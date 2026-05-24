import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';

type Step = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<Step>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [lang, setLangState] = useState(getLang());

  const reset = () => { setMsg(''); setMsgOk(false); };
  const goLogin = () => { setStep('login'); reset(); };

  const handleLogin = async () => {
    if (!username || !password) return setMsg(t('errEmptyFields'));
    const r = await api.login(username, password);
    if (r.status === 'ok') {
      if (r.token) localStorage.setItem('token', r.token);
      localStorage.setItem('user', username);
      onLogin();
    } else if (r.need_verify) {
      setEmail(r.email); setStep('verify'); setMsg('');
    } else {
      setMsg(r.message || t('errWrongCredentials'));
    }
  };

  const handleRegister = async () => {
    if (!username || !password || !email) return setMsg(t('errEmptyFields'));
    const r = await api.register(username, password, email);
    if (r.status === 'ok') { setMsgOk(true); setMsg(r.message); setStep('verify'); }
    else setMsg(r.message);
  };

  const handleVerify = async () => {
    if (!code) return;
    const r = await api.verify(email, code);
    if (r.status === 'ok') { setMsgOk(true); setMsg(t('msgVerifyOk')); setStep('login'); }
    else setMsg(r.message);
  };

  const handleForgot = async () => {
    if (!email) return setMsg(t('errEmptyFields'));
    const r = await api.forgotPassword(email);
    if (r.status === 'ok') { setMsgOk(true); setMsg(r.message); setStep('reset'); }
    else setMsg(r.message);
  };

  const handleReset = async () => {
    if (!code || !password) return setMsg(t('errEmptyFields'));
    const r = await api.resetPassword(email, code, password);
    if (r.status === 'ok') { setMsgOk(true); setMsg(r.message); setStep('login'); }
    else setMsg(r.message);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('appTitle')}</Text>
      <Text style={styles.subtitle}>{t('subtitle')}</Text>

      {/* Lang switcher */}
      <View style={styles.langRow}>
        {langs.map(([l, label]) => (
          <TouchableOpacity key={l} onPress={() => { setLang(l); setLangState(l); }}>
            <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Step tabs */}
      {step === 'login' || step === 'register' ? (
        <View style={styles.tabRow}>
          <TouchableOpacity onPress={goLogin}>
            <Text style={[styles.tab, step === 'login' && styles.tabActive]}>{t('login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep('register'); reset(); }}>
            <Text style={[styles.tab, step === 'register' && styles.tabActive]}>{t('register')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Message */}
      {msg ? <Text style={[styles.msg, msgOk && styles.msgOk]}>{msg}</Text> : null}

      {/* Fields */}
      {step === 'login' && (
        <>
          <TextInput style={styles.input} placeholder={t('username')} value={username} onChangeText={setUsername} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#999" />
          <TouchableOpacity style={styles.btn} onPress={handleLogin}><Text style={styles.btnText}>{t('loginBtn')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep('forgot'); reset(); }}>
            <Text style={styles.link}>{t('forgotPassword')}</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'register' && (
        <>
          <TextInput style={styles.input} placeholder={t('username')} value={username} onChangeText={setUsername} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder={t('password')} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholderTextColor="#999" />
          <TouchableOpacity style={styles.btn} onPress={handleRegister}><Text style={styles.btnText}>{t('registerBtn')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={goLogin}><Text style={styles.link}>{t('backToLogin')}</Text></TouchableOpacity>
        </>
      )}

      {step === 'verify' && (
        <>
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder={t('verifyCode')} value={code} onChangeText={setCode} placeholderTextColor="#999" />
          <TouchableOpacity style={styles.btn} onPress={handleVerify}><Text style={styles.btnText}>{t('verifyBtn')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => api.resendCode(email)}><Text style={styles.link}>{t('resendCode')}</Text></TouchableOpacity>
        </>
      )}

      {step === 'forgot' && (
        <>
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} placeholderTextColor="#999" />
          <TouchableOpacity style={styles.btn} onPress={handleForgot}><Text style={styles.btnText}>{t('forgotSendBtn')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={goLogin}><Text style={styles.link}>{t('backToLogin')}</Text></TouchableOpacity>
        </>
      )}

      {step === 'reset' && (
        <>
          <TextInput style={styles.input} placeholder={t('verifyCode')} value={code} onChangeText={setCode} placeholderTextColor="#999" />
          <TextInput style={styles.input} placeholder={t('newPassword')} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#999" />
          <TouchableOpacity style={styles.btn} onPress={handleReset}><Text style={styles.btnText}>{t('resetBtn')}</Text></TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FAFAFA', paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', color: '#8B1E22', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#999', marginBottom: 16 },
  langRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  langBtn: { fontSize: 12, color: '#999', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB' },
  langActive: { color: '#8B1E22', borderColor: '#8B1E22', fontWeight: '600' },
  tabRow: { flexDirection: 'row', gap: 0, marginBottom: 16 },
  tab: { fontSize: 14, color: '#999', paddingHorizontal: 20, paddingVertical: 6, borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { color: '#8B1E22', borderColor: '#8B1E22', fontWeight: '600' },
  input: { width: 260, height: 42, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 10, paddingHorizontal: 14, fontSize: 14, marginBottom: 10, backgroundColor: '#fff', color: '#333' },
  btn: { width: 260, height: 42, backgroundColor: '#8B1E22', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { fontSize: 12, color: '#8B1E22', marginTop: 4 },
  msg: { fontSize: 12, color: '#DC2626', marginBottom: 8, textAlign: 'center' },
  msgOk: { color: '#16A34A' },
});
