import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Image, TextInput } from 'react-native';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { validateEmail, validatePhone } from '../utils/validation';
import { t, getLang } from '../i18n';
import { historyHeader, MODAL_CARD_RADIUS } from '../sharedStyles';
import { modalClose } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ModalOverlay from '../components/ModalOverlay';
import TrashIcon from '../components/icons/TrashIcon';
import { useSwipeBack } from '../hooks/useSwipeBack';
import CloseButton from '../components/CloseButton';
import { getCurrentUserId } from '../utils/storage';
import { api } from '../api/client';
import { translateName } from './partner/usePartnerData';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  linked_partner_id: number | null;
  linked_partner_name: string;
}

interface Props {
  user: { id: number; username: string; email: string; avatar: string; is_disabled: boolean };
  onBack: () => void;
  onUpdated: () => void;
}

const ROLES = ['董事长', 'CEO', '店长', '员工', '打杂'];
const ROLE_EN = ['Chairman', 'CEO', 'Manager', 'Staff', 'User'];
const ROLE_TW = ['董事長', 'CEO', '店長', '員工', '打雜'];

const ROLE_COLORS: Record<string, string> = {
  '董事长': '#C84047',  // 勃艮第红
  'CEO': '#E8953A',     // 琥珀
  '店长': '#3A7CA5',     // 靛蓝
  '员工': '#5B8C5A',     // 橄榄绿
  '打杂': '#8C8583', // 灰
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
function EditableField({ label, value, onChangeText, onBlurSave, placeholder, c, editable = true, validate, keyboardType, filter }: {
  label: string; value: string; onChangeText: (t: string) => void; onBlurSave: () => void; placeholder?: string; c: ThemeColors; editable?: boolean; validate?: (v: string) => string | null; keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad'; filter?: (v: string) => string;
}) {
  const [err, setErr] = useState('');
  // Track latest value in ref so handleBlur always reads the most recent input,
  // even if React hasn't re-rendered after onChangeText → setState yet.
  const valueRef = useRef(value);
  valueRef.current = value;

  if (!editable) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
        <Text style={{ fontSize: 14, color: c.textSub, flexShrink: 0 }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: c.textMain }}>{value || placeholder || '—'}</Text>
      </View>
    );
  }

  const handleBlur = () => {
    const v = valueRef.current;
    if (validate && v) {
      const msg = validate(v);
      if (msg) { setErr(msg); return; }
    }
    setErr('');
    onBlurSave();
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
        <Text style={{ fontSize: 14, color: c.textSub, flexShrink: 0 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
          <TextInput
            style={{ fontSize: 14, fontWeight: '500', color: c.textMain, textAlign: 'right', borderWidth: 0, outline: 'none', background: 'transparent', padding: 0, flex: 1, minWidth: 60 } as any}
            value={value}
            onChangeText={(txt) => { const v = filter ? filter(txt) : txt; valueRef.current = v; onChangeText(v); if (err) setErr(''); }}
            onBlur={handleBlur}
            placeholder={placeholder || '—'}
            placeholderTextColor={c.textSub}
            keyboardType={keyboardType || 'default'}
          />
          <PencilSvg color={c.textSub} />
        </View>
      </View>
      {err !== '' && (
        <Text style={{ fontSize: 11, color: c.danger, textAlign: 'right', paddingHorizontal: 16, paddingBottom: 8, marginTop: -6 }}>{err}</Text>
      )}
    </View>
  );
}

export default function UserDetailScreen({ user, onBack, onUpdated }: Props) {
  const { colors: c } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const isSelf = String(user.id) === (getCurrentUserId() || '');
  const lang = getLang();
  const st = useMemo(() => getStyles(c), [c]);
  const [showLinkedPartnerHint, setShowLinkedPartnerHint] = useState(false);

  const [detail, setDetail] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDisabled, setIsDisabled] = useState(user.is_disabled);
  const [role, setRole] = useState('');
  const [remark, setRemark] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [realName, setRealName] = useState('');
  const [realNamePinyin, setRealNamePinyin] = useState('');
  const [realNameTW, setRealNameTW] = useState('');
  const [deleteScheduled, setDeleteScheduled] = useState('');
  const [deleteBy, setDeleteBy] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [linkedPartnerId, setLinkedPartnerId] = useState<number | null>(null);
  const [linkedPartnerName, setLinkedPartnerName] = useState('');
  const [linkedPartnerNamePinyin, setLinkedPartnerNamePinyin] = useState('');
  const [linkedPartnerNameTW, setLinkedPartnerNameTW] = useState('');
  const [showPartnerPicker, setShowPartnerPicker] = useState(false);
  const [partnerList, setPartnerList] = useState<any[]>([]);
  const [partnersLoaded, setPartnersLoaded] = useState(false);

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
      setRealName(d.real_name || '');
      setRealNamePinyin(d.real_name_pinyin || '');
      setRealNameTW(d.real_name_tw || '');
      setDeleteScheduled(d.delete_scheduled || '');
      setDeleteBy(d.delete_by || '');
      setLinkedPartnerId(d.linked_partner_id ?? null);
      setLinkedPartnerName(d.linked_partner_name || '');
      setLinkedPartnerNamePinyin(d.linked_partner_name_pinyin || '');
      setLinkedPartnerNameTW(d.linked_partner_name_tw || '');
    } catch {}
    setLoading(false);
  }, [user.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // 加载合伙人列表，用于判断是否有可关联的合伙人
  useEffect(() => {
    if (detail && !partnersLoaded && !linkedPartnerId) {
      fetchPartnerList();
      setPartnersLoaded(true);
    }
  }, [detail, partnersLoaded, linkedPartnerId]);

  const saveField = useCallback(async (field: string, value: string | boolean) => {
    setSaving(true);
    try {
      const body: Record<string, string | boolean> = {};
      body[field] = value;
      const resp: any = await api.admin.updateUser(user.id, body);
      if (field === 'real_name') {
        // 重新拉取详情以更新拼音和繁体
        const detailResp: any = await api.admin.getUser(user.id);
        const d = detailResp.data || detailResp;
        setRealNamePinyin(d.real_name_pinyin || '');
        setRealNameTW(d.real_name_tw || '');
        // sync linked partner name
        if (d.linked_partner_name) {
          setLinkedPartnerName(d.linked_partner_name);
          setLinkedPartnerNamePinyin(d.linked_partner_name_pinyin || '');
          setLinkedPartnerNameTW(d.linked_partner_name_tw || '');
        }
      }
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

  const fetchPartnerList = useCallback(async () => {
    try {
      const data: any = await api.getPartners();
      setPartnerList(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const availablePartners = useMemo(() => partnerList.filter((p: any) => !p.linked_user_id), [partnerList]);

  const handleLinkPartner = useCallback(async (partnerId: number, partnerName: string) => {
    setShowPartnerPicker(false);
    setSaving(true);
    try {
      await api.admin.updateUser(user.id, { linked_partner_id: partnerId });
      setLinkedPartnerId(partnerId);
      setLinkedPartnerName(realName || partnerName);
      setLinkedPartnerNamePinyin(realNamePinyin || '');
      setLinkedPartnerNameTW(realNameTW || '');
    } catch {}
    setSaving(false);
  }, [user.id, realName]);

  const handleUnlinkPartner = useCallback(async () => {
    setSaving(true);
    try {
      await api.admin.updateUser(user.id, { linked_partner_id: null });
      setLinkedPartnerId(null);
      setLinkedPartnerName('');
      setLinkedPartnerNamePinyin('');
      setLinkedPartnerNameTW('');
      setPartnersLoaded(false);
    } catch {}
    setSaving(false);
  }, [user.id]);

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
          <View style={st.backBtn}><BackArrowSvg color="#000" /></View>
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
                  <TouchableOpacity onPress={() => {
                    if (linkedPartnerId) {
                      setShowLinkedPartnerHint(true);
                      return;
                    }
                    setShowDeleteConfirm(true);
                  }} activeOpacity={0.7} disabled={deleting}>
                    <View style={[st.actionBtn, { backgroundColor: withAlpha(c.danger, 0.08) }]}>
                      {deleting ? (
                        <LoadingSpinner label={false} size={16} color={c.danger} />
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
              <EditableField label={t('realName')} value={lang === 'en' ? (realNamePinyin || realName) : lang === 'zh-TW' ? (realNameTW || realName) : realName} onChangeText={setRealName} onBlurSave={() => saveField('real_name', realName)} c={c} editable={lang === 'zh-CN'} />
              <View style={st.divider} />
              <EditableField label={t('phone')} value={phone} onChangeText={setPhone} onBlurSave={() => saveField('phone', phone)} c={c} keyboardType="phone-pad" filter={(v: string) => v.replace(/[^\d]/g, '').slice(0, 11)} validate={(v) => { if (!v) return null; if (!/^1[3-9]\d{9}$/.test(v)) return t('errPhoneInvalid'); return null; }} />
              <View style={st.divider} />
              <EditableField label={t('profileEmail')} value={email} onChangeText={setEmail} onBlurSave={() => saveField('email', email)} c={c} validate={(v) => validateEmail(v, t)} />
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

          {/* Linked Partner — hide when no partner linked and none available */}
          {(linkedPartnerId !== null || !partnersLoaded || availablePartners.length > 0) && (
          <View style={st.section}>
            <View style={st.sectionTitleRow}>
              <Text style={st.sectionTitleText}>{t('linkedPartner')}</Text>
              <View style={st.sectionTitleLine} />
            </View>
            <View style={st.card}>
              <View style={st.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.toggleLabel}>{linkedPartnerId ? translateName(linkedPartnerName, linkedPartnerNamePinyin, linkedPartnerNameTW) : t('unlinked')}</Text>
                </View>
                {linkedPartnerId ? (
                  <TouchableOpacity onPress={() => setShowUnlinkConfirm(true)} disabled={saving} activeOpacity={0.7}>
                    <Text style={{ color: c.danger, fontSize: 13, fontWeight: '500' }}>{t('unlinkPartner')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => { fetchPartnerList(); setShowPartnerPicker(true); }} disabled={saving} activeOpacity={0.7}>
                    <Text style={{ color: c.primary, fontSize: 13, fontWeight: '500' }}>{t('linkPartner')}</Text>
                  </TouchableOpacity>
                )}
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
                  <View style={[st.roleBadge, { backgroundColor: withAlpha(getRoleColor(role || '打杂'), 0.1) }]}>
                    <Text style={[st.infoValue, { color: getRoleColor(role || '打杂') }]}>{getRoleLabel(role, lang)}</Text>
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
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteError(''); }} />

      <ConfirmModal visible={showUnlinkConfirm}
        title={t('unlinkPartner')}
        message={<Text>{t('confirmUnlinkMsg').replace('{name}', linkedPartnerName)}</Text>}
        confirmLabel={t('unlinkPartner')}
        cancelLabel={t('cancel')}
        loading={saving}
        onConfirm={() => { setShowUnlinkConfirm(false); handleUnlinkPartner(); }}
        onCancel={() => setShowUnlinkConfirm(false)} />

      {/* Partner Picker Modal */}
      <ModalOverlay visible={showPartnerPicker} onClose={() => setShowPartnerPicker(false)} animation="blurMorph">
        <View style={{ backgroundColor: c.surface, borderRadius: MODAL_CARD_RADIUS, width: 320, maxWidth: '100%', overflow: 'hidden', } as any} onStartShouldSetResponder={() => true}>
          <View style={{ backgroundColor: c.primary, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.surface }}>{t('selectPartner')}</Text>
            <TouchableOpacity onPress={() => setShowPartnerPicker(false)}>
              <Text style={{ ...modalClose as any }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            {availablePartners.map((p: any) => (
              <TouchableOpacity key={p.id}
                onPress={() => handleLinkPartner(p.id, p.name)}
                style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: withAlpha(c.textMain, 0.08) }}
                activeOpacity={0.7}>
                <Text style={{ fontSize: 15, color: c.textMain }}>{translateName(p.name, p.name_pinyin, p.name_tw)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowPartnerPicker(false)}
              style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}
              activeOpacity={0.7}>
              <Text style={{ fontSize: 13, color: c.textSub }}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalOverlay>

      {/* Linked-partner delete hint modal */}
      <ModalOverlay visible={showLinkedPartnerHint} onClose={() => setShowLinkedPartnerHint(false)} animation="blurMorph">
        <View style={st.hintCard} onStartShouldSetResponder={() => true}>
          <View style={st.hintHeader}>
            <Text style={st.hintTitle}>{t('friendlyReminder')}</Text>
            <CloseButton onPress={() => setShowLinkedPartnerHint(false)} />
          </View>
          <View style={st.hintBody}>
            <Text style={st.hintMsg}>{t('err_user_linked_partner')}</Text>
            <TouchableOpacity style={st.hintBtn} onPress={() => setShowLinkedPartnerHint(false)} activeOpacity={0.7}>
              <Text style={st.hintBtnText}>{t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalOverlay>
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
    /* Linked-partner delete hint modal */
    hintCard: {
      backgroundColor: c.surface, borderRadius: MODAL_CARD_RADIUS,
      width: 340, maxWidth: '100%', overflow: 'hidden',
    },
    hintHeader: {
      backgroundColor: c.primary, paddingVertical: 14, paddingHorizontal: 20,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    hintTitle: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.surface },
    hintBody: { padding: 24, gap: 18 },
    hintMsg: {
      fontSize: FONTS.sub.size, color: c.textSub, textAlign: 'center', lineHeight: 22,
      backgroundColor: withAlpha(c.primary, 0.1), borderRadius: 12, padding: 12,
    },
    hintBtn: {
      width: '100%', paddingVertical: 12, borderRadius: 10,
      backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center',
    },
    hintBtnText: { fontSize: FONTS.sub.size, fontWeight: '600', color: c.surface },
  });
};
