import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet,
  ActivityIndicator, Image,
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
import { getCurrentUser } from '../utils/storage';

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

const fmtExpDate = (s: string) => {
  if (!s || s.length < 10) return s;
  const lang = getLang();
  return fmtLocalDate(s, lang);
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

/* ── SVG icons (same as ExpenseScreen) ── */
const catIcons: Record<string, React.ReactElement> = {
  daily: <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-3H9L7 7H5a2 2 0 00-2 2z"/><Path d="M16 12a4 4 0 11-8 0"/></Svg>,
  rent: <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 21h18"/><Path d="M3 10l9-7 9 7"/><Path d="M5 12v7h4v-4h6v4h4v-7"/></Svg>,
  salary: <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="9"/><Path d="M14 8h-3.5a2 2 0 000 4h1a2 2 0 010 4H8"/><Path d="M12 6v2M12 16v2"/></Svg>,
  goods: <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 7l-3-4H7L4 7v12a2 2 0 002 2h12a2 2 0 002-2V7z"/><Path d="M4 7h16"/><Path d="M9 12h6"/><Path d="M12 9v6"/></Svg>,
};

const payIcons: Record<string, (color: string) => React.ReactNode> = {
  payCash: (color: string) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Rect x="1" y="4" width="22" height="16" rx="2"/><Path d="M1 10h22"/><Circle cx="12" cy="12" r="3"/></Svg>,
  payWechat: (color: string) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></Svg>,
  payAlipay: (color: string) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><Path d="M9 12l2 2 4-4"/></Svg>,
};

const payIconBg: Record<string, string> = { payWechat: '#07C160', payAlipay: '#1677FF', payCash: '#333' };

export default function ExpenseDetailScreen({ record, onBack, onDeleted }: {
  record: ExpenseRecord;
  onBack: () => void;
  onDeleted?: () => void;
}) {
  const { colors } = useTheme();
  const lang = getLang();

  // State
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSavedConfirm, setShowSavedConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  // Editable fields
  const [category, setCategory] = useState(record.category || 'daily');
  const [account, setAccount] = useState(record.account || 'payWechat');
  const [amount, setAmount] = useState(toDec2(record.amount));
  const [date, setDate] = useState(record.date || record.created_at?.slice(0, 10) || todayStr());
  const [note, setNote] = useState(record.note || '');
  const [images, setImages] = useState<string[]>(parseImages(record.images));

  // For new image uploads (File objects)
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
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
        setUploadingImg(true);
        const uploadRes = await api.uploadExpenseImages(newFiles);
        const uploadedUrls: string[] = uploadRes.images || [];
        finalImages = [...images, ...uploadedUrls];
        setUploadingImg(false);
      }
      await api.updateTransaction(record.id, {
        amount: amt,
        category,
        account,
        date,
        note,
        images: finalImages,
      });
      // Update local state so view mode reflects changes
      record.amount = amt;
      record.category = category;
      record.account = account;
      record.date = date;
      record.note = note;
      record.images = JSON.stringify(finalImages);
      setImages(finalImages);
      setNewFiles([]);
      setEditMode(false);
      setShowSavedConfirm(true);
      setToast('');
    } catch (e: any) {
      setToast(e?.message || t('errNetworkError'));
    } finally {
      setSaving(false);
      setUploadingImg(false);
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

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const removeNewFile = (idx: number) => {
    const file = newFiles[idx];
    if (file) {
      const url = urlCache.current.get(file);
      if (url) URL.revokeObjectURL(url);
      urlCache.current.delete(file);
    }
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

  return (
    <View style={[st.wrap, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={{...historyHeader(colors).header, backgroundColor: colors.bg}}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={st.headerBtn}>
          <BackArrow color={colors.textMain} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textMain }]}>{t('expDetail')}</Text>
        <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.7} style={st.headerBtn}>
          <TrashIcon color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView style={st.body} contentContainerStyle={st.bodyInner} showsVerticalScrollIndicator={false}>
        {/* ── View mode ── */}
        {!editMode && (
          <>
            {/* Category */}
            <View style={st.fieldRow}>
              <Text style={[st.fieldLabel, { color: colors.textSub }]}>{t('expenseCategory')}</Text>
              <View style={[st.badge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <Text style={[st.badgeText, { color: colors.primary }]}>{trCategory(record.category)}</Text>
              </View>
            </View>

            {/* Payment method */}
            <View style={st.fieldRow}>
              <Text style={[st.fieldLabel, { color: colors.textSub }]}>{t('paymentMethod')}</Text>
              <View style={[st.badge, { backgroundColor: withAlpha(colors.textSub, 0.1) }]}>
                <Text style={[st.badgeText, { color: colors.textMain}]}>{trPayment(record.account)}</Text>
              </View>
            </View>

            {/* Amount */}
            <View style={st.fieldRow}>
              <Text style={[st.fieldLabel, { color: colors.textSub }]}>{t('amount')}</Text>
              <Text style={[st.fieldValue, { color: colors.danger }]}>-¥{Number(record.amount || 0).toFixed(2)}</Text>
            </View>

            {/* Date */}
            <View style={st.fieldRow}>
              <Text style={[st.fieldLabel, { color: colors.textSub }]}>{t('date')}</Text>
              <Text style={[st.fieldValue, { color: colors.textMain}]}>{fmtExpDate(record.date || record.created_at?.slice(0, 10))}</Text>
            </View>

            {/* Note */}
            <View style={st.noteSection}>
              <Text style={[st.fieldLabel, { color: colors.textSub, marginBottom: 6 }]}>{t('expenseNote')}</Text>
              <Text style={[st.noteFull, { color: colors.textMain}]}>
                {record.note || (record.proc_batch_number ? t('procNowBatch').replace('{n}', String(record.proc_batch_number)) : '—')}
              </Text>
            </View>

            {/* Filled by */}
            {currentUser && (
              <View style={st.fieldRow}>
                <Text style={[st.fieldLabel, { color: colors.textSub }]}>{t('filledBy')}</Text>
                <Text style={[st.fieldValue, { color: colors.textMain}]}>{currentUser}</Text>
              </View>
            )}

            {/* Images */}
            {displayImgs.length > 0 && (
              <View style={st.imageSection}>
                <Text style={[st.fieldLabel, { color: colors.textSub, marginBottom: 8 }]}>{t('uploadImage')}</Text>
                <View style={st.imageGrid}>
                  {displayImgs.map((url: string, i: number) => (
                    <TouchableOpacity key={i} onPress={() => window.open(url, '_blank')} activeOpacity={0.8}>
                      <Image source={{ uri: url }} style={st.imageThumb} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── Edit mode ── */}
        {editMode && (
          <>
            {/* Category picker */}
            <Text style={[st.sectionTitle, { color: colors.textMain}]}>{t('expenseCategory')}</Text>
            <View style={st.chipGrid}>
              {CATEGORIES.map(cat => {
                const active = category === cat;
                return (
                  <TouchableOpacity key={cat}
                    style={[st.chip, active && { backgroundColor: withAlpha(colors.primary, 0.12), borderColor: colors.primary }]}
                    onPress={() => setCategory(cat)} activeOpacity={0.7}>
                    <View style={[st.chipIcon, active && { backgroundColor: colors.primary }]}>
                      {React.cloneElement(catIcons[cat] as any, { stroke: active ? '#fff' : colors.textSub })}
                    </View>
                    <Text style={[st.chipText, active && { color: colors.primary }]} numberOfLines={1}>{trCategory(cat)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payment method picker */}
            <Text style={[st.sectionTitle, { color: colors.textMain}]}>{t('paymentMethod')}</Text>
            <View style={st.chipGrid}>
              {PAY_METHODS.map(m => {
                const active = account === m;
                return (
                  <TouchableOpacity key={m}
                    style={[st.chip, active && { backgroundColor: withAlpha(payIconBg[m] || colors.primary, 0.12), borderColor: payIconBg[m] || colors.primary }]}
                    onPress={() => setAccount(m)} activeOpacity={0.7}>
                    <View style={[st.chipIcon, active && { backgroundColor: payIconBg[m] || colors.primary }]}>
                      {payIcons[m](active ? '#fff' : colors.textSub)}
                    </View>
                    <Text style={[st.chipText, active && { color: payIconBg[m] || colors.primary }]} numberOfLines={1}>{trPayment(m)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Amount */}
            <Text style={[st.sectionTitle, { color: colors.textMain}]}>{t('amount')}</Text>
            <TextInput
              style={[st.input, { color: colors.textMain, borderColor: colors.secondary, backgroundColor: colors.bg }]}
              value={amount}
              onChangeText={(v: string) => setAmount(fmtDecInput(v))}
              onBlur={() => { if (amount !== '') setAmount(toDec2(amount)); }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSub}
            />

            {/* Date */}
            <Text style={[st.sectionTitle, { color: colors.textMain}]}>{t('date')}</Text>
            <TouchableOpacity style={[st.dateBtn, { borderColor: colors.secondary }]} onPress={() => dateInputRef.current?.showPicker?.()} activeOpacity={0.7}>
              <Text style={[st.dateBtnText, { color: colors.textMain}]}>{fmtLocalDate(date, lang)}</Text>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="4" width="18" height="18" rx="2"/><Path d="M16 2v4M8 2v4M3 10h18"/>
              </Svg>
              {React.createElement('input', {
                ref: dateInputRef,
                type: 'date',
                defaultValue: date,
                max: todayStr(),
                onChange: (e: any) => setDate(e.target.value),
                style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.01, cursor: 'pointer' },
              })}
            </TouchableOpacity>

            {/* Note */}
            <Text style={[st.sectionTitle, { color: colors.textMain}]}>{t('expenseNote')}</Text>
            <TextInput
              style={[st.input, st.noteInput, { color: colors.textMain, borderColor: colors.secondary, backgroundColor: colors.bg }]}
              value={note}
              onChangeText={setNote}
              placeholder={t('expenseNote')}
              placeholderTextColor={colors.textSub}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Existing images */}
            {images.length > 0 && (
              <View style={st.imageSection}>
                <Text style={[st.fieldLabel, { color: colors.textSub, marginBottom: 8 }]}>{t('uploadImage')}</Text>
                <View style={st.imageGrid}>
                  {images.map((url: string, i: number) => (
                    <View key={i} style={st.imageWrap}>
                      <Image source={{ uri: url }} style={st.imageThumb} />
                      <TouchableOpacity style={st.removeImgBtn} onPress={() => removeImage(i)} activeOpacity={0.7}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                          <Path d="M18 6L6 18M6 6l12 12"/>
                        </Svg>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* New images */}
            {newFiles.length > 0 && (
              <View style={st.imageSection}>
                <View style={st.imageGrid}>
                  {newFiles.map((file: File, i: number) => (
                    <View key={i} style={st.imageWrap}>
                      <Image source={{ uri: getPreviewUrl(file) }} style={st.imageThumb} />
                      <TouchableOpacity style={st.removeImgBtn} onPress={() => removeNewFile(i)} activeOpacity={0.7}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth={2} strokeLinecap="round">
                          <Path d="M18 6L6 18M6 6l12 12"/>
                        </Svg>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Add image button */}
            <TouchableOpacity style={[st.addImgBtn, { borderColor: colors.secondary }]}
              onPress={() => fileInputRef.current?.click()} activeOpacity={0.7}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textSub} strokeWidth={2} strokeLinecap="round">
                <Path d="M12 5v14M5 12h14"/>
              </Svg>
              <Text style={[st.addImgText, { color: colors.textSub }]}>{t('uploadImage')}</Text>
            </TouchableOpacity>
            {React.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/*', multiple: true, onChange: handleFilePick, style: { display: 'none' } })}

            {/* Edit bottom buttons */}
            <View style={st.editBtnRow}>
              <TouchableOpacity style={[st.cancelBtn, { borderColor: colors.secondary }]}
                onPress={() => {
                  setCategory(record.category || 'daily');
                  setAccount(record.account || 'payWechat');
                  setAmount(toDec2(record.amount));
                  setDate(record.date || record.created_at?.slice(0, 10) || todayStr());
                  setNote(record.note || '');
                  setImages(parseImages(record.images));
                  newFiles.forEach(f => {
                    const u = urlCache.current.get(f);
                    if (u) URL.revokeObjectURL(u);
                  });
                  urlCache.current.clear();
                  setNewFiles([]);
                  setEditMode(false);
                }} activeOpacity={0.7}>
                <Text style={[st.cancelBtnText, { color: colors.textMain}]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.saveBtn, saving && st.saveBtnDisabled, { backgroundColor: colors.primary }]}
                onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={st.saveBtnText}>{t('save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* View mode bottom: Edit button */}
      {!editMode && (
        <View style={st.bottomBar}>
          <TouchableOpacity style={[st.editBtn, { backgroundColor: colors.primary }]}
            onPress={() => setEditMode(true)} activeOpacity={0.8}>
            <Text style={st.editBtnText}>{t('edit')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          visible={showDeleteConfirm}
          title={t('confirmDeleteRecord')}
          message={t('confirmDelete')}
          confirmLabel={t('delete')}
          cancelLabel={t('cancel')}
          confirmColor={colors.danger}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showSavedConfirm && (
        <ConfirmModal
          visible={showSavedConfirm}
          title={t('expUpdated')}
          message={t('expSavedMsg')}
          confirmLabel={t('backToList')}
          cancelLabel={t('stayPage')}
          onConfirm={() => { setShowSavedConfirm(false); onBack(); }}
          onCancel={() => setShowSavedConfirm(false)}
        />
      )}

      {toast ? <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1 },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: FONTS.h2.size, fontWeight: '600' },
  body: { flex: 1, paddingHorizontal: 20 },
  bodyInner: { paddingTop: 95, paddingBottom: 24 },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  fieldLabel: { fontSize: FONTS.body.size },
  fieldValue: { fontSize: FONTS.body.size, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: FONTS.sub.size, fontWeight: '500' },
  noteSection: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.15)' },
  noteFull: { fontSize: FONTS.body.size, lineHeight: 22 },
  imageSection: { marginTop: 14 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: 'rgba(128,128,128,0.1)' },
  imageWrap: { position: 'relative' },
  removeImgBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },

  // Edit mode
  sectionTitle: { fontSize: FONTS.body.size, fontWeight: '500', marginTop: 18, marginBottom: 8 },
  chipGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.2)',
  },
  chipIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(128,128,128,0.08)' },
  chipText: { fontSize: FONTS.sub.size, fontWeight: '500' },
  input: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: FONTS.body.size,
  },
  noteInput: { minHeight: 80, paddingTop: 12 },
  dateBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  dateBtnText: { fontSize: FONTS.body.size },
  addImgBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 10, paddingVertical: 12, marginTop: 10,
    borderStyle: 'dashed',
  },
  addImgText: { fontSize: FONTS.sub.size },
  editBtnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelBtnText: { fontSize: FONTS.body.size, fontWeight: '500' },
  saveBtn: {
    flex: 2, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: FONTS.body.size, fontWeight: '600' },

  // View mode bottom bar
  bottomBar: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  editBtn: { borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  editBtnText: { color: '#fff', fontSize: FONTS.body.size, fontWeight: '600' },
});
