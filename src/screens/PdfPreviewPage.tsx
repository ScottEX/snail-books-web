import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import BackArrow from '../components/icons/BackArrow';

interface Props {
  batchId: number;
  batchNumber: number;
  onBack: () => void;
}

interface Item {
  product_name: string;
  spec: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface BatchData {
  batch_number: number;
  date: string;
  payment_method: string;
  total: number;
  note?: string;
  operator?: string;
  items: Item[];
}

function fmt(v: number): string {
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(raw: string): string {
  try {
    const d = new Date(raw + 'T00:00:00');
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch { return raw; }
}

const HEADER_H = 56;
const TOOLBAR_H = 72;

export default function PdfPreviewPage({ batchId, batchNumber, onBack }: Props) {
  const { colors: c } = useTheme();
  const [batch, setBatch] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data: any = await api.getProcurementBatchDetail(batchId);
        if (!cancelled) {
          if (data?.items) setBatch(data);
          else setError('未找到数据');
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || '加载失败'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [batchId]);

  const title = t('procPdfTitle').replace('{n}', String(batchNumber));
  const styles = useMemo(() => makeStyles(c), [c]);

  if (loading) {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (error || !batch) {
    return (
      <View style={styles.overlay}>
        <Text style={styles.errText}>{error || '数据加载失败'}</Text>
        <TouchableOpacity onPress={onBack} style={styles.retryBtn}><Text style={styles.retryText}>返回</Text></TouchableOpacity>
      </View>
    );
  }

  const batchNo = `2026-${String(batch.batch_number).padStart(4, '0')}`;
  const dateStr = fmtDate(batch.date);
  const itemCount = batch.items.length;
  const totalQty = batch.items.reduce((s, it) => s + (it.quantity || 0), 0);

  return (
    <View style={styles.overlay}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={onBack} style={styles.navBack}>
          <BackArrow color="#F0EDE8" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.paper}>
          {/* Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandName}>柳 味 探 秘 科 技</Text>
            <Text style={styles.brandSub}>LIUWEI TECHNOLOGY · 餐饮供应链管理</Text>
          </View>

          {/* Heading */}
          <View style={styles.heading}>
            <Text style={styles.headingTitle}>进 货 单</Text>
            <Text style={styles.headingSub}>PURCHASE ORDER / RECEIPT</Text>
          </View>

          {/* Meta */}
          <View style={styles.meta}>
            <View><Text style={styles.metaLabel}>NO.</Text><Text style={styles.metaValue}>{batchNo}</Text></View>
            <View><Text style={styles.metaLabel}>日期</Text><Text style={styles.metaValue}>{dateStr}</Text></View>
            <View><Text style={styles.metaLabel}>支付</Text><Text style={styles.metaValue}>{batch.payment_method}</Text></View>
          </View>

          {/* Table */}
          <View style={styles.tableWrap}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 3.5 }]}>品名</Text>
              <Text style={[styles.th, { flex: 2 }]}>规格</Text>
              <Text style={[styles.th, { flex: 1.8, textAlign: 'center' }]}>单价</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>数量</Text>
              <Text style={[styles.th, { flex: 1.7, textAlign: 'right' }]}>小计</Text>
            </View>
            {/* Rows */}
            {batch.items.map((it, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowEven]}>
                <Text style={[styles.td, styles.tdName, { flex: 3.5 }]} numberOfLines={2}>{it.product_name}</Text>
                <Text style={[styles.td, styles.tdSpec, { flex: 2 }]} numberOfLines={1}>{it.spec}</Text>
                <Text style={[styles.td, styles.tdNum, { flex: 1.8 }]}>{fmt(it.unit_price)}</Text>
                <Text style={[styles.td, styles.tdNum, { flex: 1.2 }]}>{it.quantity}</Text>
                <Text style={[styles.td, styles.tdSub, { flex: 1.7 }]}>{fmt(it.subtotal)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totals}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>商品种类</Text><Text style={styles.totalVal}>{itemCount} 种</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>总件数</Text><Text style={styles.totalVal}>{totalQty} 件</Text></View>
            <View style={[styles.totalRow, styles.totalGrand]}><Text style={styles.totalGrandLabel}>合计货款</Text><Text style={styles.totalGrandVal}>{fmt(batch.total)}</Text></View>
          </View>

          {/* Note */}
          {batch.note ? (
            <View style={styles.noteBox}><Text style={styles.noteText}>📝 {batch.note}</Text></View>
          ) : null}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {batch.operator ? `经办人：${batch.operator} · ` : ''}柳味探秘科技 · 餐饮供应链管理系统{'\n'}本单据由系统自动生成，具有法律效力
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolBtn} onPress={() => {
          const a = (document as any).createElement('a');
          a.href = `/api/procurement-batches/${batchId}/pdf`;
          a.download = `procurement_${batchId}.pdf`;
          (document as any).body.appendChild(a); a.click(); (document as any).body.removeChild(a);
        }}>
          <Text style={styles.toolLabel}>⬇️ 下载</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => {
          (navigator as any).clipboard?.writeText((window as any).location.href);
        }}>
          <Text style={styles.toolLabel}>🔗 复制链接</Text>
        </TouchableOpacity>
        <View style={styles.toolSep} />
        <TouchableOpacity style={styles.toolBtn} onPress={() => (window as any).print()}>
          <Text style={styles.toolLabel}>🖨️ 打印</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  overlay: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#141416', zIndex: 9999,
  },
  navbar: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 10,
    height: HEADER_H, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const, paddingHorizontal: 16,
    backgroundColor: 'rgba(20,20,22,.85)',
    backdropFilter: 'blur(20px)' as any, WebkitBackdropFilter: 'blur(20px)' as any,
  } as any,
  navBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#26262C', borderWidth: 0.5, borderColor: 'rgba(255,255,255,.12)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  navTitle: { fontSize: 15, fontWeight: '600' as const, color: '#F0EDE8' },
  scrollView: { flex: 1, marginTop: HEADER_H, marginBottom: TOOLBAR_H },
  scrollContent: { padding: '20px 12px 20px' as any },
  paper: {
    backgroundColor: '#fff', borderRadius: 4,
    padding: '28px 24px 36px' as any,
    boxShadow: '0 4px 20px rgba(0,0,0,.5)' as any,
    maxWidth: 560, alignSelf: 'center' as const, width: '100%' as any,
  },
  brand: { alignItems: 'center' as const, marginBottom: 18, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#e8e4de' },
  brandName: { fontSize: 13, letterSpacing: 4.5, color: '#333', fontWeight: '500' as const, marginBottom: 3 },
  brandSub: { fontSize: 9, letterSpacing: 1.6, color: '#aaa', fontFamily: 'monospace' },
  heading: { alignItems: 'center' as const, marginBottom: 18 },
  headingTitle: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 6.6, color: '#C0392B', marginBottom: 3 },
  headingSub: { fontSize: 8, letterSpacing: 1.2, color: '#aaa', fontFamily: 'monospace' },
  meta: { flexDirection: 'row' as const, marginBottom: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#e8e4de', borderBottomWidth: 0.5, borderBottomColor: '#e8e4de' },
  metaLabel: { color: '#aaa', marginBottom: 2, fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.4 },
  metaValue: { color: '#222', fontWeight: '500' as const, fontSize: 10 },
  tableWrap: { marginBottom: 8 },
  tableHeader: { flexDirection: 'row' as const, backgroundColor: '#7a1a1a', paddingVertical: 7, paddingHorizontal: 6, borderRadius: 2 },
  th: { fontSize: 9.5, color: '#fff', fontWeight: '500' as const },
  tableRow: { flexDirection: 'row' as const, borderBottomWidth: 0.5, borderBottomColor: '#f0ece6', paddingVertical: 7, paddingHorizontal: 6 },
  tableRowEven: { backgroundColor: '#faf9f7' },
  td: { fontSize: 9.5, color: '#222', includeFontPadding: false },
  tdName: { flexShrink: 1, paddingRight: 2 },
  tdSpec: { fontSize: 9, color: '#666', paddingRight: 2 },
  tdNum: { textAlign: 'center' as const, fontFamily: 'monospace', color: '#555' },
  tdSub: { textAlign: 'right' as const, fontFamily: 'monospace', color: '#7a1a1a', fontWeight: '600' as const },
  totals: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e8e4de' },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 5 },
  totalLabel: { fontSize: 10, color: '#888' },
  totalVal: { fontSize: 10, color: '#333', fontFamily: 'monospace' },
  totalGrand: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#e8e4de' },
  totalGrandLabel: { fontSize: 12, fontWeight: '600' as const, color: '#222' },
  totalGrandVal: { fontSize: 16, fontWeight: '700' as const, color: '#7a1a1a', fontFamily: 'monospace' },
  noteBox: { marginTop: 12, padding: '8px 10px' as any, backgroundColor: '#faf9f7', borderRadius: 4 },
  noteText: { fontSize: 9, color: '#888', fontFamily: 'monospace' },
  footer: { marginTop: 24, alignItems: 'center' as const, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: '#ede9e3' },
  footerText: { fontSize: 8, color: '#bbb', letterSpacing: 0.6, fontFamily: 'monospace', lineHeight: 14, textAlign: 'center' as const },
  toolbar: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    height: TOOLBAR_H, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-around' as const, paddingHorizontal: 8, paddingBottom: 8,
    backgroundColor: 'rgba(20,20,22,.88)',
    backdropFilter: 'blur(20px)' as any,
  } as any,
  toolBtn: { flex: 1, maxWidth: 90, alignItems: 'center' as const, paddingVertical: 8 },
  toolLabel: { fontSize: 10, color: 'rgba(240,237,232,.28)' },
  toolSep: { width: 0.5, height: 36, backgroundColor: 'rgba(255,255,255,.07)' },
  errText: { fontSize: 16, color: '#F0EDE8', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: c.primary, borderRadius: 10 },
  retryText: { fontSize: 14, color: '#fff' },
});
