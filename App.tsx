import React, { useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { ThemeProvider } from './src/theme';

export default function App() {
  const [page, setPage] = useState<'login' | 'home'>(
    typeof localStorage !== 'undefined' && localStorage.getItem('user') ? 'home' : 'login'
  );

  return (
    <ThemeProvider>
      {page === 'login' && <LoginScreen onLogin={() => setPage('home')} />}
      {page === 'home' && <HomeScreen onLogout={() => setPage('login')} />}
    </ThemeProvider>
  );
}
