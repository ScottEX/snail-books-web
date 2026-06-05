import React, { useState, useEffect } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionKickedModal from './src/components/SessionKickedModal';
import { ThemeProvider } from './src/theme';

export default function App() {
  const [page, setPage] = useState<'login' | 'home'>(
    typeof localStorage !== 'undefined' && localStorage.getItem('user') ? 'home' : 'login'
  );

  // 全局排版：字体家族 + 数字等宽（内联样式覆盖 Tailwind）
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.style.fontFamily = '"Inter", -apple-system, "PingFang SC", sans-serif';
    el.style.fontVariantNumeric = 'tabular-nums';
  }, []);

  return (
    <ThemeProvider>
      <SessionKickedModal />
      {page === 'login' && <LoginScreen onLogin={() => setPage('home')} />}
      {page === 'home' && <HomeScreen onLogout={() => setPage('login')} />}
    </ThemeProvider>
  );
}
