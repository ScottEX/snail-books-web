import React, { useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import { useIdleTimeout } from './src/hooks/useIdleTimeout';

export default function App() {
  const [page, setPage] = useState<'login' | 'home'>(
    typeof localStorage !== 'undefined' && localStorage.getItem('user') ? 'home' : 'login'
  );

  useIdleTimeout(() => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  }, 2); // TEST: 2 minutes (change back to 120 for production)

  return (
    <>
      {page === 'login' && <LoginScreen onLogin={() => setPage('home')} />}
      {page === 'home' && <HomeScreen onLogout={() => setPage('login')} />}
    </>
  );
}
