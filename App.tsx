import React, { useState, useEffect } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionKickedModal from './src/components/SessionKickedModal';
import { ThemeProvider } from './src/theme';
import { LangProvider } from './src/i18n';

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
        {page === 'home' && <HomeScreen onLogout={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('app:user-change'));
          }
          setPage('login');
        }} />}
      </ThemeProvider>
    </LangProvider>
  );
}
