import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';
import PartnerScreen from './PartnerScreen';
import ExpenseScreen from './ExpenseScreen';
import ReconHistoryScreen from './ReconHistoryScreen';
import ExpenseHistoryScreen from './ExpenseHistoryScreen';

type Tab = 'list' | 'expense' | 'supply' | 'chart' | 'partner';

export default function HomeScreen({ onLogout }: { onLogout: () => void }) {
  const [tab, setTabState] = useState<Tab>(() => {
    try { return (localStorage.getItem('active_tab') as Tab) || 'partner'; }
    catch { return 'partner'; }
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem('active_tab', t); } catch {}
  };
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [chart, setChart] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<any[]>([]);
  const [lang, setLangState] = useState(getLang());

  // Add form
  const [txType, setTxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [note, setNote] = useState('');
  const [showBgModal, setShowBgModal] = useState(false);
  const [showReconHistory, setShowReconHistory] = useState(false);
  const [showExpenseHistory, setShowExpenseHistory] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [toast, setToast] = useState('');
  const navScaleAnims = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const [bgVersion, setBgVersion] = useState(0);
  const [bgImage, setBgImage] = useState('/img/bg.jpg');
  const [bgOpacity, setBgOpacity] = useState(() => {
    try {
      const saved = localStorage.getItem('bg-opacity');
      return saved !== null ? parseFloat(saved) : 0.5;
    } catch { return 0.5; }
  });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const INCOME_CATS = ['🍜 堂食','🛵 美团外卖','🛵 饿了吗外卖','🎫 美团团购','📦 京东','🔧 其他收入'];
  const EXPENSE_CATS = ['📦 原材料进货','🏠 房租','⚡ 水电煤气','👨‍🍳 人工工资','🔧 设备/工具','🏗️ 装修','📋 培训/证件','🧹 卫生/清洁','🧻 餐具/纸巾','📦 包装/打包','📢 广告/推广','💊 杂项/烟酒','📝 其他'];
  const cats = { income: INCOME_CATS, expense: EXPENSE_CATS };

  const loadData = useCallback(async () => {
    try {
      const s = await api.getSummary();
      setSummary(s);
      const tx = await api.getTransactions(1);
      setTransactions(tx.transactions || []);
      setPages(tx.pages || 1);
      setPage(1);
    } catch { setToast(t('toastLoadFailed')); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load background image — user-specific
  useEffect(() => {
    api.getBackground().then((r: any) => {
      if (r?.url) setBgImage(r.url);
    }).catch(() => {});
  }, []);

  const loadChart = async () => {
    try { const d = await api.getChart(); setChart(d || []); } catch { setToast(t('toastLoadFailed')); }
  };

  const loadProducts = async () => {
    try { const p = await api.getProducts(); setProducts(p || []); } catch { setToast(t('toastLoadFailed')); }
  };

  const loadProcurements = async () => {
    try { const p = await api.getProcurements(); setProcurements(p || []); } catch { setToast(t('toastLoadFailed')); }
  };

  useEffect(() => {
    if (tab === 'chart') loadChart();
    if (tab === 'supply') { loadProducts(); loadProcurements(); }
  }, [tab]);

  const handleAddTx = async () => {
    if (!amount || !category || !account) return;
    await api.createTransaction({ type: txType, amount: parseFloat(amount), category, account, note });
    setAmount(''); setCategory(''); setAccount(''); setNote('');
    loadData();
  };

  const handlePage = async (p: number) => {
    const tx = await api.getTransactions(p);
    setTransactions(tx.transactions || []);
    setPage(p);
  };

  const handleDeleteTx = async (id: number) => {
    await api.deleteTransaction(id);
    loadData();
  };

  const formatDate = (d: string) => (d || '').slice(5, 16);

  const todayStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

  const handleBgUpload = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      await api.uploadBackground(file);
      const r = await api.getBackground();
      if (r?.url) setBgImage(r.url);
      setBgVersion(v => v + 1);
    } catch (err) { /* ignore */ }
    setUploadingBg(false);
    setShowBgModal(false);
  };
  const handleBgReset = async () => {
    setUploadingBg(true);
    try {
      await api.resetBackground();
      const r = await api.getBackground();
      if (r?.url) setBgImage(r.url);
      setBgVersion(v => v + 1);
    } catch (err) { /* ignore */ }
    setUploadingBg(false);
    setShowBgModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={[styles.bgLayer, { backgroundImage: `url(${bgImage}?v=${bgVersion})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: bgOpacity } as any]} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setShowBgModal(true)} style={{ marginRight: 8 }}>
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '500' }}>{t('bgSettings')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => { await api.logout(); localStorage.removeItem('active_tab'); onLogout(); }}>
              <Text style={styles.logoutBtn}>{t('logout')}</Text>
            </TouchableOpacity>
            <View style={styles.langRow}>
              {langs.map(([l, label]) => (
                <TouchableOpacity key={l} onPress={() => { setLang(l, loadData); setLangState(l); }}>
                  <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Page content */}
      <View style={styles.page}>
        {tab === 'partner' ? (
          <PartnerScreen onBack={() => setTab('list')} />
        ) : showExpenseHistory ? (
          <ExpenseHistoryScreen onBack={() => setShowExpenseHistory(false)} />
        ) : showReconHistory ? (
          <ReconHistoryScreen onBack={() => setShowReconHistory(false)} />
        ) : tab === 'expense' ? (
          <ExpenseScreen onReconHistory={() => setShowReconHistory(true)} onExpenseHistory={() => setShowExpenseHistory(true)} />
        ) : (
          <>
            {/* Tab Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {tab === 'list' && (
                <>
                  {transactions.map((tx: any) => (
                    <View key={tx.id} style={styles.txRow}>
                      <View style={[styles.txDot, { backgroundColor: tx.type === 'income' ? '#059669' : '#DC2626' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txCat}>{tx.category}</Text>
                        {tx.note ? <Text style={styles.txNote}>{tx.note}</Text> : null}
                      </View>
                      <Text style={[styles.txAmt, { color: tx.type === 'income' ? '#059669' : '#DC2626' }]}>
                        {tx.type === 'income' ? '+' : '-'}¥{tx.amount?.toFixed(2)}
                      </Text>
                      <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                      <TouchableOpacity onPress={() => handleDeleteTx(tx.id)}>
                        <Text style={styles.txDel}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {pages > 1 && (
                    <View style={styles.pageRow}>
                      {Array.from({ length: pages }, (_, i) => (
                        <TouchableOpacity key={i} onPress={() => handlePage(i + 1)}>
                          <Text style={[styles.pageBtn, page === i + 1 && styles.pageBtnActive]}>{i + 1}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {tab === 'supply' && (
                <View>
                  <Text style={styles.sectionTitle}>{t('productCatalog') || '产品目录'}</Text>
                  {products.map((p: any) => (
                    <View key={p.id} style={styles.supplyRow}>
                      <Text style={styles.supplyName}>{p.name} {p.spec}</Text>
                      <Text style={styles.supplyPrice}>¥{p.price?.toFixed(2)}</Text>
                    </View>
                  ))}
                  {procurements.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('recentProcure') || '最近进货'}</Text>
                      {procurements.map((pr: any) => (
                        <View key={pr.id} style={styles.supplyRow}>
                          <Text style={styles.supplyName}>{pr.product_name} x{pr.quantity}</Text>
                          <Text style={styles.supplyPrice}>¥{pr.total?.toFixed(2)}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {tab === 'chart' && (
                <View>
                  <Text style={styles.sectionTitle}>{t('trend12Month') || '近12月收支趋势'}</Text>
                  {chart.map((d: any) => (
                    <View key={d.month} style={styles.barRow}>
                      <Text style={styles.barLabel}>{d.month?.slice(5)}</Text>
                      <View style={styles.barWrap}>
                        <View style={[styles.barIncome, { flex: d.income || 0 } as any]} />
                        <View style={[styles.barExpense, { flex: d.expense || 0 } as any]} />
                      </View>
                      <Text style={styles.barVal}>+{d.income?.toFixed(0)} -{d.expense?.toFixed(0)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </View>

      {/* Background settings modal */}
      {showBgModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('bgSettings')}</Text>
              <TouchableOpacity onPress={() => setShowBgModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBodyBg}>
              <Text style={styles.modalHint}>{t('bgHint')}</Text>
              {/* Opacity slider */}
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, color: '#374151', fontWeight: '500' }}>{t('opacity')}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#8B1E22' }}>{Math.round(bgOpacity * 100)}%</Text>
                </View>
                <View style={{ position: 'relative', height: 32, justifyContent: 'center' }}>
                  {/* track background */}
                  <View style={{
                    position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
                    backgroundColor: '#E5E7EB',
                  }} />
                  {/* active track fill */}
                  <View style={{
                    position: 'absolute', left: 0, height: 4, borderRadius: 2,
                    width: `${bgOpacity * 100}%`,
                    backgroundColor: '#8B1E22',
                  }} />
                  {/* range input (invisible, on top) */}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgOpacity}
                    onChange={(e: any) => {
                      const v = parseFloat(e.target.value);
                      setBgOpacity(v);
                      try { localStorage.setItem('bg-opacity', String(v)); } catch {}
                    }}
                    style={{
                      width: '100%', height: 32, opacity: 0, cursor: 'pointer',
                      margin: 0, position: 'relative', zIndex: 1,
                    }}
                  />
                </View>
                {/* tick labels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <Text style={{ fontSize: 9, color: '#D1D5DB' }}>0</Text>
                  <Text style={{ fontSize: 9, color: '#D1D5DB' }}>50</Text>
                  <Text style={{ fontSize: 9, color: '#D1D5DB' }}>100</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.bgBtn, styles.bgBtnOutline]}
                  disabled={uploadingBg}
                  onPress={() => fileRef.current?.click()}
                >
                  <Text style={styles.bgBtnOutlineText}>{uploadingBg ? t('uploading') : t('chooseImage')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bgBtn, styles.bgBtnDanger]}
                  disabled={uploadingBg}
                  onPress={handleBgReset}
                >
                  <Text style={styles.bgBtnDangerText}>{t('resetDefault')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {([
          { id: 'list', icon: NavIconList },
          { id: 'expense', icon: NavIconAdd },
          { id: 'supply', icon: NavIconSupply },
          { id: 'chart', icon: NavIconChart },
          { id: 'partner', icon: NavIconPartner },
        ] as const).map(({ id, icon: Icon }, i) => (
          <TouchableOpacity
            key={id}
            style={[styles.navItem, (id === 'partner' ? tab === 'partner' : tab === id) && styles.navItemActive]}
            onPress={() => {
              Animated.sequence([
                Animated.spring(navScaleAnims[i], { toValue: 0.85, useNativeDriver: false, speed: 30, bounciness: 6 }),
                Animated.spring(navScaleAnims[i], { toValue: 1, useNativeDriver: false, speed: 20, bounciness: 14 }),
              ]).start();
              setTab(id as Tab);
              setShowReconHistory(false);
              setShowExpenseHistory(false);
            }}
          >
            <Animated.View style={{ transform: [{ scale: navScaleAnims[i] }] }}>
              <Icon active={id === 'partner' ? tab === 'partner' : tab === id} />
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>
      {/* Hidden file input for background upload */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgUpload}
      />
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

/* ===== NAV SVG ICONS ===== */

function NavIconList({ active }: { active: boolean }) {
  const c = active ? '#1A1A1A' : '#999';
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <Path d="M9 12h6M9 16h6" />
    </Svg>
  );
}

function NavIconAdd({ active }: { active: boolean }) {
  const c = active ? '#1A1A1A' : '#999';
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function NavIconSupply({ active }: { active: boolean }) {
  const c = active ? '#1A1A1A' : '#999';
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </Svg>
  );
}

function NavIconChart({ active }: { active: boolean }) {
  const c = active ? '#1A1A1A' : '#999';
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3v18h18" />
      <Path d="M7 16l4-8 4 4 4-6" />
    </Svg>
  );
}

function NavIconPartner({ active }: { active: boolean }) {
  const c = active ? '#1A1A1A' : '#999';
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <Path d="M12 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F0EB' },
  bgLayer: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
  },
  // Header — match bottom nav glass (0.20 opacity)
  header: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.30)',
    // @ts-ignore - web-only
    backdropFilter: 'saturate(180%) blur(24px)',
    borderBottomWidth: 0,
    zIndex: 50,
  },
  headerInner: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  // 8600: color:#999 font-size:13px
  date: { color: '#999', fontSize: 13 },
  logoutBtn: { fontSize: 11, color: '#DC2626', fontWeight: '500' },
  langRow: { flexDirection: 'row', gap: 4 },
  langBtn: { fontSize: 10, color: '#6B7280', fontWeight: '500', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  langActive: { color: '#8B1E22', backgroundColor: '#FEE2E2', fontWeight: '700' },
  // Page — 8600: padding:0 16px 110px, max-width:520px, margin:0 auto
  page: { flex: 1, paddingHorizontal: 16, paddingBottom: 12, maxWidth: 520, alignSelf: 'center', width: '100%' },
  // Stats — 8600: grid-cols-4
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statItem: { flex: 1 },
  // 8600: stat-label font-size:11px color:#999 font-weight:500
  statLabel: { fontSize: 11, color: '#999', fontWeight: '500', marginBottom: 4 },
  // 8600: stat-num font-size:28px font-weight:700
  statNum: { fontSize: 28, fontWeight: '700', lineHeight: 28 },
  // 8600: text-xs color:#bbb
  statSub: { fontSize: 10, color: '#bbb', marginTop: 2 },
  // Tab bar — 8600: display:flex border-bottom
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EBEBEB', marginBottom: 16 },
  // 8600: tab padding:10px font-size:12px color:#999
  tabItem: { paddingVertical: 10, paddingHorizontal: 0, marginRight: 0, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: '#1A1A1A' },
  tabItemText: { fontSize: 12, fontWeight: '500', color: '#999' },
  tabActiveText: { color: '#1A1A1A' },
  // Content
  content: { flex: 1 },
  // Transaction row — 8600: tx-row
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  txDot: { width: 7, height: 7, borderRadius: 4 },
  txCat: { fontSize: 13, fontWeight: '500' },
  txNote: { fontSize: 10, color: '#BBB' },
  txAmt: { fontSize: 13, fontWeight: '600' },
  txDate: { fontSize: 10, color: '#CCC', width: 70 },
  txDel: { fontSize: 14, color: '#CCC', padding: 4 },
  // Pagination
  pageRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  pageBtn: { fontSize: 12, color: '#999', paddingHorizontal: 10, paddingVertical: 4 },
  pageBtnActive: { color: '#1A1A1A', fontWeight: '600' },
  // Add form — 8600 style
  addForm: { paddingTop: 4 },
  typeToggle: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBEB', backgroundColor: '#fff', alignItems: 'center' },
  typeBtnInc: { borderColor: '#059669', backgroundColor: '#F0FDF4' },
  typeBtnExp: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  typeBtnText: { fontSize: 14, fontWeight: '500', color: '#999' },
  typeBtnIncText: { color: '#059669' },
  typeBtnExpText: { color: '#DC2626' },
  addInput: { width: '100%', paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 8, fontSize: 14, backgroundColor: '#FAFAFA', color: '#1A1A1A', marginBottom: 8, fontFamily: undefined },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  catBtn: { fontSize: 11, color: '#999', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#EBEBEB' },
  catBtnActive: { color: '#8B1E22', borderColor: '#8B1E22', backgroundColor: 'rgba(139,30,34,0.03)' },
  saveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 20 },
  // Supply
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#999', paddingVertical: 10 },
  supplyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  supplyName: { fontSize: 13, fontWeight: '500', flex: 1 },
  supplyPrice: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  // Chart
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { fontSize: 10, color: '#999', fontWeight: '500', width: 36, textAlign: 'right' },
  barWrap: { flex: 1, height: 16, backgroundColor: '#F5F5F5', borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  barIncome: { backgroundColor: '#059669', height: '100%' },
  barExpense: { backgroundColor: '#EF4444', opacity: 0.7, height: '100%' },
  barVal: { fontSize: 9, color: '#999', width: 90 },
  // Bottom Nav — glass pill, icons only, 80% transparent
  bottomNav: {
    position: 'fixed' as any,
    bottom: 16,
    left: '50%',
    // @ts-ignore - web-only translateX
    transform: 'translateX(-50%)',
    width: '80%',
    maxWidth: 420,
    backgroundColor: 'rgba(255,255,255,0.30)',
    // @ts-ignore - web-only
    backdropFilter: 'saturate(180%) blur(24px)',
    borderRadius: 28,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 2px 16px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(255,255,255,0.3) inset',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 100,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 22, marginHorizontal: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  navLabel: { fontSize: 10, fontWeight: '600', color: '#999', letterSpacing: 0.3 },
  navLabelActive: { color: '#1A1A1A' },
  // Background settings modal
  modalOverlay: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 200, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 16, width: 340, maxWidth: '90%',
    overflow: 'hidden' as const,
  },
  modalHeader: {
    backgroundColor: '#8B1E22', paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  modalClose: { fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: '300' },
  modalBodyBg: { padding: 24 },
  modalHint: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  bgBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  bgBtnOutline: { borderWidth: 1, borderColor: '#D1D5DB' },
  bgBtnOutlineText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  bgBtnDanger: { borderWidth: 1, borderColor: '#FCA5A5' },
  bgBtnDangerText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
});