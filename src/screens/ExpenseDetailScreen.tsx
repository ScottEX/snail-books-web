import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, ActivityIndicator, Image,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { trCategory, trPayment } from '../i18nHelpers';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { historyHeader } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import BackArrow from '../components/icons/BackArrow';
import TrashIcon from '../components/icons/TrashIcon';
import { getCurrentUser, getCurrentUserId } from '../utils/storage';

const todayStr = () => {
  const d = new Date();
  const cn = new Date(d.getTime() + 8 * 3600000);
  return cn.toISOString().slice(0, 10);
};

const fmtLocalDate = (s: string, lang: string) => {
  const [y, m, d] = s.split('-');
  if (lang.startsWith('en')) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[+m-1]} ${+d}, ${y}`;
  }
  return `${y}年${m}月${d}日`;
};

const blockNeg = (s: string) => s.replace(/[^0-9.]/g, '');
const fmtDecInput = (s: string) => { s = blockNeg(s); return s.startsWith('.') ? '0' + s : s; };
const toDec2 = (v: any) => String((parseFloat(String(v ?? 0)) || 0).toFixed(2));

interface ExpenseRecord {
  id: number;
  type: string;
  amount: number;
  category: string;
  account: string;
  note: string;
  date: string;
  images: string;
  thumb_images: string;
  created_at: string;
  user_id?: number;
  procurement_batch_id?: number | null;
  proc_batch_number?: string | null;
}

const CATEGORIES = ['daily', 'rent', 'salary', 'goods'] as const;
const PAY_METHODS = ['payCash', 'payWechat', 'payAlipay'] as const;

function parseImages(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

/* ── SVG icons ── */
const catIcons: Record<string, React.ReactElement> = {
  daily: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-3H9L7 7H5a2 2 0 00-2 2z"/><Path d="M16 12a4 4 0 11-8 0"/></Svg>,
  rent: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 21h18"/><Path d="M3 10l9-7 9 7"/><Path d="M5 12v7h4v-4h6v4h4v-7"/></Svg>,
  salary: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="9"/><Path d="M14 8h-3.5a2 2 0 000 4h1a2 2 0 010 4H8"/><Path d="M12 6v2M12 16v2"/></Svg>,
  goods: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 7l-3-4H7L4 7v12a2 2 0 002 2h12a2 2 0 002-2V7z"/><Path d="M4 7h16"/><Path d="M9 12h6"/><Path d="M12 9v6"/></Svg>,
};

const payIcons: Record<string, (color: string) => React.ReactNode> = {
  payCash: (color: string) => <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Rect x="1" y="4" width="22" height="16" rx="2"/><Path d="M1 10h22"/><Circle cx="12" cy="12" r="3"/></Svg>,
  payWechat: (color: string) => <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></Svg>,
  payAlipay: (color: string) => <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><Path d="M9 12l2 2 4-4"/></Svg>,
};

const payIconBg: Record<string, string> = { payWechat: '#07C160', payAlipay: '#1677FF', payCash: '#333' };

export default function ExpenseDetailScreen({ record, onBack, onDeleted }: {
  record: ExpenseRecord;
  onBack: () => void;
  onDeleted?: () => void;
}) {
  const { colors: c, theme } = useTheme();
  const styles = useMemo(() => getStyles(c), [c]);

  // Theme-specific amount card color
  const AMOUNT_COLORS: Record<string, string> = {
    'burgundy-warm': '#FF6B3D',
    'obsidian-gold': '#3B82F6',
    'deep-teal': '#22C55E',
  };
  const amtColor = AMOUNT_COLORS[theme.id] || '#FF6B3D';
  const amtBg = withAlpha(amtColor, 0.10);
  const lang = getLang();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSavedConfirm, setShowSavedConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  const [category, setCategory] = useState(record.category || 'daily');
  const [account, setAccount] = useState(record.account || 'payWechat');
  const [amount, setAmount] = useState(toDec2(record.amount));
  const [date, setDate] = useState(record.date || record.created_at?.slice(0, 10) || todayStr());
  const [note, setNote] = useState(record.note || '');
  const [images, setImages] = useState<string[]>(parseImages(record.images));

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const urlCache = useRef<Map<File, string>>(new Map());

  const getPreviewUrl = (file: File) => {
    if (!urlCache.current.has(file)) urlCache.current.set(file, URL.createObjectURL(file));
    return urlCache.current.get(file)!;
  };

  useEffect(() => {
    return () => { urlCache.current.forEach(u => URL.revokeObjectURL(u)); urlCache.current.clear(); };
  }, []);

  useEffect(() => {
    if (dateInputRef.current) dateInputRef.current.value = date;
  }, [date]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setToast(t('enterAmount')); return; }
    setSaving(true);
    try {
      let finalImages = images;
      if (newFiles.length > 0) {
        const uploadRes = await api.uploadExpenseImages(newFiles);
        finalImages = [...images, ...(uploadRes.images || [])];
      }
      await api.updateTransaction(record.id, { amount: amt, category, account, date, note, images: finalImages });
      record.amount = amt; record.category = category; record.account = account;
      record.date = date; record.note = note; record.images = JSON.stringify(finalImages);
      setImages(finalImages); setNewFiles([]); setEditMode(false);
      setShowSavedConfirm(true);
    } catch (e: any) {
      setToast(e?.message || t('errNetworkError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteTransaction(record.id);
      setShowDeleteConfirm(false);
      onDeleted?.();
      onBack();
    } catch (e: any) {
      setToast(e?.message || t('errNetworkError'));
    } finally {
      setDeleting(false);
    }
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));
  const removeNewFile = (idx: number) => {
    const file = newFiles[idx];
    if (file) { const u = urlCache.current.get(file); if (u) URL.revokeObjectURL(u); urlCache.current.delete(file); }
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const arr: File[] = [];
    for (let i = 0; i < files.length; i++) arr.push(files[i]);
    setNewFiles(prev => [...prev, ...arr]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayImgs = parseImages(record.images);
  const currentUser = getCurrentUser();
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const uid = getCurrentUserId();
    if (!uid) return;
    const CACHE_KEY = 'cached_avatar_b64';
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) setAvatarUrl(cached);
    } catch {}
    fetch(`/api/users/avatar?user_id=${uid}`)
      .then(resp => resp.ok ? resp.blob() : null)
      .then(blob => {
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result as string;
          setAvatarUrl(b64);
          try { sessionStorage.setItem(CACHE_KEY, b64); } catch {}
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      {/* Header — absolute glass, same as ProcurementDetailScreen */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <BackArrow color={c.textMain} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>{t('expDetail')}</Text>
        <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.7}
          style={styles.actionBtn} disabled={deleting}>
          <TrashIcon color={c.danger} />
        </TouchableOpacity>
      </View>

      {/* Body — bg + marginTop clears the absolute header */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>

        {/* ── View mode ── */}
        {!editMode && (
          <>
            {/* Amount card — prominent at the top, theme-colored */}
            <View style={[styles.amountCard, { backgroundColor: amtBg }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.amountLabel}>{t('expTotalAmount')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  <Text style={[styles.amountSymbol, { color: amtColor }]}>-¥</Text>
                  <Text style={[styles.amountValue, { color: amtColor }]}>{Number(record.amount || 0).toFixed(2)}</Text>
                </View>
              </View>
              {currentUser ? (
                <View style={styles.amountUser}>
                  <Image
                    source={{ uri: avatarUrl || '/img/logo.jpg' }}
                    style={styles.amountAvatar}
                  />
                  <Text style={styles.amountUsername} numberOfLines={1}>{currentUser}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('expenseCategory')}</Text>
                <Text style={styles.infoValue}>{trCategory(record.category)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('paymentMethod')}</Text>
                <Text style={styles.infoValue}>{trPayment(record.account)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('expenseDate')}</Text>
                <Text style={styles.infoValue}>{(() => {
                  const raw = record.created_at || record.date || '';
                  if (!raw) return '—';
                  const d = new Date(raw.endsWith('Z') ? raw : raw + 'Z');
                  if (isNaN(d.getTime())) {
                    const s = record.date || raw.slice(0, 10);
                    const [y, mm, dd] = s.split('-');
                    if (lang.startsWith('en')) {
                      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      return `${months[+mm-1]} ${+dd}, ${y}`;
                    }
                    return `${y}年${mm}月${dd}日`;
                  }
                  const y = d.getFullYear();
                  const mo = d.getMonth() + 1;
                  const day = d.getDate();
                  const h = String(d.getHours()).padStart(2, '0');
                  const mi = String(d.getMinutes()).padStart(2, '0');
                  const s = String(d.getSeconds()).padStart(2, '0');
                  if (lang.startsWith('en')) {
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    return `${months[mo-1]} ${day}, ${y} ${h}:${mi}:${s}`;
                  }
                  return `${y}年${mo}月${day}日 ${h}:${mi}:${s}`;
                })()}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>{t('expenseNote')}</Text>
                <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]}>
                  {record.note || (record.proc_batch_number ? t('procNowBatch').replace('{n}', String(record.proc_batch_number)) : '—')}
                </Text>
              </View>
            </View>

            {displayImgs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('uploadImage')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {displayImgs.map((url: string, i: number) => (
                    <TouchableOpacity key={i} onPress={() => window.open(url, '_blank')} activeOpacity={0.8}>
                      <Image source={{ uri: url }} style={styles.thumb} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* ── Edit mode ── */}
        {editMode && (
          <View style={{ gap: 14 }}>
            {/* Category */}
            <Text style={styles.sectionTitle}>{t('expenseCategory')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CATEGORIES.map(cat => {
                const active = category === cat;
                return (
                  <TouchableOpacity key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(cat)} activeOpacity={0.7}>
                    <View style={[styles.chipIconCircle, active && styles.chipIconCircleActive]}>
                      {catIcons[cat]}
                    </View>
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{trCategory(cat)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payment */}
            <Text style={styles.sectionTitle}>{t('paymentMethod')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PAY_METHODS.map(m => {
                const active = account === m;
                return (
                  <TouchableOpacity key={m}
                    style={[styles.chip, active && { backgroundColor: payIconBg[m] || c.primary }]}
                    onPress={() => setAccount(m)} activeOpacity={0.7}>
                    <View style={[styles.chipIconCircle, active && styles.chipIconCircleActive]}>
                      {payIcons[m](active ? '#fff' : c.textSub)}
                    </View>
                    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{trPayment(m)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount */}
            <Text style={styles.sectionTitle}>{t('amount')}</Text>
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: c.danger, marginRight: 6 }}>-¥</Text>
                <TextInput
                  style={{ fontSize: FONTS.amount.size, fontWeight: FONTS.amount.weight, color: c.textMain, borderWidth: 0, backgroundColor: 'transparent', textAlign: 'left', padding: 0, flex: 0, width: 180 }}
                  value={amount} onChangeText={(v: string) => setAmount(fmtDecInput(v))}
                  onBlur={() => { if (amount !== '') setAmount(toDec2(amount)); }}
                  keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSub} />
              </View>
              <View style={{ width: 40, height: 2, marginTop: 10, borderRadius: 1, backgroundColor: c.danger }} />
            </View>

            {/* Date */}
            <Text style={styles.sectionTitle}>{t('date')}</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bg, borderRadius: 10, paddingVertical: 12, paddingRight: 12 }}
              onPress={() => dateInputRef.current?.showPicker?.()} activeOpacity={0.7}>
              <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textSub }}>{fmtLocalDate(date, lang)}</Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ translateY: 0 }] }}><Path d="M10 6l6 6-6 6"/></Svg>
              {React.createElement('input', {
                ref: dateInputRef, type: 'date', defaultValue: date, max: todayStr(),
                onChange: (e: any) => setDate(e.target.value),
                style: { position: 'absolute', top: -6, right: 0, bottom: -6, left: 0, opacity: 0.01, cursor: 'pointer', fontSize: FONTS.sub.size },
              })}
            </TouchableOpacity>

            {/* Note */}
            <Text style={styles.sectionTitle}>{t('expenseNote')}</Text>
            <TextInput
              style={{ fontSize: FONTS.sub.size, color: c.textMain, borderWidth: 0, backgroundColor: c.bg, borderRadius: 10, padding: 12, minHeight: 60 }}
              value={note} onChangeText={setNote}
              placeholder={t('expenseNote')} placeholderTextColor={c.textSub}
              multiline numberOfLines={3} />

            {/* Images */}
            {images.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>{t('uploadImage')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((url: string, i: number) => (
                    <View key={i} style={{ position: 'relative', marginRight: 8 }}>
                      <Image source={{ uri: url }} style={styles.thumb} />
                      <TouchableOpacity onPress={() => removeImage(i)} activeOpacity={0.7}
                        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                          <Path d="M18 6L6 18M6 6l12 12"/>
                        </Svg>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            {newFiles.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {newFiles.map((file: File, i: number) => (
                  <View key={i} style={{ position: 'relative', marginRight: 8 }}>
                    <Image source={{ uri: getPreviewUrl(file) }} style={styles.thumb} />
                    <TouchableOpacity onPress={() => removeNewFile(i)} activeOpacity={0.7}
                      style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                        <Path d="M18 6L6 18M6 6l12 12"/>
                      </Svg>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, borderStyle: 'dashed' as any, borderColor: c.secondary }}
              onPress={() => fileInputRef.current?.click()} activeOpacity={0.7}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.textSub} strokeWidth={2} strokeLinecap="round">
                <Path d="M12 5v14M5 12h14"/>
              </Svg>
              <Text style={{ fontSize: FONTS.sub.size, color: c.textSub }}>{t('uploadImage')}</Text>
            </TouchableOpacity>
            {React.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/*', multiple: true, onChange: handleFilePick, style: { display: 'none' } })}

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderColor: c.secondary }}
                onPress={() => {
                  setCategory(record.category || 'daily'); setAccount(record.account || 'payWechat');
                  setAmount(toDec2(record.amount)); setDate(record.date || record.created_at?.slice(0, 10) || todayStr());
                  setNote(record.note || ''); setImages(parseImages(record.images));
                  newFiles.forEach(f => { const u = urlCache.current.get(f); if (u) URL.revokeObjectURL(u); });
                  urlCache.current.clear(); setNewFiles([]); setEditMode(false);
                }} activeOpacity={0.7}>
                <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.textMain }}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: c.primary }, saving && { opacity: 0.5 }]}
                onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight }}>{t('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* View mode bottom bar — match procurement detail */}
      {!editMode && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={[styles.editBtn, { backgroundColor: c.primary }]}
            onPress={() => setEditMode(true)} activeOpacity={0.8}>
            <Text style={styles.editBtnText}>{t('edit')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delete confirm */}
      <ConfirmModal visible={showDeleteConfirm}
        title={t('confirmDeleteRecord')}
        message={t('confirmDelete')}
        confirmLabel={t('delete')} cancelLabel={t('cancel')}
        confirmColor={c.danger}
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)} />

      {/* Save success confirm */}
      <ConfirmModal visible={showSavedConfirm}
        title={t('expUpdated')}
        message={t('expSavedMsg')}
        confirmLabel={t('backToList')} cancelLabel={t('stayPage')}
        onConfirm={() => { setShowSavedConfirm(false); onBack(); }}
        onCancel={() => setShowSavedConfirm(false)} />

      {toast ? <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} /> : null}
    </View>
  );
}

const getStyles = (c: ThemeColors) => {
  const hdr = historyHeader(c);
  return StyleSheet.create({
    container: { flex: 1 },
    ...hdr as any,
    actionBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: withAlpha(c.bg, 0.30),
      justifyContent: 'center' as const, alignItems: 'center' as const,
      backdropFilter: 'saturate(200%) blur(30px)' as any,
      borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.10)',
    },
    body: {
      flex: 1,
      marginTop: 100,
      backgroundColor: c.bg,
    },
    bodyContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    // Amount card — prominent, left-aligned, theme-colored bg
    amountCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderRadius: 12,
      paddingVertical: 20,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    amountLabel: {
      fontSize: FONTS.micro.size,
      fontWeight: '500' as const,
      color: c.textSub,
      textTransform: 'uppercase' as any,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    amountValue: {
      fontSize: 36,
      fontWeight: '700' as const,
    },
    amountSymbol: {
      fontSize: 20,
      fontWeight: '600' as const,
      marginRight: 2,
      marginBottom: 2,
    },
    amountUser: {
      alignItems: 'center' as const,
      marginLeft: 12,
    },
    amountAvatar: {
      width: 36, height: 36, borderRadius: 18,
      marginBottom: 4,
    },
    amountUsername: {
      fontSize: FONTS.sub.size,
      fontWeight: '600' as const,
      color: c.textMain,
      maxWidth: 72,
    },
    // Info card
    infoCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      minHeight: 42,
      borderBottomWidth: 0.5,
      borderBottomColor: withAlpha(c.textMain, 0.06),
    },
    infoLabel: {
      fontSize: FONTS.sub.size,
      color: c.textSub,
    },
    infoValue: {
      fontSize: FONTS.sub.size,
      fontWeight: '500' as const,
      color: c.textMain,
    },
    // Section
    section: { marginBottom: 16 },
    sectionTitle: {
      fontSize: FONTS.micro.size, fontWeight: '600' as const,
      color: c.textSub, textTransform: 'uppercase' as any,
      letterSpacing: 0.5, marginBottom: 10,
    },
    thumb: {
      width: 72, height: 72, borderRadius: 8, marginRight: 8,
      borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    },
    // Edit chips
    chip: {
      flex: 1, flexDirection: 'row' as const, paddingVertical: 8, borderRadius: 22,
      backgroundColor: c.bg, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.textSub },
    chipTextActive: { color: c.surface },
    chipIconCircle: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center' as const,
      justifyContent: 'center' as const, marginRight: 4,
    },
    chipIconCircleActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
    // Bottom bar
    bottomBar: {
      backgroundColor: c.bg,
      paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8,
    },
    editBtn: {
      borderRadius: 12, paddingVertical: 14,
      alignItems: 'center' as const, overflow: 'hidden' as any,
    },
    editBtnText: {
      color: c.surface, fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
    },
  } as any);
};
