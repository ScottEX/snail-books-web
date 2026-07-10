import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { t } from '../../i18n';
import { getCurrentUserId } from '../../utils/storage';
import { useCropCanvas } from '../../hooks/useCropCanvas';

interface CoverCropState {
  x: number; y: number; scale: number; rotation: number; flipX: boolean;
  minScale: number; maxScale: number;
  cropW: number; cropH: number; cropRatio: number;
  drag: { active: boolean; sx: number; sy: number; ox: number; oy: number };
  pinch: { active: boolean; startDist: number; startScale: number; midX: number; midY: number };
}

export function useCoverCrop() {
  // ── Cover image state ──
  const [coverUrl, setCoverUrl] = useState('');
  const [coverKey, setCoverKey] = useState(0);
  const [coverOpacity, setCoverOpacity] = useState(1);
  const [coverUploading, setCoverUploading] = useState(false);

  // ── Cover crop state ──
  const [coverCropSrc, setCoverCropSrc] = useState('');
  const [coverCropResult, setCoverCropResult] = useState('');
  const [coverShowResult, setCoverShowResult] = useState(false);
  const [coverCropMsg, setCoverCropMsg] = useState('');
  const [coverZoomSlider, setCoverZoomSlider] = useState(0);
  const [coverCropLoading, setCoverCropLoading] = useState(false);

  // ── Cover crop refs ──
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverCropImgRef = useRef<HTMLImageElement | null>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverStageRef = useRef<HTMLDivElement | null>(null);
  const coverGuideRef = useRef<HTMLDivElement | null>(null);
  const coverCropState = useRef<CoverCropState>({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropW: 320, cropH: 208, cropRatio: 260 / 375,
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });

  // ── Canvas utilities ──
  const coverSetupCanvas = () => {
    const stage = coverStageRef.current;
    const canvas = coverCanvasRef.current;
    if (!stage || !canvas) return;
    const w = stage.offsetWidth;
    const h = stage.offsetHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const s = coverCropState.current;
    s.cropW = Math.round(w * 0.8);
    s.cropRatio = 260 / w;
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

  // ── useCropCanvas event binding ──
  const onCoverCropSetup = () => { coverSetupCanvas(); coverClampCrop(); coverDrawCrop(); };
  useCropCanvas({
    active: !!coverCropSrc && !coverShowResult,
    canvasRef: coverCanvasRef,
    stageRef: coverStageRef,
    guideRef: coverGuideRef,
    stateRef: coverCropState,
    scheduleDraw: coverDrawCrop,
    clampCrop: coverClampCrop,
    zoomCrop: coverZoomCrop,
    onSetup: onCoverCropSetup,
    onZoomChange: () => {
      const s = coverCropState.current;
      const range = (s.maxScale - s.minScale) * 0.5;
      const v = range > 0 ? Math.round(100 * (s.scale - s.minScale) / range) : 0;
      setCoverZoomSlider(Math.max(0, Math.min(100, v)));
    },
  });

  // ── User actions ──
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setCoverCropMsg(t('errFileSize')); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setCoverCropSrc(src); setCoverCropMsg(''); setCoverShowResult(false);
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => { coverCropImgRef.current = img; coverSetupCanvas(); coverFitImage(); coverDrawCrop(); setCoverZoomSlider(0); };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const coverConfirmCrop = () => {
    setCoverCropLoading(true);
    try {
      const img = coverCropImgRef.current;
      if (!img) { setCoverCropMsg('图片未加载'); setCoverCropLoading(false); return; }
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
      setCoverCropLoading(false);
    } catch { setCoverCropMsg('裁切失败，请重试'); setCoverCropLoading(false); }
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

  const handleCoverOpacityChange = (v: number) => {
    setCoverOpacity(v);
    try {
      const uid = getCurrentUserId();
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

  // ── Load cover from server ──
  const loadCover = async () => {
    try {
      const r: any = await api.getProfileCover();
      if (r?.url) setCoverUrl(r.url);
    } catch {}
    try {
      const uid = getCurrentUserId();
      const saved = localStorage.getItem(uid ? `cover-opacity-${uid}` : 'cover-opacity');
      if (saved !== null) setCoverOpacity(parseFloat(saved));
    } catch {}
  };

  return {
    // State
    coverUrl, setCoverUrl, coverKey, setCoverKey,
    coverOpacity, setCoverUploading, coverUploading,
    coverCropSrc, coverCropResult, coverShowResult, coverCropMsg,
    setCoverCropSrc, setCoverCropResult, setCoverShowResult, setCoverCropMsg,
    // Zoom slider
    coverZoomSlider, setCoverZoomSlider,
    // Refs
    coverInputRef, coverCropImgRef, coverCanvasRef, coverStageRef, coverGuideRef,
    // Actions
    handleCoverSelect, coverConfirmCrop, coverDoUpload,
    handleCoverOpacityChange, handleCoverReset,
    loadCover,
    // Crop toolbar actions
    coverCropState, coverClampCrop, coverDrawCrop,
    // Loading
    coverCropLoading,
  };
}
