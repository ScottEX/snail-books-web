import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';

type Tab = 'list' | 'add' | 'supply' | 'chart';

export default function HomeScreen({ onPartner, onLogout }: { onPartner: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('list');
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
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadChart = async () => {
    try { const d = await api.getChart(); setChart(d || []); } catch {}
  };

  const loadProducts = async () => {
    try { const p = await api.getProducts(); setProducts(p || []); } catch {}
  };

  const loadProcurements = async () => {
    try { const p = await api.getProcurements(); setProcurements(p || []); } catch {}
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Text style={styles.title}>{t('appTitle')}</Text>
          <View style={styles.headerRight}>
            <Text style={styles.date}>{todayStr}</Text>
            <TouchableOpacity onPress={async () => { await api.logout(); onLogout(); }}>
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
        {/* Stats - 8600 style grid-cols-4 */}
        {summary && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('income')}</Text>
              <Text style={[styles.statNum, { color: '#059669' }]}>¥{(summary.today?.income || 0).toFixed(2)}</Text>
              <Text style={styles.statSub}>{t('month')}¥{(summary.month?.income || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('expense')}</Text>
              <Text style={[styles.statNum, { color: '#DC2626' }]}>¥{(summary.today?.expense || 0).toFixed(2)}</Text>
              <Text style={styles.statSub}>{t('month')}¥{(summary.month?.expense || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('profit')}</Text>
              <Text style={[styles.statNum, { color: (summary.today?.profit || 0) >= 0 ? '#1A1A1A' : '#DC2626' }]}>¥{(summary.today?.profit || 0).toFixed(2)}</Text>
              <Text style={styles.statSub}>{t('month')}¥{(summary.month?.profit || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>{t('procurement')}</Text>
              <Text style={[styles.statNum, { color: '#D97706' }]}>¥{(summary.today?.procurement || 0).toFixed(2)}</Text>
              <Text style={styles.statSub}>{t('month')}¥{(summary.month?.procurement || 0).toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Tab bar - 8600 underline style */}
        <View style={styles.tabBar}>
          {(['list', 'add', 'supply', 'chart'] as Tab[]).map((tId) => (
            <TouchableOpacity key={tId} onPress={() => setTab(tId)} style={[styles.tabItem, tab === tId && styles.tabActive]}>
              <Text style={[styles.tabItemText, tab === tId && styles.tabActiveText]}>
                {t(`tab${tId === 'list' ? 'Bills' : tId === 'add' ? 'Record' : tId === 'supply' ? 'Supply' : 'Trends'}` as any)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

          {tab === 'add' && (
            <View style={styles.addForm}>
              <View style={styles.typeToggle}>
                <TouchableOpacity onPress={() => setTxType('income')} style={[styles.typeBtn, txType === 'income' && styles.typeBtnInc]}>
                  <Text style={[styles.typeBtnText, txType === 'income' && styles.typeBtnIncText]}>{t('income')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTxType('expense')} style={[styles.typeBtn, txType === 'expense' && styles.typeBtnExp]}>
                  <Text style={[styles.typeBtnText, txType === 'expense' && styles.typeBtnExpText]}>{t('expense')}</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.addInput} placeholder="¥" value={amount} onChangeText={setAmount}
                keyboardType="decimal-pad" placeholderTextColor="#999" />
              <View style={styles.catGrid}>
                {(cats[txType as keyof typeof cats] || []).map((c: string) => (
                  <TouchableOpacity key={c} onPress={() => setCategory(c)}>
                    <Text style={[styles.catBtn, category === c && styles.catBtnActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.addInput} placeholder="账户" value={account} onChangeText={setAccount} placeholderTextColor="#999" />
              <TextInput style={styles.addInput} placeholder={t('notePlaceholder') || '备注'} value={note} onChangeText={setNote} placeholderTextColor="#999" />
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddTx}>
                <Text style={styles.saveBtnText}>✓</Text>
              </TouchableOpacity>
            </View>
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
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {([
          { id: 'list', label: '账单', icon: NavIconList },
          { id: 'add', label: '记账', icon: NavIconAdd },
          { id: 'supply', label: '供应链', icon: NavIconSupply },
          { id: 'chart', label: '趋势', icon: NavIconChart },
          { id: 'partner', label: t('navPartner'), icon: NavIconPartner },
        ] as const).map(({ id, label, icon: Icon }) => (
          <TouchableOpacity
            key={id}
            style={[styles.navItem, (id === 'partner' ? false : tab === id) && styles.navItemActive]}
            onPress={() => id === 'partner' ? onPartner() : setTab(id as Tab)}
          >
            <Icon active={id === 'partner' ? false : tab === id} />
            <Text style={[styles.navLabel, (id === 'partner' ? false : tab === id) && styles.navLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  // Header — 8600: padding:28px 20px 0
  header: { paddingTop: 28, paddingHorizontal: 20 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  // 8600: font-size:18px font-weight:600
  title: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 8600: color:#999 font-size:13px
  date: { color: '#999', fontSize: 13 },
  logoutBtn: { fontSize: 11, color: '#DC2626', fontWeight: '500' },
  langRow: { flexDirection: 'row', gap: 4 },
  langBtn: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  langActive: { color: '#8B1E22', backgroundColor: '#FEE2E2', fontWeight: '700' },
  // Page — 8600: padding:0 16px 110px, max-width:520px, margin:0 auto
  page: { flex: 1, paddingHorizontal: 16, paddingBottom: 80, maxWidth: 520, alignSelf: 'center', width: '100%' },
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
  // Bottom Nav — floating pill
  bottomNav: {
    position: 'fixed' as any,
    bottom: 12,
    left: '50%',
    // @ts-ignore - web-only translateX
    transform: 'translateX(-50%)',
    width: '92%',
    maxWidth: 480,
    backgroundColor: 'rgba(255,255,255,0.94)',
    // @ts-ignore - web-only
    backdropFilter: 'blur(20px)',
    borderRadius: 22,
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    // @ts-ignore - web-only boxShadow
    boxShadow: '0 2px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    zIndex: 100,
  },
  navItem: {
    flex: 1, alignItems: 'center', paddingVertical: 6, gap: 3,
    borderRadius: 16, marginHorizontal: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  navLabel: { fontSize: 10, fontWeight: '600', color: '#999', letterSpacing: 0.3 },
  navLabelActive: { color: '#1A1A1A' },
});
