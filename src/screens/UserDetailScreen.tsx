import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Image, TextInput } from 'react-native';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { t, getLang } from '../i18n';
import { historyHeader } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
import TrashIcon from '../components/icons/TrashIcon';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { getCurrentUserId } from '../utils/storage';
import { api } from '../api/client';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  delete_scheduled: string;
  delete_by: string;
}

interface Props {
  user: { id: number; username: string; email: string; avatar: string; is_disabled: boolean };
  onBack: () => void;
  onUpdated: () => void;
}

const ROLES = ['董事长', 'CEO', '店长', '员工', '普通用户'];
const ROLE_EN = ['Chairman', 'CEO', 'Manager', 'Staff', 'User'];
const ROLE_TW = ['董事長', 'CEO', '店長', '員工', '普通用戶'];

const ROLE_COLORS: Record<string, string> = {
  '董事长': '#C84047',  // 勃艮第红
  'CEO': '#E8953A',     // 琥珀
  '店长': '#3A7CA5',     // 靛蓝
  '员工': '#5B8C5A',     // 橄榄绿
  '普通用户': '#8C8583', // 灰
};

function getRoleLabel(role: string, lang: string): string {
  if (!role) return t('normalUser');
  if (lang === 'en') { const idx = ROLES.indexOf(role); return idx >= 0 ? ROLE_EN[idx] : role; }
  if (lang === 'zh-TW') { const idx = ROLES.indexOf(role); return idx >= 0 ? ROLE_TW[idx] : role; }
  return role;
}

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || '#8C8583';
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

function UndoIconSvg({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

// EditableField extracted outside to prevent re-mount on parent re-render
function EditableField({ label, value, onChangeText, onBlurSave, placeholder, c }: {
  label: string; value: string; onChangeText: (t: string) => void; onBlurSave: () => void; placeholder?: string; c: ThemeColors;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
      <Text style={{ fontSize: 14, color: c.textSub, flexShrink: 0 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
        <TextInput
          style={{ fontSize: 14, fontWeight: '500', color: c.textMain, textAlign: 'right', borderWidth: 0, outline: 'none', background: 'transparent', padding: 0, flex: 1, minWidth: 60 } as any}
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
}

export default function UserDetailScreen({ user, onBack, onUpdated }: Props) {
  const { colors: c } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const isSelf = String(user.id) === (getCurrentUserId() || '');
  const lang = getLang();
  const st = useMemo(() => getStyles(c), [c]);

  const [detail, setDetail] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDisabled, setIsDisabled] = useState(user.is_disabled);
  const [role, setRole] = useState('');
  const [remark, setRemark] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deleteScheduled, setDeleteScheduled] = useState('');
  const [deleteBy, setDeleteBy] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const resp: any = await api.admin.getUser(user.id);
      const d = resp.data || resp;
      setDetail(d);
      setIsDisabled(d.is_disabled);
      setRole(d.role || '');
      setRemark(d.remark || '');
      setPhone(d.phone || '');
      setEmail(d.email || '');
      setDeleteScheduled(d.delete_scheduled || '');
      setDeleteBy(d.delete_by || '');
    } catch {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const saveField = useCallback(async (field: string, value: string | boolean) => {
    setSaving(true);
    try {
      const body: Record<string, string | boolean> = {};
      body[field] = value;
      const resp: any = await api.admin.updateUser(user.id, body);
      if (field === 'is_disabled') onUpdated();
    } catch {}
    setSaving(false);
  }, [user.id, onUpdated]);

  const handleToggleDisabled = useCallback((val: boolean) => {
    setIsDisabled(val);
    saveField('is_disabled', val);
  }, [saveField]);

  const handleRoleSelect = useCallback((r: string) => {
    setRole(r);
    setShowRolePicker(false);
    saveField('role', r);
  }, [saveField]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const resp: any = await api.admin.deleteUser(user.id);
      setDeleteScheduled(resp.scheduled || '');
      setDeleteBy('admin');
      setIsDisabled(true);
      onUpdated();
    } catch (e: any) {
      setDeleteError(e?.message || '网络错误');
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleRestore = async () => {
    setSaving(true);
    try {
      const resp: any = await api.admin.restoreUser(user.id);
      setDeleteScheduled('');
      setDeleteBy('');
      setIsDisabled(false);
      onUpdated();
    } catch {}
    setSaving(false);
  };

  const fmtDate = (d: string) => {
    if (!d) return '—';
    try { return d.slice(0, 16).replace('T', ' '); } catch { return '—'; }
  };

  const isGrace = !!deleteScheduled;
  const graceDateStr = deleteScheduled ? deleteScheduled.slice(0, 16).replace('T', ' ') : '';
  const graceInitiator = deleteBy === 'admin' ? (lang === 'en' ? 'Admin' : lang === 'zh-TW' ? '管理員' : '管理员') : (lang === 'en' ? 'User' : lang === 'zh-TW' ? '用戶' : '用户');
  const graceHint = lang === 'en'
    ? `Will be permanently deleted on ${graceDateStr} · Initiated by ${graceInitiator}`
    : lang === 'zh-TW'
      ? `將於 ${graceDateStr} 永久刪除 · ${graceInitiator}發起`
      : `将于 ${graceDateStr} 永久删除 · ${graceInitiator}发起`;

  return (
    <View style={st.container} {...swipeBack}>
      {/* Header — no delete button, moved to avatar row */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={st.backBtn}><BackArrowSvg color={c.primary} /></View>
        </TouchableOpacity>
        <Text style={st.title}>{t('userDetail')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={st.body}>
          <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 60, fontSize: 13 }}>{t('loading') || '加载中...'}</Text>
        </View>
      ) : !detail ? (
        <View style={st.body}>
          <Text style={{ textAlign: 'center', color: c.textSub, marginTop: 60, fontSize: 13 }}>User not found</Text>
        </View>
      ) : (
        <ScrollView style={st.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 16 }}>
          {/* Avatar section: avatar left, info + button right */}
          <View style={st.avatarSection}>
            {detail.avatar ? (
              <Image source={{ uri: detail.avatar }} style={st.avatar} />
            ) : (
              <Image source={{ uri: '/img/logo.jpg' }} style={st.avatar} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row' as const, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={st.avatarName}>{detail.username}</Text>
                {/* Delete / Restore button (mutually exclusive, hidden for self) */}
                {!isGrace && !isSelf ? (
                  <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.7} disabled={deleting}>
                    <View style={[st.actionBtn, { backgroundColor: withAlpha(c.danger, 0.08) }]}>
                      {deleting ? (
                        <Text style={{ fontSize: 12, color: c.danger, fontWeight: '600' }}>...</Text>
                      ) : (
                        <TrashIcon color={c.danger} />
                      )}
                    </View>
                  </TouchableOpacity>
                ) : isGrace && !isSelf ? (
                  <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} disabled={saving}>
                    <View style={[st.actionBtn, { backgroundColor: withAlpha(c.success, 0.08) }]}>
                      <UndoIconSvg color={c.success} />
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* Status badge */}
              {isGrace ? (
                <View style={[st.statusBadge, { alignSelf: 'flex-start', backgroundColor: withAlpha(c.warning, 0.08) }]}>
                  <View style={[st.statusDot, { backgroundColor: c.warning }]} />
                  <Text style={[st.statusText, { color: c.warning }]}>{t('graceStatus')}</Text>
                </View>
              ) : (
                <View style={[st.statusBadge, { alignSelf: 'flex-start', backgroundColor: isDisabled ? withAlpha(c.danger, 0.08) : withAlpha(c.success, 0.08) }]}>
                  <View style={[st.statusDot, { backgroundColor: isDisabled ? c.danger : c.success }]} />
                  <Text style={[st.statusText, { color: isDisabled ? c.danger : c.success }]}>
                    {isDisabled ? t('disabledStatus') : t('normalStatus')}
                  </Text>
                </View>
              )}
              {/* Cooldown hint */}
              {isGrace && (
                <Text style={{ fontSize: 11, color: c.textSub, lineHeight: 16 }}>{graceHint}</Text>
              )}
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
                <Text style={st.infoLabel}>{t('userId')}</Text>
                <Text style={st.infoValue}>{detail.id}</Text>
              </View>
              <View style={st.divider} />
              <View style={st.infoRow}>
                <Text style={st.infoLabel}>{t('username')}</Text>
                <Text style={st.infoValue}>{detail.username}</Text>
              </View>
              <View style={st.divider} />
              <EditableField label={t('phone')} value={phone} onChangeText={setPhone} onBlurSave={() => saveField('phone', phone)} c={c} />
              <View style={st.divider} />
              <EditableField label={t('profileEmail')} value={email} onChangeText={setEmail} onBlurSave={() => saveField('email', email)} c={c} />
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

          {/* Login Status — hidden for self */}
          {!isSelf && (
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
                  onValueChange={(v) => { if (saving) return; handleToggleDisabled(!v); }}
                  trackColor={{ false: withAlpha(c.textMain, 0.18), true: c.primary }}
                  thumbColor="#fff"
                  disabled={isGrace}
                />
              </View>
            </View>
          </View>
          )}

          {/* Other Info */}
          <View style={st.section}>
            <View style={st.sectionTitleRow}>
              <Text style={st.sectionTitleText}>{t('otherInfo')}</Text>
              <View style={st.sectionTitleLine} />
            </View>
            <View style={st.card}>
              {/* Role */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
                <Text style={st.infoLabel}>{t('role')}</Text>
                <TouchableOpacity onPress={() => setShowRolePicker(!showRolePicker)} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[st.roleBadge, { backgroundColor: withAlpha(getRoleColor(role || '普通用户'), 0.1) }]}>
                    <Text style={[st.infoValue, { color: getRoleColor(role || '普通用户') }]}>{getRoleLabel(role, lang)}</Text>
                  </View>
                  <PencilSvg color={c.textSub} />
                </TouchableOpacity>
              </View>
              {showRolePicker && (
                <View style={st.roleList}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[st.roleItem, { backgroundColor: withAlpha(getRoleColor(r), role === r ? 0.15 : 0.05) }]}
                      onPress={() => handleRoleSelect(r)}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.roleItemText, { color: getRoleColor(r), fontWeight: role === r ? '700' : '500' }]}>
                        {getRoleLabel(r, lang)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={st.divider} />
              {/* Remarks */}
              <EditableField label={t('remarks')} value={remark} onChangeText={setRemark} onBlurSave={() => saveField('remark', remark)} c={c} />
            </View>
          </View>
        </ScrollView>
      )}

      <ConfirmModal visible={showDeleteConfirm}
        title={t('deleteUser') || '删除用户'}
        message={deleteError ? (
          <Text style={{ color: c.danger, fontSize: 12, textAlign: 'center' }}>{deleteError}</Text>
        ) : (
          t('deleteUserGraceNote')
        )}
        confirmLabel={deleting ? (t('loading') || '...') : (t('delete') || '删除')}
        cancelLabel={t('cancel')}
        confirmColor={c.danger}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteError(''); }} />
    </View>
  );
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: { flex: 1 },
    ...hdr as any,
    title: { ...hdr.title, color: c.textMain },
    body: {
      flex: 1,
      marginTop: 100,
      backgroundColor: c.bg,
    },
    avatarSection: {
      flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 16,
      paddingHorizontal: 20, paddingBottom: 24,
    },
    avatar: { width: 64, height: 64, borderRadius: 32, flexShrink: 0 },
    avatarName: { fontSize: 18, fontWeight: '700' as const, color: c.textMain },
    actionBtn: {
      width: 36, height: 36, borderRadius: 18,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    statusBadge: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 12, fontWeight: '500' } as any,
    roleBadge: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    },
    section: { paddingHorizontal: 20, marginTop: 12 },
    sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 4, gap: 8 },
    sectionTitleText: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 2, textTransform: 'uppercase' as const, color: c.textSub } as any,
    sectionTitleLine: { flex: 1, height: 1, backgroundColor: withAlpha(c.textMain, 0.08) },
    card: { marginTop: 4, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 0, paddingVertical: 2 },
    infoRow: {
      flexDirection: 'row' as const, justifyContent: 'space-between',
      alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 16,
    },
    infoLabel: { fontSize: 14, color: c.textSub, flexShrink: 0 },
    infoValue: { fontSize: 14, fontWeight: '500' as const, color: c.textMain } as any,
    divider: { height: 0.5, backgroundColor: withAlpha(c.textMain, 0.08), marginLeft: 16 },
    toggleRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const,
      paddingVertical: 14, paddingHorizontal: 16, gap: 12,
    },
    toggleLabel: { fontSize: 14, fontWeight: '500' as const, color: c.textMain, marginBottom: 2 },
    toggleHint: { fontSize: 12, color: c.textSub, lineHeight: 16 },
    roleList: {
      flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6,
      paddingHorizontal: 16, paddingBottom: 12,
    },
    roleItem: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    },
    roleItemText: { fontSize: 13 } as any,
  });
};
