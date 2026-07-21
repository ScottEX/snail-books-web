import { useState, useEffect, useLayoutEffect } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionKickedModal from './src/components/SessionKickedModal';
import { ThemeProvider, CONTENT_MAX_WIDTH } from './src/theme';
import { LangProvider } from './src/i18n';

// Parse a #/preview-pdf?… hash into { id, number } or null.
// The PdfPreview page now lives inside HomeScreen's pageStack
// (see HomeScreen.renderSubPage → 'pdf') so it inherits the same
// SlideScreen push/pop animation + frosted header as every other
// sub-page. App.tsx only owns the URL → route-state bridge.
function readPreviewHash(): { id: number; number: number } | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.hash.match(/^#\/preview-pdf\?id=(\d+)(?:&.*)?$/);
  if (!m) return null;
  const qs = window.location.hash.split('?')[1] || '';
  const num = parseInt(new URLSearchParams(qs).get('number') || '0', 10);
  return { id: parseInt(m[1], 10), number: num };
}

export default function App() {
  const [page, setPage] = useState<'login' | 'home'>(() => {
    if (typeof localStorage === 'undefined') return 'login';
    return localStorage.getItem('user') ? 'home' : 'login';
  });
  // appKey is bumped whenever the user changes (login / logout /
  // session-kicked). The whole <ThemeProvider> subtree uses it as a
  // React key so that every child (including HomeScreen,
  // ProfileScreen, etc.) is fully re-mounted, picking up the new
  // user's per-user preferences (language, theme) that
  // ThemeProvider pulls from the server on mount.
  //
  // Without this, components that capture the previous user's
  // curLang / theme via useState(getLang()) at mount would keep
  // showing the old user's settings after a new user signs in.
  const [appKey, setAppKey] = useState(0);

  // Hash-route preview-pdf?  We use hash routing (not history.pushState)
  // because the SPA shell never sees the file:// fallback for unknown
  // paths — the server only ever serves index.html. Hash changes are
  // picked up via 'hashchange' and don't collide with HomeScreen's
  // existing popstate listener (which handles browser-back over the
  // pageStack). Reading window.location.hash here is safe during SSR-
  // style checks because we guard with `typeof window !== 'undefined'`.
  const [previewRoute, setPreviewRoute] = useState<{ id: number; number: number } | null>(readPreviewHash);
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => setPreviewRoute(readPreviewHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const closePreview = () => {
    if (typeof window !== 'undefined') {
      // Replace current entry instead of pushing a new one,
      // so stale PDF hash entries don't linger in history.
      history.replaceState(null, '', window.location.pathname + window.location.search);
      setPreviewRoute(null);
    }
  };

  // 全局排版：字体家族 + 数字等宽（内联样式覆盖 Tailwind）
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.style.fontFamily = '"Inter", -apple-system, "PingFang SC", sans-serif';
    el.style.fontVariantNumeric = 'tabular-nums';
    // One-shot: hide scrollbars on elements with class .no-scrollbar
    if (!document.getElementById('no-scrollbar-style-v2')) {
      const s = document.createElement('style');
      s.id = 'no-scrollbar-style-v2';
      s.textContent = '.no-scrollbar ::-webkit-scrollbar{display:none!important}.no-scrollbar,.no-scrollbar *{scrollbar-width:none!important}';
      document.head.appendChild(s);
    }
  }, []);

  // 全局页面宽度限制（登录页 & 首页统一）
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.maxWidth = `${CONTENT_MAX_WIDTH}px`;
    document.body.style.margin = '0 auto';
    document.body.style.overflow = 'hidden';
  }, []);

  // Listen for user state changes (401 handler, login, logout).
  // Re-evaluate page AND bump appKey so the ThemeProvider subtree
  // remounts and ThemeProvider re-pulls the new user's lang/theme
  // from server. The 401 handler also dispatches 'app:user-change'
  // (to clear the stale localStorage.user and show
  // SessionKickedModal). When that fires, ThemeProvider remounts
  // and its useEffect sees localStorage.user is empty (just cleared
  // by 401) and short-circuits, so no second fetch is made — this
  // breaks the loop that caused the login-screen flicker on the
  // previous attempt.
  //
  // IMPORTANT: SessionKickedModal sits OUTSIDE the keyed
  // <ThemeProvider> subtree. If it were inside, the appKey++ would
  // unmount the modal instance and reset its useState(visible) to
  // false, swallowing the kick notification. Keeping it outside
  // preserves visible=true across the remount and the modal
  // continues to display after the page flips back to 'login'.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const onUserChange = () => {
      setAppKey((k) => k + 1);
      setPage(localStorage.getItem('user') ? 'home' : 'login');
    };
    window.addEventListener('app:user-change', onUserChange);
    return () => window.removeEventListener('app:user-change', onUserChange);
  }, []);

  // Preload background image into browser cache; LoginScreen/HomeScreen
  // will signal __appReady once the actual background is rendered.
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem('bg-image');
      if (cached && cached !== '/img/bg.jpg?v=3') {
        const img = new Image(); img.src = cached;
      } else {
        const img = new Image(); img.src = '/img/bg.jpg?v=3';
      }
    } catch {}

    // Safety timeout — if no screen signals __appReady within 8s, release splash
    setTimeout(() => {
      if (!(window as any).__appReady) (window as any).__appReady = true;
    }, 8000);
  }, []);

  return (
    <LangProvider>
      {/* SessionKickedModal is rendered outside the keyed ThemeProvider
          subtree so its visible state survives the user-change remount. */}
      <SessionKickedModal />
      <ThemeProvider key={appKey}>
        {page === 'login' && <LoginScreen onLogin={() => {
          // Dispatch first so ThemeProvider's listener fires in the
          // same tick and pulls the new user's lang/theme. Then
          // switch to the home page.
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('app:user-change'));
          }
          setPage('home');
        }} />}
        {page === 'home' && (
          <HomeScreen
            onLogout={() => {
              let savedLogin = '', rememberMe = '', lang = '', apiBase = '',
                  webauthnBound = '', webauthnUser = '', webauthnCredentialId = '',
                  webauthnUserIdB64 = '', themeId = '', bgImage = '';
              try {
                savedLogin = localStorage.getItem('saved_login') || '';
                rememberMe = localStorage.getItem('remember_me') || '';
                lang = localStorage.getItem('lang') || '';
                apiBase = localStorage.getItem('api_base') || '';
                webauthnBound = localStorage.getItem('webauthn_bound') || '';
                webauthnUser = localStorage.getItem('webauthn_user') || '';
                webauthnCredentialId = localStorage.getItem('webauthn_credential_id') || '';
                webauthnUserIdB64 = localStorage.getItem('webauthn_user_id_b64') || '';
                // Theme is stored per-user: snail-books-theme-{uid} when logged
                // in, snail-books-theme when logged out.
                { const uid = localStorage.getItem('user_id');
                  if (uid) themeId = localStorage.getItem('snail-books-theme-' + uid) || ''; }
                bgImage = localStorage.getItem('bg-image') || '';
                localStorage.clear();
                sessionStorage.clear();
                if (savedLogin) localStorage.setItem('saved_login', savedLogin);
                if (rememberMe) localStorage.setItem('remember_me', rememberMe);
                if (lang) localStorage.setItem('lang', lang);
                if (apiBase) localStorage.setItem('api_base', apiBase);
                if (webauthnBound) localStorage.setItem('webauthn_bound', webauthnBound);
                if (webauthnUser) localStorage.setItem('webauthn_user', webauthnUser);
                if (webauthnCredentialId) localStorage.setItem('webauthn_credential_id', webauthnCredentialId);
                if (webauthnUserIdB64) localStorage.setItem('webauthn_user_id_b64', webauthnUserIdB64);
                if (themeId) localStorage.setItem('snail-books-theme', themeId);
                if (bgImage) localStorage.setItem('bg-image', bgImage);
              } catch {}
              // Clear history.state so stale sub-page stack isn't restored on next login
              try { history.replaceState(null, '', location.href); } catch {}
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('app:user-change'));
              }
              setPage('login');
            }}
            previewRoute={previewRoute}
            onClosePreview={closePreview}
          />
        )}
      </ThemeProvider>
    </LangProvider>
  );
}
