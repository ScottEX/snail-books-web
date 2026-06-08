import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Image } from 'react-native';
import { useTheme, withAlpha, ThemeColors, FONTS } from '../theme';
import { t, getLang } from '../i18n';
import { historyHeader } from '../sharedStyles';

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
}

/* pinyin initial extraction — supports all common Chinese characters */
function pinyinInitials(s: string): string {
  const map: Record<string, string> = {
    '阿':'a','爱':'a','安':'a','暗':'a','昂':'a','奥':'a',
    '巴':'b','白':'b','班':'b','包':'b','贝':'b','边':'b','波':'b','步':'b',
    '才':'c','蔡':'c','曹':'c','岑':'c','常':'c','陈':'c','成':'c','程':'c','迟':'c','崔':'c',
    '大':'d','戴':'d','邓':'d','丁':'d','董':'d','杜':'d','段':'d',
    '范':'f','方':'f','房':'f','费':'f','冯':'f','傅':'f','富':'f',
    '高':'g','葛':'g','宫':'g','龚':'g','古':'g','顾':'g','关':'g','郭':'g',
    '海':'h','韩':'h','郝':'h','何':'h','贺':'h','洪':'h','侯':'h','胡':'h','华':'h','黄':'h','霍':'h',
    '纪':'j','贾':'j','简':'j','江':'j','姜':'j','蒋':'j','金':'j',
    '康':'k','孔':'k','寇':'k','匡':'k','邝':'k',
    '赖':'l','蓝':'l','雷':'l','黎':'l','李':'l','利':'l','梁':'l','廖':'l','林':'l','凌':'l','刘':'l','柳':'l','龙':'l','卢':'l','陆':'l','吕':'l','罗':'l','骆':'l',
    '马':'m','麦':'m','毛':'m','梅':'m','孟':'m','米':'m','苗':'m','莫':'m','牟':'m',
    '倪':'n','年':'n','聂':'n','宁':'n','牛':'n',
    '欧':'o','区':'o',
    '潘':'p','庞':'p','裴':'p','彭':'p','皮':'p','蒲':'p',
    '戚':'q','齐':'q','钱':'q','乔':'q','秦':'q','邱':'q','屈':'q','全':'q',
    '任':'r','荣':'r','阮':'r','芮':'r',
    '沙':'s','单':'s','商':'s','邵':'s','沈':'s','盛':'s','施':'s','石':'s','史':'s','舒':'s','司':'s','宋':'s','苏':'s','孙':'s',
    '谈':'t','谭':'t','汤':'t','唐':'t','陶':'t','田':'t','童':'t','涂':'t',
    '万':'w','汪':'w','王':'w','韦':'w','魏':'w','温':'w','文':'w','翁':'w','吴':'w','伍':'w','武':'w',
    '席':'x','夏':'x','向':'x','萧':'x','谢':'x','徐':'x','许':'x','薛':'x',
    '严':'y','颜':'y','杨':'y','姚':'y','叶':'y','易':'y','殷':'y','尹':'y','应':'y','尤':'y','于':'y','余':'y','俞':'y','袁':'y','岳':'y','云':'y',
    '曾':'z','翟':'z','詹':'z','张':'z','章':'z','赵':'z','郑':'z','钟':'z','周':'z','朱':'z','诸':'z','祝':'z','庄':'z','卓':'z','宗':'z','邹':'z','左':'z',
  };
  let r = '';
  for (const ch of s) r += map[ch] || ch.toLowerCase();
  return r;
}

function ChevronRightSvg({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 6l6 6-6 6" />
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

function BackArrowSvg({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export default function UserManagementScreen({ onBack }: Props) {
  const { colors: c } = useTheme();
  const st = useMemo(() => getStyles(c), [c]);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'normal' | 'disabled'
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  const fetchUsers = useCallback(async (p: number, s: string, sts: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (sts) params.set('status', sts);
      params.set('page', String(p));
      params.set('per_page', '50');
      const resp = await fetch(`/api/admin/users?${params.toString()}`, { credentials: 'include', headers: { 'X-Lang': getLang() } });
      if (resp.ok) {
        const data = await resp.json();
        setUsers(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(1, search, statusFilter); }, []);

  const doSearch = useCallback(() => {
    setPage(1);
    fetchUsers(1, search, statusFilter);
  }, [search, statusFilter, fetchUsers]);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setShowFilter(false);
    setPage(1);
    fetchUsers(1, search, val);
  }, [search, fetchUsers]);

  const handleToggleStatus = useCallback(async (uid: number) => {
    try {
      const resp = await fetch(`/api/admin/users/${uid}/toggle`, { credentials: 'include', headers: { 'X-Lang': getLang() } });
      if (resp.ok) {
        // refresh list
        fetchUsers(page, search, statusFilter);
      }
    } catch {}
  }, [page, search, statusFilter, fetchUsers]);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return d.slice(0, 10); } catch { return '—'; }
  };

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrowSvg color={c.primary} />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('userManagement')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search bar */}
      <View style={st.searchRow}>
        <View style={st.searchBox}>
          <SearchIcon />
          <TextInput
            style={st.searchInput}
            placeholder={t('searchUser')}
            placeholderTextColor={c.textSub}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={doSearch}
            returnKeyType="search"
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => { setSearch(''); setPage(1); fetchUsers(1, '', statusFilter); }}>
              <Text style={{ fontSize: 14, color: c.textSub, paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Status filter button */}
        <TouchableOpacity
          style={[st.filterBtn, statusFilter !== '' && st.filterBtnActive]}
          onPress={() => setShowFilter(!showFilter)}
          activeOpacity={0.7}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={statusFilter !== '' ? c.surface : c.textSub} strokeWidth="2" strokeLinecap="round">
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="12" x2="23" y2="12" />
          </svg>
        </TouchableOpacity>
        {/* Status filter dropdown */}
        {showFilter && (
          <View style={st.filterDropdown}>
            <TouchableOpacity style={st.filterItem} onPress={() => handleStatusChange('')}>
              <Text style={[st.filterItemText, statusFilter === '' && { color: c.primary, fontWeight: '600' }]}>{t('all')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.filterItem} onPress={() => handleStatusChange('normal')}>
              <View style={[st.statusDot, { backgroundColor: c.success }]} />
              <Text style={[st.filterItemText, statusFilter === 'normal' && { color: c.primary, fontWeight: '600' }]}>{t('normalStatus')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.filterItem} onPress={() => handleStatusChange('disabled')}>
              <View style={[st.statusDot, { backgroundColor: c.danger }]} />
              <Text style={[st.filterItemText, statusFilter === 'disabled' && { color: c.primary, fontWeight: '600' }]}>{t('disabledStatus')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* User list */}
      <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 40, fontSize: 13 }}>{t('loading') || '加载中...'}</Text>
        ) : users.length === 0 ? (
          <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 40, fontSize: 13 }}>{t('noUsers') || '暂无用户'}</Text>
        ) : (
          users.map((u) => (
            <View key={u.id} style={st.userRow}>
              {/* Avatar */}
              <View style={st.avatarWrap}>
                {u.avatar ? (
                  <Image source={{ uri: u.avatar }} style={st.avatar} />
                ) : (
                  <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
                )}
              </View>
              {/* User info */}
              <View style={{ flex: 1 }}>
                <Text style={st.userName}>{u.username}</Text>
                {u.email ? <Text style={st.userEmail}>{u.email}</Text> : null}
              </View>
              {/* Status badge */}
              <TouchableOpacity
                style={[st.statusBadge, { backgroundColor: u.is_disabled ? withAlpha(c.danger, 0.08) : withAlpha(c.success, 0.08) }]}
                onPress={() => handleToggleStatus(u.id)}
                activeOpacity={0.7}
              >
                <View style={[st.statusDot, { backgroundColor: u.is_disabled ? c.danger : c.success }]} />
                <Text style={[st.statusText, { color: u.is_disabled ? c.danger : c.success }]}>
                  {u.is_disabled ? t('disabledStatus') : t('normalStatus')}
                </Text>
              </TouchableOpacity>
              {/* Chevron */}
              <ChevronRightSvg color={c.textSub} />
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Footer */}
      <View style={st.footer}>
        <Text style={st.footerText}>{t('totalRecords').replace('{n}', String(total))}</Text>
      </View>
    </View>
  );
}

const HEADER_H = 88; // top:36 + height:52

const getStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  ...historyHeader(c),
  // Search bar
  searchRow: {
    marginTop: HEADER_H + 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 10, paddingHorizontal: 12, height: 40,
    borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
  },
  searchInput: {
    flex: 1, marginLeft: 8, fontSize: 14, color: c.textMain,
    paddingVertical: 0,
  } as any,
  filterBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: c.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
  },
  filterBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  // Filter dropdown
  filterDropdown: {
    position: 'absolute' as any, top: 48, right: 16,
    backgroundColor: c.surface, borderRadius: 10,
    borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    zIndex: 100,
    // shadow
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    minWidth: 120,
  } as any,
  filterItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 0.5, borderBottomColor: withAlpha(c.textMain, 0.06),
  },
  filterItemText: { fontSize: 14, color: c.textMain },
  // List
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
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
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    marginRight: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' } as any,
  // Footer
  footer: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 0.5, borderTopColor: withAlpha(c.textMain, 0.06),
    backgroundColor: c.surface,
    alignItems: 'center',
  },
  footerText: { fontSize: 13, color: c.textSub },
});
