#!/usr/bin/env python3
"""Post-build: inject Tailwind CDN + Google Fonts + glass CSS + idle timeout + PWA into dist/index.html"""

import sys, os, re, shutil

dist_index = os.path.join(os.path.dirname(__file__) if '__file__' in dir() else '.', 'dist', 'index.html')
if len(sys.argv) > 1:
    dist_index = sys.argv[1]

dist_dir = os.path.dirname(dist_index)

# ── Copy PWA icons to dist/ ──
web_dir = os.path.join(os.path.dirname(dist_index) if '__file__' not in dir() else '.', 'web')
if os.path.isdir(web_dir):
    for f in ['icon-180.png', 'icon-192.png', 'icon-512.png', 'favicon-32.png', 'manifest.json']:
        src = os.path.join(web_dir, f)
        dst = os.path.join(dist_dir, f)
        if os.path.isfile(src):
            shutil.copy2(src, dst)
            print(f"Copied {f} to dist/")

with open(dist_index, 'r') as f:
    html = f.read()

# CSS to inject (glass-morphism + background styles from production login page)
INJECT_CSS = '''
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter','Noto Sans SC',sans-serif; -webkit-font-smoothing:antialiased; }
    input, textarea { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; touch-action: manipulation; }
    /* Keep #root flex for React Native Web layout — don't override */
    .bg-wrapper { position: fixed; inset: 0; z-index: 0; background: url(/img/bg.jpg?v=2) center/cover no-repeat; }
    .bg-overlay { position: fixed; inset: 0; z-index: 1; background: rgba(0,0,0,0.15); }
    .bg-content { position: relative; z-index: 2; }
    .glass-card { background: rgba(255,255,255,0.10); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.10); text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .glass-input { background: rgba(255,255,255,0.10); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.10); color: #fff; }
    .glass-input::placeholder { color: rgba(255,255,255,0.55); }
    .glass-input:focus { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.10); box-shadow: 0 0 0 3px rgba(255,255,255,0.10); outline: none; }
    .glass-tabs { background: rgba(255,255,255,0.10); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.10); }
    .tab-active { background: rgba(255,255,255,0.10); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .tab-inactive { color: rgba(255,255,255,0.65); }
    .btn-dark { background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.10); color: #fff; }
    .btn-dark:hover { background: rgba(0,0,0,0.7); }
    .btn-red { background: rgba(139,30,34,0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.10); color: #fff; }
    .btn-red:hover { background: rgba(139,30,34,0.85); }
    .lang-btn { color: rgba(255,255,255,0.10); font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer; transition: all .2s; }
    .lang-btn:hover { color: rgba(255,255,255,0.10); background: rgba(255,255,255,0.10); }
    .lang-btn.active { color: #fff; background: rgba(255,255,255,0.10); }
    .shake { animation: shake .4s ease; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
    .fade-in { animation: fadeIn .4s ease; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes modalIn { from{opacity:0;transform:translateY(-300px)} to{opacity:1;transform:translateY(0)} }
'''

BOOT_JS = r'''<script>(function(){
  if(window.Capacitor||navigator.userAgent.indexOf('Capacitor')!==-1){
    if(!localStorage.getItem('api_base')){
      localStorage.setItem('api_base','http://8.135.58.90:8600');
    }
  }
})();</script>'''

# Idle timeout: 3 hours no API call → redirect to login
IDLE_TIMEOUT_JS = r'''<script>
(function(){
  var IDLE_MS = 180*60*1000; // 3 hours
  var lastActivity = Date.now();

  // Hook fetch to track API calls
  var _fetch = window.fetch;
  window.fetch = function(){
    lastActivity = Date.now();
    return _fetch.apply(this, arguments);
  };

  // Check every 10 seconds
  setInterval(function(){
    if(Date.now() - lastActivity > IDLE_MS){
      localStorage.removeItem('user');
      localStorage.removeItem('active_tab');
      window.location.href = '/login';
    }
  }, 10000);
})();
</script>'''

INJECT_HEAD = '''
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: { 'inter': ['Inter', 'sans-serif'], 'noto': ['Noto Sans SC', 'sans-serif'] }
          }
        }
      }
    </script>
'''

# ── PWA tags (no apple-mobile-web-app-capable — avoids iOS fullscreen white gap) ──
PWA_TAGS = '''
    <meta name="theme-color" content="#1A1A2E" />
    <meta name="apple-mobile-web-app-title" content="探秘" />
    <link rel="apple-touch-icon" href="/icon-180.png?v=3" />
    <link rel="manifest" href="/manifest.json?v=3" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
'''

# Fonts: non-blocking <link> — avoids @import blocking splash CSS rendering on iOS Safari
FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&amp;family=Noto+Sans+SC:wght@300;400;500;700&amp;display=swap" media="print" onload="this.media=\'all\'">'

# Inject idle timeout first (before any other scripts, so it wraps fetch early)
html = html.replace('<head>', '<head>\n' + IDLE_TIMEOUT_JS)

# Inject boot.js (for Capacitor config)
html = html.replace('<head>', '<head>\n' + BOOT_JS)
# Insert Tailwind CDN before </body> — not in <head>, to avoid blocking splash rendering
html = html.replace('</body>', INJECT_HEAD + '\n</body>')
# Insert PWA tags
html = html.replace('<head>', '<head>\n' + PWA_TAGS)
# Insert non-blocking font link
html = html.replace('<head>', '<head>\n' + FONT_LINK)
# Insert custom CSS into the existing expo-reset style block, or add a new one
html = html.replace('</style>', '</style>\n<style>' + INJECT_CSS + '</style>')

# Fix viewport to prevent iOS auto-zoom on input focus
html = html.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
)

# Fix title
html = html.replace('<title>snail-books-web</title>', '<title>探秘</title>')

# ── Splash screen: shown immediately, closed by App ready signal ──
SPLASH_HTML = """<div id="splash" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#FBF7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;opacity:1">
<div style="text-align:center">
<div style="position:relative;width:56px;height:56px;margin:0 auto">
<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;animation:bounce .6s ease-in-out infinite,frameA .4s steps(1) infinite">🐱</span>
<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;animation:bounce .6s ease-in-out infinite,frameB .4s steps(1) infinite">🐈</span>
</div>
<div style="font-size:18px;font-weight:600;color:#5C3D2E;margin-top:16px">探秘</div>
<div style="margin-top:12px;display:flex;gap:6px;justify-content:center">
<span style="width:6px;height:6px;border-radius:50%;background:#8B7355;animation:dot 1.2s ease-in-out infinite"></span>
<span style="width:6px;height:6px;border-radius:50%;background:#8B7355;animation:dot 1.2s ease-in-out .2s infinite"></span>
<span style="width:6px;height:6px;border-radius:50%;background:#8B7355;animation:dot 1.2s ease-in-out .4s infinite"></span>
</div>
</div>
</div>"""
SPLASH_CSS = """
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes frameA{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes frameB{0%,49%{opacity:0}50%,100%{opacity:1}}
@keyframes dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
"""
SPLASH_JS = """<script>
(function(){
  var s=document.getElementById('splash');
  var TIMEOUT=20000,start=Date.now();
  var check=setInterval(function(){
    if(window.__appReady){
      clearInterval(check);
      s.style.transition='opacity .3s';
      s.style.opacity='0';
      setTimeout(function(){s.remove()},300);
    }else if(Date.now()-start>TIMEOUT){
      clearInterval(check);
      s.innerHTML='<div style="text-align:center"><div style="font-size:48px;opacity:.4">🐱</div><div style="font-size:15px;color:#5C3D2E;margin-top:16px;font-weight:600">加载超时</div><div style="margin-top:10px;font-size:13px;color:#8B7355;cursor:pointer;text-decoration:underline" onclick="location.reload()">点击重试</div></div>';
    }
  },200);
})();
</script>"""

html = html.replace('</style>', '</style>\n<style>' + SPLASH_CSS + '</style>')
html = html.replace('<body>', '<body>\n' + SPLASH_HTML)
html = html.replace('</body>', SPLASH_JS + '\n</body>')

with open(dist_index, 'w') as f:
    f.write(html)

print(f"Injected into {dist_index}")
print(f"Size: {len(html)} bytes")
