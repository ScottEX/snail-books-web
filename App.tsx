import React, { useState } from 'react';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PartnerScreen from './src/screens/PartnerScreen';

export default function App() {
  const [page, setPage] = useState<'login' | 'home' | 'partner'>(
    typeof localStorage !== 'undefined' && localStorage.getItem('user') ? 'home' : 'login'
  );

  return (
    <>
      {page === 'login' && <LoginScreen onLogin={() => setPage('home')} />}
      {page === 'home' && <HomeScreen onPartner={() => setPage('partner')} onLogout={() => setPage('login')} />}
      {page === 'partner' && <PartnerScreen onBack={() => setPage('home')} />}
    </>
  );
}
