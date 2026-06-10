import React, { useState, useEffect } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionKickedModal from './src/components/SessionKickedModal';
import { ThemeProvider } from './src/theme';
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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => setPreviewRoute(readPreviewHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const closePreview = () => {
    if (typeof window !== 'undefined') {
      // Drop the hash without leaving the page. Using
      // history.pushState + replaceState keeps the browser back
      // stack clean: back from a fresh empty hash lands on the
      // previous page in the SPA, not on the previous URL.
      history.pushState(null, '', window.location.pathname + window.location.search);
      setPreviewRoute(null);
    }
  };

  // 全局排版：字体家族 + 数字等宽（内联样式覆盖 Tailwind）
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.style.fontFamily = '"Inter", -apple-system, "PingFang SC", sans-serif';
    el.style.fontVariantNumeric = 'tabular-nums';
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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onUserChange = () => {
      setAppKey((k) => k + 1);
      setPage(localStorage.getItem('user') ? 'home' : 'login');
    };
    window.addEventListener('app:user-change', onUserChange);
    return () => window.removeEventListener('app:user-change', onUserChange);
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
              let savedLogin = '', rememberMe = '';
              try {
                savedLogin = localStorage.getItem('saved_login') || '';
                rememberMe = localStorage.getItem('remember_me') || '';
                localStorage.clear();
                sessionStorage.clear();
                if (savedLogin) localStorage.setItem('saved_login', savedLogin);
                if (rememberMe) localStorage.setItem('remember_me', rememberMe);
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
