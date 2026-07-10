import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput, Switch, Animated } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SVGGradient, Stop, Rect } from 'react-native-svg';
import { t, getLang, useLang } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { MODAL_CARD_RADIUS } from '../sharedStyles';
import { FONTS } from '../theme';
import { validateEmail } from '../utils/validation';
import { useToast } from '../hooks/useToast';

// Base64url helpers for WebAuthn
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 ? 4 - (base64.length % 4) : 0;
  const binary = atob(base64 + '='.repeat(pad));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

import ThemePickerModal from '../components/ThemePickerModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import ModalOverlay from '../components/ModalOverlay';
import FullscreenOverlay from '../components/FullscreenOverlay';
import LoadingSpinner from '../components/LoadingSpinner';
import BackArrow from '../components/icons/BackArrow';
import CameraIcon from '../components/icons/CameraIcon';
import { getCurrentUser, getCurrentUserId } from '../utils/storage';
import { useProfileForms } from './profile/useProfileForms';
import { useSignatureForm } from './profile/useSignatureForm';
import { useCoverCrop } from './profile/useCoverCrop';
import { useAvatarCrop } from './profile/useAvatarCrop';
import { useSwipeBack } from '../hooks/useSwipeBack';
import ButtonPair from '../components/ButtonPair';
import CloseButton from '../components/CloseButton';
import TextField from '../components/TextField';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ========== MAIN SCREEN ========== */
function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: [{ translateY: -1 }] }}>
      <Path d="M10 6l6 6-6 6" />
    </Svg>
  );
}

/* ========== MAIN SCREEN ========== */

export default function ProfileScreen({ onBack, onLogout, onLangChange, onAvatarChange, onManageUsers, refreshKey }: { onBack: () => void; onLogout: () => void; onLangChange?: () => void; onAvatarChange?: () => void; onManageUsers?: () => void; refreshKey?: number }) {
  const { colors, theme, setTheme } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const {
    avatarUrl, avatarKey,
    cropSrc, cropResult, showResult, cropMsg,
    setCropSrc, setShowResult,
    canvasRef, stageRef, guideRef,
    handleAvatarSelect, confirmCrop, doUpload,
    loadAvatar,
    cropState, clampCrop, drawCrop,
    zoomSlider, setZoomSlider,
    uploadLoading,
  } = useAvatarCrop(onAvatarChange);
  const {
    coverUrl, coverKey,
    coverOpacity, setCoverUploading, coverUploading,
    coverCropSrc, coverCropResult, coverShowResult, coverCropMsg,
    setCoverCropSrc, setCoverCropResult, setCoverShowResult,
    coverZoomSlider, setCoverZoomSlider,
    coverInputRef, coverCanvasRef, coverStageRef, coverGuideRef,
    handleCoverSelect, coverConfirmCrop, coverDoUpload,
    loadCover,
    coverCropState, coverClampCrop, coverDrawCrop,
  } = useCoverCrop();
  const { showToast, ToastHost } = useToast();

  // Sticky header — shown when cover scrolls out of view
  const [stickyHeaderVisible, setStickyHeaderVisible] = useState(false);
  const stickyOpacity = useRef(new Animated.Value(0)).current;

  // Pulled from LangContext — re-renders on LangContext value change
  // instead of capturing curLang at mount.
  const { setLang: setLangState } = useLang();

  const username = useMemo(() => {
    try { return getCurrentUser(); } catch { return ''; }
  }, []);
  const [email, setEmail] = useState('');
  const {
    signature, setSignature,
    signatureEditing,
    signatureDraft, setSignatureDraft,
    handleSignatureSave, startEditing,
  } = useSignatureForm();
  const [daysSince, setDaysSince] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [unreviewedCount, setUnreviewedCount] = useState(0);

  const checkAdmin = async (): Promise<boolean> => {
    try {
      const data = await api.admin.check();
      const ok = data.is_admin === true;
      setIsAdmin(ok);
      return ok;
    } catch { setIsAdmin(false); return false; }
  };

  const fetchUnreviewedCount = async () => {
    try {
      const data = await api.admin.getUnreviewedCount();
      setUnreviewedCount(data.count ?? 0);
    } catch {}
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const {
    showPwModal, setShowPwModal,
    showEmailModal, setShowEmailModal,
    emailStep, setEmailStep,
    oldPw, setOldPw, newPw, setNewPw, confirmPw, setConfirmPw,
    newEmail, setNewEmail, emailCode, setEmailCode,
    modalMsg, setModalMsg, modalLoading,
    handleChangePw, handleSendCode, handleVerifyEmail, openEmailModal,
  } = useProfileForms(showToast);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAdminBlockModal, setShowAdminBlockModal] = useState(false);
  const [showPartnerBlockModal, setShowPartnerBlockModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');
  const [showThemeModal, setShowThemeModal] = useState(false);

  // ── bgOpacity (from HomeScreen header theme settings) ──
  const [bgOpacity, setBgOpacity] = useState(() => {
    try {
      const uid = getCurrentUserId();
      const saved = localStorage.getItem(uid ? `bg-opacity-${uid}` : 'bg-opacity');
      return saved !== null ? parseFloat(saved) : 1;
    } catch { return 1; }
  });

  const handleBgOpacityChange = (v: number) => {
    setBgOpacity(v);
    try {
      const uid = getCurrentUserId();
      localStorage.setItem(uid ? `bg-opacity-${uid}` : 'bg-opacity', String(v));
    } catch {}
    clearTimeout((window as any).__bgOpacityTimer);
    (window as any).__bgOpacityTimer = setTimeout(() => {
      api.saveBackgroundSettings({ opacity: v }).catch(() => {});
    }, 500);
  };

  // Auth prefs (single-device login + session timeout)
  const [enforceSingleSession, setEnforceSingleSession] = useState(1);
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState(1);
  const authPrefsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebAuthn (Face ID)
  const [hasFaceID, setHasFaceID] = useState(false);
  const [faceIDLoading, setFaceIDLoading] = useState(false);
  const [webauthnSupported] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!(window as any).PublicKeyCredential;
  });


  // Avatar crop state → useAvatarCrop hook

  // coverCrop state → useCoverCrop hook

  const st = useMemo(() => getStyles(colors), [colors]);
  const mo = useMemo(() => getMo(colors), [colors]);
  const cropS = useMemo(() => getCropStyles(), []);


  // loadAvatar → useAvatarCrop.loadAvatar()


  const loadBgOpacity = async () => {
    try {
      const r: any = await api.getBackground();
      if (r?.opacity !== null && r?.opacity !== undefined) {
        setBgOpacity(r.opacity);
      }
    } catch {}
  };

  // loadCover → useCoverCrop.loadCover()

  useEffect(() => { loadAvatar(); loadCover(); loadUserInfo(); loadFaceIDStatus(); loadBgOpacity(); checkAdmin().then(ok => { if (ok) fetchUnreviewedCount(); }); }, []);
  useEffect(() => { if (isAdmin) fetchUnreviewedCount(); }, [refreshKey]);

  const loadUserInfo = async () => {
    try {
      const data = await api.admin.getMe();
      if (data.email) setEmail(data.email);
      if (data.signature) setSignature(data.signature);
      if (data.created_at) {
        const days = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 86400000);
        setDaysSince(Math.max(1, days));
      }
      if (typeof data.enforce_single_session === 'number') {
        setEnforceSingleSession(data.enforce_single_session);
      }
      if (typeof data.session_timeout_hours === 'number' && [1, 2, 6, 24].includes(data.session_timeout_hours)) {
        setSessionTimeoutHours(data.session_timeout_hours);
      }
      if (data.partner_name) {
        setIsPartner(true);
      }
    } catch {}
  };

  // Debounced save for auth preferences
  const persistAuthPrefs = (next: { enforce_single_session?: number; session_timeout_hours?: number }) => {
    if (authPrefsTimer.current) clearTimeout(authPrefsTimer.current);
    authPrefsTimer.current = setTimeout(async () => {
      try {
        await api.updateAuthPrefs(next);
      } catch {}
    }, 400);
  };
  const toggleEnforceSingleSession = (v: boolean) => {
    const nv = v ? 1 : 0;
    setEnforceSingleSession(nv);
    persistAuthPrefs({ enforce_single_session: nv });
  };

  const toggleFaceID = async (v: boolean) => {
    if (faceIDLoading) return;
    if (v) {
      // Enable Face ID — start registration
      setFaceIDLoading(true);
      try {
        const beginResp = await api.webauthnRegisterBegin();
        const challenge = base64urlToArrayBuffer(beginResp.challenge);
        const user = beginResp.user;
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: beginResp.rp,
            user: { id: base64urlToArrayBuffer(user.id), name: user.name, displayName: user.displayName },
            pubKeyCredParams: beginResp.pubKeyCredParams,
            timeout: beginResp.timeout || 60000,
            authenticatorSelection: beginResp.authenticatorSelection,
            attestation: beginResp.attestation || 'none',
          },
        }) as PublicKeyCredential;
        const response = credential.response as AuthenticatorAttestationResponse;
        const completeResp = await api.webauthnRegisterComplete({
          id: credential.id,
          clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
          attestationObject: arrayBufferToBase64url(response.attestationObject),
        });
        if (completeResp.status === 'ok') {
          setHasFaceID(true);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('webauthn_bound', '1');
            localStorage.setItem('webauthn_user', localStorage.getItem('user') || '');
            // Store credential ID so we can signal the device to delete
            // the key when the user unbinds Face ID later.
            localStorage.setItem('webauthn_credential_id', credential.id);
            // Store WebAuthn user.id bytes for signalAllAcceptedCredentials
            localStorage.setItem('webauthn_user_id_b64', user.id);
          }
          showToast(completeResp.message || '面容登录已开启');
        } else {
          showToast(completeResp.message || '绑定失败');
        }
      } catch (e: any) {
        // User cancelled — don't show error
        const name = (e as any)?.name || '';
        const msg = (e as any)?.message || '';
        if (name === 'NotAllowedError' || name === 'AbortError' ||
            msg.includes('not allowed') || msg.includes('denied permission')) {
          // silently ignore
        } else {
          showToast(e?.message || '绑定失败，请重试');
        }
      } finally {
        setFaceIDLoading(false);
      }
    } else {
      // Disable Face ID
      setFaceIDLoading(true);
      try {
        // Signal the device to delete the credential from its secure storage.
        // This prevents the Face ID picker from showing stale credentials
        // (e.g. JiangKuan's key after unbind) when another user logs in.
        let credIdB64 = (() => {
          try { return localStorage.getItem('webauthn_credential_id'); } catch { return null; }
        })();
        // Fallback: if credential ID not in localStorage (e.g. password-login),
        // fetch it from the server so we can still signal the device.
        if (!credIdB64) {
          try {
            const statusResp = await api.webauthnStatus();
            if (statusResp.credential_id) {
              credIdB64 = statusResp.credential_id;
            }
          } catch {}
        }
        if (credIdB64 && typeof window !== 'undefined' && (window as any).PublicKeyCredential) {
          const PKC = (window as any).PublicKeyCredential;
          // Try both Signal APIs — Safari 26+ bug may affect one but not the other.
          // 1. signalUnknownCredential: delete a specific credential by ID
          if (typeof PKC.signalUnknownCredential === 'function') {
            try {
              await Promise.race([
                PKC.signalUnknownCredential({
                  rpId: 'test.rowanlan.xyz',
                  credentialId: base64urlToArrayBuffer(credIdB64),
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
              ]);
            } catch { /* Safari bug — ignore */ }
          }
          // 2. signalAllAcceptedCredentials: tell iOS this user has NO valid credentials
          const userIdB64 = (() => {
            try { return localStorage.getItem('webauthn_user_id_b64'); } catch { return null; }
          })();
          if (typeof PKC.signalAllAcceptedCredentials === 'function' && userIdB64) {
            try {
              await Promise.race([
                PKC.signalAllAcceptedCredentials({
                  rpId: 'test.rowanlan.xyz',
                  userId: base64urlToArrayBuffer(userIdB64),
                  allAcceptedCredentialIds: [],  // empty = no valid credentials for this user
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
              ]);
            } catch { /* Safari bug — ignore */ }
          }
        }
        const resp = await api.webauthnDelete();
        setHasFaceID(false);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('webauthn_bound');
          localStorage.removeItem('webauthn_user');
          localStorage.removeItem('webauthn_credential_id');
          localStorage.removeItem('webauthn_user_id_b64');
        }
        showToast(resp.message || '面容登录已关闭');
      } catch (e: any) {
        showToast(e?.message || '解绑失败');
      } finally {
        setFaceIDLoading(false);
      }
    }
  };

  // Load Face ID status
  const loadFaceIDStatus = async () => {
    try {
      const resp = await api.webauthnStatus();
      setHasFaceID(resp.has_credential);
      if (resp.has_credential && resp.credential_id && typeof localStorage !== 'undefined') {
        localStorage.setItem('webauthn_credential_id', resp.credential_id);
      }
    } catch {}
  };
  const pickTimeout = (h: number) => {
    setSessionTimeoutHours(h);
    persistAuthPrefs({ session_timeout_hours: h });
  };


  // handleCoverSelect → useCoverCrop hook


  // handleCoverOpacityChange → useCoverCrop hook


  // handleCoverReset → useCoverCrop hook

  // Theme button is "set background image" (per user clarification).
  // ThemePickerModal self-contains the crop flow; we receive the
  // cropped File via onCoverImagePicked and upload to the same
  // /api/settings/background endpoint HomeScreen uses. The background
  // is actually rendered by HomeScreen, so we broadcast a 'bg-changed'
  // event for HomeScreen to refresh its bgImage state when the user
  // switches back.
  const handleCoverImagePicked = async (file: File) => {
    setCoverUploading(true);
    try {
      const r: any = await api.uploadBackground(file);
      if (r?.url) {
        try { localStorage.setItem('bg-image', r.url); } catch {}
        window.dispatchEvent(new CustomEvent('bg-changed', { detail: { url: r.url } }));
      } else { throw new Error('upload-failed'); }
    } catch (err) {
      showToast(t('uploadFailedShort'));
    } finally {
      setCoverUploading(false);
    }
  };

  // Theme button "reset default" should reset the BACKGROUND, not the cover
  // — the theme button is "set background image" per user clarification.
  const handleThemeReset = async () => {
    setCoverUploading(true);
    try {
      // Reset theme scheme to default
      setTheme('burgundy-warm');
      await api.resetBackground();
      try { localStorage.removeItem('bg-image'); } catch {}
      window.dispatchEvent(new CustomEvent('bg-changed', { detail: { url: '/img/bg.jpg?v=3' } }));
      // Reset opacity to 100%
      setBgOpacity(1);
      try {
        const uid = getCurrentUserId();
        const key = uid ? `bg-opacity-${uid}` : 'bg-opacity';
        localStorage.removeItem(key);
      } catch {}
      api.saveBackgroundSettings({ opacity: 1 }).catch(() => {});
    } catch (err) { /* ignore */ }
    finally { setCoverUploading(false); }
  };

  // handleSignatureSave → useSignatureForm hook

  // ── Delete account ──
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const rawUid = getCurrentUserId();
      if (!rawUid) { showToast('无法获取用户信息'); setDeleteLoading(false); setShowDeleteModal(false); return; }
      const data = await api.deleteAccount(Number(rawUid));
      setShowDeleteModal(false);
      setDeleteConfirmUsername('');
      showToast(data.message || '账户已进入冷静期');
    } catch (err: any) {
      showToast(err.message || '操作失败，请稍后重试');
    } finally {
      setDeleteLoading(false);
    }
  };


  // handleAvatarSelect → useAvatarCrop hook
  // Avatar canvas functions → useAvatarCrop hook
  // Cover crop canvas → useCoverCrop hook

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const threshold = 260; // cover height
    const shouldShow = y >= threshold;
    if (shouldShow !== stickyHeaderVisible) {
      setStickyHeaderVisible(shouldShow);
      Animated.timing(stickyOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };


  return (
    <View style={st.root} {...swipeBack}>
      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
        {/* Cover Image — nav & controls overlaid on top */}
        <TouchableOpacity style={st.coverWrap} onPress={() => coverInputRef.current?.click()} activeOpacity={0.9}>
          {coverUrl ? (
            <Image source={{ uri: (coverUrl.includes('?') ? coverUrl : coverUrl + '?') + '&u=' + (getCurrentUserId() || '0') + '&v=' + coverKey }} style={[st.coverImg, { opacity: coverOpacity }]} />
          ) : (
            <View style={st.coverGradient}>
              <Svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="none">
                <Defs>
                  <SVGGradient id="coverGrad2" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={colors.primary} stopOpacity={1} />
                    <Stop offset="0.5" stopColor={colors.accent} stopOpacity={0.7} />
                    <Stop offset="1" stopColor={colors.primary} stopOpacity={0.35} />
                  </SVGGradient>
                </Defs>
                <Rect width="360" height="260" fill="url(#coverGrad2)" />
              </Svg>
            </View>
          )}

          {/* Top shadow gradient — ensures nav readability on any cover */}
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 80,
            backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)',
          } as any} />

          {/* Floating nav — back + title on top of cover */}
          <View style={st.coverNav}>
            <TouchableOpacity onPress={onBack} style={st.coverBackBtn}>
              <BackArrow color="#fff" />
            </TouchableOpacity>
            <Text style={st.coverTitle}>{t('editProfile')}</Text>
          </View>
          <View style={st.coverOverlay}>
            <CameraIcon color="#fff" size={14} strokeWidth={2} />
            <Text style={st.coverOverlayText}>{t('editCover')}</Text>
          </View>

          {/* Avatar — right side, half overlapping cover bottom */}
          <TouchableOpacity
            onPress={(e: any) => { e.stopPropagation(); avatarInputRef.current?.click(); }}
            style={st.avatarFloat}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={st.avatar} key={avatarKey} />
            ) : (
              <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
            )}
            <View style={st.camBadge}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="2" />
                <circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="2" />
              </svg>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── Profile head ── */}
        <View style={st.profileHead}>
          <Text style={st.profileName}>{username}</Text>
          {/* Signature */}
          {signatureEditing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <TextInput
                style={st.signatureInput}
                value={signatureDraft}
                onChangeText={setSignatureDraft}
                placeholder={t('signaturePlaceholder')}
                placeholderTextColor={colors.textSub}
                maxLength={200}
                autoFocus
                onBlur={handleSignatureSave}
                onSubmitEditing={handleSignatureSave}
              />
            </View>
          ) : (
            <TouchableOpacity onPress={startEditing}>
              <Text style={st.signatureText}>
                {signature || t('signaturePlaceholder')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Section: Account ── */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('accountInfo')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            <View style={st.iconRow}>
              <View style={[st.iconWrap, st.iconUser]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6499ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('displayName')}</Text>
              <Text style={st.iconValue}>{username}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.iconRow}>
              <View style={[st.iconWrap, st.iconMail]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64c896" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('profileEmail')}</Text>
              <Text style={st.iconValue}>{email || '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── Section: Security ── */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('securitySettings')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            <TouchableOpacity style={st.iconRow} onPress={() => { setShowPwModal(true); setOldPw(''); setNewPw(''); setConfirmPw(''); setModalMsg(''); }}>
              <View style={[st.iconWrap, st.iconLock]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('changePassword')}</Text>
              <ChevronRight color={colors.textSub} />
            </TouchableOpacity>
            <View style={st.divider} />
            <TouchableOpacity style={st.iconRow} onPress={openEmailModal}>
              <View style={[st.iconWrap, st.iconMail]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64c896" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('changeEmail')}</Text>
              <ChevronRight color={colors.textSub} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Preferences ── */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('preferences')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            <View style={st.iconRow}>
              <View style={[st.iconWrap, st.iconLang]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c096d8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('language')}</Text>
              <View style={{ flexDirection: 'row' }}>
                {(['zh-CN','zh-TW','en'] as const).map(l => (
                  <TouchableOpacity key={l} onPress={() => { setLangState(l); onLangChange?.(); }}>
                    <Text style={[st.langBtn, getLang() === l && st.langBtnActive]}>
                      {l === 'zh-CN' ? '简' : l === 'zh-TW' ? '繁' : 'EN'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={st.divider} />
            <TouchableOpacity style={st.iconRow} onPress={() => setShowThemeModal(true)}>
              <View style={[st.iconWrap, st.iconTheme]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb450" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('themeLabel')}</Text>
              <Text style={st.badge}>{getLang() === 'zh-TW' ? (theme as any).nameTw || theme.nameZh : getLang() === 'en' ? (theme as any).nameEn || theme.nameZh : theme.nameZh}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Sign-in Security ── */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('authSettingsTitle')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.authCard}>
            {/* Face ID row — only on devices that support WebAuthn */}
            {webauthnSupported && (
            <View style={st.authRow}>
              <View style={st.authHeaderRow}>
                <View style={[st.iconWrap, st.iconFace]}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="4"/>
                    <circle cx="9" cy="10" r="0.8" fill={colors.primary} stroke="none"/>
                    <circle cx="15" cy="10" r="0.8" fill={colors.primary} stroke="none"/>
                    <path d="M9 13.5 Q12 15.5 15 13.5"/>
                  </svg>
                </View>
                <Text style={st.authLabel}>{t('faceIDLabel') || '面容登录'}</Text>
                <Switch
                  value={hasFaceID}
                  onValueChange={toggleFaceID}
                  trackColor={{ false: withAlpha(colors.textMain, 0.18), true: colors.primary }}
                  thumbColor="#fff"
                  disabled={faceIDLoading}
                />
              </View>
              <Text style={st.authDesc}>{t('faceIDDesc') || '使用面容快速登录'}</Text>
            </View>
            )}
            <View style={st.divider} />
            {/* SSO row */}
            <View style={st.authRow}>
              <View style={st.authHeaderRow}>
                <View style={[st.iconWrap, st.iconShield]}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </View>
                <Text style={st.authLabel}>{t('ssoLabel')}</Text>
                <Switch
                  value={enforceSingleSession === 1}
                  onValueChange={toggleEnforceSingleSession}
                  trackColor={{ false: withAlpha(colors.textMain, 0.18), true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
              <Text style={st.authDesc}>{t('ssoDesc')}</Text>
            </View>
            <View style={st.divider} />
            {/* Session timeout row */}
            <View style={st.authRow}>
              <View style={st.authHeaderRow}>
                <View style={[st.iconWrap, st.iconClock]}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffb450" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </View>
                <Text style={st.authLabel}>{t('sessionTimeoutLabel')}</Text>
              </View>
              <View style={st.capsuleRow}>
                {[1, 2, 6, 24].map(h => {
                  const active = sessionTimeoutHours === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      activeOpacity={0.7}
                      style={[st.capsule, active && st.capsuleActive]}
                      onPress={() => pickTimeout(h)}
                    >
                      <Text style={[st.capsuleText, active && st.capsuleTextActive]}>{h}h</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={st.authDesc}>{t('sessionTimeoutDesc')}</Text>
            </View>
            {isAdmin && (<>
            <View style={st.divider} />
            {/* User management row */}
            <TouchableOpacity style={st.iconRow} onPress={() => { onManageUsers?.(); }}>
              <View style={[st.iconWrap, st.iconUsers]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B9BD5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3"/><path d="M2 20c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 19c0-2 1.8-4 4-4s4 2 4 4"/>
                </svg>
              </View>
              <Text style={st.iconLabel}>{t('userManagement')}</Text>
              {unreviewedCount > 0 && (
                <View style={{ backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center', marginLeft: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{unreviewedCount > 99 ? '99+' : unreviewedCount}</Text>
                </View>
              )}
              <ChevronRight color={colors.textSub} />
            </TouchableOpacity>
            </>)}
          </View>
        </View>

        {/* ── Section: Danger ── */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('dangerZone')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            <TouchableOpacity style={st.iconRow} onPress={() => {
              if (isAdmin) { setShowAdminBlockModal(true); }
              else if (isPartner) { setShowPartnerBlockModal(true); }
              else { setDeleteConfirmUsername(''); setShowDeleteModal(true); }
            }}>
              <View style={[st.iconWrap, st.iconDanger]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e06464" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </View>
              <Text style={[st.iconLabel, { color: '#e06464' }]}>{t('deleteAccount')}</Text>
              <ChevronRight color="#e06464" />
            </TouchableOpacity>
            <View style={st.divider} />
            <TouchableOpacity style={st.iconRow} onPress={() => setShowLogoutModal(true)}>
              <View style={[st.iconWrap, st.iconDanger]}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e06464" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </View>
              <Text style={[st.iconLabel, { color: '#e06464' }]}>{t('logout')}</Text>
              <ChevronRight color="#e06464" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Bottom stamp ── */}
        {daysSince > 0 && (
          <View style={st.stamp}>
            <Text style={st.stampPre}>
              {theme.id === 'obsidian-gold' ? t('stampPrefixObsidian') : theme.id === 'deep-teal' ? t('stampPrefixTeal') : t('stampPrefixBurgundy')}
              <Text style={[st.stampNum, { color: colors.primary }]}> {daysSince} </Text>
              {theme.id === 'obsidian-gold' ? t('stampSuffixObsidian') : theme.id === 'deep-teal' ? t('stampSuffixTeal') : t('stampSuffixBurgundy')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky header — appears when cover scrolls out of view */}
      {stickyHeaderVisible && (
        <Animated.View style={[st.stickyHeader, { opacity: stickyOpacity }]}>
          <TouchableOpacity onPress={onBack} style={st.stickyBackBtn}>
            <BackArrow color={colors.textMain} />
          </TouchableOpacity>
          <Text style={st.stickyTitle}>{t('editProfile')}</Text>
        </Animated.View>
      )}

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" ref={coverInputRef as any} style={{ display: 'none' }} onChange={handleCoverSelect} />
      <input type="file" accept="image/*" ref={avatarInputRef as any} style={{ display: 'none' }} onChange={handleAvatarSelect} />

      {/* Toast */}
      {ToastHost}

      {/* Shared modals */}
      <LogoutConfirmModal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} onLogout={onLogout} />
      {/* Admin cannot self-delete modal */}
      <ModalOverlay visible={showAdminBlockModal} onClose={() => setShowAdminBlockModal(false)} animation="blurMorph">
        <View style={mo.card}>
          <View style={mo.header}>
            <Text style={mo.title}>{t('deleteAccount')}</Text>
            <CloseButton onPress={() => setShowAdminBlockModal(false)} />
          </View>
          <View style={mo.body}>
            <Text style={mo.warnMsg}>
              {t('adminCannotDelete')}
            </Text>
            <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }} onPress={() => setShowAdminBlockModal(false)}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>{t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalOverlay>
      {/* Partner cannot self-delete modal */}
      <ModalOverlay visible={showPartnerBlockModal} onClose={() => setShowPartnerBlockModal(false)} animation="blurMorph">
        <View style={mo.card}>
          <View style={mo.header}>
            <Text style={mo.title}>{t('deleteAccount')}</Text>
            <CloseButton onPress={() => setShowPartnerBlockModal(false)} />
          </View>
          <View style={mo.body}>
            <Text style={mo.warnMsg}>
              {t('err_partner_cannot_delete')}
            </Text>
            <TouchableOpacity style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }} onPress={() => setShowPartnerBlockModal(false)}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>{t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalOverlay>
      {/* Delete account modal */}
      <ModalOverlay visible={showDeleteModal} onClose={() => setShowDeleteModal(false)} animation="blurMorph">
        <View style={mo.card}>
          <View style={mo.header}>
            <Text style={mo.title}>{t('deleteAccountConfirmTitle')}</Text>
            <CloseButton onPress={() => setShowDeleteModal(false)} />
          </View>
          <View style={mo.body}>
            <Text style={{ color: colors.textMain, fontSize: 15, lineHeight: 22, marginBottom: 8 }}>
              {t('deleteAccountGraceNote')}
            </Text>
            <TextField
              placeholder={t('enterUsernameToConfirm')}
              value={deleteConfirmUsername}
              onChangeText={setDeleteConfirmUsername}
            />
            <ButtonPair
              leftLabel={t('cancel')}
              leftOnPress={() => { setShowDeleteModal(false); setDeleteConfirmUsername(''); }}
              rightLabel={deleteLoading ? '...' : t('deleteAccountBtn')}
              rightOnPress={handleDeleteAccount}
              rightDisabled={deleteLoading || deleteConfirmUsername !== username}
            />
          </View>
        </View>
      </ModalOverlay>

      <ThemePickerModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        showCoverTools
        coverOpacity={bgOpacity}
        onCoverOpacityChange={handleBgOpacityChange}
        onCoverImagePicked={handleCoverImagePicked}
        onResetCover={handleThemeReset}
        coverUploading={coverUploading}
      />

      {/* ── Change Password Modal ── */}
      <ModalOverlay visible={showPwModal} onClose={() => setShowPwModal(false)} animation="springScale">
        <View style={mo.card}>
            <View style={mo.header}>
              <Text style={mo.title}>{t('changePassword')}</Text>
              <CloseButton onPress={() => setShowPwModal(false)} />
            </View>
            <View style={mo.body}>
              <TextField
                placeholder={t('oldPassword')}
                secureTextEntry
                value={oldPw}
                onChangeText={setOldPw}
                autoFocus
              />
              <TextField
                placeholder={t('newPassword')}
                secureTextEntry
                value={newPw}
                onChangeText={setNewPw}
              />
              <Text style={mo.pwHint}>{t('pwHint')}</Text>
              <TextField
                placeholder={t('confirmNewPassword')}
                secureTextEntry
                value={confirmPw}
                onChangeText={setConfirmPw}
              />
              {modalMsg ? <Text style={mo.err}>{modalMsg}</Text> : null}
              <ButtonPair
                leftLabel={t('cancel')}
                leftOnPress={() => setShowPwModal(false)}
                rightLabel={modalLoading ? '...' : t('confirm')}
                rightOnPress={handleChangePw}
                rightDisabled={modalLoading || !oldPw || !newPw || !confirmPw}
              />
            </View>
        </View>
      </ModalOverlay>

      {/* ── Change Email Modal ── */}
      <ModalOverlay visible={showEmailModal} onClose={() => setShowEmailModal(false)} animation="springScale">
        <View style={mo.card}>
            <View style={mo.header}>
              <Text style={mo.title}>{t('changeEmail')}</Text>
              <CloseButton onPress={() => setShowEmailModal(false)} />
            </View>
            <View style={mo.body}>
              {emailStep === 'input' ? (
                <>
                  <TextInput
                    style={[mo.input, { outline: 'none' } as any]}
                    placeholder={t('newEmail')}
                    placeholderTextColor={colors.textSub}
                    value={newEmail}
                    onChangeText={(v) => { setNewEmail(v); if (modalMsg) setModalMsg(''); }}
                    onBlur={() => {
                      const emailErr = validateEmail(newEmail, t);
                      if (emailErr) {
                        setNewEmail('');
                        setModalMsg(emailErr);
                      }
                    }}
                    autoFocus
                    keyboardType="email-address"
                  />
                  {modalMsg ? <Text style={mo.err}>{modalMsg}</Text> : null}
                  <ButtonPair
                    leftLabel={t('cancel')}
                    leftOnPress={() => setShowEmailModal(false)}
                    rightLabel={modalLoading ? '...' : t('sendCode')}
                    rightOnPress={handleSendCode}
                    rightDisabled={modalLoading || !newEmail}
                  />
                </>
              ) : (
                <>
                  <Text style={{ fontSize: FONTS.sub.size, color: colors.textSub, textAlign: 'center' }}>
                    {t('codeSent')}：{newEmail}
                  </Text>
                  <TextInput
                    style={[mo.input, { outline: 'none', textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '700' } as any]}
                    placeholder={t('enterCode')}
                    placeholderTextColor={colors.textSub}
                    value={emailCode}
                    onChangeText={setEmailCode}
                    autoFocus
                    maxLength={6}
                    keyboardType="number-pad"
                  />
                  {modalMsg ? <Text style={mo.err}>{modalMsg}</Text> : null}
                  <ButtonPair
                    leftLabel={t('back')}
                    leftOnPress={() => setEmailStep('input')}
                    rightLabel={modalLoading ? t('verifying') : t('confirm')}
                    rightOnPress={() => handleVerifyEmail((newEm: string) => {
                      setEmail(newEm);
                      try { localStorage.setItem('email', newEm); } catch {}
                    })}
                    rightDisabled={modalLoading || !emailCode}
                  />
                </>
              )}
            </View>
        </View>
      </ModalOverlay>

      {/* ====== AVATAR CROP MODAL ====== */}
      <FullscreenOverlay visible={cropSrc !== '' && !showResult} onClose={() => setCropSrc('')}>
        <View style={{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' as any }}>
          <View style={cropS.header as any}>
            <Text style={cropS.title}>{t('avatarCropTitle')}</Text>
            <TouchableOpacity onPress={() => setCropSrc('')} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
              <Svg width="14" height="14" viewBox="0 0 1088 1024">
                <Path d="M843.712 191.936l-6.08-5.568-5.184-3.84-5.696-3.328a67.712 67.712 0 0 0-80.448 11.264L520.768 416.064l-224.64-224.64-2.688-2.56c-27.968-24.32-68.224-24.256-92.672 0.128l-4.8 5.12-4.608 6.144-3.392 5.632a67.84 67.84 0 0 0 11.328 80.512L424.96 512l-227.2 227.328c-24.32 28.16-24.32 68.48 0 92.864l5.12 4.8 6.208 4.608 5.632 3.392c26.816 14.336 59.136 9.984 80.448-11.328l225.6-225.728 227.072 227.2c28.608 24.832 68.928 24 94.336-1.472l4.544-5.056 4.096-5.568a67.84 67.84 0 0 0-8.64-85.312L616.64 512.064l224.512-224.64 4.16-4.352c23.04-26.752 22.4-67.008-1.6-91.136z" fill="rgba(255,255,255,0.7)" />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={cropS.stage as any} ref={stageRef as any}>
            <canvas ref={canvasRef as any}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', }}
            />
            <View style={cropS.guideWrap as any} pointerEvents="none">
              <View style={cropS.guideCircle as any} ref={guideRef as any}>
                <View style={[cropS.thirds, { top: '33.3%' }] as any} />
                <View style={[cropS.thirds, { top: '66.6%' }] as any} />
                <View style={[cropS.thirds, { left: '33.3%', width: 1, height: '100%' }] as any} />
                <View style={[cropS.thirds, { left: '66.6%', width: 1, height: '100%' }] as any} />
                <View style={[cropS.handle, { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 }] as any} />
                <View style={[cropS.handle, { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 }] as any} />
                <View style={[cropS.handle, { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 }] as any} />
                <View style={[cropS.handle, { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 }] as any} />
              </View>
            </View>
            <View style={cropS.pill as any} pointerEvents="none" data-pill="true">
              <Text style={cropS.pillText}>{t('cropPill')}</Text>
            </View>
          </View>
          <View style={cropS.toolbar as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>A</Text>
              <input type="range" min="0" max="100" value={zoomSlider}
                onChange={(e: any) => {
                  const s = cropState.current;
                  const t = Number(e.target.value) / 100;
                  s.scale = s.minScale + (s.maxScale - s.minScale) * t * 0.5;
                  s.scale = Math.max(s.minScale, s.scale);
                  setZoomSlider(Number(e.target.value));
                  clampCrop(); drawCrop();
                }}
                style={{ flex: 1, height: 3, appearance: 'none', accentColor: '#5B5BD6', background: `linear-gradient(to right, #5B5BD6 ${zoomSlider}%, rgba(255,255,255,0.2) ${zoomSlider}%)`, borderRadius: 2 } as any}
              />
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>A</Text>
            </View>
            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 10 }} />
            <TouchableOpacity style={cropS.toolBtn as any} onPress={() => { cropState.current.rotation = (cropState.current.rotation + 90) % 360; drawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 109-9H9m0 0l3 3m-3-3l3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t('cropRotate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cropS.toolBtn, { marginLeft: 8 }] as any} onPress={() => { cropState.current.flipX = !cropState.current.flipX; drawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t('cropFlip')}</Text>
            </TouchableOpacity>
          </View>
          <View style={cropS.actions as any}>
            <TouchableOpacity style={cropS.cancelBtn as any} onPress={() => setCropSrc('')}>
              <Text style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.confirmBtn as any} onPress={confirmCrop}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t('useThisAvatar')}</Text>
            </TouchableOpacity>
          </View>
          {cropMsg !== '' && (
            <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>{cropMsg}</Text>
          )}
        </View>
      </FullscreenOverlay>

      {/* ====== AVATAR RESULT PREVIEW ====== */}
      <ModalOverlay visible={showResult && cropResult !== ''} onClose={() => { setShowResult(false); setCropSrc(''); }} animation="springScale" backdropColor="rgba(8,8,12,0.92)" overlayStyle={{ padding: 0 }}>
        <View style={cropS.resultCard as any}>
          <View style={cropS.resultBadge as any}>
            <Text style={{ fontSize: 20, color: '#1B7A4A' }}>✓</Text>
          </View>
          <Text style={cropS.resultLabel}>{t('avatarUpdated')}</Text>
          <View style={cropS.sizePreviews as any}>
            {[80, 48, 32].map((size) => (
              <View key={size} style={{ alignItems: 'center', gap: 6 }}>
                <img src={cropResult} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{size}px</Text>
              </View>
            ))}
          </View>
          <Text style={cropS.resultSub}>{t('avatarSizeHint')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' }}>
            <TouchableOpacity style={cropS.reEditBtn as any} onPress={() => { setShowResult(false); }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{t('recrop')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.saveBtn as any} onPress={doUpload} disabled={uploadLoading}>
              {uploadLoading ? (
                <LoadingSpinner label={false} size={20} color="#fff" />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{t('confirmUse')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ModalOverlay>

      {/* ====== COVER CROP MODAL ====== */}
      <FullscreenOverlay visible={coverCropSrc !== '' && !coverShowResult} onClose={() => { setCoverCropSrc(''); setCoverCropResult(''); }}>
        <View style={{ position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' as any }}>
          <View style={cropS.header as any}>
            <Text style={cropS.title}>{t('coverCropTitle')}</Text>
            <TouchableOpacity onPress={() => { setCoverCropSrc(''); setCoverCropResult(''); }} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
              <Svg width="14" height="14" viewBox="0 0 1088 1024">
                <Path d="M843.712 191.936l-6.08-5.568-5.184-3.84-5.696-3.328a67.712 67.712 0 0 0-80.448 11.264L520.768 416.064l-224.64-224.64-2.688-2.56c-27.968-24.32-68.224-24.256-92.672 0.128l-4.8 5.12-4.608 6.144-3.392 5.632a67.84 67.84 0 0 0 11.328 80.512L424.96 512l-227.2 227.328c-24.32 28.16-24.32 68.48 0 92.864l5.12 4.8 6.208 4.608 5.632 3.392c26.816 14.336 59.136 9.984 80.448-11.328l225.6-225.728 227.072 227.2c28.608 24.832 68.928 24 94.336-1.472l4.544-5.056 4.096-5.568a67.84 67.84 0 0 0-8.64-85.312L616.64 512.064l224.512-224.64 4.16-4.352c23.04-26.752 22.4-67.008-1.6-91.136z" fill="rgba(255,255,255,0.7)" />
              </Svg>
            </TouchableOpacity>
          </View>
          <View style={cropS.stage as any} ref={coverStageRef as any}>
            <canvas ref={coverCanvasRef as any}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', }}
            />
            <View style={cropS.guideWrap as any} pointerEvents="none">
              <View style={{ width: 320, height: Math.round(320 * 260 / 375), borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', position: 'relative',  } as any} ref={coverGuideRef as any}>
                <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '33.3%' } as any} />
                <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '66.6%' } as any} />
                <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '33.3%' } as any} />
                <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '66.6%' } as any} />
              </View>
            </View>
            <View style={cropS.pill as any} pointerEvents="none" data-pill="true">
              <Text style={cropS.pillText}>{t('cropPill')}</Text>
            </View>
          </View>
          <View style={cropS.toolbar as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>A</Text>
              <input type="range" min="0" max="100" value={coverZoomSlider}
                onChange={(e: any) => {
                  const s = coverCropState.current;
                  const t = Number(e.target.value) / 100;
                  s.scale = s.minScale + (s.maxScale - s.minScale) * t * 0.5;
                  s.scale = Math.max(s.minScale, s.scale);
                  setCoverZoomSlider(Number(e.target.value));
                  coverClampCrop(); coverDrawCrop();
                }}
                style={{ flex: 1, height: 3, appearance: 'none', accentColor: '#5B5BD6', background: `linear-gradient(to right, #5B5BD6 ${coverZoomSlider}%, rgba(255,255,255,0.2) ${coverZoomSlider}%)`, borderRadius: 2 } as any}
              />
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>A</Text>
            </View>
            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 10 }} />
            <TouchableOpacity style={cropS.toolBtn as any} onPress={() => { coverCropState.current.rotation = (coverCropState.current.rotation + 90) % 360; coverDrawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 109-9H9m0 0l3 3m-3-3l3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t('cropRotate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cropS.toolBtn, { marginLeft: 8 }] as any} onPress={() => { coverCropState.current.flipX = !coverCropState.current.flipX; coverDrawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{t('cropFlip')}</Text>
            </TouchableOpacity>
          </View>
          <View style={cropS.actions as any}>
            <TouchableOpacity style={cropS.cancelBtn as any} onPress={() => { setCoverCropSrc(''); setCoverCropResult(''); }}>
              <Text style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.confirmBtn as any} onPress={coverConfirmCrop}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t('useThisCover')}</Text>
            </TouchableOpacity>
          </View>
          {coverCropMsg !== '' && (
            <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>{coverCropMsg}</Text>
          )}
        </View>
      </FullscreenOverlay>

      {/* ====== COVER RESULT PREVIEW ====== */}
      <ModalOverlay visible={coverShowResult} onClose={() => { setCoverShowResult(false); setCoverCropSrc(''); }} animation="springScale" backdropColor="rgba(8,8,12,0.92)" overlayStyle={{ padding: 0 }}>
        <View style={cropS.resultCard as any}>
          <View style={cropS.resultBadge as any}>
            <Text style={{ fontSize: 20, color: '#1B7A4A' }}>✓</Text>
          </View>
          <Text style={cropS.resultLabel}>{t('coverUpdated')}</Text>
          {coverCropResult ? <img src={coverCropResult} width={240} height={Math.round(240 * coverCropState.current.cropRatio)} style={{ borderRadius: 4, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} /> : null}
          <Text style={cropS.resultSub}>{t('coverHint')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' }}>
            <TouchableOpacity style={cropS.reEditBtn as any} onPress={() => { setCoverShowResult(false); }}>
              <Text style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{t('recrop')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.saveBtn as any} onPress={coverDoUpload} disabled={coverUploading}>
              {coverUploading ? (
                <LoadingSpinner label={false} size={20} color="#fff" />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{t('confirmUse')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ModalOverlay>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    scroll: { flex: 1 },
    // Cover
    coverWrap: { height: 260, position: 'relative', overflow: 'visible' as any },
    coverImg: { width: '100%', height: '100%', resizeMode: 'cover' as any } as any,
    coverGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    // Floating nav on top of cover
    coverNav: {
      position: 'absolute', top: 0, left: 0, right: 0,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    },
    coverBackBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.25)',
      justifyContent: 'center', alignItems: 'center',
    },
    coverTitle: {
      fontSize: 15, fontWeight: '600', color: '#fff',

    } as any,
    coverOverlay: {
      position: 'absolute', bottom: 12, left: 12,
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
    },
    coverOverlayText: { fontSize: 12, fontWeight: '500', color: '#fff' },
    // Avatar — positioned right, half overlapping cover bottom
    avatarFloat: {
      position: 'absolute' as any, right: 20, bottom: -40,
      zIndex: 10,
    },
    avatar: {
      width: 80, height: 80, borderRadius: 40,
      borderWidth: 3, borderColor: colors.surface,

    } as any,
    camBadge: {
      position: 'absolute', bottom: 0, right: -2,
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: colors.surface,
    },
    // Card
    card: {
      marginTop: 4, backgroundColor: colors.surface,
      borderRadius: 12, paddingHorizontal: 0, paddingVertical: 2,
    },
    field: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingVertical: 16,
    },
    fieldLabel: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textMain },
    fieldValue: { fontSize: FONTS.body.size, fontWeight: '500', color: colors.textMain },
    divider: { height: 0.5, backgroundColor: withAlpha(colors.textMain, 0.08) },
    // Action rows (password / email) — same typography as field labels above
    actionRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingVertical: 16,
    },
    actionLabel: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textMain },
    // Section
    section: { paddingHorizontal: 20, marginTop: 12 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
    sectionTitleText: { fontSize: 10, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: colors.textSub } as any,
    sectionTitleLine: { flex: 1, height: 1, backgroundColor: withAlpha(colors.textMain, 0.08) },
    // Auth security (SSO + timeout) — authRow paddingHorizontal:0 to match iconRow
    authCard: {
      marginTop: 4, backgroundColor: colors.surface,
      borderRadius: 12, paddingVertical: 2,
    },
    authRow: {
      flexDirection: 'column', paddingVertical: 14, paddingHorizontal: 0, gap: 10,
    },
    authHeaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    authLabel: {
      fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textMain, flex: 1,
    },
    authDesc: {
      fontSize: 12, color: colors.textSub, lineHeight: 16, marginLeft: 42,
    },
    iconShield: { backgroundColor: withAlpha(colors.primary, 0.12) },
    iconFace: { backgroundColor: withAlpha(colors.primary, 0.12) },
    iconClock: { backgroundColor: 'rgba(255,180,80,0.12)' },
    iconUsers: { backgroundColor: 'rgba(91,155,213,0.12)' },
    capsuleRow: {
      flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2, flexWrap: 'wrap', marginLeft: 42,
    },
    capsule: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
      borderWidth: 1, borderColor: withAlpha(colors.textMain, 0.15),
      backgroundColor: 'transparent',
    },
    capsuleActive: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    capsuleText: {
      fontSize: 13, color: colors.textSub, fontWeight: '500',
    },
    capsuleTextActive: {
      color: colors.primary, fontWeight: '600',
    },
    // Profile head
    profileHead: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 12 },
    profileName: { fontSize: 26, fontWeight: '700', color: colors.textMain, letterSpacing: -0.2 } as any,
    profileEmail: { fontSize: 12, color: colors.textSub, marginTop: 4 } as any,
    signatureText: { fontSize: 12, color: colors.textSub, marginTop: 6, fontStyle: 'italic' } as any,
    signatureInput: {
      fontSize: 13, color: colors.textMain,
      paddingVertical: 4, flex: 1,
      // @ts-ignore - web-only
      outlineStyle: 'none' as any, borderWidth: 0,
    } as any,
    // Icon rows
    iconRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 14, paddingHorizontal: 0, gap: 10,
    },
    iconWrap: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: withAlpha(colors.textMain, 0.04),
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    iconUser: { backgroundColor: 'rgba(100,160,255,0.12)' },
    iconMail: { backgroundColor: 'rgba(100,200,150,0.12)' },
    iconLock: { backgroundColor: withAlpha(colors.primary, 0.12) },
    iconLang: { backgroundColor: 'rgba(180,130,220,0.12)' },
    iconTheme: { backgroundColor: 'rgba(255,180,80,0.12)' },
    iconDanger: { backgroundColor: 'rgba(192,57,43,0.1)' },
    badge: {
      fontSize: 13, fontWeight: '500',
      color: colors.textSub,
      backgroundColor: withAlpha(colors.textMain, 0.05),
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    } as any,
    langBtn: { fontSize: 13, fontWeight: FONTS.micro.weight, color: colors.textSub, paddingHorizontal: 8 },
    langBtnActive: { color: colors.primary, fontWeight: FONTS.microBold.weight },
    iconLabel: { fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: colors.textMain, flex: 1 },
    iconValue: { fontSize: FONTS.body.size, fontWeight: '500', color: colors.textMain },
    // Bottom stamp
    stamp: {
      alignItems: 'center' as any,
      paddingVertical: 32, paddingBottom: 48,
      paddingHorizontal: 24,
    } as any,
    stampPre: { fontSize: 13, color: colors.textSub, letterSpacing: 0.5, lineHeight: 48, textAlign: 'center' } as any,
    stampNum: { fontSize: 42, fontWeight: '700', fontFamily: 'Inter, serif', fontStyle: 'italic' } as any,
    stampPost: { fontSize: 12, color: colors.textSub, marginTop: 4 } as any,
    // Sticky header
    stickyHeader: {
      position: 'absolute' as any, top: 0, left: 0, right: 0, zIndex: 100,
      flexDirection: 'row' as any, alignItems: 'center' as any,
      paddingVertical: 8, paddingHorizontal: 16, paddingTop: 12,
      backgroundColor: withAlpha(colors.surface, 0.85),
      // @ts-ignore
      backdropFilter: 'saturate(180%) blur(20px)',
      borderBottomWidth: 0.5, borderBottomColor: withAlpha(colors.textMain, 0.08),
    },
    stickyBackBtn: { padding: 4, marginRight: 12 },
    stickyTitle: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain },
  });
}

function getMo(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: MODAL_CARD_RADIUS,
      width: 360, maxWidth: '90%', overflow: 'hidden' as any,

    },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.surface },
    body: { padding: 20, gap: 12 } as any,
    input: {
      paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8,
      fontSize: FONTS.sub.size, color: colors.textMain,
      backgroundColor: withAlpha(colors.textMain, 0.03),
    },
    pwHint: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 18 },
    err: { fontSize: FONTS.micro.size, color: colors.danger },
    warnMsg: {
      fontSize: FONTS.micro.size, color: colors.textSub, textAlign: 'center', lineHeight: 22,
      backgroundColor: withAlpha(colors.primary, 0.1), borderRadius: 12, padding: 12,
      marginBottom: 16,
    },
  });
}

function getCropStyles() {
  return {
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any,
    header: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 } as any,
    title: { fontSize: 14, fontWeight: '600' as const, color: '#fff', letterSpacing: -0.2 },
    stage: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000', } as any,
    guideWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as any,
    guideCircle: {
      width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
      position: 'relative', 

    } as any,
    thirds: { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)' } as any,
    handle: { position: 'absolute', width: 18, height: 18, borderColor: '#fff', borderStyle: 'solid', opacity: 0.9 } as any,
    pill: {
      position: 'absolute', bottom: 8, left: '50%', transform: [{ translateX: -75 }],
      backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    } as any,
    pillText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    toolbar: {
      paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center',
      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', flexShrink: 0,
    } as any,
    toolBtn: { paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 } as any,
    actions: {
      paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', gap: 10, flexShrink: 0,
    } as any,
    cancelBtn: {
      flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center',
    } as any,
    confirmBtn: {
      flex: 2, padding: 11, borderRadius: 12, backgroundColor: '#5B5BD6',
      justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
    } as any,
    resultCard: { backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: MODAL_CARD_RADIUS, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: 320, alignItems: 'center', gap: 12 } as any,
    resultBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,122,74,0.2)', justifyContent: 'center', alignItems: 'center' } as any,
    resultLabel: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },
    sizePreviews: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' } as any,
    resultSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    reEditBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' } as any,
    saveBtn: { flex: 2, padding: 12, borderRadius: 10, backgroundColor: '#5B5BD6', justifyContent: 'center', alignItems: 'center' } as any,
  };
}
