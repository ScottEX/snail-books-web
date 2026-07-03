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
    body { font-family:'Inter','Noto Sans SC',sans-serif; -webkit-font-smoothing:antialiased; background:#FAF9F6; }
    input, textarea { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; touch-action: manipulation; }
    /* Keep #root flex for React Native Web layout — don't override */
    .bg-wrapper { position: fixed; inset: 0; z-index: 0; background: url(/img/bg.jpg?v=3) center/cover no-repeat; }
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


# ── PWA tags (no apple-mobile-web-app-capable — avoids iOS fullscreen white gap) ──
PWA_TAGS = '''
    <meta name="theme-color" content="#1A1A2E" />
    <meta name="apple-mobile-web-app-title" content="探秘" />
    <link rel="apple-touch-icon" href="/icon-180.png?v=4" />
    <link rel="manifest" href="/manifest.json?v=4" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
'''

# Fonts: non-blocking <link> — avoids @import blocking splash CSS rendering on iOS Safari
FONT_LINK = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&amp;family=Noto+Sans+SC:wght@300;400;500;700&amp;family=Playfair+Display:ital,wght@0,400;0,500;1,400&amp;family=DM+Mono:wght@300;400&amp;display=swap" media="print" onload="this.media=\'all\'">'

# Inject idle timeout first (before any other scripts, so it wraps fetch early)
html = html.replace('<head>', '<head>\n' + IDLE_TIMEOUT_JS)

# Inject boot.js (for Capacitor config)
html = html.replace('<head>', '<head>\n' + BOOT_JS)
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
SPLASH_HTML = """<div id="splash" style="position:fixed;inset:0;z-index:9999;background:#FAF9F6;opacity:1;overflow:hidden;-webkit-font-smoothing:antialiased">
<div style="position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(ellipse 360px 260px at 50% 20%, rgba(201,169,110,.07) 0%, transparent 70%),radial-gradient(ellipse 280px 200px at 80% 85%, rgba(122,26,26,.05) 0%, transparent 70%)"></div>
<div style="position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(180,174,160,.12) 1px, transparent 1px),linear-gradient(90deg, rgba(180,174,160,.12) 1px, transparent 1px);background-size:32px 32px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)"></div>
<div style="position:absolute;width:14px;height:14px;top:80px;left:36px;border-top:1px solid #E4E0D6;border-left:1px solid #E4E0D6"></div>
<div style="position:absolute;width:14px;height:14px;top:80px;right:36px;border-top:1px solid #E4E0D6;border-right:1px solid #E4E0D6"></div>
<div style="position:absolute;width:14px;height:14px;bottom:110px;left:36px;border-bottom:1px solid #E4E0D6;border-left:1px solid #E4E0D6"></div>
<div style="position:absolute;width:14px;height:14px;bottom:110px;right:36px;border-bottom:1px solid #E4E0D6;border-right:1px solid #E4E0D6"></div>
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;position:relative;z-index:2;margin-top:-32px">
<div style="position:relative;width:96px;height:96px;margin-bottom:28px">
<div style="position:absolute;inset:-16px;border-radius:50%;background:radial-gradient(circle, rgba(201,169,110,.14) 0%, transparent 70%);animation:glowPulse 3s ease-in-out 1.2s infinite"></div>
<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="48" cy="48" r="40" stroke="#C9A96E" stroke-width="1" opacity=".4" stroke-dasharray="200" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .5s forwards"/>
<path d="M24 42 Q24 66 48 68 Q72 66 72 42" stroke="#7A1A1A" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="200" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .65s forwards"/>
<path d="M20 42 L76 42" stroke="#7A1A1A" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="200" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .78s forwards"/>
<path d="M38 34 Q40 28 38 22" stroke="#C9A96E" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="60" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .96s forwards"/>
<path d="M48 32 Q50 26 48 20" stroke="#C9A96E" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="60" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .96s forwards"/>
<path d="M58 34 Q60 28 58 22" stroke="#C9A96E" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="60" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) 1.05s forwards"/>
<circle cx="32" cy="78" r="3" stroke="#7A1A1A" stroke-width="1.2" fill="#FAF9F6" stroke-dasharray="200" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .88s forwards"/>
<circle cx="48" cy="78" r="3" stroke="#C9A96E" stroke-width="1.2" fill="#FAF9F6" stroke-dasharray="200" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .88s forwards"/>
<circle cx="64" cy="78" r="3" stroke="#7A1A1A" stroke-width="1.2" fill="#FAF9F6" stroke-dasharray="200" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .88s forwards"/>
<line x1="35" y1="78" x2="45" y2="78" stroke="#B0ADA5" stroke-width="1" stroke-dasharray="2 2" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .88s forwards"/>
<line x1="51" y1="78" x2="61" y2="78" stroke="#B0ADA5" stroke-width="1" stroke-dasharray="2 2" stroke-dashoffset="200" style="animation:drawIn .8s cubic-bezier(.4,0,.2,1) .88s forwards"/>
</svg>
</div>
<div style="text-align:center;opacity:0;animation:fadeUp .7s cubic-bezier(.22,.88,.4,1) .95s forwards">
<div style="font-family:'DM Mono',monospace;font-size:10px;font-weight:300;letter-spacing:.28em;text-transform:uppercase;color:#A88040;margin-bottom:6px">Liuwei &middot; Supply Chain</div>
<div style="font-family:'Playfair Display',serif;font-size:34px;font-weight:400;color:#7A1A1A;letter-spacing:.12em;line-height:1">柳味探秘</div>
<div style="font-family:'Noto Sans SC',sans-serif;font-size:11px;font-weight:300;color:#B0ADA5;letter-spacing:.18em;margin-top:18px;opacity:0;animation:fadeIn .6s ease 1.5s forwards">生活不简单，尽量简单过～</div>
</div>
<div style="margin-top:40px;text-align:center;opacity:0;animation:fadeIn .6s ease 1.7s forwards">
<span style="font-family:'Noto Sans SC',sans-serif;font-size:12px;font-weight:400;color:#B0ADA5;letter-spacing:.1em;display:flex;align-items:center;gap:10px;justify-content:center"><span style="width:24px;height:1px;background:#E4E0D6;display:inline-block"></span>每一笔流水，清晰可查<span style="width:24px;height:1px;background:#E4E0D6;display:inline-block"></span></span>
</div>
<div style="position:absolute;bottom:0;left:0;right:0;padding-bottom:52px;display:flex;flex-direction:column;align-items:center;gap:14px;z-index:2;opacity:0;animation:fadeIn .6s ease 1.9s forwards">
<div style="width:56px;height:2px;background:#E4E0D6;border-radius:1px;overflow:hidden"><div style="height:100%;width:100%;background:linear-gradient(90deg,#A88040,#C9A96E);border-radius:1px;animation:loadFill 1.8s cubic-bezier(.4,0,.2,1) 2s forwards;width:0%"></div></div>
<div style="font-family:'DM Mono',monospace;font-size:9px;font-weight:300;letter-spacing:.2em;text-transform:uppercase;color:#B0ADA5">Loading</div>
</div>
</div>
</div>"""
SPLASH_CSS = """
@keyframes drawIn{to{stroke-dashoffset:0}}
@keyframes glowPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes fadeUp{to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{to{opacity:1}}
@keyframes loadFill{to{width:100%}}
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
