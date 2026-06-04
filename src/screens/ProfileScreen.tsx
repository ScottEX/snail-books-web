import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput } from 'react-native';
import { createPortal } from 'react-dom';
import Svg, { Path, Defs, LinearGradient as SVGGradient, Stop, Rect } from 'react-native-svg';
import { t, getLang, setLang } from '../i18n';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import Toast from '../components/Toast';
import { modalCardAnimation, modalClose } from '../sharedStyles';
import ThemePickerModal from '../components/ThemePickerModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

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

export default function ProfileScreen({ onBack, onLogout, onLangChange, onAvatarChange }: { onBack: () => void; onLogout: () => void; onLangChange?: () => void; onAvatarChange?: () => void }) {
  const { colors, theme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarKey, setAvatarKey] = useState(0);
  const [coverUrl, setCoverUrl] = useState('');
  const [coverKey, setCoverKey] = useState(0);
  const [coverOpacity, setCoverOpacity] = useState(1);
  const [coverUploading, setCoverUploading] = useState(false);
  const [toast, setToast] = useState('');

  const [lang, setLangState] = useState(getLang());

  const username = useMemo(() => {
    try { return localStorage.getItem('user') || ''; } catch { return ''; }
  }, []);
  const [email, setEmail] = useState('');
  const [signature, setSignature] = useState('');
  const [signatureEditing, setSignatureEditing] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState('');
  const [daysSince, setDaysSince] = useState(0);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showPwModal, setShowPwModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
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
  const guideRef = useRef<HTMLDivElement | null>(null);
  const cropState = useRef({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropSize: 160,
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });

  // Cover crop state
  const [coverCropSrc, setCoverCropSrc] = useState('');
  const [coverCropResult, setCoverCropResult] = useState('');
  const [coverShowResult, setCoverShowResult] = useState(false);
  const [coverCropMsg, setCoverCropMsg] = useState('');
  const coverCropImgRef = useRef<HTMLImageElement | null>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverStageRef = useRef<HTMLDivElement | null>(null);
  const coverGuideRef = useRef<HTMLDivElement | null>(null);
  const coverCropState = useRef({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropW: 320, cropH: 208, cropRatio: 260/375,
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });

  const st = useMemo(() => getStyles(colors), [colors]);
  const mo = useMemo(() => getMo(colors), [colors]);
  const cropS = useMemo(() => getCropStyles(), []);

  // Load avatar (cached to avoid flash)
  const CACHE_KEY_AVATAR = 'cached_avatar_b64';
  const loadAvatar = async () => {
    const uid = localStorage.getItem('user_id');
    if (!uid) return;
    // Serve from cache immediately
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_AVATAR);
      if (cached) setAvatarUrl(cached);
    } catch {}
    try {
      const resp = await fetch(`/api/users/avatar?user_id=${uid}`);
      if (resp.ok) {
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          setAvatarUrl(b64);
          try { sessionStorage.setItem(CACHE_KEY_AVATAR, b64); } catch {}
        };
        reader.readAsDataURL(blob);
      }
    } catch {}
  };

  // Load cover
  const loadCover = async () => {
    try {
      const r: any = await api.getProfileCover();
      if (r?.url) setCoverUrl(r.url);
    } catch {}
    // Load cover opacity from localStorage
    try {
      const uid = localStorage.getItem('user_id');
      const saved = localStorage.getItem(uid ? `cover-opacity-${uid}` : 'cover-opacity');
      if (saved !== null) setCoverOpacity(parseFloat(saved));
    } catch {}
  };

  useEffect(() => { loadAvatar(); loadCover(); loadUserInfo(); }, []);

  const loadUserInfo = async () => {
    try {
      const resp = await fetch('/api/users/me');
      if (resp.ok) {
        const data = await resp.json();
        if (data.email) setEmail(data.email);
        if (data.signature) setSignature(data.signature);
        if (data.created_at) {
          const days = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 86400000);
          setDaysSince(Math.max(1, days));
        }
      }
    } catch {}
  };

  // ── Cover upload flow (crop before upload) ──
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setCoverCropSrc(src); setCoverCropMsg(''); setCoverShowResult(false);
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => { coverCropImgRef.current = img; coverSetupCanvas(); coverFitImage(); coverDrawCrop(); };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCoverOpacityChange = (v: number) => {
    setCoverOpacity(v);
    try {
      const uid = localStorage.getItem('user_id');
      localStorage.setItem(uid ? `cover-opacity-${uid}` : 'cover-opacity', String(v));
    } catch {}
  };

  const handleCoverReset = async () => {
    setCoverUploading(true);
    try {
      await api.resetProfileCover();
      setCoverUrl(''); setCoverKey(k => k + 1);
    } catch {}
    finally { setCoverUploading(false); }
  };

  const handleSignatureSave = async () => {
    setSignatureEditing(false);
    const val = signatureDraft.trim();
    if (val === signature) return;
    setSignature(val);
    try { await api.saveSignature(val); } catch {}
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
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const s = cropState.current;
    s.cropSize = Math.round(Math.min(rect.width, rect.height) * 0.76);
    const guide = guideRef.current;
    if (guide) {
      guide.style.width = s.cropSize + 'px';
      guide.style.height = s.cropSize + 'px';
      guide.style.borderRadius = (s.cropSize / 2) + 'px';
    }
  };

  const fitImage = () => {
    const img = cropImgRef.current;
    if (!img) return;
    const s = cropState.current;
    const sw = s.cropSize / img.naturalWidth;
    const sh = s.cropSize / img.naturalHeight;
    s.scale = Math.max(sw, sh) * 1.05;
    s.minScale = Math.max(sw, sh);
    s.x = 0; s.y = 0; s.rotation = 0; s.flipX = false;
  };

  const clampCrop = () => {
    const img = cropImgRef.current;
    if (!img) return;
    const s = cropState.current;
    const hw = (img.naturalWidth * s.scale) / 2;
    const hh = (img.naturalHeight * s.scale) / 2;
    const hr = s.cropSize / 2;
    const maxX = hw - hr, maxY = hh - hr;
    s.x = maxX > 0 ? Math.max(-maxX, Math.min(maxX, s.x)) : 0;
    s.y = maxY > 0 ? Math.max(-maxY, Math.min(maxY, s.y)) : 0;
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

  const zoomCrop = (delta: number, cx: number, cy: number) => {
    const s = cropState.current;
    const newScale = Math.max(s.minScale, Math.min(s.maxScale, s.scale * (1 + delta)));
    const sd = newScale / s.scale;
    s.x = cx + (s.x - cx) * sd;
    s.y = cy + (s.y - cy) * sd;
    s.scale = newScale;
    clampCrop();
    drawCrop();
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
      if (resp.status === 'ok') { setShowResult(false); setCropSrc(''); setCropResult(''); setAvatarKey(k => k + 1); try { sessionStorage.removeItem(CACHE_KEY_AVATAR); } catch {} loadAvatar(); onAvatarChange?.(); }
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

      } else {
        setModalMsg(r.message || '修改失败');
      }
    } catch (e: any) { setModalMsg(e.message || t('errNetworkError')); }
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
    } catch (e: any) { setModalMsg(e.message || t('errNetworkError')); }
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
        // Reset modal state BEFORE closing to avoid render timing issues
        setNewEmail(''); setEmailCode(''); setEmailStep('input');
        setShowEmailModal(false);
      } else {
        setModalMsg(r.message || '验证失败');
      }
    } catch (e: any) { setModalMsg(e.message || t('errNetworkError')); }
    setModalLoading(false);
  };

  const openEmailModal = () => {
    setShowEmailModal(true);
    setNewEmail(''); setEmailCode(''); setEmailStep('input'); setModalMsg('');
  };

  // ── Imperative crop event binding ──
  useEffect(() => {
    if (!cropSrc || showResult) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    setTimeout(() => { setupCanvas(); clampCrop(); drawCrop(); }, 60);

    let frameId = 0;
    const scheduleDraw = () => { if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; drawCrop(); }); };

    const toLocal = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left - canvas.width / 2, y: clientY - r.top - canvas.height / 2 };
    };

    const guide = guideRef.current;
    const setGuideActive = (active: boolean) => {
      if (!guide) return;
      guide.style.borderColor = active ? '#fff' : 'rgba(255,255,255,0.8)';
      guide.style.boxShadow = active
        ? '0 0 0 9999px rgba(0,0,0,0.62)'
        : '0 0 0 9999px rgba(0,0,0,0.55)';
    };

    let pillTimer: any = setTimeout(() => {
      const pill = stage.querySelector('[data-pill]') as HTMLElement;
      if (pill) pill.style.opacity = '0';
    }, 3000);
    const hidePill = () => {
      clearTimeout(pillTimer);
      const pill = stage.querySelector('[data-pill]') as HTMLElement;
      if (pill) pill.style.opacity = '0';
    };

    const onResize = () => { setupCanvas(); clampCrop(); drawCrop(); };
    window.addEventListener('resize', onResize);

    const onMD = (e: MouseEvent) => {
      const s = cropState.current; s.drag.active = true;
      s.drag.sx = e.clientX; s.drag.sy = e.clientY;
      s.drag.ox = s.x; s.drag.oy = s.y;
      setGuideActive(true); hidePill();
    };
    const onMM = (e: MouseEvent) => {
      const s = cropState.current; if (!s.drag.active) return;
      s.x = s.drag.ox + (e.clientX - s.drag.sx);
      s.y = s.drag.oy + (e.clientY - s.drag.sy);
      clampCrop(); scheduleDraw();
    };
    const onMU = () => { cropState.current.drag.active = false; setGuideActive(false); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      zoomCrop(e.deltaY > 0 ? -0.08 : 0.08, p.x, p.y);
    };

    const getDist = (ts: TouchList) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      const s = cropState.current; hidePill();
      if (e.touches.length === 1) {
        s.drag.active = true;
        s.drag.sx = e.touches[0].clientX; s.drag.sy = e.touches[0].clientY;
        s.drag.ox = s.x; s.drag.oy = s.y;
        setGuideActive(true);
      } else if (e.touches.length === 2) {
        s.drag.active = false; setGuideActive(false);
        s.pinch.active = true;
        s.pinch.startDist = getDist(e.touches);
        s.pinch.startScale = s.scale;
        const r = stage.getBoundingClientRect();
        s.pinch.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left - canvas.width / 2;
        s.pinch.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top - canvas.height / 2;
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      const s = cropState.current;
      if (s.drag.active && e.touches.length === 1) {
        s.x = s.drag.ox + (e.touches[0].clientX - s.drag.sx);
        s.y = s.drag.oy + (e.touches[0].clientY - s.drag.sy);
        clampCrop(); scheduleDraw();
      } else if (s.pinch.active && e.touches.length === 2) {
        const d = getDist(e.touches);
        const ns = Math.max(s.minScale, Math.min(s.maxScale, s.pinch.startScale * (d / s.pinch.startDist)));
        const sd = ns / s.scale;
        s.x = s.pinch.midX + (s.x - s.pinch.midX) * sd;
        s.y = s.pinch.midY + (s.y - s.pinch.midY) * sd;
        s.scale = ns; clampCrop(); scheduleDraw();
      }
    };
    const onTE = (e: TouchEvent) => {
      const s = cropState.current;
      if (e.touches.length < 2) s.pinch.active = false;
      if (e.touches.length === 0) { s.drag.active = false; setGuideActive(false); }
    };

    canvas.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE);
    canvas.addEventListener('touchcancel', onTE);

    return () => {
      canvas.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTS);
      canvas.removeEventListener('touchmove', onTM);
      canvas.removeEventListener('touchend', onTE);
      canvas.removeEventListener('touchcancel', onTE);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      clearTimeout(pillTimer);
    };
  }, [cropSrc, showResult]);

  // ── Cover crop handlers ──
  const coverSetupCanvas = () => {
    const stage = coverStageRef.current;
    const canvas = coverCanvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const s = coverCropState.current;
    s.cropW = Math.round(rect.width * 0.8);
    s.cropRatio = 260 / rect.width;
    s.cropH = Math.round(s.cropW * s.cropRatio);
    const guide = coverGuideRef.current;
    if (guide) {
      guide.style.width = s.cropW + 'px';
      guide.style.height = s.cropH + 'px';
    }
  };

  const coverFitImage = () => {
    const img = coverCropImgRef.current;
    if (!img) return;
    const s = coverCropState.current;
    const sw = s.cropW / img.naturalWidth;
    const sh = s.cropH / img.naturalHeight;
    s.scale = Math.max(sw, sh) * 1.05;
    s.minScale = Math.max(sw, sh);
    s.x = 0; s.y = 0; s.rotation = 0; s.flipX = false;
  };

  const coverClampCrop = () => {
    const img = coverCropImgRef.current;
    if (!img) return;
    const s = coverCropState.current;
    const hw = (img.naturalWidth * s.scale) / 2;
    const hh = (img.naturalHeight * s.scale) / 2;
    const hrh = s.cropH / 2, hrw = s.cropW / 2;
    const maxX = hw - hrw, maxY = hh - hrh;
    s.x = maxX > 0 ? Math.max(-maxX, Math.min(maxX, s.x)) : 0;
    s.y = maxY > 0 ? Math.max(-maxY, Math.min(maxY, s.y)) : 0;
  };

  const coverDrawCrop = () => {
    const canvas = coverCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = coverCropImgRef.current;
    if (!ctx || !img) return;
    const s = coverCropState.current;
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx.save();
    ctx.translate(canvas!.width / 2 + s.x, canvas!.height / 2 + s.y);
    ctx.rotate(s.rotation * Math.PI / 180);
    if (s.flipX) ctx.scale(-1, 1);
    ctx.scale(s.scale, s.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  const coverZoomCrop = (delta: number, cx: number, cy: number) => {
    const s = coverCropState.current;
    const newScale = Math.max(s.minScale, Math.min(s.maxScale, s.scale * (1 + delta)));
    const sd = newScale / s.scale;
    s.x = cx + (s.x - cx) * sd;
    s.y = cy + (s.y - cy) * sd;
    s.scale = newScale;
    coverClampCrop();
    coverDrawCrop();
  };

  const coverConfirmCrop = () => {
    try {
      const img = coverCropImgRef.current;
      if (!img) { setCoverCropMsg('图片未加载'); return; }
      const s = coverCropState.current;
      const outW = 720, outH = Math.round(outW * s.cropRatio);
      const output = document.createElement('canvas');
      output.width = outW; output.height = outH;
      const octx = output.getContext('2d')!;
      const outScale = outW / s.cropW;
      octx.translate(outW / 2 + s.x * outScale, outH / 2 + s.y * outScale);
      octx.rotate(s.rotation * Math.PI / 180);
      if (s.flipX) octx.scale(-1, 1);
      octx.scale(s.scale * outScale, s.scale * outScale);
      octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setCoverCropResult(output.toDataURL('image/jpeg', 0.92));
      setCoverShowResult(true);
    } catch { setCoverCropMsg('裁切失败，请重试'); }
  };

  const coverDoUpload = async () => {
    if (!coverCropResult) return;
    setCoverUploading(true);
    try {
      const arr = coverCropResult.split(',');
      const mime = (arr[0].match(/:(.*?);/) || ['', 'image/jpeg'])[1];
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      const file = new File([blob], 'cover.jpg', { type: mime });
      const r: any = await api.uploadProfileCover(file);
      if (r?.url) {
        setCoverUrl(r.url); setCoverKey(k => k + 1);
        setCoverCropSrc(''); setCoverCropResult(''); setCoverShowResult(false);
      } else { setCoverCropMsg('上传失败'); }
    } catch { setCoverCropMsg('上传失败，请重试'); }
    finally { setCoverUploading(false); }
  };

  // ── Imperative cover crop event binding ──
  useEffect(() => {
    if (!coverCropSrc || coverShowResult) return;
    const stage = coverStageRef.current;
    const canvas = coverCanvasRef.current;
    if (!stage || !canvas) return;

    setTimeout(() => { coverSetupCanvas(); coverClampCrop(); coverDrawCrop(); }, 60);

    let frameId = 0;
    const scheduleDraw = () => { if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; coverDrawCrop(); }); };

    const toLocal = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      return { x: clientX - r.left - canvas.width / 2, y: clientY - r.top - canvas.height / 2 };
    };

    const guide = coverGuideRef.current;
    const setGuideActive = (active: boolean) => {
      if (!guide) return;
      guide.style.borderColor = active ? '#fff' : 'rgba(255,255,255,0.8)';
      guide.style.boxShadow = active
        ? '0 0 0 9999px rgba(0,0,0,0.62)'
        : '0 0 0 9999px rgba(0,0,0,0.55)';
    };

    const onResize = () => { coverSetupCanvas(); coverClampCrop(); coverDrawCrop(); };
    window.addEventListener('resize', onResize);

    const onMD = (e: MouseEvent) => {
      const s = coverCropState.current; s.drag.active = true;
      s.drag.sx = e.clientX; s.drag.sy = e.clientY;
      s.drag.ox = s.x; s.drag.oy = s.y;
      setGuideActive(true);
    };
    const onMM = (e: MouseEvent) => {
      const s = coverCropState.current; if (!s.drag.active) return;
      s.x = s.drag.ox + (e.clientX - s.drag.sx);
      s.y = s.drag.oy + (e.clientY - s.drag.sy);
      coverClampCrop(); scheduleDraw();
    };
    const onMU = () => { coverCropState.current.drag.active = false; setGuideActive(false); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      coverZoomCrop(e.deltaY > 0 ? -0.08 : 0.08, p.x, p.y);
    };

    const getDist = (ts: TouchList) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      const s = coverCropState.current;
      if (e.touches.length === 1) {
        s.drag.active = true;
        s.drag.sx = e.touches[0].clientX; s.drag.sy = e.touches[0].clientY;
        s.drag.ox = s.x; s.drag.oy = s.y;
        setGuideActive(true);
      } else if (e.touches.length === 2) {
        s.drag.active = false; setGuideActive(false);
        s.pinch.active = true;
        s.pinch.startDist = getDist(e.touches);
        s.pinch.startScale = s.scale;
        const r = stage.getBoundingClientRect();
        s.pinch.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left - canvas.width / 2;
        s.pinch.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top - canvas.height / 2;
      }
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      const s = coverCropState.current;
      if (s.drag.active && e.touches.length === 1) {
        s.x = s.drag.ox + (e.touches[0].clientX - s.drag.sx);
        s.y = s.drag.oy + (e.touches[0].clientY - s.drag.sy);
        coverClampCrop(); scheduleDraw();
      } else if (s.pinch.active && e.touches.length === 2) {
        const d = getDist(e.touches);
        const ns = Math.max(s.minScale, Math.min(s.maxScale, s.pinch.startScale * (d / s.pinch.startDist)));
        const sd = ns / s.scale;
        s.x = s.pinch.midX + (s.x - s.pinch.midX) * sd;
        s.y = s.pinch.midY + (s.y - s.pinch.midY) * sd;
        s.scale = ns; coverClampCrop(); scheduleDraw();
      }
    };
    const onTE = (e: TouchEvent) => {
      const s = coverCropState.current;
      if (e.touches.length < 2) s.pinch.active = false;
      if (e.touches.length === 0) { s.drag.active = false; setGuideActive(false); }
    };

    canvas.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTS, { passive: false });
    canvas.addEventListener('touchmove', onTM, { passive: false });
    canvas.addEventListener('touchend', onTE);
    canvas.addEventListener('touchcancel', onTE);

    return () => {
      canvas.removeEventListener('mousedown', onMD);
      window.removeEventListener('mousemove', onMM);
      window.removeEventListener('mouseup', onMU);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTS);
      canvas.removeEventListener('touchmove', onTM);
      canvas.removeEventListener('touchend', onTE);
      canvas.removeEventListener('touchcancel', onTE);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
    };
  }, [coverCropSrc, coverShowResult]);

  return (
    <View style={st.root}>
      <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover Image — nav & controls overlaid on top */}
        <TouchableOpacity style={st.coverWrap} onPress={() => coverInputRef.current?.click()} activeOpacity={0.9}>
          {coverUrl ? (
            <Image source={{ uri: (coverUrl.includes('?') ? coverUrl : coverUrl + '?') + '&u=' + (localStorage.getItem('user_id') || '0') + '&v=' + coverKey }} style={[st.coverImg, { opacity: coverOpacity }]} />
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

        {/* ── Profile head ── */}
        <View style={st.profileHead}>
          <Text style={st.profileName}>{username}</Text>
          <Text style={st.profileEmail}>{email || '—'}</Text>
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
            <TouchableOpacity onPress={() => { setSignatureDraft(signature); setSignatureEditing(true); }}>
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
                  <TouchableOpacity key={l} onPress={() => { setLang(l); setLangState(l); onLangChange?.(); }}>
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

        {/* ── Section: Danger ── */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('dangerZone')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
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

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" ref={coverInputRef as any} style={{ display: 'none' }} onChange={handleCoverSelect} />
      <input type="file" accept="image/*" ref={avatarInputRef as any} style={{ display: 'none' }} onChange={handleAvatarSelect} />

      {/* Toast */}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />

      {/* Shared modals */}
      <LogoutConfirmModal visible={showLogoutModal} onClose={() => setShowLogoutModal(false)} onLogout={onLogout} />
      <ThemePickerModal
        visible={showThemeModal}
        onClose={() => setShowThemeModal(false)}
        showCoverTools
        coverOpacity={coverOpacity}
        onCoverOpacityChange={handleCoverOpacityChange}
        onChooseCover={() => coverInputRef.current?.click()}
        onResetCover={handleCoverReset}
        coverUploading={coverUploading}
      />

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

      {/* ====== AVATAR CROP MODAL (portal) ====== */}
      {cropSrc !== '' && !showResult && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any} onClick={(e: any) => { if (e.target === e.currentTarget) setCropSrc(''); }}>
          <View style={cropS.header as any}>
            <Text style={cropS.title}>调整头像</Text>
            <TouchableOpacity onPress={() => setCropSrc('')} style={cropS.closeBtn as any}>
              <Text style={cropS.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={cropS.stage as any} ref={stageRef as any}>
            <canvas ref={canvasRef as any}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
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
              <Text style={cropS.pillText}>拖动移动 · 双指缩放</Text>
            </View>
          </View>
          <View style={cropS.toolbar as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>A</Text>
              <input type="range" min="0" max="100" defaultValue={0}
                onChange={(e: any) => {
                  const s = cropState.current;
                  const t = Number(e.target.value) / 100;
                  s.scale = s.minScale + (s.maxScale - s.minScale) * t * 0.5;
                  s.scale = Math.max(s.minScale, s.scale);
                  clampCrop(); drawCrop();
                }}
                style={{ flex: 1, height: 3, appearance: 'none', cursor: 'pointer', accentColor: '#5B5BD6', background: 'rgba(255,255,255,0.2)', borderRadius: 2 } as any}
              />
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>A</Text>
            </View>
            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 10 }} />
            <TouchableOpacity style={cropS.toolBtn as any} onPress={() => { cropState.current.rotation = (cropState.current.rotation + 90) % 360; drawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 109-9H9m0 0l3 3m-3-3l3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>旋转</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.toolBtn as any} onPress={() => { cropState.current.flipX = !cropState.current.flipX; drawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>翻转</Text>
            </TouchableOpacity>
          </View>
          <View style={cropS.actions as any}>
            <TouchableOpacity style={cropS.cancelBtn as any} onPress={() => setCropSrc('')}>
              <Text style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.confirmBtn as any} onPress={confirmCrop}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>使用此头像</Text>
            </TouchableOpacity>
          </View>
          {cropMsg !== '' && (
            <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>{cropMsg}</Text>
          )}
        </div>,
        document.body
      )}

      {/* ====== AVATAR RESULT PREVIEW ====== */}
      {showResult && cropResult !== '' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)' } as any} onClick={(e: any) => { if (e.target === e.currentTarget) { setShowResult(false); setCropSrc(''); } }}>
          <View style={cropS.resultCard as any}>
            <View style={cropS.resultBadge as any}>
              <Text style={{ fontSize: 20, color: '#1B7A4A' }}>✓</Text>
            </View>
            <Text style={cropS.resultLabel}>头像已更新</Text>
            <View style={cropS.sizePreviews as any}>
              {[80, 48, 32].map((size) => (
                <View key={size} style={{ alignItems: 'center', gap: 6 }}>
                  <img src={cropResult} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} />
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{size}px</Text>
                </View>
              ))}
            </View>
            <Text style={cropS.resultSub}>在不同场景下的显示效果</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' }}>
              <TouchableOpacity style={cropS.reEditBtn as any} onPress={() => { setShowResult(false); }}>
                <Text style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>重新裁剪</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cropS.saveBtn as any} onPress={doUpload}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>确认使用</Text>
              </TouchableOpacity>
            </View>
          </View>
        </div>,
        document.body
      )}

      {/* ====== COVER CROP MODAL (portal) ====== */}
      {coverCropSrc !== '' && !coverShowResult && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any} onClick={(e: any) => { if (e.target === e.currentTarget) { setCoverCropSrc(''); setCoverCropResult(''); } }}>
          <View style={cropS.header as any}>
            <Text style={cropS.title}>编辑封面</Text>
            <TouchableOpacity onPress={() => { setCoverCropSrc(''); setCoverCropResult(''); }} style={cropS.closeBtn as any}>
              <Text style={cropS.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={cropS.stage as any} ref={coverStageRef as any}>
            <canvas ref={coverCanvasRef as any}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
            />
            <View style={cropS.guideWrap as any} pointerEvents="none">
              <View style={{ width: 320, height: Math.round(320 * 260 / 375), borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', position: 'relative', transition: 'border-color 0.2s', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' } as any} ref={coverGuideRef as any}>
                <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '33.3%' } as any} />
                <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '66.6%' } as any} />
                <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '33.3%' } as any} />
                <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '66.6%' } as any} />
              </View>
            </View>
          </View>
          <View style={cropS.toolbar as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>A</Text>
              <input type="range" min="0" max="100" defaultValue={0}
                onChange={(e: any) => {
                  const s = coverCropState.current;
                  const t = Number(e.target.value) / 100;
                  s.scale = s.minScale + (s.maxScale - s.minScale) * t * 0.5;
                  s.scale = Math.max(s.minScale, s.scale);
                  coverClampCrop(); coverDrawCrop();
                }}
                style={{ flex: 1, height: 3, appearance: 'none', cursor: 'pointer', accentColor: '#5B5BD6', background: 'rgba(255,255,255,0.2)', borderRadius: 2 } as any}
              />
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>A</Text>
            </View>
            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 10 }} />
            <TouchableOpacity style={cropS.toolBtn as any} onPress={() => { coverCropState.current.rotation = (coverCropState.current.rotation + 90) % 360; coverDrawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 109-9H9m0 0l3 3m-3-3l3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>旋转</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.toolBtn as any} onPress={() => { coverCropState.current.flipX = !coverCropState.current.flipX; coverDrawCrop(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>翻转</Text>
            </TouchableOpacity>
          </View>
          <View style={cropS.actions as any}>
            <TouchableOpacity style={cropS.cancelBtn as any} onPress={() => { setCoverCropSrc(''); setCoverCropResult(''); }}>
              <Text style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cropS.confirmBtn as any} onPress={coverConfirmCrop}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 6 }}>
                <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>使用此封面</Text>
            </TouchableOpacity>
          </View>
          {coverCropMsg !== '' && (
            <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>{coverCropMsg}</Text>
          )}
        </div>,
        document.body
      )}

      {/* ====== COVER RESULT PREVIEW ====== */}
      {coverShowResult && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)' } as any} onClick={(e: any) => { if (e.target === e.currentTarget) { setCoverShowResult(false); setCoverCropSrc(''); } }}>
          <View style={cropS.resultCard as any}>
            <View style={cropS.resultBadge as any}>
              <Text style={{ fontSize: 20, color: '#1B7A4A' }}>✓</Text>
            </View>
            <Text style={cropS.resultLabel}>封面已更新</Text>
            {coverCropResult ? <img src={coverCropResult} width={240} height={Math.round(240 * coverCropState.current.cropRatio)} style={{ borderRadius: 4, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)' }} /> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' }}>
              <TouchableOpacity style={cropS.reEditBtn as any} onPress={() => { setCoverShowResult(false); }}>
                <Text style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>重新裁剪</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cropS.saveBtn as any} onPress={coverDoUpload}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>确认使用</Text>
              </TouchableOpacity>
            </View>
          </View>
        </div>,
        document.body
      )}
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
    // Profile head
    profileHead: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 12 },
    profileName: { fontSize: 26, fontWeight: '700', color: colors.textMain, letterSpacing: -0.2 } as any,
    profileEmail: { fontSize: 12, color: colors.textSub, marginTop: 4 } as any,
    signatureText: { fontSize: 12, color: colors.textSub, marginTop: 6, fontStyle: 'italic' } as any,
    signatureInput: {
      fontSize: 13, color: colors.textMain,
      paddingVertical: 4, flex: 1,
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
    stage: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000', cursor: 'move' } as any,
    guideWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as any,
    guideCircle: {
      width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)',
      position: 'relative', transition: 'border-color 0.2s',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
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
    resultCard: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -160 }, { translateY: -100 }], backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: 20, padding: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: 320, alignItems: 'center', gap: 12 } as any,
    resultBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,122,74,0.2)', justifyContent: 'center', alignItems: 'center' } as any,
    resultLabel: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },
    sizePreviews: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' } as any,
    resultSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    reEditBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' } as any,
    saveBtn: { flex: 2, padding: 12, borderRadius: 10, backgroundColor: '#5B5BD6', justifyContent: 'center', alignItems: 'center' } as any,
  };
}
