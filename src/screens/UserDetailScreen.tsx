import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Image } from 'react-native';
import { useTheme, withAlpha, ThemeColors, FONTS } from '../theme';
import { t, getLang } from '../i18n';

interface UserData {
  id: number;
  username: string;
  email: string;
  phone: string;
  role: string;
  remark: string;
  is_disabled: boolean;
  created_at: string;
  last_login: string;
  avatar: string;
  signature: string;
}

interface Props {
  user: { id: number; username: string; email: string; avatar: string; is_disabled: boolean };
  onBack: () => void;
  onUpdated: () => void;
}

const ROLES = ['', '普通用户', '董事长', 'CEO', '店长', '员工'];
const ROLE_EN = ['', 'User', 'Chairman', 'CEO', 'Manager', 'Staff'];
const ROLE_TW = ['', '普通用戶', '董事長', 'CEO', '店長', '員工'];

function getRoleLabel(role: string, lang: string): string {
  if (!role) return '—';
  if (lang === 'en') {
    const idx = ROLES.indexOf(role);
    return idx >= 0 ? ROLE_EN[idx] : role;
  }
  if (lang === 'zh-TW') {
    const idx = ROLES.indexOf(role);
    return idx >= 0 ? ROLE_TW[idx] : role;
  }
  return role;
}

function BackArrowSvg({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export default function UserDetailScreen({ user, onBack, onUpdated }: Props) {
  const { colors: c } = useTheme();
  const lang = getLang();
  const st = useMemo(() => getStyles(c), [c]);

  const [detail, setDetail] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDisabled, setIsDisabled] = useState(user.is_disabled);
  const [role, setRole] = useState('');
  const [remark, setRemark] = useState('');
  const [phone, setPhone] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/admin/users/${user.id}`, { credentials: 'include', headers: { 'X-Lang': lang } });
      if (resp.ok) {
        const data = await resp.json();
        const d = data.data;
        setDetail(d);
        setIsDisabled(d.is_disabled);
        setRole(d.role || '');
        setRemark(d.remark || '');
        setPhone(d.phone || '');
      }
    } catch {}
    setLoading(false);
  }, [user.id, lang]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const saveField = useCallback(async (field: string, value: string | boolean) => {
    setSaving(true);
    try {
      const body: Record<string, string | boolean> = {};
      body[field] = value;
      const resp = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Lang': lang },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        if (field === 'is_disabled') onUpdated();
      }
    } catch {}
    setSaving(false);
  }, [user.id, lang, onUpdated]);

  const handleToggleDisabled = useCallback((val: boolean) => {
    setIsDisabled(val);
    saveField('is_disabled', val);
  }, [saveField]);

  const handleRoleSelect = useCallback((r: string) => {
    setRole(r);
    setShowRolePicker(false);
    saveField('role', r);
  }, [saveField]);

  const handleRemarkBlur = useCallback(() => {
    saveField('remark', remark);
  }, [remark, saveField]);

  const handlePhoneBlur = useCallback(() => {
    saveField('phone', phone);
  }, [phone, saveField]);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return d.slice(0, 16).replace('T', ' '); } catch { return '—'; }
  };

  if (loading) {
    return (
      <View style={st.root}>
        <View style={st.statusBar} />
        <View style={st.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={st.backBtn}><BackArrowSvg color={c.primary} /></View>
          </TouchableOpacity>
          <Text style={st.title}>{t('userDetail')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 60, fontSize: 13 }}>{t('loading') || '加载中...'}</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={st.root}>
        <View style={st.statusBar} />
        <View style={st.header}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={st.backBtn}><BackArrowSvg color={c.primary} /></View>
          </TouchableOpacity>
          <Text style={st.title}>{t('userDetail')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 60, fontSize: 13 }}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={st.root}>
      {/* Status bar padding */}
      <View style={st.statusBar} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}>
            <BackArrowSvg color={c.primary} />
          </View>
        </TouchableOpacity>
        <Text style={st.title}>{t('userDetail')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Avatar + Username + Status */}
        <View style={st.avatarSection}>
          {detail.avatar ? (
            <Image source={{ uri: detail.avatar }} style={st.avatar} />
          ) : (
            <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
          )}
          <Text style={st.avatarName}>{detail.username}</Text>
          <View style={[st.statusBadge, { backgroundColor: isDisabled ? withAlpha(c.danger, 0.08) : withAlpha(c.success, 0.08) }]}>
            <View style={[st.statusDot, { backgroundColor: isDisabled ? c.danger : c.success }]} />
            <Text style={[st.statusText, { color: isDisabled ? c.danger : c.success }]}>
              {isDisabled ? t('disabledStatus') : t('normalStatus')}
            </Text>
          </View>
        </View>

        {/* Basic Info */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('basicInfo')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('username')}</Text>
              <Text style={st.infoValue}>{detail.username}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>User ID</Text>
              <Text style={st.infoValue}>{detail.id}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('phone')}</Text>
              <Text style={st.infoValue}>{detail.phone || '—'}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('profileEmail')}</Text>
              <Text style={st.infoValue}>{detail.email || '—'}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('registrationTime')}</Text>
              <Text style={st.infoValue}>{fmtDate(detail.created_at)}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('lastLogin') || 'Last Login'}</Text>
              <Text style={st.infoValue}>{fmtDate(detail.last_login)}</Text>
            </View>
          </View>
        </View>

        {/* Login Status */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('loginStatus')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            <View style={st.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.toggleLabel}>{t('allowLogin')}</Text>
                <Text style={st.toggleHint}>{t('loginDisabledHint')}</Text>
              </View>
              <Switch
                value={!isDisabled}
                onValueChange={(v) => handleToggleDisabled(!v)}
                trackColor={{ false: withAlpha(c.danger, 0.3), true: c.success }}
                thumbColor="#fff"
                disabled={saving}
              />
            </View>
          </View>
        </View>

        {/* Other Info */}
        <View style={st.section}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionTitleText}>{t('otherInfo')}</Text>
            <View style={st.sectionTitleLine} />
          </View>
          <View style={st.card}>
            {/* Role */}
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('role')}</Text>
              <TouchableOpacity onPress={() => setShowRolePicker(!showRolePicker)} activeOpacity={0.7}>
                <Text style={[st.infoValue, st.roleValue]}>{getRoleLabel(role, lang)}</Text>
              </TouchableOpacity>
            </View>
            {showRolePicker && (
              <View style={st.roleList}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[st.roleItem, role === r && st.roleItemActive]}
                    onPress={() => handleRoleSelect(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.roleItemText, role === r && { color: c.primary, fontWeight: '600' }]}>
                      {getRoleLabel(r, lang) || '—'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={st.divider} />
            {/* Remarks */}
            <View style={st.remarkRow}>
              <Text style={st.infoLabel}>{t('remarks')}</Text>
              <input
                type="text"
                value={remark}
                onChange={(e: any) => setRemark(e.target.value)}
                onBlur={handleRemarkBlur}
                placeholder="—"
                style={{
                  flex: 1, textAlign: 'right', border: 'none', outline: 'none',
                  fontSize: 14, fontWeight: '500', color: c.textMain,
                  background: 'transparent', padding: 0,
                }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const STATUS_BAR_H = 48;

const getStyles = (c: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  statusBar: { height: STATUS_BAR_H },
  header: {
    height: 48,
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: withAlpha(c.textMain, 0.06),
    justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '600' as const, color: c.textMain },
  // Avatar section
  avatarSection: {
    alignItems: 'center' as const, paddingTop: 20, paddingBottom: 24,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  avatarName: { fontSize: 20, fontWeight: '700' as const, color: c.textMain, marginBottom: 6 },
  statusBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: '500' } as any,
  // Sections
  section: { paddingHorizontal: 20, marginTop: 12 },
  sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 4, gap: 8 },
  sectionTitleText: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: c.textSub } as any,
  sectionTitleLine: { flex: 1, height: 1, backgroundColor: withAlpha(c.textMain, 0.08) },
  card: {
    marginTop: 4, backgroundColor: c.surface,
    borderRadius: 12, paddingHorizontal: 0, paddingVertical: 2,
  },
  infoRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between',
    alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 16,
  },
  infoLabel: { fontSize: 14, color: c.textSub },
  infoValue: { fontSize: 14, fontWeight: '500' as const, color: c.textMain } as any,
  divider: { height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 },
  // Toggle
  toggleRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '500' as const, color: c.textMain, marginBottom: 2 },
  toggleHint: { fontSize: 12, color: c.textSub, lineHeight: 16 },
  // Role picker
  roleValue: { color: c.primary } as any,
  roleList: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  roleItem: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: withAlpha(c.textMain, 0.05),
  },
  roleItemActive: { backgroundColor: withAlpha(c.primary, 0.1) },
  roleItemText: { fontSize: 13, color: c.textMain },
  // Remark
  remarkRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between',
    alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
});
