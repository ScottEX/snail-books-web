import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Image } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, withAlpha, ThemeColors, FONTS } from '../theme';
import { t, getLang } from '../i18n';
import { historyHeader } from '../sharedStyles';
import { useSwipeBack } from '../hooks/useSwipeBack';

interface UserItem {
  id: number;
  username: string;
  email: string;
  is_disabled: boolean;
  created_at: string;
  avatar: string;
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

export default function UserManagementScreen({ onBack, onUserSelect }: Props) {
  const { colors: c } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const st = useMemo(() => getStyles(c), [c]);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'normal' | 'disabled'
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // dropdown states
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showDateDrop, setShowDateDrop] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchUsers = useCallback(async (p: number, s: string, sts: string, df: string, dt: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (sts) params.set('status', sts);
      if (df) params.set('date_from', df);
      if (dt) params.set('date_to', dt);
      params.set('page', String(p));
      params.set('per_page', '50');
      const url = `/api/admin/users?${params.toString()}`;
      console.log('[UserMgmt] fetchUsers, url:', url);
      const resp = await fetch(url, { credentials: 'include', headers: { 'X-Lang': getLang() } });
      console.log('[UserMgmt] fetchUsers resp:', resp.status);
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(1, search, statusFilter, dateFrom, dateTo); }, []);

  // Debounced search-as-you-type
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      console.log('[UserMgmt] debounce fire, searchText:', searchText);
      setSearch(searchText);
      setPage(1);
      fetchUsers(1, searchText, statusFilter, dateFrom, dateTo);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText]);

  const applyStatus = useCallback((val: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setStatusFilter(val);
    setSearch(searchText);
    setShowStatusDrop(false);
    setPage(1);
    fetchUsers(1, searchText, val, dateFrom, dateTo);
  }, [searchText, dateFrom, dateTo, fetchUsers]);

  const applyDate = useCallback((df: string, dt: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setDateFrom(df);
    setDateTo(dt);
    setSearch(searchText);
    setShowDateDrop(false);
    setPage(1);
    fetchUsers(1, searchText, statusFilter, df, dt);
  }, [searchText, statusFilter, fetchUsers]);

  const clearDate = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setDateFrom('');
    setDateTo('');
    setSearch(searchText);
    setPage(1);
    fetchUsers(1, searchText, statusFilter, '', '');
  }, [searchText, statusFilter, fetchUsers]);

  const statusLabel = statusFilter === 'normal' ? t('normalStatus') : statusFilter === 'disabled' ? t('disabledStatus') : t('all');
  const dateLabel = (dateFrom || dateTo) ? `${dateFrom || '…'} - ${dateTo || '…'}` : t('registrationTime');

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
    if (el) { const r = el.getBoundingClientRect(); setDateRect({ top: r.bottom + 4, left: r.left, width: r.width }); }
    setShowDateDrop(true);
    setShowStatusDrop(false);
  }, []);

  const closeDrops = useCallback(() => {
    setShowStatusDrop(false);
    setShowDateDrop(false);
    setStatusRect(null);
    setDateRect(null);
  }, []);

  return (
    <View style={st.container} {...swipeBack}>
      {/* Header — absolute glass (matches ExpenseDetailScreen) */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrowSvg color={c.primary} />
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

        {/* Status dropdown portal */}
        {showStatusDrop && statusRect && createPortal(
          <div style={{ position: 'fixed', top: statusRect.top, left: statusRect.left, width: statusRect.width, zIndex: 9999 }}>
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
            </div>
          </div>,
          document.body
        )}
        {showStatusDrop && createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={closeDrops} />, document.body)}

        {/* Date dropdown portal */}
        {showDateDrop && dateRect && createPortal(
          <div style={{ position: 'fixed', top: dateRect.top, left: dateRect.left, width: dateRect.width, zIndex: 9999 }}>
            <div style={portalDropdownStyle(c)}>
              <View style={st.dateRow}>
                <TextInput
                  style={st.dateInput}
                  value={dateFrom}
                  onChangeText={setDateFrom}
                  placeholder="2024-01-01"
                  placeholderTextColor={c.textSub}
                  maxLength={10}
                />
                <Text style={{ color: c.textSub, marginHorizontal: 4 }}>—</Text>
                <TextInput
                  style={st.dateInput}
                  value={dateTo}
                  onChangeText={setDateTo}
                  placeholder="2024-12-31"
                  placeholderTextColor={c.textSub}
                  maxLength={10}
                />
              </View>
              <View style={st.dateActions}>
                <TouchableOpacity style={st.dateActionBtn} onPress={() => { clearDate(); closeDrops(); }}>
                  <Text style={st.dateActionText}>{t('reset') || '重置'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.dateActionBtn, st.dateActionApply]} onPress={() => { applyDate(dateFrom, dateTo); closeDrops(); }}>
                  <Text style={[st.dateActionText, { color: '#fff' }]}>{t('apply') || '确定'}</Text>
                </TouchableOpacity>
              </View>
            </div>
          </div>,
          document.body
        )}
        {showDateDrop && createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={closeDrops} />, document.body)}

        {/* User list */}
        <ScrollView style={st.list} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
          {loading ? (
            <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 40, fontSize: 13 }}>{t('loading') || '加载中...'}</Text>
          ) : users.length === 0 ? (
            <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 40, fontSize: 13 }}>{t('noUsers') || '暂无用户'}</Text>
          ) : (
            users.map((u) => (
              <TouchableOpacity key={u.id} style={st.userRow} onPress={() => onUserSelect(u)} activeOpacity={0.6}>
                <View style={st.avatarWrap}>
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={st.avatar} />
                  ) : (
                    <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.userName}>{u.username}</Text>
                  {u.email ? <Text style={st.userEmail}>{u.email}</Text> : null}
                </View>
                <View style={[st.statusBadge, { backgroundColor: u.is_disabled ? withAlpha(c.danger, 0.08) : withAlpha(c.success, 0.08) }]}>
                  <View style={[st.statusDot, { backgroundColor: u.is_disabled ? c.danger : c.success }]} />
                  <Text style={[st.statusText, { color: u.is_disabled ? c.danger : c.success }]}>
                    {u.is_disabled ? t('disabledStatus') : t('normalStatus')}
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
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  };
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: { flex: 1 },
    ...hdr as any,
    // Override title color for light bg (historyHeader defaults to #F0EDE8)
    title: { ...hdr.title, color: c.textMain },
    // Body (below absolute header)
    body: {
      flex: 1,
      marginTop: 100,
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
    // Date picker in dropdown
    dateRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    dateInput: {
      flex: 1, height: 34, borderRadius: 8,
      backgroundColor: c.bg,
      paddingHorizontal: 10, fontSize: 13, color: c.textMain,
      borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.1), outline: 'none',
    } as any,
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
