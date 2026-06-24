import './src/polyfills/localStorage';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { ThemeProvider } from './src/theme';
import { LangProvider } from './src/i18n';
import { onSessionKicked } from './src/api/client';

export default function App() {
  const [page, setPage] = useState<'login' | 'home'>('login');
  const [appKey, setAppKey] = useState(0);

  // Check localStorage on mount
  useEffect(() => {
    try {
      if (localStorage.getItem('user')) setPage('home');
    } catch {}
  }, []);

  // 401 / account disabled → force login
  useEffect(() => {
    const unsub = onSessionKicked(() => {
      setAppKey((k) => k + 1);
      setPage('login');
    });
    return unsub;
  }, []);

  const goHome = useCallback(() => setPage('home'), []);
  const goLogin = useCallback(() => {
    // Preserve lang across logout
    let lang = '';
    try {
      lang = localStorage.getItem('lang') || '';
      localStorage.clear();
      if (lang) localStorage.setItem('lang', lang);
    } catch {}
    setAppKey((k) => k + 1);
    setPage('login');
  }, []);

  return (
    <SafeAreaProvider>
      <LangProvider>
        <ThemeProvider key={appKey}>
          {page === 'login' && <LoginScreen onLogin={goHome} />}
          {page === 'home' && <HomeScreen onLogout={goLogin} />}
        </ThemeProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
