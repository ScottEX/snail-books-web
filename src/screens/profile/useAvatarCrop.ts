import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { t } from '../../i18n';
import { getCurrentUserId } from '../../utils/storage';
import { useCropCanvas } from '../../hooks/useCropCanvas';

interface AvatarCropState {
  x: number; y: number; scale: number; rotation: number; flipX: boolean;
  minScale: number; maxScale: number;
  cropSize: number;
  drag: { active: boolean; sx: number; sy: number; ox: number; oy: number };
  pinch: { active: boolean; startDist: number; startScale: number; midX: number; midY: number };
}

const CACHE_KEY_AVATAR = 'cached_avatar_b64';

export function useAvatarCrop(onAvatarChange?: () => void) {
  // ── Avatar image state ──
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarKey, setAvatarKey] = useState(0);

  // ── Avatar crop state ──
  const [cropSrc, setCropSrc] = useState('');
  const [cropResult, setCropResult] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [cropMsg, setCropMsg] = useState('');

  // ── Avatar crop refs ──
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const cropState = useRef<AvatarCropState>({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropSize: 160,
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });
  const pillTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Canvas utilities ──
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

  const hidePill = () => {
    if (pillTimer.current) clearTimeout(pillTimer.current);
    pillTimer.current = setTimeout(() => {
      const guide = guideRef.current;
      if (guide) guide.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.55)';
    }, 600);
  };

  // ── useCropCanvas event binding ──
  const onCropSetup = () => { setupCanvas(); clampCrop(); drawCrop(); };
  useCropCanvas({
    active: !!cropSrc && !showResult,
    canvasRef, stageRef, guideRef, stateRef: cropState,
    scheduleDraw: drawCrop,
    clampCrop,
    zoomCrop,
    onSetup: onCropSetup,
    onBeforeDrag: hidePill,
  });

  // ── User actions ──
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setCropMsg(t('errFileSize')); e.target.value = ''; return; }
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

  const confirmCrop = () => {
    try {
      const img = cropImgRef.current;
      if (!img) { setCropMsg('图片未加载'); return; }
      const s = cropState.current;
      const outW = 320, outH = 320;
      const output = document.createElement('canvas');
      output.width = outW; output.height = outH;
      const octx = output.getContext('2d')!;
      const outScale = outW / s.cropSize;
      octx.translate(outW / 2 + s.x * outScale, outH / 2 + s.y * outScale);
      octx.rotate(s.rotation * Math.PI / 180);
      if (s.flipX) octx.scale(-1, 1);
      octx.scale(s.scale * outScale, s.scale * outScale);
      octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      setCropResult(output.toDataURL('image/png'));
      setShowResult(true);
    } catch { setCropMsg('裁切失败，请重试'); }
  };

  const doUpload = async () => {
    if (!cropResult) return;
    try {
      const uid = getCurrentUserId();
      if (!uid) { setCropMsg('用户未登录'); return; }
      const arr = cropResult.split(',');
      const mime = (arr[0].match(/:(.*?);/) || ['', 'image/png'])[1];
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: mime });
      const file = new File([blob], 'avatar.png', { type: mime });
      const form = new FormData();
      form.append('file', file);
      const r: any = await api.uploadAvatar(form);
      if (r?.url) {
        setAvatarUrl(r.url); setAvatarKey(k => k + 1);
        setCropSrc(''); setCropResult(''); setShowResult(false);
        try { sessionStorage.setItem(CACHE_KEY_AVATAR, r.url); } catch {}
        onAvatarChange?.();
      } else { setCropMsg('上传失败'); }
    } catch { setCropMsg('上传失败，请重试'); }
  };

  // ── Load avatar from server ──
  const loadAvatar = async () => {
    const uid = getCurrentUserId();
    if (!uid) return;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_AVATAR);
      if (cached) setAvatarUrl(cached);
    } catch {}
    try {
      const b64 = await api.getUserAvatar(uid);
      if (b64) {
        setAvatarUrl(b64);
        try { sessionStorage.setItem(CACHE_KEY_AVATAR, b64); } catch {}
      }
    } catch {}
  };

  return {
    // State
    avatarUrl, setAvatarUrl, avatarKey, setAvatarKey,
    cropSrc, cropResult, showResult, cropMsg,
    setCropSrc, setCropResult, setShowResult, setCropMsg,
    // Refs
    cropImgRef, canvasRef, stageRef, guideRef,
    // Actions
    handleAvatarSelect, confirmCrop, doUpload,
    loadAvatar,
    // Toolbar
    cropState, clampCrop, drawCrop,
  };
}
