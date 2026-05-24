import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput } from 'react-native';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';

const partnerShare: Record<string, number> = { '张安武': 0.34, '江宽': 0.33, '蓝柳富': 0.33 };

export default function PartnerScreen({ onBack }: { onBack: () => void }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [totalDiv, setTotalDiv] = useState(0);
  const [showDividend, setShowDividend] = useState(false);
  const [divAmount, setDivAmount] = useState('');
  const [divNote, setDivNote] = useState('');
  const [filter, setFilter] = useState('all');
  const [lang, setLangState] = useState(getLang());

  const loadData = async () => {
    try {
      const p = await api.getPartners();
      setPartners(p || []);
      const d = await api.getDividends();
      setDividends(d || []);
      setTotalDiv((d || []).reduce((s: number, x: any) => s + x.amount, 0));
    } catch {}
  };

  useEffect(() => { loadData(); }, []);

  // Group dividends by note
  const grouped: Record<string, any[]> = {};
  dividends.forEach((d: any) => {
    const n = d.note || '分红';
    if (!grouped[n]) grouped[n] = [];
    grouped[n].push(d);
  });

  const groupKeys = Object.keys(grouped);

  const handleDividend = async () => {
    if (!divAmount) return;
    const amt = parseFloat(divAmount);
    const items = partners.map((p: any) => ({
      partner: p.name,
      amount: Math.round(amt * (partnerShare[p.name] || 0.33) * 100) / 100,
      note: divNote || `第${groupKeys.length + 1}次分红`,
    }));
    await api.createDividend({ items });
    setShowDividend(false);
    setDivAmount('');
    setDivNote('');
    loadData();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backBtn}>← {t('navHome')}</Text></TouchableOpacity>
        <View style={styles.langRow}>
          {langs.map(([l, label]) => (
            <TouchableOpacity key={l} onPress={() => { setLang(l, loadData); setLangState(l); }}>
              <Text style={[styles.langBtn, lang === l && styles.langActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Stats */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('totalCapital')}</Text>
            <Text style={styles.statNum}>¥130,000</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('distributedPool')}</Text>
            <Text style={[styles.statNum, { color: '#D97706' }]}>¥{totalDiv.toLocaleString()}</Text>
            <TouchableOpacity style={styles.divBtn} onPress={() => setShowDividend(true)}>
              <Text style={styles.divBtnText}>{t('issueDividend')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('partnerSeats')}</Text>
            <Text style={styles.statNum}>3 {t('shareholders')}</Text>
          </View>
        </View>

        {/* Partner Cards */}
        <View style={styles.partnerGrid}>
          {partners.map((p: any) => (
            <View key={p.id} style={styles.partnerCard}>
              <Text style={styles.partnerName}>{p.name}</Text>
              <Text style={styles.partnerShare}>{Math.round(p.share * 100)}%</Text>
              <Text style={styles.partnerInvest}>¥{p.investment?.toFixed(2)}</Text>
              <Text style={styles.partnerDiv}>+¥{p.total_dividends?.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Ledger */}
        <Text style={styles.sectionTitle}>{t('capitalLedger')}</Text>
        <View style={styles.filterRow}>
          {(['all', 'capital', 'additional', 'dividend'] as const).map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}>
              <Text style={[styles.filterBtn, filter === f && styles.filterActive]}>{t(f)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {groupKeys.map((note) => {
          const items = grouped[note];
          const total = items.reduce((s: number, d: any) => s + d.amount, 0);
          return (
            <View key={note} style={styles.group}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{note}</Text>
                <Text style={styles.groupAmt}>¥{total.toLocaleString()}</Text>
              </View>
              {items.map((d: any) => (
                <View key={d.id} style={styles.divRow}>
                  <Text style={styles.divPartner}>{d.partner}</Text>
                  <Text style={styles.divAmt}>¥{d.amount?.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Dividend Modal */}
      <Modal visible={showDividend} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('issueDividend')}</Text>
              <TouchableOpacity onPress={() => setShowDividend(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="总金额" value={divAmount} onChangeText={setDivAmount} keyboardType="decimal-pad" placeholderTextColor="#999" />
            <TextInput style={styles.input} placeholder="备注 (如: 第6次分红)" value={divNote} onChangeText={setDivNote} placeholderTextColor="#999" />
            <TouchableOpacity style={styles.btn} onPress={handleDividend}><Text style={styles.btnText}>确认</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 8 },
  backBtn: { fontSize: 13, color: '#8B1E22' },
  langRow: { flexDirection: 'row', gap: 4 },
  langBtn: { fontSize: 10, color: '#999', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBEB' },
  langActive: { color: '#8B1E22', borderColor: '#8B1E22' },
  content: { flex: 1, paddingHorizontal: 12 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB', padding: 10 },
  statLabel: { fontSize: 10, color: '#999' },
  statNum: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  divBtn: { marginTop: 6, backgroundColor: '#8B1E22', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' },
  divBtnText: { fontSize: 10, color: '#fff' },
  partnerGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  partnerCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#EBEBEB', padding: 10, alignItems: 'center' },
  partnerName: { fontSize: 13, fontWeight: '600' },
  partnerShare: { fontSize: 18, fontWeight: '700', color: '#8B1E22', marginVertical: 4 },
  partnerInvest: { fontSize: 10, color: '#999' },
  partnerDiv: { fontSize: 10, color: '#16A34A' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#999', paddingVertical: 10 },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  filterBtn: { fontSize: 10, color: '#999', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBEB' },
  filterActive: { color: '#fff', backgroundColor: '#8B1E22', borderColor: '#8B1E22' },
  group: { marginBottom: 12 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  groupTitle: { fontSize: 12, fontWeight: '600', color: '#666' },
  groupAmt: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  divRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingLeft: 12 },
  divPartner: { fontSize: 12, color: '#666' },
  divAmt: { fontSize: 12, fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderRadius: 12, width: 280, overflow: 'hidden' },
  modalHead: { backgroundColor: '#8B1E22', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  modalTitle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  modalClose: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
  input: { height: 40, borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, marginHorizontal: 16, marginTop: 12, color: '#333' },
  btn: { height: 40, backgroundColor: '#8B1E22', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 16, marginVertical: 12 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
