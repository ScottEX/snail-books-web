import React, { useState, useMemo, useCallback } from 'react';
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
const NAV_TOP = 44;
const NAV_PAD_T = 20;
const NAV_PAD_B = 8;
const NAV_CONTENT_H = 44;
const NAV_TOTAL_H = NAV_PAD_T + NAV_CONTENT_H + NAV_PAD_B;
const VIEWPORT_TOP = NAV_TOP + NAV_TOTAL_H;

const PORTAL_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);--text:#F0EDE8;--text2:rgba(240,237,232,.5);--text3:rgba(240,237,232,.28);--surface2:#26262C;--surface3:#2E2E36;--accent:#C0392B;--sans:'Noto Sans SC',sans-serif;--mono:'DM Mono',monospace}

.navbar{position:fixed;top:${NAV_TOP}px;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:${NAV_PAD_T}px 16px ${NAV_PAD_B}px;background:transparent;backdrop-filter:saturate(200%) blur(30px);-webkit-backdrop-filter:saturate(200%) blur(30px);border-bottom:0.5px solid rgba(0,0,0,0.06)}
.nav-back{width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.30);backdrop-filter:saturate(200%) blur(30px);-webkit-backdrop-filter:saturate(200%) blur(30px);border:0.5px solid rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
.nav-back:active{background:rgba(255,255,255,0.45)}
.nav-back svg{width:20px;height:20px;stroke:#2C2626;stroke-width:1.5;fill:none;display:block}
.nav-title{font-size:16px;font-weight:500;color:#2C2626;text-align:center}

.toolbar{position:fixed;bottom:0;left:0;right:0;z-index:100;height:${TOOLBAR_H}px;background:rgba(20,20,22,.88);backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-around;padding:0 8px 8px}
.tool-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all .15s;border:none;background:none;flex:1;max-width:90px}
.tool-btn:active{background:var(--surface2);transform:scale(.95)}
.tool-btn svg{width:20px;height:20px;stroke:var(--text2);stroke-width:1.7;fill:none}
.tool-btn span{font-size:10px;color:var(--text3);font-family:var(--sans);white-space:nowrap}
.tool-btn.highlight svg{stroke:var(--accent)}
.tool-btn.highlight span{color:var(--accent)}
.tool-sep{width:1px;height:36px;background:var(--line);flex-shrink:0}

.toast{position:fixed;bottom:${TOOLBAR_H + 16}px;left:50%;transform:translateX(-50%);background:rgba(30,30,34,.95);border:1px solid var(--line2);border-radius:10px;padding:10px 18px;font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px;z-index:200;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s}
.toast.show{opacity:1}
`;

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);
  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const pdfUrl = `/api/procurement-batches/${batchId}/pdf`;

  return (
    <View style={styles.container}>
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#141416' }}>
          <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
          {/* Navbar */}
          <div className="navbar">
            <div className="nav-back" onClick={onBack}>
              <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="nav-title">{title}</div>
            <div style={{ width: 44 }} />
          </div>

          {/* PDF iframe — browser native PDF viewer */}
          <iframe
            src={pdfUrl + '#view=FitH'}
            style={{
              position: 'fixed',
              top: VIEWPORT_TOP,
              left: 0, right: 0, bottom: TOOLBAR_H,
              border: 'none',
              background: '#525659',
            }}
            title="PDF Preview"
          />

          {/* Bottom toolbar */}
          <div className="toolbar">
            <button className="tool-btn" onClick={() => {
              const a = document.createElement('a');
              a.href = pdfUrl; a.download = `procurement_${batchId}.pdf`;
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }}>
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>下载</span>
            </button>
            <div className="tool-sep" />
            <button className="tool-btn" onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})}>
              <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              <span>复制链接</span>
            </button>
            <div className="tool-sep" />
            <button className="tool-btn highlight" onClick={() => window.print()}>
              <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              <span>打印</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
});
