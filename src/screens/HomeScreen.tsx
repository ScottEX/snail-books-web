import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';

type Tab = 'list' | 'add' | 'supply' | 'chart';

export default function HomeScreen({ onPartner }: { onPartner: () => void }) {
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

  const cats = { income: ['销售额','分红收入','其他收入'], expense: ['原材料','包装','物流','设备','人工','水电','其他支出'] };

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('appTitle')}</Text>
        <View style={styles.langRow}>
          {langs.map(([l, label]) => (
            <TouchableOpacity key={l} onPress={() => { setLang(l, loadData); setLangState(l); }}>
              <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.card}><Text style={styles.cardLabel}>{t('income')}</Text><Text style={styles.cardNum}>{summary.today?.income || 0}</Text><Text style={styles.cardSub}>{t('month')}{summary.month?.income || 0}</Text></View>
          <View style={styles.card}><Text style={styles.cardLabel}>{t('expense')}</Text><Text style={[styles.cardNum, { color: '#DC2626' }]}>{summary.today?.expense || 0}</Text><Text style={styles.cardSub}>{t('month')}{summary.month?.expense || 0}</Text></View>
          <View style={styles.card}><Text style={styles.cardLabel}>{t('profit')}</Text><Text style={[styles.cardNum, { color: (summary.today?.profit || 0) >= 0 ? '#16A34A' : '#DC2626' }]}>{summary.today?.profit || 0}</Text><Text style={styles.cardSub}>{t('month')}{summary.month?.profit || 0}</Text></View>
          <View style={styles.card}><Text style={styles.cardLabel}>{t('procurement')}</Text><Text style={styles.cardNum}>0</Text><Text style={styles.cardSub}>{t('month')}{summary.month?.procurement || 0}</Text></View>
        </View>
      )}

      {/* Tab Content */}
      <ScrollView style={styles.content}>
        {tab === 'list' && (
          <>
            {transactions.map((tx: any) => (
              <View key={tx.id} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: tx.type === 'income' ? '#16A34A' : '#DC2626' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowCat}>{tx.category}</Text>
                  {tx.note ? <Text style={styles.rowNote}>{tx.note}</Text> : null}
                </View>
                <Text style={[styles.rowAmt, { color: tx.type === 'income' ? '#16A34A' : '#DC2626' }]}>
                  {tx.type === 'income' ? '+' : '-'}¥{tx.amount?.toFixed(2)}
                </Text>
                <Text style={styles.rowDate}>{formatDate(tx.created_at)}</Text>
                <TouchableOpacity onPress={() => handleDeleteTx(tx.id)}><Text style={styles.delBtn}>✕</Text></TouchableOpacity>
              </View>
            ))}
            {pages > 1 && (
              <View style={styles.pageRow}>
                {Array.from({ length: pages }, (_, i) => (
                  <TouchableOpacity key={i} onPress={() => handlePage(i + 1)}>
                    <Text style={[styles.pageBtn, page === i + 1 && styles.pageActive]}>{i + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {tab === 'add' && (
          <View style={styles.form}>
            <View style={styles.typeRow}>
              <TouchableOpacity onPress={() => setTxType('expense')}><Text style={[styles.typeBtn, txType === 'expense' && styles.typeActive]}>{t('expense')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setTxType('income')}><Text style={[styles.typeBtn, txType === 'income' && styles.typeActive]}>{t('income')}</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.fInput} placeholder="¥" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor="#999" />
            <View style={styles.catRow}>
              {(cats[txType as keyof typeof cats] || []).map((c: string) => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)}>
                  <Text style={[styles.catBtn, category === c && styles.catActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.fInput} placeholder="账户" value={account} onChangeText={setAccount} placeholderTextColor="#999" />
            <TextInput style={styles.fInput} placeholder="备注" value={note} onChangeText={setNote} placeholderTextColor="#999" />
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddTx}><Text style={styles.submitText}>✓</Text></TouchableOpacity>
          </View>
        )}

        {tab === 'supply' && (
          <View>
            <Text style={styles.sectionTitle}>Products</Text>
            {products.map((p: any) => (
              <View key={p.id} style={styles.row}><Text style={{ flex: 1 }}>{p.name} {p.spec}</Text><Text>¥{p.price?.toFixed(2)}</Text></View>
            ))}
          </View>
        )}

        {tab === 'chart' && (
          <View>
            {chart.map((d: any) => (
              <View key={d.month} style={styles.barRow}>
                <Text style={styles.barLabel}>{d.month?.slice(5)}</Text>
                <View style={{ flex: 1, height: 16, flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min((d.income / Math.max(...chart.map((x: any) => x.income || 1))) * 100, 100)}%`, backgroundColor: '#16A34A' }} />
                  <View style={{ width: `${Math.min((d.expense / Math.max(...chart.map((x: any) => x.expense || 1))) * 100, 100)}%`, backgroundColor: '#DC2626' }} />
                </View>
                <Text style={styles.barVal}>+{d.income?.toFixed(0)} -{d.expense?.toFixed(0)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.nav}>
        {(['list', 'add', 'supply', 'chart'] as Tab[]).map((tabId) => (
          <TouchableOpacity key={tabId} style={styles.navItem} onPress={() => setTab(tabId)}>
            <Text style={[styles.navText, tab === tabId && styles.navActive]}>{t(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}` as any)}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.navItem} onPress={onPartner}>
          <Text style={styles.navText}>{t('navPartner')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#8B1E22' },
  langRow: { flexDirection: 'row', gap: 4 },
  langBtn: { fontSize: 10, color: '#999', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBEB' },
  langActive: { color: '#8B1E22', borderColor: '#8B1E22' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 8, gap: 6, marginBottom: 8 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB', padding: 10, alignItems: 'center' },
  cardLabel: { fontSize: 10, color: '#999' },
  cardNum: { fontSize: 16, fontWeight: '700', marginVertical: 2 },
  cardSub: { fontSize: 9, color: '#BBB' },
  content: { flex: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F0F0F0', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowCat: { fontSize: 13, fontWeight: '500' },
  rowNote: { fontSize: 10, color: '#BBB' },
  rowAmt: { fontSize: 13, fontWeight: '600' },
  rowDate: { fontSize: 10, color: '#CCC', width: 70 },
  delBtn: { fontSize: 14, color: '#CCC', padding: 4 },
  pageRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  pageBtn: { fontSize: 12, color: '#999', paddingHorizontal: 8, paddingVertical: 2 },
  pageActive: { color: '#8B1E22', fontWeight: '600' },
  form: { padding: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { fontSize: 13, color: '#999', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#EBEBEB' },
  typeActive: { color: '#8B1E22', borderColor: '#8B1E22' },
  fInput: { height: 40, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, marginBottom: 8, backgroundColor: '#fff', color: '#333' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  catBtn: { fontSize: 11, color: '#999', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#EBEBEB' },
  catActive: { color: '#8B1E22', borderColor: '#8B1E22', backgroundColor: '#8B1E2208' },
  submitBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B1E22', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#999', paddingVertical: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  barLabel: { fontSize: 10, color: '#999', width: 40 },
  barVal: { fontSize: 9, color: '#999', width: 90 },
  nav: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#EBEBEB', backgroundColor: '#fff', paddingBottom: 20 },
  navItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  navText: { fontSize: 11, color: '#999' },
  navActive: { color: '#8B1E22', fontWeight: '600' },
});
