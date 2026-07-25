import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors, ENTER_DURATION, EXIT_DURATION, ENTER_EASING, EXIT_EASING, CONTENT_MAX_WIDTH } from '../theme';
import { t, getLang } from '../i18n';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  batchId?: number;
  batchNumber?: number;
  supplier?: string;
  fileUrl?: string;
  title?: string;
  onBack: () => void;
}

const NAV_H = 50;

const getCSS = (c: ThemeColors) => {
  const r = parseInt(c.bg.slice(1,3),16);
  const g = parseInt(c.bg.slice(3,5),16);
  const b = parseInt(c.bg.slice(5,7),16);
  const btnBg = `rgba(${r},${g},${b},0.30)`;
  const btnBgActive = `rgba(${r},${g},${b},0.45)`;
  return `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
.pv-nav{position:absolute;top:0;left:0;right:0;z-index:100;height:${NAV_H}px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:transparent;backdrop-filter:saturate(200%) blur(30px);border-bottom:0.5px solid rgba(0,0,0,0.06)}
.pv-nav-l{display:flex;align-items:center;gap:10px}
.pv-back{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:${btnBgActive}}
.pv-back svg{width:16px;height:16px;stroke:#2C2626;stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:#2C2626;letter-spacing:.01em}
.pv-share-btn{width:36px;height:36px;border-radius:50%;background:${btnBg};border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0}
.pv-share-btn:active{background:${btnBgActive};transform:scale(.92)}
.pv-share-btn svg{width:16px;height:16px;stroke:#8C8583;stroke-width:2;fill:none}
.pv-vp{position:absolute;top:${NAV_H}px;left:0;right:0;bottom:0;overflow:auto;background:#F9F7F4;-webkit-overflow-scrolling:touch;touch-action:auto}
.pv-obj{width:100%;min-height:100%;border:none;display:block}
.pv-err{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#555;font-size:14px;text-align:center;padding:40px}
.pv-err svg{display:block}
.pv-err-msg{font-size:13px;color:#999}
.pv-err-btn{padding:10px 28px;border-radius:8px;background:${c.accent};color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .15s}
.pv-err-btn:active{opacity:.8}
.pv-intro-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:200;pointer-events:none}
.pv-intro{background:#F9F7F4;border-radius:8px;padding:16px 24px;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.pv-intro.on{opacity:1;transform:translateY(0)}
.pv-intro-text{color:#999;font-size:15px;text-align:center;white-space:nowrap}
.pv-intro-sec{font-size:36px;font-weight:800;font-family:'DM Mono',monospace}
@keyframes pv-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes pv-slide-out{from{transform:translateX(0)}to{transform:translateX(100%)}}
.pv-root{background:linear-gradient(to bottom,transparent 56px,#F9F7F4 56px);animation:pv-slide-in ${ENTER_DURATION}ms ${ENTER_EASING} both}
.pv-root.out{animation:pv-slide-out ${EXIT_DURATION}ms ${EXIT_EASING} both}
`;
};

export default function PdfPreviewPage({ batchId, batchNumber, supplier, fileUrl, title: customTitle, onBack }: Props) {
  const { colors: c } = useTheme();
  const st = useMemo(() => getStyles(c), [c]);
  const title = customTitle || t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = fileUrl
    || (supplier
      ? `/api/procurement-batches/${batchId}/pdf?supplier=${encodeURIComponent(supplier)}`
      : `/api/procurement-batches/${batchId}/pdf`);
  const isLocal = pdfUrl.startsWith('blob:');

  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const pdfBlobRef = useRef<Blob | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [exiting, setExiting] = useState(false);
  const [introSec, setIntroSec] = useState(0);

  const handleBack = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onBack, EXIT_DURATION);
  }, [exiting, onBack]);

  const swipeBack = useSwipeBack(handleBack);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(pdfUrl, { credentials: 'include', headers: { 'X-Lang': getLang() } });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const blob = await res.blob();
        if (blob.size === 0) throw new Error('Empty PDF (0 bytes)');
        if (!cancelled) {
          setPdfBlobUrl(URL.createObjectURL(blob));
          pdfBlobRef.current = blob;
          setPdfLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setPdfError(e?.message || String(e)); setPdfLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfLoading) { setIntroSec(0); return; }
    setIntroSec(0);
    const id = setInterval(() => setIntroSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [pdfLoading]);

  const doDownload = useCallback(async () => {
    const blob = pdfBlobRef.current;
    if (!blob) return;
    const file = new File([blob], `procurement_${batchId}_${getLang()}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; }
      catch (e) { if ((e as DOMException).name === 'AbortError') return; }
    }
    const dlBlob = new Blob([blob], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(dlBlob);
    a.download = `procurement_${batchId}_${getLang()}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [batchId, title]);

  const doDownloadImage = useCallback(async () => {
    const pngUrl = batchId
      ? (supplier
        ? `/api/procurement-batches/${batchId}/png?supplier=${encodeURIComponent(supplier)}`
        : `/api/procurement-batches/${batchId}/png`)
      : `${fileUrl}/png`;
    const dlName = batchId ? `procurement_${batchId}_${getLang()}.png` : `invoice_${getLang()}.png`;
    try {
      const res = await fetch(pngUrl, { credentials: 'include', headers: { 'X-Lang': getLang() } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], dlName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title }); return; }
        catch (e) { if ((e as DOMException).name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = dlName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { /* silently fail */ }
  }, [batchId, supplier, title, fileUrl]);

  return (
    <View style={st.container} {...swipeBack}>
      {createPortal(<div className={`pv-root${exiting ? ' out' : ''}`} style={{ position: 'absolute', inset: 0, zIndex: 9999, marginLeft: 'auto', marginRight: 'auto', maxWidth: CONTENT_MAX_WIDTH }}>
        <style dangerouslySetInnerHTML={{ __html: getCSS(c) }} />

        <div className="pv-nav">
          <div className="pv-nav-l">
            <div className="pv-back" onClick={handleBack}><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg></div>
            <div><div className="pv-title">{title}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isLocal && (
            <>
            <div className="pv-share-btn" onClick={doDownload} title={t('downloadPdf')}>
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#2C2626" strokeWidth="2" fill="none"/><polyline points="7 10 12 15 17 10" stroke="#2C2626" strokeWidth="2" fill="none"/><line x1="12" y1="15" x2="12" y2="3" stroke="#2C2626" strokeWidth="2"/></svg>
            </div>
            <div className="pv-share-btn" onClick={doDownloadImage} title={t('downloadImage')}>
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="#2C2626" strokeWidth="2" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="#2C2626"/><polyline points="21 15 16 10 5 21" stroke="#2C2626" strokeWidth="2" fill="none"/><line x1="12" y1="18" x2="12" y2="12" stroke="#2C2626" strokeWidth="2"/><polyline points="9 15 12 12 15 15" stroke="#2C2626" strokeWidth="2" fill="none"/></svg>
            </div>
            </>
            )}
          </div>
        </div>

        {pdfLoading && !pdfError && (
          <div className="pv-intro-overlay">
            <div className="pv-intro on">
              <div className="pv-intro-text">{t('pdfGenerating')}</div>
              <div className="pv-intro-sec" style={{ color: c.primary }}>{introSec}s</div>
            </div>
          </div>
        )}

        {pdfError && (
          <div className="pv-err" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
            <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
              <circle cx="24" cy="24" r="20" stroke="#e0dcd5" strokeWidth="1.5" fill="#f5f2eb" />
              <line x1="24" y1="14" x2="24" y2="28" />
              <circle cx="24" cy="33" r="1.5" fill="#999" stroke="none" />
            </svg>
            <div>{t('pdfLoadFailed')}</div>
            <div className="pv-err-msg">{pdfError}</div>
            <button className="pv-err-btn" onClick={() => { setPdfError(''); setPdfLoading(true); setPdfBlobUrl(''); }}>{t('retry')}</button>
          </div>
        )}

        {pdfBlobUrl && !pdfError && (
          <div className="pv-vp">
            <object className="pv-obj" data={pdfBlobUrl} type="application/pdf" title={title}>
              <p>{t('pdfLoadFailed')}</p>
            </object>
          </div>
        )}
      </div>, document.body)}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
