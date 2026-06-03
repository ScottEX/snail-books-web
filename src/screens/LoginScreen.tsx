import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';

type Step = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [step, setStep] = useState<Step>('login');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [lang, setLangState] = useState(getLang());
  const [resendCooldown, setResendCooldown] = useState(0);
  const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);  // separate toggle for confirm password on register
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [devCode, setDevCode] = useState('');  // dev mode: verification code
  const codeRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { colors } = useTheme();

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('saved_login');
      if (saved) {
        setUsername(saved);
        // Restore remember preference for this saved user
        setRemember(localStorage.getItem('remember_me') === 'true');
      }
      if (localStorage.getItem('user')) onLogin();
    }
  }, []);

  // Scroll to top when error message appears (prevents message being obscured)
  useEffect(() => {
    if (msg && !msgOk) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [msg, msgOk]);

  const reset = () => { setMsg(''); setMsgOk(false); setDevCode(''); };
  const goLogin = () => {
    setStep('login'); reset();
    setPassword(''); setPassword2(''); setEmail('');
    // restore saved login username
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('saved_login');
      if (saved) setUsername(saved);
    }
  };

  const goRegister = () => {
    setStep('register'); reset();
    setUsername(''); // don't carry over saved login
  };

  // Fetch avatar when username changes (debounced)
  useEffect(() => {
    if (!username) { setAvatarUrl(''); return; }
    const timer = setTimeout(async () => {
      try {
        let resp = await fetch(`/api/users/avatar?username=${encodeURIComponent(username)}`);
        if (!resp.ok && username.includes('@')) {
          resp = await fetch(`/api/users/avatar?email=${encodeURIComponent(username)}`);
        }
        if (resp.ok) {
          const blob = await resp.blob();
          setAvatarUrl(URL.createObjectURL(blob));
        } else {
          setAvatarUrl('');
        }
      } catch { setAvatarUrl(''); }
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const validatePassword = (pw: string): string => {
    if (pw.length < 8) return t('errPwTooShort') || '8 chars min';
    if (!/[A-Za-z]/.test(pw)) return t('errPwNeedLetter') || 'needs a letter';
    if (!/[0-9]/.test(pw)) return t('errPwNeedNumber') || 'needs a number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return t('errPwNeedSpecial') || 'needs a special char';
    return '';
  };

  const validateEmail = (em: string): string => {
    if (!EMAIL_RE.test(em)) return t('errEmailInvalid') || 'Invalid email';
    return '';
  };

  const triggerShake = () => {
    setShake(true); setTimeout(() => setShake(false), 400);
  };

  const handleLogin = async () => {
    if (loading) return;
    if (!username || !password) { setMsg(t('errEmptyFields')); triggerShake(); return; }
    setLoading(true);
    try {
      const r = await api.login(username, password, remember);
      setLoading(false);
      if (r.status === 'ok') {
        if (r.token && typeof localStorage !== 'undefined') localStorage.setItem('token', r.token);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('user', r.username || username);
          localStorage.setItem('user_id', String(r.user_id || ''));
          localStorage.setItem('saved_login', username);
          localStorage.removeItem('active_tab');
          localStorage.removeItem('expense_active_tab');
        }
        try { await api.saveLang(getLang()); } catch {}
        onLogin();
      } else if (r.need_verify) {
        setEmail(r.email); setStep('verify'); setMsg('');
        setTimeout(() => codeRef.current?.focus(), 100);
      } else {
        setMsg(r.message || t('errWrongCredentials'));
        triggerShake();
      }
    } catch (e: any) {
      setLoading(false);
      setMsg(e?.message || t('errNetworkError') || '网络错误，请检查网络后重试');
    }
  };

  const handleRegister = async () => {
    if (loading) return;
    if (!username || !password || !email) { setMsg(t('errEmptyFields')); triggerShake(); return; }
    if (password !== password2) { setMsg(t('errPwMismatch') || 'Passwords mismatch'); triggerShake(); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setMsg(pwErr); triggerShake(); return; }
    const emailErr = validateEmail(email);
    if (emailErr) { setMsg(emailErr); triggerShake(); return; }
    setLoading(true);
    try {
      const r = await api.register(username, password, email);
      setLoading(false);
      if (r.status === 'ok') { setMsg(''); setMsgOk(false); setDevCode(r.dev_code || ''); setStep('verify'); setTimeout(() => codeRef.current?.focus(), 100); }
      else { setMsgOk(false); setMsg(r.message); triggerShake(); }
    } catch (e: any) {
      setLoading(false);
      setMsgOk(false);
      setMsg(e?.message || t('errNetworkError') || '网络错误，请检查网络后重试');
    }
  };

  const handleVerify = async () => {
    if (loading) return;
    if (!code) return;
    setLoading(true);
    try {
      const r = await api.verify(email, code);
      setLoading(false);
      if (r.status === 'ok') { setMsgOk(true); setMsg(r.message); setStep('login'); }
      else { setMsgOk(false); setMsg(r.message); triggerShake(); }
    } catch (e: any) {
      setLoading(false);
      setMsgOk(false);
      setMsg(e?.message || t('errNetworkError') || '网络错误，请检查网络后重试');
    }
  };

  const handleForgot = async () => {
    if (loading) return;
    if (!email) { setMsg(t('errEmptyFields')); return; }
    const emailErr = validateEmail(email);
    if (emailErr) { setMsg(emailErr); return; }
    setLoading(true);
    try {
      const r = await api.forgotPassword(email);
      setLoading(false);
      if (r.status === 'ok') { setDevCode(r.dev_code || ''); setStep('reset'); setTimeout(() => codeRef.current?.focus(), 100); }
      else setMsg(r.message);
    } catch (e: any) {
      setLoading(false);
      setMsg(e?.message || t('errNetworkError') || '网络错误，请检查网络后重试');
    }
  };

  const handleReset = async () => {
    if (loading) return;
    if (!code || !password) { setMsgOk(false); setMsg(t('errEmptyFields')); triggerShake(); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setMsgOk(false); setMsg(pwErr); triggerShake(); return; }
    setLoading(true);
    try {
      const r = await api.resetPassword(email, code, password);
      setLoading(false);
      if (r.status === 'ok') { setMsgOk(true); setMsg(t('msgResetOk')); setStep('login'); }
      else { setMsgOk(false); setMsg(r.message); triggerShake(); }
    } catch (e: any) {
      setLoading(false);
      setMsgOk(false);
      setMsg(e?.message || t('errNetworkError') || '网络错误，请检查网络后重试');
    }
  };

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }; }, []);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const r = await api.resendCode(email);
      if (r.dev_code) setDevCode(r.dev_code);
      setResendCooldown(30);
    } catch (e: any) {
      setMsg(e?.message || t('errNetworkError') || '网络错误，请检查网络后重试');
      return;
    }
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(c => { if (c <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; return 0; } return c - 1; });
    }, 1000);
  };

  const switchLang = (l: string) => { setLang(l); setLangState(l); };

  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Background layers */}
      <View style={styles.bgWrapper} />
      <View style={styles.bgOverlay} />
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* Brand */}
        <View style={styles.brand}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.logo} />
          ) : (
            <Image source={{ uri: '/img/logo.jpg' }} style={styles.logo} />
          )}
          <Text style={styles.subtitle}>{t('subtitle')}</Text>
          <View style={styles.langRow}>
            {langs.map(([l, label]) => (
              <TouchableOpacity key={l} onPress={() => switchLang(l)}>
                <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Glass Card */}
        <View style={[styles.glassCard, shake && styles.shake]}>
          {/* Message */}
          {msg ? (
            <View style={[styles.msgBox, msgOk ? styles.msgOk : styles.msgErr]}>
              <Text style={[styles.msgText, msgOk ? styles.msgOkText : styles.msgErrText]}>{msg}</Text>
            </View>
          ) : null}

          {/* Login/Register tabs */}
          {(step === 'login' || step === 'register') ? (
            <View style={styles.tabRow}>
              <TouchableOpacity onPress={goLogin} style={[styles.tabBtn, step === 'login' && styles.tabActive]}>
                <Text style={[styles.tabText, step === 'login' && styles.tabActiveText]}>{t('login')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goRegister} style={[styles.tabBtn, step === 'register' && styles.tabActive]}>
                <Text style={[styles.tabText, step === 'register' && styles.tabActiveText]}>{t('register')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* LOGIN */}
          {step === 'login' && (
            <View style={styles.formSection}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('username')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput style={[styles.textInput, { flex: 1 }]} value={username} onChangeText={setUsername}
                    placeholder={t('loginPlaceholder') || '用户名 / 邮箱'} placeholderTextColor="rgba(255,255,255,0.55)"
                    onSubmitEditing={handleLogin} />
                  {username ? (
                    <TouchableOpacity onPress={() => setUsername('')} style={{ padding: 8, marginLeft: -36 }}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round">
                        <Path d="M18 6L6 18M6 6l12 12" />
                      </Svg>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('password')}</Text>
                <View style={styles.pwWrap}>
                  <TextInput style={styles.pwInput} value={password} onChangeText={setPassword}
                    placeholder={t('password')} placeholderTextColor="rgba(255,255,255,0.55)"
                    secureTextEntry={!showPw} onSubmitEditing={handleLogin} />
                  <TouchableOpacity style={styles.pwEye} onPress={() => setShowPw(!showPw)}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      {showPw ? (
                        <>
                          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                          <Line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <Circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={handleLogin} style={styles.btnDark} disabled={loading}>
                <Text style={styles.btnDarkText}>{loading ? '...' : t('loginBtn')}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => { const next = !remember; setRemember(next); if (typeof localStorage !== 'undefined') localStorage.setItem('remember_me', String(next)); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', backgroundColor: remember ? colors.primary : 'transparent' }}>
                    {remember && <Text style={{ fontSize: FONTS.micro.size, color: colors.surface }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.5)' }}>{t('rememberMe') || '记住我'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setStep('forgot'); reset(); }}>
                  <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* REGISTER */}
          {step === 'register' && (
            <View style={styles.formSection}>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('username')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput style={[styles.textInput, { flex: 1 }]} value={username} onChangeText={setUsername}
                    placeholder={t('username')} placeholderTextColor="rgba(255,255,255,0.55)" />
                  {username ? (
                    <TouchableOpacity onPress={() => setUsername('')} style={{ padding: 8, marginLeft: -36 }}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round">
                        <Path d="M18 6L6 18M6 6l12 12" />
                      </Svg>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('email') || 'Email'}</Text>
                <TextInput style={styles.textInput} value={email} onChangeText={setEmail}
                  placeholder={t('email') || 'Email'} placeholderTextColor="rgba(255,255,255,0.55)" />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>
                  {t('password')}{' '}
                  <Text style={styles.hintText}>{t('pwHint') || '6+ chars, letter + number'}</Text>
                </Text>
                <View style={styles.pwWrap}>
                  <TextInput style={styles.pwInput} value={password} onChangeText={setPassword}
                    placeholder={t('password')} placeholderTextColor="rgba(255,255,255,0.55)" secureTextEntry={!showPw} />
                  <TouchableOpacity style={styles.pwEye} onPress={() => setShowPw(!showPw)}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      {showPw ? (
                        <>
                          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                          <Line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <Circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('confirmPassword')}</Text>
                <View style={styles.pwWrap}>
                  <TextInput style={styles.pwInput} value={password2} onChangeText={setPassword2}
                    placeholder={t('confirmPassword')} placeholderTextColor="rgba(255,255,255,0.55)"
                    secureTextEntry={!showPw2} onSubmitEditing={handleRegister} />
                  <TouchableOpacity style={styles.pwEye} onPress={() => setShowPw2(!showPw2)}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      {showPw2 ? (
                        <>
                          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                          <Line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <Circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={handleRegister} style={styles.btnDark} disabled={loading}>
                <Text style={styles.btnDarkText}>{loading ? '...' : t('registerBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goLogin}>
                <Text style={styles.forgotText}>{t('backToLogin')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* VERIFY */}
          {step === 'verify' && (
            <View style={styles.formSection}>
              <Text style={styles.verifyTitle}>{t('verifyNewTitle') || '只差最后一步啦！✨'}</Text>
              <Text style={styles.verifyBody}>
                {t('verifyNewBodyPre') || '欢迎加入柳味探秘科技！一封装有激活密码的邮件已经飞往您的邮箱：'}
                <Text style={styles.verifyEmail}>{email}</Text>
                {t('verifyNewBodyPost') || '。请前往查收并点击链接完成验证。'}
              </Text>
              {devCode !== '' && (
                <View style={styles.devCodeCard}>
                  <Text style={styles.devCodeLabel}>{t('devCodeLabel') || '🔧 Dev Mode — Verification Code'}</Text>
                  <Text style={styles.devCodeValue}>{devCode}</Text>
                </View>
              )}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('verifyCode')}</Text>
                <TextInput ref={codeRef} style={[styles.textInput, styles.codeInput]} maxLength={6} value={code} onChangeText={setCode}
                  placeholder={t('verifyCode')} placeholderTextColor="rgba(255,255,255,0.55)"
                  keyboardType="number-pad" onSubmitEditing={handleVerify} autoFocus />
              </View>
              <TouchableOpacity onPress={handleVerify} style={styles.btnRed} disabled={loading}>
                <Text style={styles.btnRedText}>{loading ? '...' : t('verifyBtn')}</Text>
              </TouchableOpacity>
              <Text style={styles.verifyHint}>
                {t('verifyNewNoEmail') || '一直没收到？别着急，您可以 '}
                <Text style={styles.verifyLink} onPress={handleResend}>{resendCooldown > 0 ? `${resendCooldown}s` : t('verifyNewResend') || '重新发送'}</Text>
                {t('verifyNewOrSpam') || ' 或检查一下垃圾箱。'}
              </Text>
              <Text style={styles.verifyHint}>
                {t('verifyNewWrongEmail') || '填错邮箱了？'}
                <Text style={styles.verifyLink} onPress={() => { setStep('register'); reset(); }}>{t('verifyNewEditEmail') || '修改邮箱地址'}</Text>
              </Text>
            </View>
          )}

          {/* FORGOT */}
          {step === 'forgot' && (
            <View style={styles.formSection}>
              <Text style={styles.infoText}>{t('forgotStep1') || 'Enter email'}</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('email') || 'Email'}</Text>
                <TextInput style={styles.textInput} value={email} onChangeText={setEmail}
                  placeholder="Email" placeholderTextColor="rgba(255,255,255,0.55)"
                  keyboardType="email-address" onSubmitEditing={handleForgot} />
              </View>
              <TouchableOpacity onPress={handleForgot} style={styles.btnDark} disabled={loading}>
                <Text style={styles.btnDarkText}>{loading ? '...' : t('forgotSendBtn') || 'Send Code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goLogin}>
                <Text style={styles.forgotText}>{t('backToLogin')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* RESET */}
          {step === 'reset' && (
            <View style={styles.formSection}>
              <Text style={styles.infoText}>
                {t('resetHint') || 'Code sent to'} <Text style={styles.infoStrong}>{email}</Text>
              </Text>
              {devCode !== '' && (
                <View style={styles.devCodeCard}>
                  <Text style={styles.devCodeLabel}>{t('devCodeLabel') || '🔧 Dev Mode — Verification Code'}</Text>
                  <Text style={styles.devCodeValue}>{devCode}</Text>
                </View>
              )}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('verifyCode')}</Text>
                <TextInput ref={codeRef} style={[styles.textInput, styles.codeInput]} maxLength={6} value={code} onChangeText={setCode}
                  placeholder={t('verifyCode')} placeholderTextColor="rgba(255,255,255,0.55)" keyboardType="number-pad" autoFocus />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('newPassword')}</Text>
                <View style={styles.pwWrap}>
                  <TextInput style={styles.pwInput} value={password} onChangeText={setPassword}
                    placeholder={t('newPassword')} placeholderTextColor="rgba(255,255,255,0.55)" secureTextEntry={!showPw} />
                  <TouchableOpacity style={styles.pwEye} onPress={() => setShowPw(!showPw)}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      {showPw ? (
                        <>
                          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                          <Line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <Circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={handleReset} style={styles.btnRed} disabled={loading}>
                <Text style={styles.btnRedText}>{loading ? '...' : t('resetBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goLogin}>
                <Text style={styles.forgotText}>{t('backToLogin')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Copyright */}
          <Text style={styles.copyright}>{t('copyright') || '© 2026 柳味探秘 · 经营查询 · 版权所有'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 24 },
  bgWrapper: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    // @ts-ignore - web-only background image
    backgroundImage: 'url(/img/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 },
  bgOverlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)', zIndex: 1 },
  content: { flex: 1, position: 'relative' as any, zIndex: 2, width: '100%', maxWidth: 380, alignSelf: 'center' },
  contentScroll: { paddingBottom: 40 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 16, overflow: 'hidden' as const, marginBottom: 20,
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 1px 3px rgba(0,0,0,.2), 0 8px 40px rgba(0,0,0,.15)',
  },
  logo: { width: 80, height: 80, borderRadius: 40, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.2), 0 8px 40px rgba(0,0,0,.15)' } as any,
  subtitle: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.6)', marginTop: 6, letterSpacing: 1 },
  langRow: { flexDirection: 'row', gap: 4, marginTop: 12 },
  langBtn: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.4)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  langActive: { color: colors.surface, backgroundColor: 'rgba(255,255,255,0.15)' },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 16, padding: 28,
    // @ts-ignore - web-only
    backdropFilter: 'blur(24px)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  shake: {}, // animation handled by CSS class
  msgBox: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  msgOk: { backgroundColor: withAlpha(colors.success, 0.3) },
  msgErr: { backgroundColor: withAlpha(colors.danger, 0.12) },
  msgText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight },
  msgOkText: { color: withAlpha(colors.success, 0.1) },
  msgErrText: { color: colors.danger },
  tabRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, padding: 4, marginBottom: 16,
    // @ts-ignore
    backdropFilter: 'blur(8px)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: 'rgba(255,255,255,0.65)' },
  tabActiveText: { color: colors.surface },
  formSection: { gap: 16 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: 'rgba(255,255,255,0.6)' },
  hintText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: 'rgba(255,255,255,0.3)' },
  pwWrap: { position: 'relative' as any },
  pwInput: {
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    paddingRight: 44, fontSize: FONTS.body.size, color: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    // @ts-ignore - web-only style
    backdropFilter: 'blur(8px)', outlineStyle: 'none' as any,
  },
  pwEye: {
    position: 'absolute' as any, right: 0, top: 0, bottom: 0,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
  },
  pwEyeText: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.45)' },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: FONTS.body.size, color: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    // @ts-ignore - web-only style
    backdropFilter: 'blur(8px)', outlineStyle: 'none' as any,
  },
  codeInput: { textAlign: 'center', letterSpacing: 6 },
  btnDark: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12,
    // @ts-ignore
    backdropFilter: 'blur(8px)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  btnDarkText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.surface, letterSpacing: 1 },
  btnRed: {
    backgroundColor: withAlpha(colors.primary, 0.7), borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12,
    // @ts-ignore
    backdropFilter: 'blur(8px)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  btnRedText: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.surface, letterSpacing: 1 },
  forgotText: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 8 },
  disabledText: { opacity: 0.3 },
  infoText: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  infoStrong: { fontWeight: FONTS.subBold.weight, color: colors.surface },
  verifyTitle: { fontSize: FONTS.sub.size, fontWeight: FONTS.subBold.weight, color: colors.surface, textAlign: 'center', marginBottom: 12 },
  verifyBody: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 20 },
  verifyEmail: { fontWeight: FONTS.subBold.weight, color: colors.surface },
  verifyHint: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 18 },
  verifyLink: { color: colors.primary, fontWeight: FONTS.micro.weight },
  devCodeCard: {
    backgroundColor: withAlpha(colors.warning, 0.15), borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: withAlpha(colors.warning, 0.3),
    // @ts-ignore
    backdropFilter: 'blur(8px)',
  },
  devCodeLabel: { fontSize: FONTS.micro.size, color: colors.warning, fontWeight: FONTS.micro.weight, marginBottom: 8 },
  devCodeValue: { fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: colors.surface, letterSpacing: 8 },
  copyright: { fontSize: FONTS.micro.size, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 20 },
});
