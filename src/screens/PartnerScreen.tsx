import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t, setLang, getLang, langs } from '../i18n';
import { api } from '../api/client';
import Toast from '../components/Toast';

// NOTE: 合伙人持股/初始投资/姓名映射硬编码。若后端合伙人变更（增减/改名），
// 默认值（33%、42900）可能不准确。理想方案是从后端返回并缓存这些映射。
const partnerShare: Record<string, number> = { '张安武': 0.34, '江宽': 0.33, '蓝柳富': 0.33 };
const initCapital: Record<string, number> = { '张安武': 44200, '江宽': 42900, '蓝柳富': 42900 };
const nameMap: Record<string, string> = { '张安武': 'nameZhang', '江宽': 'nameJiang', '蓝柳富': 'nameLan' };

function translateName(name: string): string {
  const key = nameMap[name];
  return key ? t(key) : name;
}

function translateDividendNote(note: string): string {
  const m = note.match(/^第(\d+)次分红 \((.+)\)$/);
  if (m) return t('dividendRoundFmt').replace('{n}', m[1]).replace('{date}', m[2]);
  return note;
}

/* ========== SVG ICONS (exact 8600 paths) ========== */

function IconBuilding({ color = '#8B1E22' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path strokeLinecap="round" strokeLinejoin="round"
        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </Svg>
  );
}

function IconCoins({ color = '#F59E0B' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </Svg>
  );
}

function IconPeople({ color = '#6B7280' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </Svg>
  );
}

/* ========== MAIN SCREEN ========== */

export default function PartnerScreen({ onBack }: { onBack: () => void }) {
  const [partners, setPartners] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [totalDiv, setTotalDiv] = useState(0);
  const [showDividend, setShowDividend] = useState(false);
  const [showDelete, setShowDelete] = useState<any>(null);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showOrg, setShowOrg] = useState(false);
  const [divAmount, setDivAmount] = useState('');
  const [divNote, setDivNote] = useState('');
  const [divPreview, setDivPreview] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [lang, setLangState] = useState(getLang());

  const [toast, setToast] = useState('');

  const loadData = async () => {
    try {
      const p = await api.getPartners();
      setPartners(p || []);
      const d = await api.getDividends();
      setDividends(d || []);
      setTotalDiv((d || []).reduce((s: number, x: any) => s + x.amount, 0));
    } catch { setToast(t('toastLoadFailed')); }
  };

  useEffect(() => { loadData(); }, []);

  const grouped: Record<string, any[]> = {};
  dividends.forEach((d: any) => {
    const n = d.note || '---';
    if (!grouped[n]) grouped[n] = [];
    grouped[n].push(d);
  });
  const groupKeys = Object.keys(grouped);

  const calcPreview = (total: number) => {
    setDivPreview(partners.map((p: any) => ({
      name: p.name,
      share: (partnerShare[p.name] ?? 0.33) * 100,
      amount: parseFloat((total * (partnerShare[p.name] ?? 0.33)).toFixed(2)),
    })));
  };

  const handleDividend = async () => {
    if (!divAmount) return;
    const amt = parseFloat(divAmount);
    const items = partners.map((p: any) => ({
      partner: p.name,
      amount: parseFloat((amt * (partnerShare[p.name] ?? 0.33)).toFixed(2)),
      note: divNote || `第${groupKeys.length + 1}次分红`,
    }));
    try {
      await api.createDividend({ items });
      setShowDividend(false);
      setDivAmount(''); setDivNote(''); setDivPreview([]);
      loadData();
    } catch {
      setToast(t('toastSubmitFailed'));
    }
  };

  const handleDelete = async () => {
    if (showDelete === null) return;
    const toDelete = dividends.filter((d: any) => d.note === showDelete);
    let failed = 0;
    for (const d of toDelete) {
      try { await api.deleteDividend(d.id); }
      catch { failed++; }
    }
    setShowDelete(null);
    if (failed > 0) setToast(t('toastSubmitFailed'));
    loadData();
  };

  const switchLang = (l: string) => {
    setLang(l);
    setLangState(l);
    loadData();
  };

  // Build dividend history for detail modal
  const getPartnerHistory = (name: string) => {
    const history: { note: string; amount: number }[] = [];
    Object.entries(grouped).forEach(([note, items]) => {
      items.forEach((d: any) => {
        if (d.partner === name && d.amount > 0)
          history.push({ note: translateDividendNote(note), amount: d.amount });
      });
    });
    return history;
  };

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.container}>

          {/* ====== HEADER ====== */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <View style={s.titleRow}>
                <View style={s.redBar} />
                <View>
                  <Text style={s.mainTitle}>{t('partnerTitle')}</Text>
                  <Text style={s.engSub}>Lan's Luosifen · Partner Capital</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ====== 3 STAT CARDS (8600 exact) ====== */}
          <View style={s.statGrid}>
            <View style={s.statCard}>
              <View style={[s.statIconBg, { backgroundColor: 'rgba(139,30,34,0.08)' }]}>
                <IconBuilding color="#8B1E22" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{t('totalCapital')}</Text>
                <Text style={s.statValue}>¥130,000</Text>
                <Text style={s.statGreen}>{t('paidInRate')} 100%</Text>
              </View>
            </View>

            <View style={s.statCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                <View style={[s.statIconBg, { backgroundColor: '#FFFBEB' }]}>
                  <IconCoins color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.statLabel}>{t('distributedPool')}</Text>
                  <Text style={[s.statValue, { color: '#D97706' }]}>¥{totalDiv.toLocaleString()}</Text>
                  <Text style={s.statSub}>{t('cumulativeByShare')}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.dividendBtn} onPress={() => setShowDividend(true)}>
                <Text style={s.dividendBtnText}>{t('issueDividend')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.statCard} onPress={() => setShowOrg(true)}>
              <View style={[s.statIconBg, { backgroundColor: '#F3F4F6' }]}>
                <IconPeople color="#6B7280" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.statLabel}>{t('partnerSeats')}</Text>
                <Text style={[s.statValue, { color: '#1F2937' }]}>3 {t('shareholders')}</Text>
                <Text style={s.statSub}>{t('lpStructure')}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ====== PARTNER CARDS ====== */}
          <View style={s.partnerGrid}>
            {partners.map((p: any) => {
              const initInv = initCapital[p.name] ?? 42900;
              const midInv = p.investment - initInv;
              const pct = p.investment > 0 ? Number((p.total_dividends / p.investment * 100).toFixed(0)) : 0;
              const rem = Math.max(0, p.investment - p.total_dividends);
              const isBack = p.total_dividends >= p.investment;
              return (
                <TouchableOpacity key={p.id} style={s.partnerCard} onPress={() => setShowDetail(p)}>
                  <View style={s.partnerHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.partnerName}>{translateName(p.name)}</Text>
                      <Text style={s.partnerPct}>{(p.share * 100).toFixed(0)}%</Text>
                    </View>
                    <View style={s.paidBadge}>
                      <Text style={s.paidBadgeText}>{t('investComplete')}</Text>
                    </View>
                  </View>
                  <View style={s.partnerDataRow}>
                    <View style={s.partnerDataCell}>
                      <Text style={s.dataLabel}>{t('subscribedTotal')}</Text>
                      <Text style={s.dataValue}>¥{p.investment.toLocaleString()}</Text>
                    </View>
                    <View style={s.partnerDataCell}>
                      <Text style={s.dataLabel}>{t('initial')}</Text>
                      <Text style={s.dataValue}>¥{initInv.toLocaleString()}</Text>
                    </View>
                    <View style={s.partnerDataCell}>
                      <Text style={s.dataLabel}>{t('additional')}</Text>
                      <Text style={s.dataValue}>¥{midInv.toLocaleString()}</Text>
                    </View>
                  </View>
                  <View style={s.partnerFooter}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={s.footerLabel}>{t('totalDividendsPaid')}</Text>
                      <Text style={s.footerAmt}>¥{p.total_dividends.toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={s.footerSub}>{t('paybackRate')} {pct}%</Text>
                      {isBack ? (
                        <Text style={{ fontSize: 10, color: '#059669', fontWeight: '500' }}>{t('fullyPaidBack')}</Text>
                      ) : (
                        <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '500' }}>{t('pendingPayback')} ¥{rem.toLocaleString()}</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ====== CAPITAL LEDGER ====== */}
          <View style={s.ledgerCard}>
            <View style={s.ledgerHeader}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.ledgerTitle}>{t('capitalLedger')}</Text>
                <Text style={s.ledgerSub}>{t('byRoundAndInvest')}</Text>
              </View>
              <View style={s.filterRow}>
                {(['all', 'invest', 'mid', 'dividend'] as const).map(f => (
                  <TouchableOpacity key={f} onPress={() => setFilter(f)}
                    style={[s.filterBtn, filter === f && s.filterBtnActive]}>
                    <Text style={[s.filterBtnText, filter === f && s.filterBtnActiveText]}>{t(f)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(filter === 'all' || filter === 'invest') && (
              <TableGroup title={t('initialApr2024')} type="invest" total={130000}
                items={[
                  { name: translateName('张安武'), sub: '34%', amount: 44200 },
                  { name: translateName('蓝柳富'), sub: '33%', amount: 42900 },
                  { name: translateName('江宽'), sub: '33%', amount: 42900 },
                ]} />
            )}
            {(filter === 'all' || filter === 'mid') && (
              <TableGroup title={t('midJan2025')} type="mid" total={30162}
                items={[
                  { name: translateName('张安武'), sub: '34%', amount: 10255.08 },
                  { name: translateName('蓝柳富'), sub: '33%', amount: 9953.46 },
                  { name: translateName('江宽'), sub: '33%', amount: 9953.46 },
                ]} />
            )}
            {(filter === 'all' || filter === 'dividend') && groupKeys.map(note => {
              const items = grouped[note];
              const total = items.reduce((s: number, d: any) => s + d.amount, 0);
              return (
                <TableGroup key={note} title={translateDividendNote(note)} type="dividend" total={total}
                  items={items.map((d: any) => ({ name: translateName(d.partner), sub: '', amount: d.amount }))}
                  onDelete={() => setShowDelete(note)} />
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ====== DIVIDEND MODAL ====== */}
      {showDividend && (
        <ModalOverlay onClose={() => setShowDividend(false)}>
          <View style={mo.modalCard} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{t('issueProportional')}</Text>
                <Text style={mo.sub}>{t('autoByShare')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDividend(false)}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={moBody.body}>
              <View>
                <Text style={moBody.label}>{t('totalToPool')}</Text>
                <TextInput style={moBody.input} placeholder={t('enterAmount')} value={divAmount}
                  onChangeText={(v) => { setDivAmount(v); calcPreview(parseFloat(v) || 0); }}
                  keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
              </View>
              <View>
                <Text style={moBody.label}>{t('roundNote')}</Text>
                <TextInput style={moBody.input} placeholder={t('roundNoteExample')} value={divNote}
                  onChangeText={setDivNote} placeholderTextColor="#9CA3AF" />
              </View>
              <View style={moBody.preview}>
                <Text style={moBody.previewTitle}>{t('shareCalcResult')}</Text>
                {(divPreview.length > 0 ? divPreview : partners.map((p: any) => ({
                  name: p.name,
                  share: (partnerShare[p.name] ?? 0.33) * 100,
                  amount: 0,
                }))).map((item: any) => (
                  <View key={item.name} style={moBody.previewRow}>
                    <Text style={moBody.previewName}>{item.name} ({item.share.toFixed(0)}%)</Text>
                    <Text style={moBody.previewAmt}>¥ {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  </View>
                ))}
              </View>
              <View style={moBody.btnRow}>
                <TouchableOpacity style={moBody.cancelBtn} onPress={() => setShowDividend(false)}>
                  <Text style={moBody.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={moBody.confirmBtn} onPress={handleDividend}>
                  <Text style={moBody.confirmBtnText}>{t('confirmIssue')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== DELETE MODAL ====== */}
      {showDelete !== null && (
        <ModalOverlay onClose={() => setShowDelete(null)}>
          <View style={[mo.modalCard, { maxWidth: 320 }]} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{t('confirmDeleteRecord')}</Text>
                <Text style={mo.sub}>{t('irreversible')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDelete(null)}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <View style={moBody.deleteBox}>
                <Text style={moBody.deleteText}>
                  {t('willDelete')}<Text style={{ fontWeight: '600', color: '#1F2937' }}>{translateDividendNote(showDelete)}</Text>{t('allDividendRecords')}
                </Text>
              </View>
              <View style={moBody.btnRow}>
                <TouchableOpacity style={moBody.cancelBtn} onPress={() => setShowDelete(null)}>
                  <Text style={moBody.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={moBody.deleteConfirmBtn} onPress={handleDelete}>
                  <Text style={moBody.confirmBtnText}>{t('confirmDeleteRecord')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== PARTNER DETAIL MODAL (8600 exact) ====== */}
      {showDetail && (
        <ModalOverlay onClose={() => setShowDetail(null)}>
          <View style={[mo.modalCard, { maxWidth: 360 }]} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{translateName(showDetail.name)}</Text>
                <Text style={mo.sub}>
                  {t(getRoleKey(showDetail.name))} · {t('sharePercent')} {(showDetail.share * 100).toFixed(0)}%
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetail(null)}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={moBody.body}>
              <View style={ds.grid}>
                <View style={[ds.cell, { backgroundColor: '#F9FAFB' }]}>
                  <Text style={ds.cellLabel}>{t('totalInvest')}</Text>
                  <Text style={ds.cellNum}>¥{(showDetail.investment || 0).toLocaleString()}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={[ds.cellLabel, { color: '#D97706' }]}>{t('totalDividends')}</Text>
                  <Text style={[ds.cellNum, { color: '#D97706' }]}>¥{(showDetail.total_dividends || 0).toLocaleString()}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: '#F9FAFB' }]}>
                  <Text style={ds.cellLabel}>{t('initialInvest')}</Text>
                  <Text style={ds.cellNumSmall}>¥{(initCapital[showDetail.name] ?? 42900).toLocaleString()}</Text>
                </View>
                <View style={[ds.cell, { backgroundColor: '#F9FAFB' }]}>
                  <Text style={ds.cellLabel}>{t('additional')}</Text>
                  <Text style={ds.cellNumSmall}>¥{((showDetail.investment || 0) - (initCapital[showDetail.name] || 0)).toLocaleString()}</Text>
                </View>
              </View>
              {showDetail.investment > 0 && (
                <View style={ds.progressWrap}>
                  <View style={ds.progressLabel}>
                    <Text style={ds.progressLabelText}>{t('paybackProgress')}</Text>
                    <Text style={[ds.progressLabelText, { fontWeight: '600' }]}>
                      {t('paybackRate')} {Math.min(100, Math.round((showDetail.total_dividends || 0) / showDetail.investment * 100))}%
                    </Text>
                  </View>
                  <View style={ds.progressBar}>
                    <View style={[ds.progressFill, {
                      width: `${Math.min(100, ((showDetail.total_dividends || 0) / showDetail.investment * 100))}%` as any,
                      backgroundColor: (showDetail.total_dividends || 0) >= showDetail.investment ? '#059669' : '#D97706',
                    }]} />
                  </View>
                  <View style={{ marginTop: 4 }}>
                    {(showDetail.total_dividends || 0) >= showDetail.investment ? (
                      <Text style={{ fontSize: 10, color: '#059669', fontWeight: '500' }}>{t('fullyPaidBackDetail')}</Text>
                    ) : (
                      <Text style={{ fontSize: 10, color: '#D97706' }}>
                        {t('pendingPayback')} ¥{(showDetail.investment - (showDetail.total_dividends || 0)).toLocaleString()}
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {/* Dividend History */}
              <View>
                <Text style={ds.historyTitle}>{t('dividendHistory')}</Text>
                {(() => {
                  const hist = getPartnerHistory(showDetail.name);
                  return hist.length > 0 ? (
                    hist.map((h, i) => (
                      <View key={i} style={ds.historyRow}>
                        <Text style={ds.historyNote}>{h.note}</Text>
                        <Text style={ds.historyAmt}>¥{h.amount.toLocaleString()}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={ds.historyEmpty}>{t('noDividendRecords')}</Text>
                  );
                })()}
              </View>
            </View>
          </View>
        </ModalOverlay>
      )}

      {/* ====== ORG CHART MODAL (8600 exact) ====== */}
      {showOrg && (
        <ModalOverlay onClose={() => setShowOrg(false)}>
          <View style={[mo.modalCard, { maxWidth: 300 }]} onStartShouldSetResponder={() => true}>
            <View style={mo.header}>
              <View>
                <Text style={mo.title}>{t('partnerStructure')}</Text>
                <Text style={mo.sub}>{t('lpControl')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowOrg(false)}>
                <Text style={mo.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={org.body}>
              {[
                { name: t('nameZhang'), role: t('chairman'), pct: '34%', isChairman: true },
                { name: t('nameJiang'), role: t('ceo'), pct: '33%', isChairman: false },
                { name: t('nameLan'), role: t('janitor'), pct: '33%', isChairman: false },
              ].map(({ name, role, pct, isChairman }, i) => (
                <View key={name} style={{ alignItems: 'center', width: '100%' }}>
                  {i > 0 && <View style={org.line} />}
                  <View style={org.node}>
                    <Text style={[org.nodeName, isChairman && { color: '#8B1E22' }]}>{name}</Text>
                    <Text style={org.nodeRole}>{role} · {pct}</Text>
                  </View>
                </View>
              ))}
              <Text style={org.joke}>{t('jokeClosedLoop')}</Text>
            </View>
          </View>
        </ModalOverlay>
      )}
      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>
  );
}

function getRoleKey(name: string): string {
  const map: Record<string, string> = { '张安武': 'chairman', '江宽': 'ceo', '蓝柳富': 'janitor' };
  return map[name] || 'janitor';
}

/* ========== MODAL OVERLAY ========== */

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <View style={mo.overlay}>
      <TouchableOpacity style={mo.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={mo.content}>{children}</View>
    </View>
  );
}

/* ========== TABLE GROUP ========== */

function TableGroup({ title, type, total, items, onDelete }: {
  title: string; type: string; total: number; items: { name: string; sub: string; amount: number }[];
  onDelete?: () => void;
}) {
  const colors: Record<string, { dot: string; headerBg: string; badge: string; amt: string }> = {
    invest: { dot: '#3B82F6', headerBg: '#EFF6FF', badge: '#3B82F6', amt: '#111827' },
    mid: { dot: '#8B5CF6', headerBg: '#F5F3FF', badge: '#8B5CF6', amt: '#111827' },
    dividend: { dot: '#F59E0B', headerBg: '#FFFBEB', badge: '#F59E0B', amt: '#D97706' },
  };
  const c = colors[type] || colors.invest;
  return (
    <View style={tg.card}>
      <View style={[tg.theadRow, { backgroundColor: c.headerBg }]}>
        <View style={tg.thLeft}>
          <View style={[tg.dot, { backgroundColor: c.dot }]} />
          <Text style={tg.thTitle}>{title}</Text>
        </View>
        <View style={tg.thRight}>
          <Text style={[tg.thAmt, { color: c.amt }]}>¥{total.toLocaleString()}</Text>
          {onDelete && (
            <TouchableOpacity onPress={onDelete}>
              <Text style={tg.delBtn}>{t('deleteRecord')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {items.map((item, i) => (
        <View key={i} style={[tg.tbodyRow, i > 0 && tg.rowBorder]}>
          <Text style={tg.tdName}>{item.name}
            {item.sub ? <Text style={tg.tdSub}> · {item.sub}</Text> : null}
          </Text>
          <Text style={[tg.tdAmt, { color: c.amt }]}>¥{item.amount.toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );
}

/* ========== STYLES ========== */

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  container: { maxWidth: 1024, alignSelf: 'center', width: '100%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  header: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  backArrow: { fontSize: 22, color: '#9CA3AF', lineHeight: 22, fontWeight: '300' },
  backText: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  redBar: { width: 8, height: 36, backgroundColor: '#8B1E22', borderRadius: 100 },
  mainTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.3 },
  engSub: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', letterSpacing: 0.3, marginTop: 1 },
  langRow: { flexDirection: 'row', gap: 4, paddingTop: 4 },
  langBtn: { fontSize: 10, color: '#9CA3AF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, fontWeight: '500' as any },
  langActive: { color: '#8B1E22', backgroundColor: '#FEE2E2', fontWeight: '700' as any },
  statGrid: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  statIconBg: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', letterSpacing: 0.3 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 2 },
  statGreen: { fontSize: 9, color: '#059669', fontWeight: '500', marginTop: 2 },
  statSub: { fontSize: 9, color: '#9CA3AF', fontWeight: '500', marginTop: 2 },
  dividendBtn: { backgroundColor: '#8B1E22', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  dividendBtnText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  partnerGrid: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  partnerCard: {
    flex: 1, minWidth: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6',
    padding: 16, gap: 10, // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  partnerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  partnerName: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  partnerPct: { fontSize: 10, color: '#9CA3AF' },
  paidBadge: { backgroundColor: '#ECFDF5', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  paidBadgeText: { fontSize: 9, fontWeight: '500', color: '#059669' },
  partnerDataRow: { flexDirection: 'row', gap: 4 },
  partnerDataCell: { flex: 1, alignItems: 'center' },
  dataLabel: { fontSize: 9, color: '#9CA3AF' },
  dataValue: { fontSize: 10, fontWeight: '600', color: '#111827' },
  partnerFooter: { borderTopWidth: 1, borderTopColor: '#F9FAFB', paddingTop: 6 },
  footerLabel: { fontSize: 11, color: '#D97706', fontWeight: '500' },
  footerAmt: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  footerSub: { fontSize: 10, color: '#9CA3AF' },
  ledgerCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', marginTop: 16,
    // @ts-ignore
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  ledgerHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 12 },
  ledgerTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  ledgerSub: { fontSize: 10, color: '#9CA3AF' },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100, backgroundColor: '#F3F4F6' },
  filterBtnActive: { backgroundColor: '#1F2937' },
  filterBtnText: { fontSize: 10, fontWeight: '500' as any, color: '#6B7280' },
  filterBtnActiveText: { color: '#fff', fontWeight: '700' as any },
});

const mo = StyleSheet.create({
  overlay: { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'center', alignItems: 'center', padding: 16 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26,26,26,0.4)' },
  content: { alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 16, width: 360, maxWidth: '100%', overflow: 'hidden',
    // @ts-ignore
    animationName: 'modalIn', animationDuration: '0.2s', animationTimingFunction: 'ease',
    // @ts-ignore
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: { backgroundColor: '#8B1E22', paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 10, color: '#FECACA', marginTop: 2 },
  close: { color: '#FECACA', fontSize: 18 },
});

const moBody = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  label: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', marginBottom: 4 },
  input: { width: '100%', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: 'transparent', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, fontSize: 12, fontWeight: '700' as any, color: '#1A1A1A', fontFamily: undefined },
  preview: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, gap: 8 },
  previewTitle: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewName: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  previewAmt: { fontSize: 11, fontWeight: '700', color: '#1F2937' },
  btnRow: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { fontSize: 12, fontWeight: '500', color: '#4B5563' },
  confirmBtn: { flex: 1, backgroundColor: '#8B1E22', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  confirmBtnText: { fontSize: 12, fontWeight: '500', color: '#fff' },
  deleteConfirmBtn: { flex: 1, backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  deleteBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, alignItems: 'center' },
  deleteText: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
});

const ds = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flex: 1, flexBasis: '45%' as any, borderRadius: 12, padding: 12 },
  cellLabel: { fontSize: 10, fontWeight: '500', color: '#9CA3AF' },
  cellNum: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 2 },
  cellNumSmall: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 2 },
  progressWrap: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12 },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabelText: { fontSize: 11, color: '#9CA3AF' },
  progressBar: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },
  historyTitle: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,251,235,0.4)', borderRadius: 8, marginBottom: 4 },
  historyNote: { fontSize: 11, color: '#4B5563' },
  historyAmt: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  historyEmpty: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
});

const org = StyleSheet.create({
  body: { padding: 20, alignItems: 'center' },
  node: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, width: '100%', alignItems: 'center' },
  nodeName: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  nodeRole: { fontSize: 10, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  line: { width: 2, height: 24, backgroundColor: '#D1D5DB' },
  joke: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 20, lineHeight: 16, fontWeight: '600' },
});

const tg = StyleSheet.create({
  card: { borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  theadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  thLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  thTitle: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  thMid: { width: 40, alignItems: 'center' },
  thBadge: { fontSize: 11, fontWeight: '600' },
  thRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 16 },
  thAmt: { fontSize: 12, fontWeight: '700' },
  delBtn: { fontSize: 10, color: '#EF4444', marginLeft: 8 },
  tbodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  tdName: { fontSize: 12, color: '#4B5563', flex: 1, paddingLeft: 16 },
  tdSub: { fontSize: 10, color: '#9CA3AF' },
  tdMid: { width: 40 },
  tdAmt: { fontSize: 12, fontWeight: '600', paddingRight: 16 },
});
