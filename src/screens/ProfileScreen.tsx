import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput } from 'react-native';
import { createPortal } from 'react-dom';
import Svg, { Path, Defs, LinearGradient as SVGGradient, Stop, Rect } from 'react-native-svg';
import { t } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import Toast from '../components/Toast';
import { modalCardAnimation, modalClose } from '../sharedStyles';

/* ========== SVG ICONS ========== */

function CameraIcon({ color = '#fff', size = 12 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <Path d="M12 10a4 4 0 100 8 4 4 0 000-8z" />
    </Svg>
  );
}

function ArrowLeft({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="M10 5l-7 7 7 7" />
    </Svg>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: [{ translateY: -1 }] }}>
      <Path d="M10 6l6 6-6 6" />
    </Svg>
  );
}

/* ========== MAIN SCREEN ========== */

export default function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarKey, setAvatarKey] = useState(0);
  const [coverUrl, setCoverUrl] = useState('');
  const [coverKey, setCoverKey] = useState(0);
  const [toast, setToast] = useState('');

  const username = useMemo(() => {
    try { return localStorage.getItem('user') || ''; } catch { return ''; }
  }, []);
  const [email, setEmail] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showPwModal, setShowPwModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'code'>('input');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [modalMsg, setModalMsg] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Crop state
  const [cropSrc, setCropSrc] = useState('');
  const [cropResult, setCropResult] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [cropMsg, setCropMsg] = useState('');
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cropState = useRef({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropSize: 160,
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });

  const st = useMemo(() => getStyles(colors), [colors]);
  const mo = useMemo(() => getMo(colors), [colors]);
  const cropS = useMemo(() => getCropStyles(), []);

  // Load avatar
  const loadAvatar = async () => {
    const uid = localStorage.getItem('user_id');
    if (!uid) return;
    try {
      const resp = await fetch(`/api/users/avatar?user_id=${uid}`);
      if (resp.ok) {
        const blob = await resp.blob();
        setAvatarUrl(URL.createObjectURL(blob));
      }
    } catch {}
  };

  // Load cover
  const loadCover = async () => {
    try {
      const r: any = await api.getProfileCover();
      if (r?.url) setCoverUrl(r.url);
    } catch {}
  };

  useEffect(() => { loadAvatar(); loadCover(); loadUserInfo(); }, []);

  const loadUserInfo = async () => {
    try {
      const resp = await fetch('/api/users/me');
      if (resp.ok) {
        const data = await resp.json();
        if (data.email) setEmail(data.email);
      }
    } catch {}
  };

  // ── Cover upload ──
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r: any = await api.uploadProfileCover(file);
      if (r?.url) { setCoverUrl(r.url); setCoverKey(k => k + 1); }
    } catch { setToast('上传失败'); }
    e.target.value = '';
  };

  // ── Avatar upload flow ──
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setCropSrc(src); setCropMsg(''); setShowResult(false);
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => { cropImgRef.current = img; setupCanvas(); fitImage(); drawCrop(); };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    canvas.width = stage.clientWidth;
    canvas.height = stage.clientHeight;
  };

  const fitImage = () => {
    const img = cropImgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return;
    const s = cropState.current;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    s.scale = Math.max(sw / img.naturalWidth, sh / img.naturalHeight) * 0.9;
    s.minScale = s.scale * 0.3; s.maxScale = s.scale * 4;
    s.x = 0; s.y = 0; s.rotation = 0; s.flipX = false;
  };

  const drawCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = cropImgRef.current;
    if (!ctx || !img) return;
    const s = cropState.current;
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx.save();
    ctx.translate(canvas!.width / 2 + s.x, canvas!.height / 2 + s.y);
    ctx.rotate(s.rotation * Math.PI / 180);
    if (s.flipX) ctx.scale(-1, 1);
    ctx.scale(s.scale, s.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  const confirmCrop = () => {
    try {
      const img = cropImgRef.current;
      if (!img) { setCropMsg('图片未加载'); return; }
      const s = cropState.current;
      const outSize = 400;
      const output = document.createElement('canvas');
      output.width = outSize; output.height = outSize;
      const octx = output.getContext('2d')!;
      octx.beginPath();
      octx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
      octx.clip();
      const outScale = outSize / s.cropSize;
      octx.translate(outSize / 2 + s.x * outScale, outSize / 2 + s.y * outScale);
      octx.rotate(s.rotation * Math.PI / 180);
      if (s.flipX) octx.scale(-1, 1);
      octx.scale(s.scale * outScale, s.scale * outScale);
      octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setCropResult(output.toDataURL('image/jpeg', 0.92));
      setShowResult(true);
    } catch (e) { setCropMsg('裁切失败，请重试'); }
  };

  const doUpload = async () => {
    if (!cropResult) return;
    try {
      const arr = cropResult.split(',');
      const mime = (arr[0].match(/:(.*?);/) || ['', 'image/jpeg'])[1];
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      const form = new FormData();
      form.append('file', blob, 'avatar.jpg');
      const resp = await api.uploadAvatar(form);
      if (resp.status === 'ok') { setShowResult(false); setCropSrc(''); setCropResult(''); setAvatarKey(k => k + 1); loadAvatar(); }
      else { setCropMsg('上传失败'); }
    } catch (e) { setCropMsg('上传失败，请重试'); }
  };

  // ── Change Password ──
  const handleChangePw = async () => {
    setModalMsg('');
    if (!oldPw) { setModalMsg(t('errOldPwRequired')); return; }
    if (!newPw) { setModalMsg('请输入新密码'); return; }
    if (newPw !== confirmPw) { setModalMsg(t('errPwMismatch')); return; }
    setModalLoading(true);
    try {
      const r: any = await api.changePassword(oldPw, newPw);
      if (r.status === 'ok') {
        setShowPwModal(false);
        setOldPw(''); setNewPw(''); setConfirmPw('');
        setToast(t('pwChanged'));
      } else {
        setModalMsg(r.message || '修改失败');
      }
    } catch { setModalMsg('网络错误'); }
    setModalLoading(false);
  };

  // ── Change Email (two-step) ──
  const handleSendCode = async () => {
    setModalMsg('');
    if (!newEmail) { setModalMsg('请输入新邮箱'); return; }
    setModalLoading(true);
    try {
      const r: any = await api.sendEmailCode(newEmail);
      if (r.status === 'ok') {
        setEmailStep('code');
      } else {
        setModalMsg(r.message || '发送失败');
      }
    } catch { setModalMsg('网络错误'); }
    setModalLoading(false);
  };

  const handleVerifyEmail = async () => {
    setModalMsg('');
    if (!emailCode) { setModalMsg('请输入验证码'); return; }
    setModalLoading(true);
    try {
      const r: any = await api.verifyEmailCode(newEmail, emailCode);
      if (r.status === 'ok') {
        setEmail(newEmail);
        try { localStorage.setItem('email', newEmail); } catch {}
        setShowEmailModal(false);
        setNewEmail(''); setEmailCode(''); setEmailStep('input');
        setToast(t('emailChanged'));
      } else {
        setModalMsg(r.message || '验证失败');
      }
    } catch { setModalMsg('网络错误'); }
    setModalLoading(false);
  };

  const openEmailModal = () => {
    setShowEmailModal(true);
    setNewEmail(''); setEmailCode(''); setEmailStep('input'); setModalMsg('');
  };

  // ── Crop mouse/touch handlers ──
  const onStageMouseDown = (e: any) => {
    const s = cropState.current; s.drag.active = true;
    const cx = e.clientX || (e.touches?.[0]?.clientX) || 0;
    const cy = e.clientY || (e.touches?.[0]?.clientY) || 0;
    s.drag.sx = cx; s.drag.sy = cy; s.drag.ox = s.x; s.drag.oy = s.y;
  };
  const onStageMouseMove = (e: any) => {
    const s = cropState.current; if (!s.drag.active) return;
    const cx = e.clientX || (e.touches?.[0]?.clientX) || 0;
    const cy = e.clientY || (e.touches?.[0]?.clientY) || 0;
    s.x = s.drag.ox + (cx - s.drag.sx); s.y = s.drag.oy + (cy - s.drag.sy);
    drawCrop();
  };
  const onStageMouseUp = () => { cropState.current.drag.active = false; };
  const onStageWheel = (e: any) => {
    e.preventDefault();
    const s = cropState.current;
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    s.scale = Math.min(s.maxScale, Math.max(s.minScale, s.scale + delta));
    drawCrop();
  };

  return (
    <View style={st.root}>
      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover Image — nav & controls overlaid on top */}
        <TouchableOpacity style={st.coverWrap} onPress={() => coverInputRef.current?.click()} activeOpacity={0.9}>
          {coverUrl ? (
            <Image source={{ uri: (coverUrl.includes('?') ? coverUrl : coverUrl + '?') + '&u=' + (localStorage.getItem('user_id') || '0') + '&v=' + coverKey }} style={st.coverImg} />
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
                <Rect width="360" height="180" fill="url(#coverGrad2)" />
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
              <ArrowLeft color="#fff" />
            </TouchableOpacity>
            <Text style={st.coverTitle}>{t('editProfile')}</Text>
          </View>
          <View style={st.coverOverlay}>
            <CameraIcon color="#fff" size={14} />
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

        {/* Info card — with action rows */}
        <View style={st.card}>
          <View style={st.field}>
            <Text style={st.fieldLabel}>{t('displayName')}</Text>
            <Text style={st.fieldValue}>{username}</Text>
          </View>
          <View style={st.divider} />
          <View style={st.field}>
            <Text style={st.fieldLabel}>{t('profileEmail')}</Text>
            <Text style={st.fieldValue}>{email || '—'}</Text>
          </View>
          <View style={st.divider} />
          <TouchableOpacity style={st.actionRow} onPress={() => { setShowPwModal(true); setOldPw(''); setNewPw(''); setConfirmPw(''); setModalMsg(''); }}>
            <Text style={st.actionLabel}>{t('changePassword')}</Text>
            <ChevronRight color={colors.textSub} />
          </TouchableOpacity>
          <View style={st.divider} />
          <TouchableOpacity style={st.actionRow} onPress={openEmailModal}>
            <Text style={st.actionLabel}>{t('changeEmail')}</Text>
            <ChevronRight color={colors.textSub} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" ref={coverInputRef as any} style={{ display: 'none' }} onChange={handleCoverUpload} />
      <input type="file" accept="image/*" ref={avatarInputRef as any} style={{ display: 'none' }} onChange={handleAvatarSelect} />

      {/* Toast */}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />

      {/* ── Change Password Modal ── */}
      {showPwModal && createPortal(
        <TouchableOpacity style={mo.overlay} activeOpacity={1} onPress={() => setShowPwModal(false)}>
          <TouchableOpacity style={mo.card} activeOpacity={1} onPress={() => {}}>
            <View style={mo.header}>
              <Text style={mo.title}>{t('changePassword')}</Text>
              <TouchableOpacity onPress={() => setShowPwModal(false)}>
                <Text style={mo.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={mo.body}>
              <TextInput
                style={[mo.input, { outline: 'none' } as any]}
                placeholder={t('oldPassword')}
                placeholderTextColor={colors.textSub}
                secureTextEntry
                value={oldPw}
                onChangeText={setOldPw}
                autoFocus
              />
              <TextInput
                style={[mo.input, { outline: 'none' } as any]}
                placeholder={t('newPassword')}
                placeholderTextColor={colors.textSub}
                secureTextEntry
                value={newPw}
                onChangeText={setNewPw}
              />
              <Text style={mo.pwHint}>{t('pwHint')}</Text>
              <TextInput
                style={[mo.input, { outline: 'none' } as any]}
                placeholder={t('confirmNewPassword')}
                placeholderTextColor={colors.textSub}
                secureTextEntry
                value={confirmPw}
                onChangeText={setConfirmPw}
              />
              {modalMsg ? <Text style={mo.err}>{modalMsg}</Text> : null}
              <View style={mo.btnRow}>
                <TouchableOpacity style={mo.cancelBtn} onPress={() => setShowPwModal(false)}>
                  <Text style={mo.cancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[mo.confirmBtn, modalLoading && { opacity: 0.6 }]}
                  onPress={handleChangePw}
                  disabled={modalLoading}
                >
                  <Text style={mo.confirmText}>{modalLoading ? '...' : '确认修改'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>,
        document.body
      )}

      {/* ── Change Email Modal ── */}
      {showEmailModal && createPortal(
        <TouchableOpacity style={mo.overlay} activeOpacity={1} onPress={() => setShowEmailModal(false)}>
          <TouchableOpacity style={mo.card} activeOpacity={1} onPress={() => {}}>
            <View style={mo.header}>
              <Text style={mo.title}>{t('changeEmail')}</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <Text style={mo.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={mo.body}>
              {emailStep === 'input' ? (
                <>
                  <TextInput
                    style={[mo.input, { outline: 'none' } as any]}
                    placeholder={t('newEmail')}
                    placeholderTextColor={colors.textSub}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    autoFocus
                    keyboardType="email-address"
                  />
                  {modalMsg ? <Text style={mo.err}>{modalMsg}</Text> : null}
                  <View style={mo.btnRow}>
                    <TouchableOpacity style={mo.cancelBtn} onPress={() => setShowEmailModal(false)}>
                      <Text style={mo.cancelText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[mo.confirmBtn, modalLoading && { opacity: 0.6 }]}
                      onPress={handleSendCode}
                      disabled={modalLoading}
                    >
                      <Text style={mo.confirmText}>{modalLoading ? '...' : t('sendCode')}</Text>
                    </TouchableOpacity>
                  </View>
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
                  <View style={mo.btnRow}>
                    <TouchableOpacity style={mo.cancelBtn} onPress={() => setEmailStep('input')}>
                      <Text style={mo.cancelText}>返回</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[mo.confirmBtn, modalLoading && { opacity: 0.6 }]}
                      onPress={handleVerifyEmail}
                      disabled={modalLoading}
                    >
                      <Text style={mo.confirmText}>{modalLoading ? t('verifying') : '确认'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>,
        document.body
      )}

      {/* Crop Modal (portal) */}
      {cropSrc !== '' && !showResult && createPortal(
        <View style={cropS.overlay}>
          <View style={cropS.header}>
            <TouchableOpacity onPress={() => { setCropSrc(''); setCropResult(''); }} style={cropS.closeBtn}>
              <Text style={cropS.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={cropS.title}>编辑头像</Text>
            <TouchableOpacity onPress={confirmCrop}>
              <Text style={{ color: '#5B5BD6', fontSize: 14, fontWeight: '600' }}>确认</Text>
            </TouchableOpacity>
          </View>
          <div ref={stageRef as any} style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000', cursor: 'move', touchAction: 'none' } as any}
            onMouseDown={onStageMouseDown} onMouseMove={onStageMouseMove} onMouseUp={onStageMouseUp} onMouseLeave={onStageMouseUp}
            onTouchStart={onStageMouseDown} onTouchMove={onStageMouseMove} onTouchEnd={onStageMouseUp} onWheel={onStageWheel}>
            <canvas ref={canvasRef as any} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as any}>
              <View style={{ width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' } as any} />
            </View>
          </div>
          {cropMsg ? <Text style={{ color: '#ef4444', textAlign: 'center', padding: 4, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.6)' }}>{cropMsg}</Text> : null}
        </View>,
        document.body
      )}

      {/* Crop Result Modal */}
      {showResult && createPortal(
        <View style={cropS.overlay}>
          <View style={cropS.resultCard}>
            <View style={cropS.resultBadge}><Text style={{ fontSize: 20 }}>✓</Text></View>
            <Text style={cropS.resultLabel}>预览</Text>
            {cropResult ? <Image source={{ uri: cropResult }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)' }} /> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' } as any}>
              <TouchableOpacity style={cropS.reEditBtn} onPress={() => { setShowResult(false); }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>重选</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cropS.saveBtn} onPress={doUpload}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>,
        document.body
      )}
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    // Cover
    coverWrap: { height: 180, position: 'relative', overflow: 'visible' as any },
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
      fontSize: FONTS.body.size, fontWeight: '600', color: '#fff',
      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
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
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
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
      marginHorizontal: 16, marginTop: 48, backgroundColor: colors.surface,
      borderRadius: 14, paddingHorizontal: 18, paddingVertical: 4,
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
  });
}

function getMo(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'fixed' as any, inset: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center', alignItems: 'center', zIndex: 500,
    },
    card: {
      backgroundColor: colors.surface, borderRadius: 16,
      width: 340, maxWidth: '90%', overflow: 'hidden' as any,
      ...modalCardAnimation,
    },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.surface },
    closeBtn: { ...modalClose },
    body: { padding: 20, gap: 12 } as any,
    input: {
      paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8,
      fontSize: FONTS.sub.size, color: colors.textMain,
      backgroundColor: withAlpha(colors.textMain, 0.03),
    },
    pwHint: { fontSize: FONTS.micro.size, color: colors.textSub, lineHeight: 18 },
    err: { fontSize: FONTS.micro.size, color: colors.danger },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 10,
      borderWidth: 1, borderColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    cancelText: { fontSize: FONTS.sub.size, fontWeight: '500', color: colors.textSub },
    confirmBtn: {
      flex: 2, paddingVertical: 12, borderRadius: 10,
      backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    confirmText: { fontSize: FONTS.sub.size, fontWeight: '600', color: colors.surface },
  });
}

function getCropStyles() {
  return {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any,
    header: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 } as any,
    title: { fontSize: 14, fontWeight: '600' as const, color: '#fff', letterSpacing: -0.2 },
    closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' } as any,
    closeBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 20 },
    resultCard: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -160 }, { translateY: -100 }], backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: 20, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: 320, alignItems: 'center', gap: 12 } as any,
    resultBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,122,74,0.2)', justifyContent: 'center', alignItems: 'center' } as any,
    resultLabel: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },
    reEditBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' } as any,
    saveBtn: { flex: 2, padding: 12, borderRadius: 10, backgroundColor: '#5B5BD6', justifyContent: 'center', alignItems: 'center' } as any,
  };
}
