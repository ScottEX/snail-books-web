#!/usr/bin/env python3
"""Post-build: inject Tailwind CDN + Google Fonts + glass CSS + idle timeout into dist/index.html"""

import sys, os, re

dist_index = os.path.join(os.path.dirname(__file__) if '__file__' in dir() else '.', 'dist', 'index.html')
if len(sys.argv) > 1:
    dist_index = sys.argv[1]

with open(dist_index, 'r') as f:
    html = f.read()

# CSS to inject (glass-morphism + background styles from production login page)
INJECT_CSS = '''
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter','Noto Sans SC',sans-serif; -webkit-font-smoothing:antialiased; }
    /* Keep #root flex for React Native Web layout — don't override */
    .bg-wrapper { position: fixed; inset: 0; z-index: 0; background: url(/img/bg.jpg) center/cover no-repeat; }
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
    @keyframes modalIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
'''

BOOT_JS = r'''<script>(function(){
  if(window.Capacitor||navigator.userAgent.indexOf('Capacitor')!==-1){
    if(!localStorage.getItem('api_base')){
      localStorage.setItem('api_base','http://8.135.58.90:8600');
    }
  }
})();</script>'''

# Idle timeout: 2 minutes no API call → redirect to login
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

# Inject idle timeout first (before any other scripts, so it wraps fetch early)
html = html.replace('<head>', '<head>\n' + IDLE_TIMEOUT_JS)

# Inject boot.js (for Capacitor config)
html = html.replace('<head>', '<head>\n' + BOOT_JS)
# Insert Tailwind CDN right after <head>
html = html.replace('<head>', '<head>\n' + INJECT_HEAD)
# Insert custom CSS into the existing expo-reset style block, or add a new one
html = html.replace('</style>', '</style>\n<style>' + INJECT_CSS + '</style>')

# Fix viewport to prevent iOS auto-zoom on input focus
html = html.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
)

# Fix title
html = html.replace('<title>snail-books-web</title>', '<title>蓝姐螺蛳粉</title>')

with open(dist_index, 'w') as f:
    f.write(html)

print(f"Injected into {dist_index}")
print(f"Size: {len(html)} bytes")
