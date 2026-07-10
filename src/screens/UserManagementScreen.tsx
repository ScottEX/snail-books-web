import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Image } from 'react-native';
import ModalOverlay from '../components/ModalOverlay';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { t, getLang } from '../i18n';
import { useServerDate } from '../hooks/useServerDate';
import { historyHeader } from '../sharedStyles';
import { useSwipeBack } from '../hooks/useSwipeBack';
import EmptyState from '../components/EmptyState';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UserItem {
  id: number;
  username: string;
  email: string;
  is_disabled: boolean;
  reviewed: boolean;
  created_at: string;
  avatar: string;
  delete_scheduled: string;
}

interface Props {
  onBack: () => void;
  onUserSelect: (user: UserItem) => void;
}

function BackArrowSvg({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C8583" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronRightSvg({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6l6 6-6 6" />
    </svg>
  );
}

function CaretDownSvg({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function UserEmptyIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}


// Year constants — will be overridden by useServerDate in component
const FALLBACK_YEAR = new Date().getFullYear();
const FALLBACK_YEARS = [FALLBACK_YEAR - 2, FALLBACK_YEAR - 1, FALLBACK_YEAR, FALLBACK_YEAR + 1];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(y, m, 0); // m is 1-based → JS month is 0-based, day 0 = last day of prev month
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function UserManagementScreen({ onBack, onUserSelect }: Props) {
  const { colors: c } = useTheme();
  const sd = useServerDate();
  const swipeBack = useSwipeBack(onBack);
  const st = useMemo(() => getStyles(c), [c]);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'normal' | 'disabled'
  const [loading, setLoading] = useState(true);
  // dropdown states
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showDateDrop, setShowDateDrop] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Date picker local state (year + month selection)
  const [dropYear, setDropYear] = useState(FALLBACK_YEAR);
  useEffect(() => { if (sd.ready) { setDropYear(sd.year || FALLBACK_YEAR); setDropMonth(sd.month); } }, [sd.ready, sd.year, sd.month]);
  const [dropMonth, setDropMonth] = useState(new Date().getMonth() + 1);

  const fetchUsers = useCallback(async (sts: string, df: string, dt: string) => {
    try {
      const params = new URLSearchParams();
      if (sts) params.set('status', sts);
      if (df) params.set('date_from', df);
      if (dt) params.set('date_to', dt);
      params.set('page', '1');
      params.set('per_page', '100');
      const url = `/api/admin/users?${params.toString()}`;
      const resp = await fetch(url, { credentials: 'include', headers: { 'X-Lang': getLang() } });
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers('', '', ''); }, []);

  // Client-side filter (matches ProcurementScreen pattern)
  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    const s = searchText.toLowerCase();
    return users.filter(u =>
      u.username.toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s)
    );
  }, [users, searchText]);

  const applyStatus = useCallback((val: string) => {
    setStatusFilter(val);
    setShowStatusDrop(false);
    fetchUsers(val, dateFrom, dateTo);
  }, [dateFrom, dateTo, fetchUsers]);

  // Apply year+month picker selection
  const applyPick = useCallback(() => {
    const from = `${dropYear}-${String(dropMonth).padStart(2, '0')}-01`;
    const to = lastDayOfMonth(dropYear, dropMonth);
    setDateFrom(from);
    setDateTo(to);
    setShowDateDrop(false);
    fetchUsers(statusFilter, from, to);
  }, [dropYear, dropMonth, statusFilter, fetchUsers]);

  // Quick presets — fetch immediately (matching iOS)
  const applyQuick = useCallback((days: number) => {
    setDateFrom(sd.offset(-days)); setDateTo(sd.today);
    setShowDateDrop(false);
    fetchUsers(statusFilter, sd.offset(-days), sd.today);
  }, [sd.today, sd.offset, statusFilter, fetchUsers]);

  const clearDate = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setShowDateDrop(false);
    fetchUsers(statusFilter, '', '');
  }, [statusFilter, fetchUsers]);

  // ── Which quick preset is active? (matching iOS) ──
  const quickActive = useMemo(() => {
    if (!dateFrom && !dateTo) return 0;
    if (sd.ready && dateFrom === sd.offset(-7) && dateTo === sd.today) return 7;
    if (sd.ready && dateFrom === sd.offset(-30) && dateTo === sd.today) return 30;
    if (sd.ready && dateFrom === sd.offset(-90) && dateTo === sd.today) return 90;
    return null;
  }, [dateFrom, dateTo, sd.today, sd.ready]);

  const statusLabel = statusFilter === 'normal' ? t('normalStatus') : statusFilter === 'disabled' ? t('disabledStatus') : statusFilter === 'grace' ? t('graceStatus') : t('all');
  const dateLabel = (dateFrom || dateTo)
    ? `${dateFrom || '…'} - ${dateTo || '…'}`
    : t('registrationTime');

  // Refs for dropdown positioning via portal
  const statusChipRef = useRef<HTMLDivElement>(null);
  const dateChipRef = useRef<HTMLDivElement>(null);
  const [statusRect, setStatusRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [dateRect, setDateRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const openStatusDrop = useCallback(() => {
    const el = statusChipRef.current;
    if (el) { const r = el.getBoundingClientRect(); setStatusRect({ top: r.bottom + 4, left: r.left, width: r.width }); }
    setShowStatusDrop(true);
    setShowDateDrop(false);
  }, []);

  const openDateDrop = useCallback(() => {
    const el = dateChipRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const DD_W = 320;
      const pad = 16;
      let left = r.left - 20;
      // Keep within viewport: right edge must not exceed window width
      if (left + DD_W > window.innerWidth - pad) {
        left = window.innerWidth - pad - DD_W;
      }
      if (left < pad) left = pad;
      setDateRect({ top: r.bottom + 4, left, width: DD_W });
    }
    // Init picker from current dateFrom or today
    if (dateFrom && dateFrom.length >= 7) {
      setDropYear(parseInt(dateFrom.slice(0, 4)));
      setDropMonth(parseInt(dateFrom.slice(5, 7)));
    } else {
      setDropYear(sd.year || FALLBACK_YEAR);
      setDropMonth(sd.month || new Date().getMonth() + 1);
    }
    setShowDateDrop(true);
    setShowStatusDrop(false);
  }, [dateFrom]);

  const closeDrops = useCallback(() => {
    setShowStatusDrop(false);
    setShowDateDrop(false);
    setStatusRect(null);
    setDateRect(null);
  }, []);

  return (
    <View style={st.container} {...swipeBack}>
      {/* Header — absolute glass (matches ExpenseDetailScreen) */}
      <View style={[st.header, { pointerEvents: 'box-none' as const }] as any}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrowSvg color="#000" />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('userManagement')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Body */}
      <View style={st.body}>
        {/* Search bar */}
        <View style={st.searchBox}>
          <SearchIcon />
          <TextInput
            style={st.searchInput}
            placeholder={t('searchUser')}
            placeholderTextColor={c.textSub}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText !== '' && (
            <TouchableOpacity onPress={() => { setSearchText(''); }}>
              <Text style={{ fontSize: 14, color: c.textSub, paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter row */}
        <View style={st.filterRow}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={st.filterChip} ref={statusChipRef as any} onPress={() => showStatusDrop ? closeDrops() : openStatusDrop()} activeOpacity={0.7}>
              <Text style={[st.filterChipText, statusFilter !== '' && { color: c.primary, fontWeight: '600' }]} numberOfLines={1}>{statusLabel}</Text>
              <CaretDownSvg color={statusFilter !== '' ? c.primary : c.textSub} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={st.filterChip} ref={dateChipRef as any} onPress={() => showDateDrop ? closeDrops() : openDateDrop()} activeOpacity={0.7}>
              <Text style={[st.filterChipText, (dateFrom || dateTo) && { color: c.primary, fontWeight: '600' }]} numberOfLines={1}>{dateLabel}</Text>
              <CaretDownSvg color={(dateFrom || dateTo) ? c.primary : c.textSub} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status dropdown — always mounted for exit animation */}
        <ModalOverlay visible={showStatusDrop && !!statusRect} onClose={closeDrops} animation="springScale"
          contentStyle={statusRect ? { position: 'absolute' as any, top: statusRect.top, left: statusRect.left, width: statusRect.width, alignItems: 'stretch' } as any : {}}
        >
          {statusRect && (
            <div style={portalDropdownStyle(c)}>
              <TouchableOpacity style={st.dropItem} onPress={() => { applyStatus(''); closeDrops(); }}>
                <Text style={[st.dropItemText, statusFilter === '' && { color: c.primary, fontWeight: '600' }]}>{t('all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.dropItem} onPress={() => { applyStatus('normal'); closeDrops(); }}>
                <View style={[st.statusDot, { backgroundColor: c.success }]} />
                <Text style={[st.dropItemText, statusFilter === 'normal' && { color: c.primary, fontWeight: '600' }]}>{t('normalStatus')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.dropItem} onPress={() => { applyStatus('disabled'); closeDrops(); }}>
                <View style={[st.statusDot, { backgroundColor: c.danger }]} />
                <Text style={[st.dropItemText, statusFilter === 'disabled' && { color: c.primary, fontWeight: '600' }]}>{t('disabledStatus')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.dropItem} onPress={() => { applyStatus('grace'); closeDrops(); }}>
                <View style={[st.statusDot, { backgroundColor: c.warning }]} />
                <Text style={[st.dropItemText, statusFilter === 'grace' && { color: c.primary, fontWeight: '600' }]}>{t('graceStatus')}</Text>
              </TouchableOpacity>
            </div>
          )}
        </ModalOverlay>

        {/* Date dropdown — year/month picker + quick presets — always mounted for exit animation */}
        <ModalOverlay visible={showDateDrop && !!dateRect} onClose={closeDrops} animation="springScale"
          contentStyle={dateRect ? { position: 'absolute' as any, top: dateRect.top, left: dateRect.left, width: dateRect.width, alignItems: 'stretch' } as any : {}}
        >
          {dateRect && (
            <div style={portalDropdownStyle(c)}>
              {/* Year selector */}
              <View style={st.pickerRow}>
                {(sd.ready ? [sd.year - 2, sd.year - 1, sd.year, sd.year + 1] : FALLBACK_YEARS).map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[st.pickerBtn, dateFrom && dropYear === y && st.pickerBtnOn]}
                    onPress={() => setDropYear(y)}
                  >
                    <Text style={[st.pickerBtnText, dateFrom && dropYear === y && st.pickerBtnTextOn]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Month grid */}
              <View style={st.monthGrid}>
                {MONTHS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[st.monthBtn, dateFrom && dropMonth === m && st.monthBtnOn]}
                    onPress={() => setDropMonth(m)}
                  >
                    <Text style={[st.monthBtnText, dateFrom && dropMonth === m && st.monthBtnTextOn]}>
                      {m}{t('monthUnit')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Quick presets */}
              <View style={st.quickRow}>
                <TouchableOpacity style={[st.quickBtn, quickActive === 0 && st.quickBtnOn]} onPress={clearDate}>
                  <Text style={[st.quickBtnText, quickActive === 0 && st.quickBtnTextOn]}>{t('anyDate')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickBtn, quickActive === 7 && st.quickBtnOn]} onPress={() => applyQuick(7)}>
                  <Text style={[st.quickBtnText, quickActive === 7 && st.quickBtnTextOn]}>{t('last7Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickBtn, quickActive === 30 && st.quickBtnOn]} onPress={() => applyQuick(30)}>
                  <Text style={[st.quickBtnText, quickActive === 30 && st.quickBtnTextOn]}>{t('last30Days')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.quickBtn, quickActive === 90 && st.quickBtnOn]} onPress={() => applyQuick(90)}>
                  <Text style={[st.quickBtnText, quickActive === 90 && st.quickBtnTextOn]}>{t('last3Months')}</Text>
                </TouchableOpacity>
              </View>
              {/* Actions */}
              <View style={st.dateActions}>
                <TouchableOpacity style={st.dateActionBtn} onPress={clearDate}>
                  <Text style={st.dateActionText}>{t('reset') || '重置'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.dateActionBtn, st.dateActionApply]} onPress={applyPick}>
                  <Text style={[st.dateActionText, { color: '#fff' }]}>{t('apply') || '确定'}</Text>
                </TouchableOpacity>
              </View>
            </div>
          )}
        </ModalOverlay>

        {/* User list */}
        <ScrollView style={st.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
          {loading ? (
            <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 40, fontSize: 13 }}>{t('loading') || '加载中...'}</Text>
          ) : users.length === 0 ? (
            <EmptyState
              icon={<UserEmptyIcon color={c.textSub} />}
              title={t('noUsers') || '暂无用户'}
            />
          ) : (
            filteredUsers.map((u) => (
              <TouchableOpacity key={u.id} style={st.userRow} onPress={() => onUserSelect(u)} activeOpacity={0.6}>
                <View style={st.avatarWrap}>
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={st.avatar} />
                  ) : (
                    <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                    <Text style={st.userName}>{u.username}</Text>
                    {!u.reviewed && (
                      <View style={st.newBadge}>
                        <Text style={st.newBadgeText}>{t('newUserBadge')}</Text>
                      </View>
                    )}
                  </View>
                  {u.email ? <Text style={st.userEmail}>{u.email}</Text> : null}
                </View>
                <View style={[st.statusBadge, { backgroundColor: u.delete_scheduled ? withAlpha(c.warning, 0.12) : u.is_disabled ? withAlpha(c.danger, 0.08) : withAlpha(c.success, 0.08) }]}>
                  <View style={[st.statusDot, { backgroundColor: u.delete_scheduled ? c.warning : u.is_disabled ? c.danger : c.success }]} />
                  <Text style={[st.statusText, { color: u.delete_scheduled ? c.warning : u.is_disabled ? c.danger : c.success }]}>
                    {u.delete_scheduled ? t('graceStatus') : u.is_disabled ? t('disabledStatus') : t('normalStatus')}
                  </Text>
                </View>
                <ChevronRightSvg color={c.textSub} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <View style={st.footer}>
          <Text style={st.footerText}>{t('totalUsers').replace('{n}', String(total))}</Text>
        </View>
      </View>
    </View>
  );
}

function portalDropdownStyle(c: ThemeColors): React.CSSProperties {
  return {
    backgroundColor: c.surface,
    borderRadius: 10,
    border: `0.5px solid ${withAlpha(c.textMain, 0.08)}`,

    overflow: 'hidden',
  };
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: { flex: 1 },
    ...hdr as any,
    header: { ...hdr.header, top: 0, paddingTop: 3, paddingBottom: 3, height: 42 },
    // Override title color for light bg (historyHeader defaults to #F0EDE8)
    title: { ...hdr.title, color: c.textMain },
    // Body (below absolute header)
    body: {
      flex: 1,
      marginTop: 43,
      backgroundColor: c.bg,
    },
    // Search bar
    searchBox: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      marginHorizontal: 16, marginTop: 16, marginBottom: 10,
      backgroundColor: c.surface,
      borderRadius: 10, paddingHorizontal: 12, height: 40,
      borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    },
    searchInput: {
      flex: 1, marginLeft: 8, fontSize: 14, color: c.textMain,
      paddingVertical: 0, outline: 'none',
    } as any,
    // Filter row
    filterRow: {
      flexDirection: 'row' as const, gap: 10,
      paddingHorizontal: 16, marginBottom: 6,
    },
    filterChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: 10, height: 40, paddingHorizontal: 12,
      borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    },
    filterChipText: { fontSize: 13, color: c.textSub, flex: 1 } as any,
    dropItem: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      paddingVertical: 12, paddingHorizontal: 14,
      borderBottomWidth: 0.5, borderBottomColor: withAlpha(c.textMain, 0.06),
    },
    dropItemText: { fontSize: 14, color: c.textMain },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    // ── Date picker (year + month) ──
    pickerRow: {
      flexDirection: 'row' as const, gap: 6,
      paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6,
    },
    pickerBtn: {
      flex: 1, alignItems: 'center' as const, paddingVertical: 7,
      borderRadius: 8, backgroundColor: withAlpha(c.textMain, 0.04),
    },
    pickerBtnOn: { backgroundColor: c.primary },
    pickerBtnText: { fontSize: 13, color: c.textMain },
    pickerBtnTextOn: { color: '#fff', fontWeight: '600' as const },
    monthGrid: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6,
      paddingHorizontal: 14, paddingBottom: 8,
    },
    monthBtn: {
      width: 'calc(25% - 4.5px)' as any, alignItems: 'center' as const,
      paddingVertical: 7, borderRadius: 8,
      backgroundColor: withAlpha(c.textMain, 0.04),
    },
    monthBtnOn: { backgroundColor: c.primary },
    monthBtnText: { fontSize: 13, color: c.textMain },
    monthBtnTextOn: { color: '#fff', fontWeight: '600' as const },
    // ── Quick presets ──
    quickRow: {
      flexDirection: 'row' as const, gap: 6,
      paddingHorizontal: 14, paddingBottom: 10,
      borderTopWidth: 0.5, borderTopColor: withAlpha(c.textMain, 0.06),
      paddingTop: 10,
    },
    quickBtn: {
      flex: 1, alignItems: 'center' as const, paddingVertical: 7,
      borderRadius: 8, backgroundColor: withAlpha(c.textMain, 0.04),
    },
    quickBtnText: { fontSize: 12, color: c.textSub },
    quickBtnOn: { backgroundColor: c.primary },
    quickBtnTextOn: { color: '#fff', fontWeight: '600' as any },
    // ── Actions ──
    dateActions: {
      flexDirection: 'row' as const, justifyContent: 'flex-end', gap: 8,
      paddingHorizontal: 14, paddingBottom: 10,
    },
    dateActionBtn: {
      paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8,
      backgroundColor: withAlpha(c.textMain, 0.06),
    },
    dateActionApply: { backgroundColor: c.primary },
    dateActionText: { fontSize: 13, color: c.textMain },
    // List
    list: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
    userRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      backgroundColor: c.surface, borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 12,
      marginBottom: 6,
      borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.06),
    },
    avatarWrap: { marginRight: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    userName: { fontSize: 15, fontWeight: '600', color: c.textMain } as any,
    userEmail: { fontSize: 12, color: c.textSub, marginTop: 2 } as any,
    newBadge: {
      backgroundColor: withAlpha(c.warning, 0.15),
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    },
    newBadgeText: { fontSize: 10, fontWeight: '700', color: c.warning } as any,
    markReadBtn: {
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
      backgroundColor: withAlpha(c.primary, 0.1),
      marginRight: 4,
    },
    markReadText: { fontSize: 12, fontWeight: '600', color: c.primary } as any,
    statusBadge: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
      marginRight: 8,
    },
    statusText: { fontSize: 12, fontWeight: '500' } as any,
    // Footer
    footer: {
      paddingVertical: 12, paddingHorizontal: 16,
      borderTopWidth: 0.5, borderTopColor: withAlpha(c.textMain, 0.06),
      backgroundColor: c.surface,
      alignItems: 'center' as const,
    },
    footerText: { fontSize: 13, color: c.textSub },
  });
};
