import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, ThemeColors } from '../theme';
import { t } from '../i18n';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

const TOOLBAR_H = 72;

const CSS = `*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{--bg:#141416;--surface:#1E1E22;--surface2:#26262C;--surface3:#2E2E36;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);--text:#F0EDE8;--text2:rgba(240,237,232,.5);--text3:rgba(240,237,232,.28);--accent:#C0392B;--accent-dim:rgba(192,57,43,.15);--sans:'Noto Sans SC',sans-serif;--mono:'DM Mono',monospace}
html.pv-lock{overflow:hidden}

/* Navbar */
.pv-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:56px;display:flex;align-items:center;padding:0 16px;background:rgba(20,20,22,.85);backdrop-filter:blur(20px) saturate(1.5);border-bottom:1px solid var(--line)}
.pv-nav-l{display:flex;align-items:center;gap:10px}
.pv-back{width:36px;height:36px;border-radius:50%;background:var(--surface2);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.pv-back:active{background:var(--surface3)}
.pv-back svg{width:16px;height:16px;stroke:var(--text);stroke-width:2;fill:none;display:block}
.pv-title{font-size:15px;font-weight:600;color:var(--text);letter-spacing:.01em}
.pv-sub{font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:1px}

/* Toolbar */
.pv-tb{position:fixed;bottom:0;left:0;right:0;z-index:100;height:${TOOLBAR_H}px;background:rgba(20,20,22,.88);backdrop-filter:blur(20px) saturate(1.5);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-around;padding:0 8px 8px}
.pv-tb-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .15s;border:none;background:none;flex:1;max-width:90px}
.pv-tb-btn:active{background:var(--surface2);transform:scale(.95)}
.pv-tb-btn svg{width:20px;height:20px;stroke:var(--text2);stroke-width:1.7;fill:none}
.pv-tb-btn span{font-size:10px;color:var(--text3);font-family:var(--sans);white-space:nowrap}
.pv-tb-btn.hi svg{stroke:var(--accent)}
.pv-tb-btn.hi span{color:var(--accent)}
.pv-tb-sep{width:1px;height:36px;background:var(--line);flex-shrink:0}

/* Toast */
.pv-toast{position:fixed;bottom:${TOOLBAR_H + 16}px;left:50%;transform:translate(-50%,8px);background:rgba(30,30,34,.95);backdrop-filter:blur(16px);border:1px solid var(--line2);border-radius:10px;padding:10px 18px;font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px;z-index:200;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
.pv-toast.on{opacity:1;transform:translate(-50%,0)}

/* Share sheet */
.pv-sh-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:150;opacity:0;pointer-events:none;transition:opacity .25s}
.pv-sh-overlay.open{opacity:1;pointer-events:all}
.pv-sh{position:fixed;bottom:0;left:0;right:0;z-index:160;background:var(--surface);border-radius:20px 20px 0 0;padding:0 0 32px;transform:translateY(100%);transition:transform .3s cubic-bezier(.32,.72,0,1)}
.pv-sh-overlay.open .pv-sh{transform:none}
.pv-sh-handle{width:36px;height:4px;background:var(--line2);border-radius:2px;margin:12px auto 16px}
.pv-sh-title{font-size:13px;font-weight:600;color:var(--text2);text-align:center;margin-bottom:16px;letter-spacing:.04em}
.pv-sh-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:0;padding:0 8px;margin-bottom:16px}
.pv-sh-act{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 8px;cursor:pointer;border-radius:12px;transition:background .15s}
.pv-sh-act:active{background:var(--surface2)}
.pv-sh-icon{width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center}
.pv-sh-icon svg{width:22px;height:22px;stroke:#fff;stroke-width:1.8;fill:none}
.pv-sh-act span{font-size:11px;color:var(--text2)}
.pv-sh-cancel{margin:8px 16px 0;padding:14px;border-radius:14px;background:var(--surface2);border:1px solid var(--line2);text-align:center;font-size:14px;font-weight:500;color:var(--text2);cursor:pointer;transition:background .15s}
.pv-sh-cancel:active{background:var(--surface3)}
`;

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const [shareOpen, setShareOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ icon: string; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf#view=FitH`;

  // Lock body scroll
  useEffect(() => {
    document.documentElement.classList.add('pv-lock');
    return () => document.documentElement.classList.remove('pv-lock');
  }, []);

  const showToast = useCallback((icon: string, text: string) => {
    setToastMsg({ icon, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const doDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `procurement_${batchId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfUrl, batchId]);

  const doCopyLink = useCallback(() => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    showToast('🔗', '链接已复制');
  }, [showToast]);

  return (
    <View style={styles.container}>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)' }}>
          <style dangerouslySetInnerHTML={{ __html: CSS }} />

          {/* Navbar */}
          <div className="pv-nav">
            <div className="pv-nav-l">
              <div className="pv-back" onClick={onBack}>
                <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
              </div>
              <div>
                <div className="pv-title">{title}</div>
                <div className="pv-sub">NO.2026-{String(batchNumber).padStart(4, '0')}</div>
              </div>
            </div>
          </div>

          {/* PDF iframe — 只替换了这一块 */}
          <iframe
            src={pdfUrl}
            style={{
              position: 'fixed', top: 56, left: 0,
              width: '100%', height: `calc(100% - 56px - ${TOOLBAR_H}px)`,
              border: 'none', background: '#525659',
            }}
            title="PDF Preview"
          />

          {/* Toolbar */}
          <div className="pv-tb">
            <button className="pv-tb-btn" onClick={doDownload}>
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              <span>下载</span>
            </button>
            <div className="pv-tb-sep" />
            <button className="pv-tb-btn" onClick={() => setShareOpen(true)}>
              <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
              <span>分享</span>
            </button>
            <div className="pv-tb-sep" />
            <button className="pv-tb-btn" onClick={doCopyLink}>
              <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
              <span>复制链接</span>
            </button>
            <div className="pv-tb-sep" />
            <button className="pv-tb-btn hi" onClick={() => window.print()}>
              <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              <span>打印</span>
            </button>
          </div>

          {/* Toast */}
          <div className={`pv-toast${toastMsg ? ' on' : ''}`}>
            {toastMsg && <><span>{toastMsg.icon}</span><span>{toastMsg.text}</span></>}
          </div>

          {/* Share sheet */}
          <div className={`pv-sh-overlay${shareOpen ? ' open' : ''}`} onClick={() => setShareOpen(false)}>
            <div className="pv-sh" onClick={e => e.stopPropagation()}>
              <div className="pv-sh-handle" />
              <div className="pv-sh-title">分享进货单</div>
              <div className="pv-sh-acts">
                {[
                  ['微信', '#07c160', 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'],
                  ['朋友圈', '#fa9d3b', 'M12 2a10 10 0 100 20 10 10 0 000-20z M7 6.5c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5-1 2.5-2.5 2.5S7 8 7 6.5z M6 14c1.5-2 4-3 7-3s5.5 1 7 3'],
                  ['短信', '#4a90d9', 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'],
                  ['邮件', '#e06060', 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6'],
                  ['下载PDF', '#6c6c80', 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3'],
                  ['复制链接', '#5a5aaa', 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'],
                  ['更多', '#3a3a48', 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0 M19 12m-1 0a1 1 0 102 0 1 1 0 10-2 0 M5 12m-1 0a1 1 0 102 0 1 1 0 10-2 0'],
                ].map(([label, color, path]) => (
                  <div key={label} className="pv-sh-act" onClick={() => { setShareOpen(false); showToast('📤', `已分享至 ${label}`); }}>
                    <div className="pv-sh-icon" style={{ background: color }}>
                      <svg viewBox="0 0 24 24"><path d={path} /></svg>
                    </div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="pv-sh-cancel" onClick={() => setShareOpen(false)}>取消</div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({ container: { flex: 1 } });
