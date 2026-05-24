import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { t, setLang, getLang } from '../i18n';
import { api } from '../api/client';

/* ── helpers ── */
const fmt = (n: number) => '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2 });
const todayStr = () => new Date().toISOString().slice(0, 10);

/* ═══════════════════════════════════════════════════════════
   EXPENSE SCREEN — 三模块：对账 / 营业额 / 支出明细
   ═══════════════════════════════════════════════════════════ */
export default function ExpenseScreen() {
  /* ── 模块一：对账 state ── */
  const [recDate, setRecDate] = useState(todayStr());
  const [cardBalance, setCardBalance] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [dineIn, setDineIn] = useState('');
  const [meituan, setMeituan] = useState('');
  const [eleme, setEleme] = useState('');
  const [tuan, setTuan] = useState('');
  const [jd, setJd] = useState('');

  // Load saved reconciliation from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('expense-rec') || '{}');
      const d = saved[recDate];
      if (d) {
        setCardBalance(d.card || '');
        setCashBalance(d.cash || '');
        setDineIn(d.dineIn || '');
        setMeituan(d.meituan || '');
        setEleme(d.eleme || '');
        setTuan(d.tuan || '');
        setJd(d.jd || '');
      } else {
        setCardBalance(''); setCashBalance('');
        setDineIn(''); setMeituan('');
        setEleme(''); setTuan(''); setJd('');
      }
    } catch {}
  }, [recDate]);

  // Save reconciliation to localStorage
  const saveRec = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('expense-rec') || '{}');
      saved[recDate] = {
        card: cardBalance, cash: cashBalance,
        dineIn, meituan, eleme, tuan, jd,
      };
      localStorage.setItem('expense-rec', JSON.stringify(saved));
    } catch {}
  }, [recDate, cardBalance, cashBalance, dineIn, meituan, eleme, tuan, jd]);

  const toNum = (s: string) => parseFloat(s) || 0;
  const channelTotal = toNum(dineIn) + toNum(meituan) + toNum(eleme) + toNum(tuan) + toNum(jd);
  const realTotal = toNum(cardBalance) + toNum(cashBalance);
  const diff = realTotal - channelTotal;

  /* ── 模块三：支出 state ── */
  const [expDate, setExpDate] = useState(todayStr());
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loadingExp, setLoadingExp] = useState(false);

  const loadExpenses = async () => {
    try {
      const tx = await api.getTransactions(1);
      const expenseList = (tx.transactions || []).filter((t: any) => t.type === 'expense');
      setExpenses(expenseList);
    } catch {}
  };

  useEffect(() => { loadExpenses(); }, []);

  const handleAddExpense = async () => {
    if (!expAmount) return;
    setLoadingExp(true);
    try {
      await api.createTransaction({
        type: 'expense',
        amount: parseFloat(expAmount),
        category: '📝 其他',
        account: '现金',
        note: expNote,
      });
      setExpAmount('');
      setExpNote('');
      await loadExpenses();
    } catch {}
    setLoadingExp(false);
  };

  /* ── 模块二：营业额 state ── */
  const [revenueData, setRevenueData] = useState<any>({ todayRevenue: 0, todayActual: 0 });
  const [revenueList, setRevenueList] = useState<any[]>([]);

  const loadRevenue = async () => {
    try {
      const s = await api.getSummary();
      setRevenueData({
        todayRevenue: s.income || 0,
        todayActual: s.income || 0,
      });
      // Build daily revenue list from transactions
      const tx = await api.getTransactions(1);
      const incomeTx = (tx.transactions || []).filter((t: any) => t.type === 'income');
      // Simple list — group by date later
      setRevenueList(incomeTx.slice(0, 20));
    } catch {}
  };

  useEffect(() => { loadRevenue(); }, []);

  /* ── render ── */
  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {/* ══════════ 模块一：每日对账 ══════════ */}
          <View style={s.col}>
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>{t('dailyReconciliation')}</Text>
                <input
                  type="date"
                  value={recDate}
                  onChange={(e: any) => setRecDate(e.target.value)}
                  style={s.dateInput}
                />
              </View>

              {/* 实盘录入 */}
              <Text style={s.sectionLabel}>{t('physicalCount')}</Text>
              <View style={s.row2}>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t('cardBalance')}</Text>
                  <TextInput style={s.input} value={cardBalance}
                    onChangeText={setCardBalance} onBlur={saveRec}
                    keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#D1D5DB" />
                </View>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>{t('cashBalance')}</Text>
                  <TextInput style={s.input} value={cashBalance}
                    onChangeText={setCashBalance} onBlur={saveRec}
                    keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#D1D5DB" />
                </View>
              </View>

              {/* 渠道未到账 */}
              <Text style={s.sectionLabel}>{t('channelPending')}</Text>
              <View style={s.row5}>
                {([
                  [dineIn, setDineIn, t('dineIn')],
                  [meituan, setMeituan, t('meituan')],
                  [eleme, setEleme, t('eleme')],
                  [tuan, setTuan, t('tuan')],
                  [jd, setJd, t('jd')],
                ] as const).map(([val, setter, label]: any, i: number) => (
                  <View style={s.inputGroupSm} key={i}>
                    <Text style={s.inputLabelSm}>{label}</Text>
                    <TextInput style={s.inputSm} value={val}
                      onChangeText={setter} onBlur={saveRec}
                      keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#D1D5DB" />
                  </View>
                ))}
              </View>
              <View style={s.channelSum}>
                <Text style={s.channelSumLabel}>{t('channelTotal')}</Text>
                <Text style={s.channelSumVal}>{fmt(channelTotal)}</Text>
              </View>

              {/* 核算看板 */}
              <View style={s.resultBar}>
                <View style={s.resultItem}>
                  <Text style={s.resultLabel}>{t('bookBalance')}</Text>
                  <Text style={s.resultVal}>{fmt(realTotal)}</Text>
                </View>
                <View style={s.resultItem}>
                  <Text style={s.resultLabel}>{t('reconDiff')}</Text>
                  <Text style={[s.resultDiff, { color: diff >= 0 ? '#059669' : '#DC2626' }]}>
                    {diff >= 0 ? '+' : ''}{fmt(diff)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ══════════ 右侧列：营业额 + 支出 ══════════ */}
          <View style={s.col}>
            {/* 模块二：营业额 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('revenueTracking')}</Text>
              <View style={s.kpiRow}>
                <View style={s.kpiCard}>
                  <Text style={s.kpiLabel}>{t('revenue')}</Text>
                  <Text style={s.kpiVal}>{fmt(revenueData.todayRevenue)}</Text>
                </View>
                <View style={s.kpiCard}>
                  <Text style={s.kpiLabel}>{t('actualRevenue')}</Text>
                  <Text style={s.kpiVal}>{fmt(revenueData.todayActual)}</Text>
                </View>
              </View>

              {/* 明细表 */}
              <Text style={s.sectionLabel}>{t('revenueDetails')}</Text>
              {revenueList.length === 0 ? (
                <Text style={s.empty}>{t('noData')}</Text>
              ) : (
                <View style={s.tableWrap}>
                  <View style={[s.tableRow, s.tableHead]}>
                    <Text style={[s.td, s.tdDate]}>{t('date')}</Text>
                    <Text style={[s.td, s.tdCat]}>{t('category2')}</Text>
                    <Text style={[s.td, s.tdAmt]}>{t('amount')}</Text>
                  </View>
                  {revenueList.map((r: any, i: number) => (
                    <View style={s.tableRow} key={i}>
                      <Text style={[s.td, s.tdDate]}>{(r.created_at || '').slice(0, 10)}</Text>
                      <Text style={[s.td, s.tdCat]}>{r.category}</Text>
                      <Text style={[s.td, s.tdAmt, { color: '#059669' }]}>+{fmt(r.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 模块三：支出明细 */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('expenseDetails')}</Text>

              {/* 录入台 */}
              <View style={s.expForm}>
                <View style={s.expFormRow}>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e: any) => setExpDate(e.target.value)}
                    style={{ ...s.dateInput, flex: 1, marginBottom: 0 }}
                  />
                  <View style={s.inputGroup} key="amount">
                    <TextInput style={s.input} value={expAmount}
                      onChangeText={setExpAmount}
                      keyboardType="decimal-pad" placeholder={t('amount')}
                      placeholderTextColor="#D1D5DB" />
                  </View>
                </View>
                <TextInput style={s.input} value={expNote}
                  onChangeText={setExpNote}
                  placeholder={t('expenseNote')} placeholderTextColor="#D1D5DB" />
                <TouchableOpacity
                  style={[s.expBtn, !expAmount && s.expBtnDisabled]}
                  onPress={handleAddExpense}
                  disabled={!expAmount || loadingExp}
                >
                  <Text style={s.expBtnText}>{loadingExp ? '...' : t('confirmRecord')}</Text>
                </TouchableOpacity>
              </View>

              {/* 瀑布流水账 */}
              <Text style={s.sectionLabel}>{t('expenseLedger')}</Text>
              {expenses.length === 0 ? (
                <Text style={s.empty}>{t('noExpenseRecords')}</Text>
              ) : (
                expenses.slice(0, 20).map((ex: any, i: number) => (
                  <View style={s.expRow} key={i}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.expNote}>{ex.note || t('noNote')}</Text>
                      <Text style={s.expDateText}>{(ex.created_at || '').slice(0, 10)}</Text>
                    </View>
                    <Text style={s.expAmt}>-{fmt(ex.amount)}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════ STYLES ═══════════════════════════════════ */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    padding: 16, paddingBottom: 100,
  },
  col: {
    flex: 1, minWidth: 320, gap: 16,
  },

  /* ── card ── */
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20, gap: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    // @ts-ignore
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  dateInput: {
    fontSize: 12, color: '#6B7280', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: '#F9FAFB', fontFamily: undefined, marginBottom: 0,
  } as any,

  /* ── sections ── */
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' },

  /* ── inputs ── */
  row2: { flexDirection: 'row', gap: 12 },
  row5: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  inputGroup: { flex: 1 },
  inputGroupSm: { flex: 1, minWidth: 64 },
  inputLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  inputLabelSm: { fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginBottom: 4, textAlign: 'center' },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12,
    fontSize: 15, fontWeight: '600', color: '#1A1A1A', fontFamily: undefined,
  },
  inputSm: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 8,
    fontSize: 13, fontWeight: '600', color: '#1A1A1A', textAlign: 'center',
    fontFamily: undefined,
  },

  /* ── channel sum ── */
  channelSum: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
  },
  channelSumLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  channelSumVal: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },

  /* ── result bar ── */
  resultBar: {
    flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 12,
    padding: 14, gap: 24,
  },
  resultItem: { flex: 1, alignItems: 'center' },
  resultLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  resultVal: { fontSize: 16, fontWeight: '700', color: '#374151' },
  resultDiff: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },

  /* ── KPI cards ── */
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: {
    flex: 1, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  kpiLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  kpiVal: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },

  /* ── table ── */
  tableWrap: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, overflow: 'hidden' },
  tableHead: { backgroundColor: '#F9FAFB' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  td: { paddingVertical: 10, paddingHorizontal: 10, fontSize: 12, color: '#374151' },
  tdDate: { width: 90, color: '#6B7280', fontSize: 11 },
  tdCat: { flex: 1 },
  tdAmt: { width: 100, textAlign: 'right', fontWeight: '600' },

  /* ── expense form ── */
  expForm: { gap: 10 },
  expFormRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  expBtn: {
    backgroundColor: '#8B1E22', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center',
  },
  expBtnDisabled: { backgroundColor: '#E5E7EB' },
  expBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  /* ── expense list ── */
  expRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  expNote: { fontSize: 13, color: '#374151', fontWeight: '500' },
  expDateText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  expAmt: { fontSize: 15, fontWeight: '700', color: '#DC2626' },

  /* ── empty ── */
  empty: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },
});
