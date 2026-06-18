import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n';
import { useServerDate } from '../hooks/useServerDate';
import { api } from '../api/client';
import Toast from '../components/Toast';
import ModalOverlay from '../components/ModalOverlay';
import ConfirmModal from '../components/ConfirmModal';
import InvoiceScreen from './InvoiceScreen';
import SlideScreen from '../components/SlideScreen';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { FONTS } from '../theme';
import { modalCardAnimation, modalClose } from '../sharedStyles';

import {
  partnerShare, translateName, translateDividendNote, getRoleKey,
  usePartnerData,
} from './partner/usePartnerData';

import { formatDate } from '../utils/format';
import PlusIcon from '../components/icons/PlusIcon';
import MinusIcon from '../components/icons/MinusIcon';
import { getCurrentUserId } from '../utils/storage';
import { useCropCanvas } from '../hooks/useCropCanvas';
import ButtonPair from '../components/ButtonPair';
import { fmtDecInput } from '../utils/numbers';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useModalClose, modalExitStyle } from '../hooks/useModalClose';

/* ========== SVG ICONS (exact 8600 paths) ========== */

function IconBuilding({ color = '#7D2329' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path strokeLinecap="round" strokeLinejoin="round"
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </Svg>
  );
}

function IconCoins({ color = '#D59A53' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </Svg>
  );
}

function IconPeople({ color = '#8C8583' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </Svg>
  );
}


export default function PartnerScreen({ onBack, onProfile, refreshKey = 0 }: { onBack: () => void; onProfile?: () => void; refreshKey?: number }) {
  const sd = useServerDate();
  const [toast, setToast] = useState('');
  const [cropMsg, setCropMsg] = useState('');
  const {
    partners,
    dividends,
    totalDiv,
    loadingData,
    loadData,
    grouped,
    groupKeys,
    getPartnerHistory,
  } = usePartnerData(setToast, refreshKey);
  const [showDividend, setShowDividend] = useState(false);
  const [showDelete, setShowDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDetail, setShowDetail] = useState<any>(null);
  const { exiting: detailExiting, handleClose: handleCloseDetail } = useModalClose(() => setShowDetail(null));
  const [showOrg, setShowOrg] = useState(false);
  const { exiting: orgExiting, handleClose: handleCloseOrg } = useModalClose(() => setShowOrg(false));
  const [showInvoice, setShowInvoice] = useState(false);
  const [divAmount, setDivAmount] = useState('');
  const [divRoundNum, setDivRoundNum] = useState(0);
  const [divPreview, setDivPreview] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  // Pulled from LangContext — re-renders on LangContext value change
  // instead of capturing curLang at mount.
  const { setLang: setLangState } = useLang();

  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarKey, setAvatarKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Crop
  const [cropSrc, setCropSrc] = useState('');
  const [cropResult, setCropResult] = useState('');  // data URL after crop
  const [showResult, setShowResult] = useState(false);
  // Canvas-based crop — refs avoid React re-renders on every pixel move
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

  const { colors } = useTheme();
  const swipeBack = useSwipeBack(onBack);

  const s = useMemo(() => getS(colors), [colors]);
  const mo = useMemo(() => getMo(colors), [colors]);
  const moBody = useMemo(() => getMoBody(colors), [colors]);
  const ds = useMemo(() => getDs(colors), [colors]);
  const org = useMemo(() => getOrg(colors), [colors]);
  const tg = useMemo(() => getTg(colors), [colors]);
  const cropS = useMemo(() => ({
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
    // Result preview
    resultCard: {
      position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -160 }, { translateY: -100 }],
      backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: 20, padding: 32,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', width: 320, alignItems: 'center', gap: 12,
    } as any,
    resultBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,122,74,0.2)', justifyContent: 'center', alignItems: 'center' } as any,
    resultLabel: { fontSize: 14, fontWeight: '600' as const, color: '#fff' },
    sizePreviews: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' } as any,
    resultSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    reEditBtn: {
      flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center', alignItems: 'center',
    } as any,
    saveBtn: {
      flex: 2, padding: 12, borderRadius: 10, backgroundColor: '#5B5BD6',
      justifyContent: 'center', alignItems: 'center',
    } as any,
  }), [colors]);

  const calcPreview = (total: number) => {
    setDivPreview(partners.map((p: any) => ({
      name: translateName(p.name, p.name_pinyin, p.name_tw),
      share: (partnerShare[p.name] ?? 0.33) * 100,
      amount: parseFloat((total * (partnerShare[p.name] ?? 0.33)).toFixed(2)),
    })));
  };

  const handleDividend = async () => {
    if (!divAmount) return;
    const amt = parseFloat(divAmount);
    const items = partners.map((p: any) => ({
      partner: p.name,
      amount: parseFloat((amt * (partnerShare[p.name] ?? 0.33)).toFixed(2)),
      note: `第${divRoundNum}次`,
    }));
    try {
      await api.createDividend({ items });
      setShowDividend(false);
      setDivAmount(''); setDivRoundNum(0); setDivPreview([]);
      loadData();
    } catch {
      setToast(t('toastSubmitFailed'));
    }
  };

  const handleDelete = async () => {
    if (showDelete === null) return;
    setDeleting(true);
    setDeleteError('');
    const toDelete = dividends.filter((d: any) => d.note === showDelete);
    let failed = 0;
    for (const d of toDelete) {
      try { await api.deleteDividend(d.id); }
      catch { failed++; }
    }
    if (failed > 0) {
      setDeleteError(`删除失败：${failed}/${toDelete.length} 条记录`);
      setDeleting(false);
    } else {
      setDeleting(false);
      setShowDelete(null);
      loadData();
    }
  };

  const switchLang = (l: string) => {
    // setLangState (from LangContext) writes curLang + localStorage +
    // server AND triggers a re-render — replacing the old
    // two-step `setLang(l); setLangState(l);`.
    setLangState(l);
    loadData();
  };

  const loadAvatar = async () => {
    const uid = getCurrentUserId();
    if (!uid) return;
    const CACHE_KEY = 'partner_avatar_b64';
    // Serve from cache immediately to avoid flash
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) setAvatarUrl(cached);
    } catch {}
    try {
      const b64 = await api.getUserAvatar(uid);
      if (b64) {
        setAvatarUrl(b64);
        try { sessionStorage.setItem(CACHE_KEY, b64); } catch {}
      }
    } catch {}
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setCropSrc(src);
      setCropMsg(''); setShowResult(false);
      // @ts-ignore web-only: document.createElement('img')
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => {
        cropImgRef.current = img;
        setupCanvas();
        fitImage();
        drawCrop();
      };
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
      const outSize = 400;
      const output = document.createElement('canvas');
      output.width = outSize; output.height = outSize;
      const octx = output.getContext('2d')!;
      // Circular clip
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
    } catch (e) { console.error('crop failed', e); setCropMsg('裁切失败，请重试'); }
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
      if (resp.status === 'ok') {
        setShowResult(false);
        setCropSrc('');
        setCropResult('');
        setAvatarKey(k => k + 1);
        loadAvatar();
      } else { setCropMsg('上传失败'); }
    } catch (e) { console.error('upload failed', e); setCropMsg('上传失败，请重试'); }
  };

  // ── Canvas helpers ──
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

  const setupCanvas = () => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    // Dynamic crop circle — 76% of smaller dimension (reference behavior)
    const s = cropState.current;
    s.cropSize = Math.round(Math.min(rect.width, rect.height) * 0.76);
    // Update guide circle size imperatively (avoids React re-render)
    const guide = guideRef.current;
    if (guide) {
      guide.style.width = s.cropSize + 'px';
      guide.style.height = s.cropSize + 'px';
      guide.style.borderRadius = (s.cropSize / 2) + 'px';
    }
  };

  // ── Re-fit image when guide circle size changes ──
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

  const zoomCrop = (delta: number, cx: number, cy: number) => {
    const s = cropState.current;
    const newScale = Math.max(s.minScale, Math.min(s.maxScale, s.scale * (1 + delta)));
    const sd = newScale / s.scale;
    // Zoom toward point (cx,cy) in canvas-local coords relative to center
    s.x = cx + (s.x - cx) * sd;
    s.y = cy + (s.y - cy) * sd;
    s.scale = newScale;
    clampCrop();
    drawCrop();
  };

  const updateSliderPct = () => {
    const s = cropState.current;
    const t = (s.scale - s.minScale) / ((s.maxScale - s.minScale) * 0.5);
    return Math.max(0, Math.min(100, t * 100));
  };

  // ── Pill auto-hide (3s) ──
  const hidePill = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const pill = stage.querySelector('[data-pill]') as HTMLElement;
    if (pill) pill.style.opacity = '0';
  };

  useEffect(() => {
    if (!cropSrc || showResult) return;
    const stage = stageRef.current;
    if (!stage) return;
    const timer = setTimeout(() => {
      const pill = stage.querySelector('[data-pill]') as HTMLElement;
      if (pill) pill.style.opacity = '0';
    }, 3000);
    return () => clearTimeout(timer);
  }, [cropSrc, showResult]);

  // ── Shared crop event binding (mouse / touch / wheel / resize) ──
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

  useEffect(() => { loadAvatar(); }, []);

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.container}>

          {/* ====== HEADER ====== */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <View style={s.titleRow}>
                <View style={s.redBar} />
                <View>
                  <Text style={s.mainTitle}>{t('partnerTitle')}</Text>
                  <Text style={s.engSub}>Lan's Luosifen · Partner Capital</Text>
                </View>
              </View>
            </View>
            <View style={{ position: 'relative', marginTop: -4, marginRight: -18 }}>
            <TouchableOpacity onPress={onProfile}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatar} key={avatarKey} />
              ) : (
                <Image source={{ uri: '/img/logo.jpg' }} style={s.avatar} />
              )}
            </TouchableOpacity>
            </View>
            <input type="file" accept="image/*" ref={fileInputRef as any}
              style={{ display: 'none' }} onChange={handleAvatarSelect} />
          </View>

          {/* ====== 3 STAT CARDS (8600 exact) ====== */}
          <View style={s.statGrid}>
            <TouchableOpacity style={s.statCard} activeOpacity={0.7} onPress={() => setShowInvoice(true)}>
              <View style={[s.statIconBg, { backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                <IconBuilding color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{t('totalCapital')}</Text>
                <Text style={s.statValue}>¥130,000</Text>
                <Text style={s.statGreen}>{t('paidInRate')} 100%</Text>
              </View>
            </TouchableOpacity>

            <View style={s.statCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View style={[s.statIconBg, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <IconCoins color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.statLabel}>{t('distributedPool')}</Text>
                  <Text style={[s.statValue, { color: colors.primary }]}>¥{totalDiv.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  <Text style={s.statSub}>{t('cumulativeByShare')}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.dividendBtn} onPress={() => { setDivRoundNum(groupKeys.length + 1); setShowDividend(true); }}>
                <Text style={s.dividendBtnText}>{t('issueDividend')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.statCard} onPress={() => setShowOrg(true)}>
              <View style={[s.statIconBg, { backgroundColor: colors.bg }]}>
                <IconPeople color={colors.textSub} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{t('partnerSeats')}</Text>
                <Text style={[s.statValue, { color: colors.textMain }]}>3 {t('shareholders')}</Text>
                <Text style={s.statSub}>{t('lpStructure')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ====== PARTNER CARDS ====== */}
          <View style={s.partnerGrid}>
            {partners.map((p: any) => {
              const initInv = p.init_capital || 0;
              const midInv = p.add_amount || 0;
              const pct = p.investment > 0 ? Number((p.total_dividends / p.investment * 100).toFixed(0)) : 0;
              const rem = Math.max(0, p.investment - p.total_dividends);
              const isBack = p.total_dividends >= p.investment;
              return (
                <TouchableOpacity key={p.id} style={s.partnerCard} onPress={() => setShowDetail(p)}>
                  <View style={s.partnerHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.partnerName}>{translateName(p.name, p.name_pinyin, p.name_tw)}</Text>
                      <Text style={s.partnerPct}>{(p.share * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={s.paidBadge}>
                      <Text style={s.paidBadgeText}>{t('investComplete')}</Text>
                    </View>
                  </View>
                  <View style={s.partnerDataRow}>
                    <View style={s.partnerDataCell}>
                      <Text style={s.dataLabel}>{t('subscribedTotal')}</Text>
                      <Text style={s.dataValue}>¥{p.investment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={s.partnerDataCell}>
                      <Text style={s.dataLabel}>{t('initial')}</Text>
                      <Text style={s.dataValue}>¥{initInv.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={s.partnerDataCell}>
                      <Text style={s.dataLabel}>{t('additional')}</Text>
                      <Text style={s.dataValue}>¥{midInv.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>
                  <View style={s.partnerFooter}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={s.footerLabel}>{t('totalDividendsPaid')}</Text>
                      <Text style={s.footerAmt}>¥{p.total_dividends.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={s.footerSub}>{t('paybackRate')} {pct}%</Text>
                      {isBack ? (
                        <Text style={{ fontSize: FONTS.micro.size, color: colors.success, fontWeight: FONTS.micro.weight }}>{t('fullyPaidBack')}</Text>
                      ) : (
                        <Text style={{ fontSize: FONTS.micro.size, color: colors.primary, fontWeight: FONTS.micro.weight }}>{t('pendingPayback')} ¥{rem.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ====== CAPITAL LEDGER ====== */}
          <View style={s.ledgerCard}>
            <View style={s.ledgerHeader}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.ledgerTitle}>{t('capitalLedger')}</Text>
                <Text style={s.ledgerSub}>{t('byRoundAndInvest')}</Text>
              </View>
              <View style={s.filterRow}>
                {(['all', 'invest', 'mid', 'dividend'] as const).map(f => (
                  <TouchableOpacity key={f} onPress={() => setFilter(f)}
                    style={[s.filterBtn, filter === f && s.filterBtnActive]}>
                    <Text style={[s.filterBtnText, filter === f && s.filterBtnActiveText]}>{t(f)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(filter === 'all' || filter === 'invest') && (
              <TableGroup title={`${t('initial')} · ${formatDate(partners[0]?.init_date || '2024-04-01')}`} type="invest"
                total={partners.reduce((s: number, p: any) => s + (p.init_capital || 0), 0)}
                themeColors={colors} styles={tg}
                items={partners.map((p: any) => ({
                  name: translateName(p.name, p.name_pinyin, p.name_tw),
                  sub: `${(p.share * 100).toFixed(0)}%`,
                  amount: p.init_capital || 0,
                }))} />
            )}
            {(filter === 'all' || filter === 'mid') && (
              <TableGroup title={`${t('additional')} · ${formatDate(partners[0]?.add_date || '2025-01-21')}`} type="mid"
                total={partners.reduce((s: number, p: any) => s + (p.add_amount || 0), 0)}
                themeColors={colors} styles={tg}
                items={partners.map((p: any) => ({
                  name: translateName(p.name, p.name_pinyin, p.name_tw),
                  sub: `${(p.share * 100).toFixed(0)}%`,
                  amount: (p.investment || 0) - (p.init_capital || 0),
                }))} />
            )}
            {(filter === 'all' || filter === 'dividend') && groupKeys.map(note => {
              const items = grouped[note];
              const total = items.reduce((s: number, d: any) => s + d.amount, 0);
              return (
                <TableGroup key={note} title={translateDividendNote(note, items[0].date)} type="dividend" total={total}
                  themeColors={colors} styles={tg}
                  items={items.map((d: any) => ({ name: translateName(d.partner, d.name_pinyin, d.name_tw), sub: '', amount: d.amount }))}
                  onDelete={() => setShowDelete(note)} />
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ====== DIVIDEND MODAL ====== */}
        <ModalOverlay visible={showDividend} overlayStyle={mo.overlay} contentStyle={mo.content} onClose={() => setShowDividend(false)}>
          <View style={mo.modalCard} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{t('issueProportional')}</Text>
                <Text style={[mo.sub, { color: colors.textSub }]}>{t('autoByShare')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDividend(false)}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={moBody.body}>
              <View>
                <Text style={moBody.label}>{t('totalToPool')}</Text>
                <TextInput style={moBody.input} placeholder={t('enterAmount')} value={divAmount}
                  onChangeText={(v) => { const clean = fmtDecInput(v); setDivAmount(clean); calcPreview(parseFloat(clean) || 0); }}
                  keyboardType="decimal-pad" placeholderTextColor={colors.textSub} />
              </View>
              <View>
                <Text style={moBody.label}>{t('roundNote')}</Text>
                <View style={[moBody.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                  {(() => {
                    const fmt = (t('dividendRoundFmt') as string).replace('{date}', formatDate(sd.today));
                    const idx = fmt.indexOf('{n}');
                    const prefix = fmt.slice(0, idx);
                    const suffix = fmt.slice(idx + 3);
                    const min = groupKeys.length + 1;
                    const disabled = divRoundNum <= min;
                    const btn = { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' } as const;
                    return (<>
                      <Text style={{ fontSize: 14, color: colors.textSub }}>{prefix}</Text>
                      <TouchableOpacity onPress={() => setDivRoundNum(n => Math.max(min, n - 1))} disabled={disabled}
                        style={{ ...btn, backgroundColor: disabled ? 'transparent' : colors.bg, borderWidth: 1, borderColor: disabled ? 'transparent' : colors.primary, opacity: disabled ? 0.25 : 1 }}>
                        <MinusIcon color={colors.primary} size={12} />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textMain, minWidth: 18, textAlign: 'center' }}>{divRoundNum}</Text>
                      <TouchableOpacity onPress={() => setDivRoundNum(n => n + 1)}
                        style={{ ...btn, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.primary }}>
                        <PlusIcon color={colors.primary} size={12} />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 14, color: colors.textSub }}>{suffix}</Text>
                    </>);
                  })()}
                </View>
              </View>
              <View style={moBody.preview}>
                <Text style={moBody.previewTitle}>{t('shareCalcResult')}</Text>
                {(divPreview.length > 0 ? divPreview : partners.map((p: any) => ({
                  name: translateName(p.name, p.name_pinyin, p.name_tw),
                  share: (partnerShare[p.name] ?? 0.33) * 100,
                  amount: 0,
                }))).map((item: any) => (
                  <View key={item.name} style={moBody.previewRow}>
                    <Text style={moBody.previewName}>{item.name} ({item.share.toFixed(0)}%)</Text>
                    <Text style={moBody.previewAmt}>¥ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                ))}
              </View>
              <ButtonPair
                leftLabel={t('cancel')}
                leftOnPress={() => setShowDividend(false)}
                rightLabel={t('confirmIssue')}
                rightOnPress={handleDividend}
                rightDisabled={!divAmount || parseFloat(divAmount) <= 0}
              />
            </View>
          </View>
        </ModalOverlay>

      {/* ====== DELETE MODAL ====== */}
      <ConfirmModal
        visible={showDelete !== null}
        title={t('confirmDeleteRecord')}
        message={deleteError ? (
          <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'center' }}>{deleteError}</Text>
        ) : (
          <>{t('willDelete')}<Text style={{ fontWeight: '600', color: colors.primary }}>{translateDividendNote(showDelete, grouped[showDelete ?? '']?.[0]?.date)}</Text>{t('allDividendRecords')}</>
        )}
        confirmLabel={deleting ? '删除中…' : t('confirmDeleteRecord')}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDelete(null); setDeleteError(''); }}
      />

      {/* ====== PARTNER DETAIL MODAL (8600 exact) ====== */}
      {(showDetail || detailExiting) && (
        <ModalOverlay visible={!!showDetail && !detailExiting} overlayStyle={mo.overlay} contentStyle={mo.content} onClose={handleCloseDetail}>
          <View style={[mo.modalCard, { maxWidth: 360 }, detailExiting && modalExitStyle as any]} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{translateName(showDetail.name, showDetail.name_pinyin, showDetail.name_tw)}</Text>
                <Text style={[mo.sub, { color: colors.textSub }]}>{t(getRoleKey(showDetail.name, showDetail.linked_user_role))} · {t('sharePercent')} {(showDetail.share * 100).toFixed(0)}%</Text>
              </View>
              <TouchableOpacity onPress={handleCloseDetail}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={moBody.body}>
              <View style={ds.grid}>
                <View style={[ds.cell, { backgroundColor: colors.bg }]}>
                  <Text style={ds.cellLabel}>{t('totalInvest')}</Text>
                  <Text style={ds.cellNum}>¥{(showDetail.investment || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                  <Text style={[ds.cellLabel, { color: colors.primary }]}>{t('totalDividends')}</Text>
                  <Text style={[ds.cellNum, { color: colors.primary, fontSize: FONTS.micro.size }]}>¥{(showDetail.total_dividends || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: colors.bg }]}>
                  <Text style={ds.cellLabel}>{t('initialInvest')}</Text>
                  <Text style={ds.cellNumSmall}>¥{(showDetail.init_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: colors.bg }]}>
                  <Text style={ds.cellLabel}>{t('additional')}</Text>
                  <Text style={ds.cellNumSmall}>¥{(showDetail.add_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
              {showDetail.investment > 0 && (
                <View style={ds.progressWrap}>
                  <View style={ds.progressLabel}>
                    <Text style={ds.progressLabelText}>{t('paybackProgress')}</Text>
                    <Text style={[ds.progressLabelText, { fontWeight: '600' }]}>
                      {t('paybackRate')} {Math.min(100, Math.round((showDetail.total_dividends || 0) / showDetail.investment * 100))}%
                    </Text>
                  </View>
                  <View style={ds.progressBar}>
                    <View style={[ds.progressFill, {
                      width: `${Math.min(100, ((showDetail.total_dividends || 0) / showDetail.investment * 100))}%` as any,
                      backgroundColor: (showDetail.total_dividends || 0) >= showDetail.investment ? colors.success : colors.primary,
                    }]} />
                  </View>
                  <View style={{ marginTop: 4 }}>
                    {(showDetail.total_dividends || 0) >= showDetail.investment ? (
                      <Text style={{ fontSize: FONTS.micro.size, color: colors.success, fontWeight: FONTS.micro.weight }}>{t('fullyPaidBackDetail')}</Text>
                    ) : (
                      <Text style={{ fontSize: FONTS.micro.size, color: colors.primary }}>
                        {t('pendingPayback')} ¥{(showDetail.investment - (showDetail.total_dividends || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {/* Dividend History */}
              <View>
                <Text style={ds.historyTitle}>{t('dividendHistory')}</Text>
                {(() => {
                  const hist = getPartnerHistory(showDetail.name);
                  return hist.length > 0 ? (
                    hist.map((h, i) => (
                      <View key={i} style={ds.historyRow}>
                        <Text style={ds.historyNote}>{h.note}</Text>
                        <Text style={ds.historyAmt}>¥{h.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={ds.historyEmpty}>{t('noDividendRecords')}</Text>
                  );
                })()}
              </View>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== ORG CHART MODAL (8600 exact) ====== */}
        <ModalOverlay visible={showOrg && !orgExiting} overlayStyle={mo.overlay} contentStyle={mo.content} onClose={handleCloseOrg}>
          <View style={[mo.modalCard, { maxWidth: 360 }, orgExiting && modalExitStyle as any]} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{t('partnerStructure')}</Text>
                <Text style={mo.sub}>{t('lpControl')}</Text>
              </View>
              <TouchableOpacity onPress={handleCloseOrg}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={org.body}>
              {partners.map((p: any, i: number) => {
                const roleKey = getRoleKey(p.name, p.linked_user_role);
                const isChairman = roleKey === 'chairman';
                return (
                <View key={p.id} style={{ alignItems: 'center', width: '100%' }}>
                  {i > 0 && <View style={org.line} />}
                  <View style={org.node}>
                    <Text style={[org.nodeName, isChairman && { color: colors.primary }]}>{translateName(p.name, p.name_pinyin, p.name_tw)}</Text>
                    <Text style={org.nodeRole}>{t(roleKey)} · {(p.share * 100).toFixed(0)}%</Text>
                  </View>
                </View>
                );
              })}
              <Text style={org.joke}>{t('jokeClosedLoop')}</Text>
            </View>
          </View>
        </ModalOverlay>

      {/* ====== CROP MODAL (portal to body — escapes stacking context, covers nav bar) ====== */}
      {cropSrc !== '' && !showResult && createPortal(
        // @ts-ignore web-only overlay
        <View style={cropS.overlay as any} onClick={(e: any) => { if (e.target === e.currentTarget) setCropSrc(''); }}>
          {/* Header */}
          <View style={cropS.header as any}>
            <Text style={cropS.title}>调整头像</Text>
            <TouchableOpacity onPress={() => setCropSrc('')} style={cropS.closeBtn as any}>
              <Text style={cropS.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Crop stage */}
          <View
            // @ts-ignore web-only
            style={cropS.stage} ref={stageRef as any}>
            {/* @ts-ignore */}
            <canvas ref={canvasRef as any}
              style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', userSelect: 'none' }}
            />
            {/* Guide overlay */}
            <View style={cropS.guideWrap as any} pointerEvents="none">
              {/* @ts-ignore */}
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
            {/* Hint pill */}
            {/* @ts-ignore */}
            <View style={cropS.pill as any} pointerEvents="none" data-pill="true">
              <Text style={cropS.pillText}>拖动移动 · 双指缩放</Text>
            </View>
          </View>

          {/* Toolbar */}
          <View style={cropS.toolbar as any}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>A</Text>
              <input type="range" min="0" max="100" defaultValue={0}
                ref={(el) => { if (el) (el as any)._hermesSlider = el; }}
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

          {/* Actions */}
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
        </View>,
        document.body
      )}

      {/* ====== RESULT PREVIEW ====== */}
      {showResult && cropResult !== '' && createPortal(
        // @ts-ignore
        <View style={cropS.overlay as any} onClick={(e: any) => { if (e.target === e.currentTarget) { setShowResult(false); setCropSrc(''); } }}>
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
        </View>,
        document.body
      )}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />

      {/* ====== INVOICE SCREEN (portaled to body — covers nav bar) ====== */}
      {showInvoice && createPortal(
        <SlideScreen
          visible={showInvoice}
          onClose={() => setShowInvoice(false)}
        >
          {(close) => <InvoiceScreen onBack={close} />}
        </SlideScreen>,
        document.body
      )}
    </View>
  );
}

/* ========== TABLE GROUP ========== */

function TableGroup({ title, type, total, items, themeColors, styles, onDelete }: {
  title: string; type: string; total: number; items: { name: string; sub: string; amount: number }[];
  themeColors: ThemeColors;
  styles: ReturnType<typeof getTg>;
  onDelete?: () => void;
}) {
  const typeColors: Record<string, { dot: string; headerBg: string; badge: string; amt: string }> = {
    invest: { dot: themeColors.info, headerBg: withAlpha(themeColors.info, 0.1), badge: themeColors.info, amt: themeColors.textMain },
    mid: { dot: themeColors.info, headerBg: withAlpha(themeColors.info, 0.1), badge: themeColors.info, amt: themeColors.textMain },
    dividend: { dot: themeColors.primary, headerBg: withAlpha(themeColors.primary, 0.1), badge: themeColors.primary, amt: themeColors.primary },
  };
  const c = typeColors[type] || typeColors.invest;
  return (
    <View style={styles.card}>
      <View style={[styles.theadRow, { backgroundColor: c.headerBg }]}>
        <View style={styles.thLeft}>
          <View style={[styles.dot, { backgroundColor: c.dot }]} />
          <Text style={styles.thTitle}>{title}</Text>
        </View>
        <View style={styles.thRight}>
          <Text style={[styles.thAmt, { color: c.amt }]}>¥{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete}>
              <Text style={styles.delBtn}>{t('deleteRecord')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.tbodyRow}>
          <Text style={styles.tdName}>{item.name}
            {item.sub ? <Text style={styles.tdSub}> · {item.sub}</Text> : null}
          </Text>
          <Text style={[styles.tdAmt, { color: c.amt }]}>¥{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
      ))}
    </View>
  );
}

/* ========== STYLES (theme-aware get functions) ========== */

const getS = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  container: { maxWidth: 1024, alignSelf: 'center', width: '100%', paddingHorizontal: 0, paddingTop: 16, paddingBottom: 100 },
  header: { borderBottomWidth: 1, borderBottomColor: colors.bg, paddingBottom: 14, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  backArrow: { fontSize: FONTS.h1.size, color: colors.textSub, lineHeight: 22, fontWeight: '300' },
  backText: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  redBar: { width: 8, height: 36, backgroundColor: colors.primary, borderRadius: 100 },
  mainTitle: { fontSize: FONTS.h2.size, fontWeight: FONTS.h2.weight, color: colors.textMain, letterSpacing: -0.3 },
  engSub: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, letterSpacing: 0.3, marginTop: 1 },
  langRow: { flexDirection: 'row', gap: 4, paddingTop: 4 },
  langBtn: { fontSize: FONTS.micro.size, color: colors.textSub, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, fontWeight: FONTS.micro.weight as any },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: withAlpha(colors.primary, 0.12), justifyContent: 'center', alignItems: 'center' },
  avatarRing: { borderWidth: 1.5, borderColor: colors.bg, borderStyle: 'dashed' as any },
  avatarInitial: { fontSize: 16, fontWeight: '600', color: colors.primary },
  camBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22,
    backgroundColor: colors.primary, borderRadius: 11,
    borderWidth: 2, borderColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  langActive: { color: colors.primary, backgroundColor: withAlpha(colors.danger, 0.1), fontWeight: FONTS.microBold.weight as any },
  statGrid: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 200, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.bg,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  statIconBg: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, letterSpacing: 0.3 },
  statValue: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain, marginTop: 2 },
  statGreen: { fontSize: 10, color: '#1EE69F', fontWeight: FONTS.micro.weight, marginTop: 2 },
  statSub: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight, marginTop: 2 },
  dividendBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  dividendBtnText: { color: colors.surface, fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight },
  partnerGrid: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  partnerCard: {
    flex: 1, minWidth: 200, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.bg,
    padding: 16, gap: 10, // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  partnerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partnerName: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
  partnerPct: { fontSize: FONTS.micro.size, color: colors.textSub },
  paidBadge: { backgroundColor: withAlpha(colors.success, 0.18), borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  paidBadgeText: { fontSize: 10, fontWeight: FONTS.microBold.weight, color: '#1EE69F' },
  partnerDataRow: { flexDirection: 'row', gap: 4 },
  partnerDataCell: { flex: 1, alignItems: 'center' },
  dataLabel: { fontSize: FONTS.micro.size, color: colors.textSub },
  dataValue: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
  partnerFooter: { borderTopWidth: 1, borderTopColor: colors.bg, paddingTop: 6 },
  footerLabel: { fontSize: FONTS.micro.size, color: colors.primary, fontWeight: FONTS.micro.weight },
  footerAmt: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.primary },
  footerSub: { fontSize: FONTS.micro.size, color: colors.textSub },
  ledgerCard: {
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.bg, marginTop: 16,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  ledgerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.bg, gap: 12 },
  ledgerTitle: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, letterSpacing: 0.5 },
  ledgerSub: { fontSize: FONTS.micro.size, color: colors.textSub },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100, backgroundColor: colors.bg },
  filterBtnActive: { backgroundColor: colors.textMain },
  filterBtnText: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight as any, color: colors.textSub },
  filterBtnActiveText: { color: colors.surface, fontWeight: FONTS.microBold.weight as any },
});

const getMo = (colors: ThemeColors) => StyleSheet.create({
  overlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'center', alignItems: 'center', padding: 16 },
  content: { alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: 16, width: 360, maxWidth: '100%', overflow: 'hidden',
    // @ts-ignore
    ...modalCardAnimation,
    // @ts-ignore
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.surface },
  sub: { fontSize: FONTS.micro.size, color: withAlpha(colors.danger, 0.1), marginTop: 2 },
  close: { ...modalClose, },
});

const getMoBody = (colors: ThemeColors) => StyleSheet.create({
  body: { padding: 20, gap: 12 },
  label: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, marginBottom: 4 },
  input: { width: '100%', backgroundColor: colors.bg, borderWidth: 1, borderColor: 'transparent', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight as any, color: colors.textMain, fontFamily: undefined },
  preview: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, gap: 8 },
  previewTitle: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, letterSpacing: 0.5 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewName: { fontSize: FONTS.micro.size, color: colors.textSub, fontWeight: FONTS.micro.weight },
  previewAmt: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textMain },
  deleteBox: { backgroundColor: withAlpha(colors.primary, 0.1), borderRadius: 12, padding: 12, alignItems: 'center' },
  deleteText: { fontSize: FONTS.micro.size, color: colors.textSub, textAlign: 'center' },
});

const getDs = (colors: ThemeColors) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flex: 1, flexBasis: '45%' as any, borderRadius: 12, padding: 12 },
  cellLabel: { fontSize: FONTS.micro.size, fontWeight: FONTS.micro.weight, color: colors.textSub },
  cellNum: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain, marginTop: 2 },
  cellNumSmall: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textMain, marginTop: 2 },
  progressWrap: { backgroundColor: colors.bg, borderRadius: 12, padding: 12 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabelText: { fontSize: FONTS.micro.size, color: colors.textSub },
  progressBar: { height: 6, backgroundColor: colors.secondary, borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },
  historyTitle: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub, letterSpacing: 0.5, marginBottom: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: withAlpha(colors.primary, 0.1), borderRadius: 8, marginBottom: 4 },
  historyNote: { fontSize: FONTS.micro.size, color: colors.textSub },
  historyAmt: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.primary },
  historyEmpty: { fontSize: FONTS.micro.size, color: colors.textSub, textAlign: 'center', paddingVertical: 12 },
});

const getOrg = (colors: ThemeColors) => StyleSheet.create({
  body: { padding: 20, alignItems: 'center' },
  node: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.secondary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, width: '100%', alignItems: 'center' },
  nodeName: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: colors.textSub },
  nodeRole: { fontSize: FONTS.micro.size, color: colors.textSub, marginTop: 2, fontWeight: FONTS.micro.weight },
  line: { width: 2, height: 24, backgroundColor: colors.secondary },
  joke: { fontSize: FONTS.microBold.size, color: colors.textSub, textAlign: 'center', marginTop: 20, lineHeight: 16, fontWeight: FONTS.microBold.weight },
});

const getTg = (colors: ThemeColors) => StyleSheet.create({
  card: { borderTopWidth: 1, borderTopColor: colors.bg },
  theadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.bg },
  thLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  thTitle: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, color: colors.textSub },
  thMid: { width: 40, alignItems: 'center' },
  thBadge: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight },
  thRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  thAmt: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight },
  delBtn: { fontSize: FONTS.micro.size, fontWeight: FONTS.body.weight, color: colors.danger, marginLeft: 8 },
  tbodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.bg },
  tdName: { fontSize: FONTS.micro.size, color: colors.textSub, flex: 1, paddingLeft: 16 },
  tdSub: { fontSize: FONTS.micro.size, color: colors.textSub },
  tdMid: { width: 40 },
  tdAmt: { fontSize: FONTS.microBold.size, fontWeight: FONTS.microBold.weight, paddingRight: 16 },
});
