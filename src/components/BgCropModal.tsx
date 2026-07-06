import { View, Text, TouchableOpacity } from 'react-native';
import { createPortal } from 'react-dom';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { MODAL_CARD_RADIUS } from '../sharedStyles';
import { useCropCanvas } from '../hooks/useCropCanvas';
import { useEffect, useRef, useState } from 'react';

interface BgCropModalProps {
  visible: boolean;
  onClose: () => void;
  /** DataURL of the image to crop. When this changes from '' to a data
   *  URL, the modal loads it into the canvas. When cleared, the canvas
   *  is reset. The file picker lives in the parent (ThemePickerModal),
   *  so BgCropModal does NOT open the system file dialog itself. */
  imageSrc: string;
  /** Called when the modal wants to clear the image (e.g. on close /
   *  cancel / recrop reset). Parent should set imageSrc back to ''. */
  onClearImage: () => void;
  /** Called with a JPEG Blob after the user confirms the crop.
   *  Caller is responsible for upload + any post-upload state updates. */
  onConfirm: (blob: Blob) => void | Promise<void>;
  /** Called after the upload triggered by onConfirm has resolved
   *  successfully. Distinct from onClose (which fires on cancel /
   *  ✕ / overlay click) so the parent can decide to close the WHOLE
   *  surrounding modal on upload success without affecting the
   *  cancel-flow. */
  onUploaded?: () => void;
  /** Optional crop aspect ratio (height/width). Default: viewport ratio,
   *  so the cropped image fills the fullscreen background without black
   *  bars or distortion. Clamped to [0.5, 2.4] to match existing UX. */
  aspectRatio?: number;
  /** Title shown in the header. */
  title?: string;
  /** Label of the confirm button. */
  confirmLabel?: string;
}

/** Fullscreen crop modal used by the background image flow.
 *  Originally embedded in HomeScreen; extracted so ProfileScreen's
 *  "主题" button (which sets the background image) can use the same
 *  crop experience. Output aspect ratio is viewport-adaptive by
 *  default — the cropped image is intended to fill the screen. */
export default function BgCropModal({
  visible, onClose, imageSrc, onClearImage,
  onConfirm, onUploaded, aspectRatio, title, confirmLabel,
}: BgCropModalProps) {
  // ── Internal crop state machine ──
  //   cropping → user is adjusting the crop
  //   preview  → user clicked "使用此图片", shows preview with "再编辑 / 确认使用" buttons
  //   uploading → confirm pressed, onConfirm is in flight
  const [src, setSrc] = useState('');
  const [msg, setMsg] = useState('');
  const [phase, setPhase] = useState<'cropping' | 'preview' | 'uploading'>('cropping');
  const [cropBlob, setCropBlob] = useState<Blob | null>(null);
  const [cropDataUrl, setCropDataUrl] = useState('');
  const [zoomSlider, setZoomSlider] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    x: 0, y: 0, scale: 1, rotation: 0, flipX: false, minScale: 1, maxScale: 8,
    cropW: 320, cropH: 0, cropRatio: 9 / 16,
    drag: { active: false, sx: 0, sy: 0, ox: 0, oy: 0 },
    pinch: { active: false, startDist: 0, startScale: 1, midX: 0, midY: 0 },
  });

  // ── Load image into canvas whenever parent passes a new imageSrc ──
  // The file picker is owned by the parent (ThemePickerModal); this
  // modal just renders whatever imageSrc it is given. Going from '' →
  // dataURL loads the image; dataURL → '' clears the canvas.
  useEffect(() => {
    if (!imageSrc) {
      setSrc('');
      imgRef.current = null;
      return;
    }
    setSrc(imageSrc);
    const img = new Image() as HTMLImageElement;
    img.onload = () => {
      imgRef.current = img;
      // Wait one tick for the cropping-stage View to mount + canvas to
      // have measurable dimensions, then size the crop guide + fit.
      setTimeout(() => { setupCanvas(); fitImage(); drawCrop(); setZoomSlider(0); }, 0);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // ── Reset internal state on close ──
  useEffect(() => {
    if (!visible) {
      setSrc(''); setMsg(''); setPhase('cropping'); setCropBlob(null); setCropDataUrl('');
    }
  }, [visible]);

  const close = () => {
    setSrc(''); setMsg(''); setPhase('cropping'); setCropBlob(null); setCropDataUrl('');
    onClearImage();
    onClose();
  };

  // ── Canvas / crop geometry ──
  const setupCanvas = () => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const s = stateRef.current;
    if (aspectRatio != null) {
      s.cropRatio = Math.max(0.5, Math.min(2.4, aspectRatio));
    } else {
      s.cropRatio = window.innerHeight / window.innerWidth;
    }
    s.cropW = Math.min(rect.width, rect.height / s.cropRatio);
    s.cropH = s.cropW * s.cropRatio;
    const guide = guideRef.current;
    if (guide) {
      guide.style.width = s.cropW + 'px';
      guide.style.height = s.cropH + 'px';
    }
  };

  const fitImage = () => {
    const img = imgRef.current;
    if (!img) return;
    const s = stateRef.current;
    const sw = s.cropW / img.naturalWidth;
    const sh = s.cropH / img.naturalHeight;
    s.scale = Math.max(sw, sh) * 1.05;
    s.minScale = Math.max(sw, sh);
    s.x = 0; s.y = 0; s.rotation = 0; s.flipX = false;
  };

  const clampCrop = () => {
    const img = imgRef.current;
    if (!img) return;
    const s = stateRef.current;
    const hw = (img.naturalWidth * s.scale) / 2;
    const hh = (img.naturalHeight * s.scale) / 2;
    const hrh = s.cropH / 2, hrw = s.cropW / 2;
    const maxX = hw - hrw, maxY = hh - hrh;
    s.x = maxX > 0 ? Math.max(-maxX, Math.min(maxX, s.x)) : 0;
    s.y = maxY > 0 ? Math.max(-maxY, Math.min(maxY, s.y)) : 0;
  };

  const drawCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!ctx || !img || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = stateRef.current;
    ctx.save();
    ctx.translate(canvas.width / 2 + s.x, canvas.height / 2 + s.y);
    ctx.rotate(s.rotation * Math.PI / 180);
    if (s.flipX) ctx.scale(-1, 1);
    ctx.scale(s.scale, s.scale);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  const zoomCrop = (delta: number, cx: number, cy: number) => {
    const s = stateRef.current;
    const newScale = Math.max(s.minScale, Math.min(s.maxScale, s.scale * (1 + delta)));
    const sd = newScale / s.scale;
    s.x = cx + (s.x - cx) * sd;
    s.y = cy + (s.y - cy) * sd;
    s.scale = newScale;
    clampCrop();
    drawCrop();
  };

  // ── Shared crop event binding (mouse / touch / wheel / resize) ──
  // Extracted to useCropCanvas hook — also used by ProfileScreen and PartnerScreen.
  const onCropSetup = () => { setupCanvas(); clampCrop(); drawCrop(); };
  useCropCanvas({
    active: !!src && phase === 'cropping',
    canvasRef, stageRef, guideRef, stateRef,
    scheduleDraw: drawCrop,
    clampCrop,
    zoomCrop,
    onSetup: onCropSetup,
    onZoomChange: () => {
      const s = stateRef.current;
      const range = (s.maxScale - s.minScale) * 0.5;
      const v = range > 0 ? Math.round(100 * (s.scale - s.minScale) / range) : 0;
      setZoomSlider(Math.max(0, Math.min(100, v)));
    },
  });

  // ── Render result blob. Two paths:
  //   - 'cropping' phase (first confirm click) → render to blob + dataURL,
  //     set phase to 'preview'. User can still go back.
  //   - 'preview' phase (final confirm) → call onConfirm(blob).
  const handleConfirm = async () => {
    try {
      const img = imgRef.current;
      if (!img) { setMsg(t('imgNotLoaded')); return; }
      const s = stateRef.current;
      const outW = 1280;
      const outH = Math.max(320, Math.round(outW * s.cropRatio));
      const output = document.createElement('canvas');
      output.width = outW; output.height = outH;
      const octx = output.getContext('2d')!;
      const outScale = outW / s.cropW;
      octx.translate(outW / 2 + s.x * outScale, outH / 2 + s.y * outScale);
      octx.rotate(s.rotation * Math.PI / 180);
      if (s.flipX) octx.scale(-1, 1);
      octx.scale(s.scale * outScale, s.scale * outScale);
      octx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob: Blob = await new Promise((resolve, reject) => {
        output.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.92);
      });
      if (phase === 'cropping') {
        // Generate a dataURL for the preview thumbnail
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error('FileReader failed'));
          r.readAsDataURL(blob);
        });
        setCropBlob(blob);
        setCropDataUrl(dataUrl);
        setPhase('preview');
        return;
      }
      if (phase === 'preview') {
        setPhase('uploading');
        try {
          await onConfirm(blob);
          // Upload succeeded. Fire onUploaded (parent uses this to
          // close the surrounding modal). Do NOT call onClose here —
          // the parent's onConfirm wrapper already cleared our
          // imageSrc, which made us return null already. Calling
          // onClose would also clear the parent's imageSrc, which is
          // a no-op but obscures intent.
          setSrc(''); setMsg(''); setPhase('cropping'); setCropBlob(null); setCropDataUrl('');
          onUploaded?.();
        } catch (e: any) {
          setMsg(e?.message || t('uploadFailed'));
          setPhase('preview');
        }
      }
    } catch {
      setMsg(t('cropFailed'));
      setPhase('cropping');
    }
  };

  if (!visible) return null;
  // Don't render the modal shell until an image has been picked —
  // otherwise the user sees an empty "crop" frame before they've even
  // chosen a photo. The parent owns the file picker and sets imageSrc
  // before setting visible=true.
  if (imageSrc === '') return null;

  return createPortal(
    <div
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(8,8,12,0.92)', display: 'flex', flexDirection: 'column' } as any}
      onClick={(e: any) => { if (e.target === e.currentTarget) close(); }}
    >
      {/* Header */}
      <View style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 } as any}>
        <Text style={{ fontSize: 14, fontWeight: '600' as any, color: '#fff', letterSpacing: -0.2 }}>{title || t('editBg')}</Text>
        <TouchableOpacity onPress={close} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
          <Svg width="14" height="14" viewBox="0 0 1088 1024">
            <Path d="M843.712 191.936l-6.08-5.568-5.184-3.84-5.696-3.328a67.712 67.712 0 0 0-80.448 11.264L520.768 416.064l-224.64-224.64-2.688-2.56c-27.968-24.32-68.224-24.256-92.672 0.128l-4.8 5.12-4.608 6.144-3.392 5.632a67.84 67.84 0 0 0 11.328 80.512L424.96 512l-227.2 227.328c-24.32 28.16-24.32 68.48 0 92.864l5.12 4.8 6.208 4.608 5.632 3.392c26.816 14.336 59.136 9.984 80.448-11.328l225.6-225.728 227.072 227.2c28.608 24.832 68.928 24 94.336-1.472l4.544-5.056 4.096-5.568a67.84 67.84 0 0 0-8.64-85.312L616.64 512.064l224.512-224.64 4.16-4.352c23.04-26.752 22.4-67.008-1.6-91.136z" fill="rgba(255,255,255,0.7)" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Stage — cropping phase: live canvas crop. preview phase: thumbnail. */}
      {src !== '' && phase === 'cropping' && (
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#000', } as any} ref={stageRef as any}>
          <canvas
            ref={canvasRef as any}
            style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', } as any}
          />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' } as any} pointerEvents="none">
            <View
              style={{ borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', position: 'relative',  } as any}
              ref={guideRef as any}
            >
              <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '33.3%' } as any} />
              <View style={{ position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.18)', top: '66.6%' } as any} />
              <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '33.3%' } as any} />
              <View style={{ position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.18)', left: '66.6%' } as any} />
            </View>
          </View>
          <View style={{ position: 'absolute', bottom: 8, left: '50%', transform: [{ translateX: -75 }] as any, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' } as any} pointerEvents="none">
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' } as any}>{t('cropPill')}</Text>
          </View>
        </View>
      )}

      {/* Preview — shows the cropped result before upload. Action
          buttons live INSIDE the card so the user sees the image and
          the 重新裁剪 / 确认使用 buttons in one place, matching the
          cover-crop preview style. */}
      {phase === 'preview' && cropDataUrl !== '' && (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 } as any}>
          <View style={{ backgroundColor: 'rgba(28,28,32,0.95)', borderRadius: MODAL_CARD_RADIUS, padding: 24, alignItems: 'center', gap: 12, maxWidth: 360, width: '100%' } as any}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(27,122,74,0.2)', justifyContent: 'center', alignItems: 'center' } as any}>
              <Text style={{ fontSize: 20, color: '#1B7A4A' } as any}>✓</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' } as any}>{t('bgUpdated') || '预览'}</Text>
            <img
              src={cropDataUrl}
              style={{
                maxWidth: 280, maxHeight: 180,
                borderRadius: 4, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)',
              }}
              alt=""
            />
            {/* Hint text — sits ABOVE the action buttons, matching the
                avatar-result preview style. */}
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' } as any}>{t('bgResultHint')}</Text>
            {/* Action buttons — inside the card, under the hint text */}
            <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 } as any}>
              <TouchableOpacity
                style={{ flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' } as any}
                onPress={() => {
                  setPhase('cropping');
                  setMsg('');
                  // Preview 阶段 canvas/stage/view 不在 DOM 中（refs 变 null），
                  // 切回 cropping 后新元素挂载。src useEffect 依赖是
                  // [src, phase] 会重跑（含 setupCanvas + 绑事件），这里
                  // 再 setTimeout 0 跑一次 setupCanvas + drawCrop 让图片
                  // 立即可见（不等 src useEffect 内的 60ms setTimeout）。
                  setTimeout(() => { setupCanvas(); clampCrop(); drawCrop(); }, 0);
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)' } as any}>{t('recrop') || '再编辑'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, padding: 11, borderRadius: 12, backgroundColor: '#5B5BD6', justifyContent: 'center', alignItems: 'center' } as any}
                onPress={handleConfirm}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' } as any}>{t('confirmUse') || '确认使用'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Toolbar (only when cropping) */}
      {src !== '' && phase === 'cropping' && (
        <View style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', flexShrink: 0 } as any}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' } as any}>A</Text>
            <input
              type="range" min="0" max="100" value={zoomSlider}
              onChange={(e: any) => {
                const s = stateRef.current;
                const tt = Number(e.target.value) / 100;
                s.scale = s.minScale + (s.maxScale - s.minScale) * tt * 0.5;
                s.scale = Math.max(s.minScale, s.scale);
                setZoomSlider(Number(e.target.value));
                clampCrop(); drawCrop();
              }}
              style={{ flex: 1, height: 3, appearance: 'none', accentColor: '#5B5BD6', background: `linear-gradient(to right, #5B5BD6 ${zoomSlider}%, rgba(255,255,255,0.2) ${zoomSlider}%)`, borderRadius: 2 } as any}
            />
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' } as any}>A</Text>
          </View>
          <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 10 } as any} />
          <TouchableOpacity
            style={{ paddingVertical: 6, paddingHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 } as any}
            onPress={() => { stateRef.current.rotation = (stateRef.current.rotation + 90) % 360; drawCrop(); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M3 12a9 9 0 109-9H9m0 0l3 3m-3-3l3-3" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' } as any}>{t('cropRotate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 6, paddingHorizontal: 8, marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 } as any}
            onPress={() => { stateRef.current.flipX = !stateRef.current.flipX; drawCrop(); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v18M3 8l9-5 9 5M3 16l9 5 9-5" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' } as any}>{t('cropFlip')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Actions — different button set per phase */}
      {phase === 'cropping' && (
        <View style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', gap: 10, flexShrink: 0 } as any}>
          <TouchableOpacity
            style={{ flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' } as any}
            onPress={close}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.7)' } as any}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 2, padding: 11, borderRadius: 12, backgroundColor: '#5B5BD6', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' } as any}
            onPress={handleConfirm}
            disabled={!src}
          >
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 6 } as any}>
              <Text style={{ fontSize: 10, color: '#fff' } as any}>✓</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' } as any}>{confirmLabel || t('useThisBg')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'uploading' && (
        <View style={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', flexShrink: 0 } as any}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' } as any}>{t('uploading')}</Text>
        </View>
      )}

      {msg !== '' && phase !== 'cropping' && (
        <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: '500' } as any}>{msg}</Text>
      )}
      {msg !== '' && phase === 'cropping' && (
        <Text style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', paddingBottom: 8, fontWeight: '500' } as any}>{msg}</Text>
      )}
    </div>,
    document.body
  );
}
