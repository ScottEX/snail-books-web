import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Image, TextInput } from 'react-native';
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
  if (lang === 'en') { const idx = ROLES.indexOf(role); return idx >= 0 ? ROLE_EN[idx] : role; }
  if (lang === 'zh-TW') { const idx = ROLES.indexOf(role); return idx >= 0 ? ROLE_TW[idx] : role; }
  return role;
}

function BackArrowSvg({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function PencilSvg({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="M15 5l4 4" />
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
  const [email, setEmail] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/admin/users/${user.id}`, { credentials: 'include', headers: { 'X-Lang': lang } });
      if (resp.ok) {
        const d = (await resp.json()).data;
        setDetail(d);
        setIsDisabled(d.is_disabled);
        setRole(d.role || '');
        setRemark(d.remark || '');
        setPhone(d.phone || '');
        setEmail(d.email || '');
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
      if (resp.ok && field === 'is_disabled') onUpdated();
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

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return d.slice(0, 16).replace('T', ' '); } catch { return '—'; }
  };

  // Shared header + loading/null states
  const headerBar = (
    <View style={st.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
        <View style={st.backBtn}><BackArrowSvg color={c.primary} /></View>
      </TouchableOpacity>
      <Text style={st.title}>{t('userDetail')}</Text>
      <View style={{ width: 36 }} />
    </View>
  );

  if (loading) {
    return (
      <View style={st.root}>
        <View style={st.statusBar} />
        {headerBar}
        <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 60, fontSize: 13 }}>{t('loading') || '加载中...'}</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={st.root}>
        <View style={st.statusBar} />
        {headerBar}
        <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 60, fontSize: 13 }}>User not found</Text>
      </View>
    );
  }

  // Editable field row with pencil
  const EditableRow = ({ label, value, onChangeText, onBlurSave, placeholder }: {
    label: string; value: string; onChangeText: (t: string) => void; onBlurSave: () => void; placeholder?: string;
  }) => (
    <View style={st.editRow}>
      <Text style={st.infoLabel}>{label}</Text>
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flex: 1, justifyContent: 'flex-end' }}>
        <TextInput
          style={st.editInput}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlurSave}
          placeholder={placeholder || '—'}
          placeholderTextColor={c.textSub}
        />
        <PencilSvg color={c.textSub} />
      </View>
    </View>
  );

  return (
    <View style={st.root}>
      <View style={st.statusBar} />
      {headerBar}

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Avatar left, username + status right */}
        <View style={st.avatarSection}>
          {detail.avatar ? (
            <Image source={{ uri: detail.avatar }} style={st.avatar} />
          ) : (
            <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={st.avatarName}>{detail.username}</Text>
            <View style={[st.statusBadge, { alignSelf: 'flex-start' as const, backgroundColor: isDisabled ? withAlpha(c.danger, 0.08) : withAlpha(c.success, 0.08) }]}>
              <View style={[st.statusDot, { backgroundColor: isDisabled ? c.danger : c.success }]} />
              <Text style={[st.statusText, { color: isDisabled ? c.danger : c.success }]}>
                {isDisabled ? t('disabledStatus') : t('normalStatus')}
              </Text>
            </View>
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
            <EditableRow label={t('phone')} value={phone} onChangeText={setPhone} onBlurSave={() => saveField('phone', phone)} />
            <View style={st.divider} />
            <EditableRow label={t('profileEmail')} value={email} onChangeText={setEmail} onBlurSave={() => saveField('email', email)} />
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('registrationTime')}</Text>
              <Text style={st.infoValue}>{fmtDate(detail.created_at)}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.infoRow}>
              <Text style={st.infoLabel}>{t('lastLogin')}</Text>
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
            {/* Role with pencil */}
            <View style={st.editRow}>
              <Text style={st.infoLabel}>{t('role')}</Text>
              <TouchableOpacity onPress={() => setShowRolePicker(!showRolePicker)} activeOpacity={0.7} style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
                <Text style={[st.infoValue, { color: c.primary }]}>{getRoleLabel(role, lang)}</Text>
                <PencilSvg color={c.textSub} />
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
            {/* Remarks with pencil */}
            <View style={st.editRow}>
              <Text style={st.infoLabel}>{t('remarks')}</Text>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                <TextInput
                  style={st.editInput}
                  value={remark}
                  onChangeText={setRemark}
                  onBlur={() => saveField('remark', remark)}
                  placeholder="—"
                  placeholderTextColor={c.textSub}
                />
                <PencilSvg color={c.textSub} />
              </View>
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
    paddingHorizontal: 16, backgroundColor: 'transparent',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: withAlpha(c.textMain, 0.06),
    justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '600' as const, color: c.textMain },
  // Avatar section — horizontal layout
  avatarSection: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, flexShrink: 0 },
  avatarName: { fontSize: 18, fontWeight: '700' as const, color: c.textMain, marginBottom: 6 },
  statusBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' } as any,
  // Sections
  section: { paddingHorizontal: 20, marginTop: 12 },
  sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 4, gap: 8 },
  sectionTitleText: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: c.textSub } as any,
  sectionTitleLine: { flex: 1, height: 1, backgroundColor: withAlpha(c.textMain, 0.08) },
  card: { marginTop: 4, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 0, paddingVertical: 2 },
  infoRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between',
    alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 16,
  },
  editRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between',
    alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  infoLabel: { fontSize: 14, color: c.textSub, flexShrink: 0 },
  infoValue: { fontSize: 14, fontWeight: '500' as const, color: c.textMain } as any,
  editInput: {
    fontSize: 14, fontWeight: '500' as const, color: c.textMain,
    textAlign: 'right', borderWidth: 0, outlineWidth: 0,
    background: 'transparent', padding: 0, flex: 1, minWidth: 60,
  } as any,
  divider: { height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 },
  // Toggle
  toggleRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  toggleLabel: { fontSize: 14, fontWeight: '500' as const, color: c.textMain, marginBottom: 2 },
  toggleHint: { fontSize: 12, color: c.textSub, lineHeight: 16 },
  // Role picker
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
});
