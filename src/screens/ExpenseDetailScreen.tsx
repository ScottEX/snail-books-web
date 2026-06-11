import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { t, getLang } from '../i18n';
import { trCategory, trPayment } from '../i18nHelpers';
import { blockNeg, fmtDecInput, toDec2 } from '../utils/numbers';
import { api } from '../api/client';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { historyHeader } from '../sharedStyles';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import ImagePreview from '../components/ImagePreview';
import TrashIcon from '../components/icons/TrashIcon';
import BackArrow from '../components/icons/BackArrow';
import { getCurrentUser, getCurrentUserId } from '../utils/storage';
import { useSwipeBack } from '../hooks/useSwipeBack';
import CategoryChips from '../components/CategoryChips';
import PaymentMethodChips from '../components/PaymentMethodChips';
import ExpenseNoteInput from '../components/ExpenseNoteInput';
import ReceiptUpload from '../components/ReceiptUpload';
import { useServerDate } from '../hooks/useServerDate';

// Date helpers replaced by useServerDate() hook (server time, not client)

const fmtLocalDate = (s: string, lang: string) => {
  const [y, m, d] = s.split('-');
  if (lang.startsWith('en')) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[+m-1]} ${+d}, ${y}`;
  }
  return `${y}年${m}月${d}日`;
};



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

function parseImages(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

export default function ExpenseDetailScreen({ record, onBack, onDeleted, onEdited }: {
  record: ExpenseRecord;
  onBack: () => void;
  onDeleted?: () => void;
  onEdited?: () => void;
}) {
  const { colors: c, theme } = useTheme();
  const swipeBack = useSwipeBack(onBack);
  const sd = useServerDate();
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
  const screenW = Dimensions.get('window').width;
  const thumbSize = (screenW - 16 * 2 - 8 * 3) / 4;

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSavedConfirm, setShowSavedConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');
  const [previewData, setPreviewData] = useState<{ images: string[]; idx: number } | null>(null);

  const [category, setCategory] = useState(record.category || 'daily');
  const [account, setAccount] = useState(record.account || 'payWechat');
  const [amount, setAmount] = useState(toDec2(record.amount));
  const [date, setDate] = useState(record.date || record.created_at?.slice(0, 10) || sd.today);
  const [note, setNote] = useState(record.note || '');
  const [images, setImages] = useState<string[]>(parseImages(record.images));
  const [thumbImages, setThumbImages] = useState<string[]>(parseImages(record.thumb_images));

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const urlCache = useRef<Map<File, string>>(new Map());

  const hasChanges = category !== (record.category || 'daily') ||
    account !== (record.account || 'payWechat') ||
    amount !== toDec2(record.amount) ||
    date !== (record.date || record.created_at?.slice(0, 10) || sd.today) ||
    note !== (record.note || '') ||
    JSON.stringify(images) !== JSON.stringify(parseImages(record.images)) ||
    JSON.stringify(thumbImages) !== JSON.stringify(parseImages(record.thumb_images)) ||
    newFiles.length > 0;

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
      let finalThumbs = thumbImages;
      if (newFiles.length > 0) {
        const uploadRes = await api.uploadExpenseImages(newFiles);
        finalImages = [...images, ...(uploadRes.images || [])];
        finalThumbs = [...thumbImages, ...(uploadRes.thumb_images || uploadRes.images || [])];
      }
      await api.updateTransaction(record.id, { amount: amt, category, account, date, note, images: finalImages, thumb_images: finalThumbs });
      record.amount = amt; record.category = category; record.account = account;
      record.date = date; record.note = note; record.images = JSON.stringify(finalImages);
      record.thumb_images = JSON.stringify(finalThumbs);
      setImages(finalImages); setThumbImages(finalThumbs); setNewFiles([]); setEditMode(false);
      setShowSavedConfirm(true);
      onEdited?.();
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

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setThumbImages(prev => prev.filter((_, i) => i !== idx));
  };
  const removeNewFile = (idx: number) => {
    const file = newFiles[idx];
    if (file) { const u = urlCache.current.get(file); if (u) URL.revokeObjectURL(u); urlCache.current.delete(file); }
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const openPreview = (idx: number) => {
    setPreviewData({ images: previewImgs, idx });
  };



  const thumbImgs = parseImages(record.thumb_images);
  const displayImgs = thumbImgs.length > 0 ? thumbImgs : parseImages(record.images);
  const previewImgs = parseImages(record.images);
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
    <View style={styles.container} {...swipeBack}>
      {/* Header — absolute glass, same as ProcurementDetailScreen */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <BackArrow color={c.textMain} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>{t('expDetail')}</Text>
        {!record.procurement_batch_id && (
          <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} activeOpacity={0.7}
            style={styles.actionBtn} disabled={deleting}>
            <TrashIcon color={c.danger} />
          </TouchableOpacity>
        )}
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
              {record.proc_batch_number ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('procBatchLabel')}</Text>
                  <Text style={styles.infoValue}>
                    {t('procNowBatch').replace('{n}', String(record.proc_batch_number))}
                  </Text>
                </View>
              ) : null}
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
                  {record.note || '—'}
                </Text>
              </View>
            </View>

            {displayImgs.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>{t('receiptExpenseLabel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {displayImgs.map((url: string, i: number) => (
                    <TouchableOpacity key={i} onPress={() => openPreview(i)} activeOpacity={0.8}>
                      <Image source={{ uri: url }} style={[styles.thumb, { width: thumbSize, height: thumbSize, marginRight: 0 }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── Edit mode ── */}
        {editMode && (
          <View style={{ gap: 14 }}>
            {/* Amount — top, matching view mode style */}
            <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>{t('expTotalAmount')}</Text>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 20, fontWeight: '600' as const, color: amtColor, marginRight: 2, marginBottom: 4 }}>-¥</Text>
                {record.procurement_batch_id ? (
                  <Text style={{ fontSize: 36, fontWeight: '700' as const, color: c.textSub }}>{amount || '0.00'}</Text>
                ) : (
                  <TextInput
                    style={{ fontSize: 36, fontWeight: '700' as const, color: amtColor, borderWidth: 0, backgroundColor: 'transparent', textAlign: 'left', padding: 0, flex: 0, width: 180, outline: 'none' } as any}
                    value={amount} onChangeText={(v: string) => setAmount(fmtDecInput(v))}
                    onBlur={() => { if (amount !== '') setAmount(toDec2(amount)); }}
                    keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSub} />
                )}
              </View>
            </View>

            {/* Category */}
            {record.procurement_batch_id ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('expenseCategory')}</Text>
                <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textSub }}>
                  {trCategory(category)}
                </Text>
              </View>
            ) : (
              <CategoryChips selected={category} onSelect={setCategory} />
            )}

            {/* Payment */}
            <PaymentMethodChips selected={account} onSelect={setAccount} />

            {/* Procurement batch — read-only, only if linked */}
            {record.proc_batch_number ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('procBatchLabel')}</Text>
                <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textSub }}>
                  {t('procNowBatch').replace('{n}', String(record.proc_batch_number))}
                </Text>
              </View>
            ) : null}

            {/* Date — label inline with picker on same row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('expenseDate')}</Text>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12 }}
                onPress={() => dateInputRef.current?.showPicker?.()} activeOpacity={0.7}>
                <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textSub }}>{fmtLocalDate(date, lang)}</Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={c.textSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M10 6l6 6-6 6"/></Svg>
                {React.createElement('input', {
                  ref: dateInputRef, type: 'date', defaultValue: date, max: sd.today,
                  onChange: (e: any) => setDate(e.target.value),
                  style: { position: 'absolute', top: -6, right: 0, bottom: -6, left: 0, opacity: 0.01, cursor: 'pointer', fontSize: FONTS.sub.size, outline: 'none' },
                })}
              </TouchableOpacity>
            </View>

            {/* Note */}
            <ExpenseNoteInput value={note} onChangeText={setNote} />

            {/* Images */}
            <ReceiptUpload
              existingImages={images}
              newFiles={newFiles}
              onAdd={(files: File[]) => setNewFiles(prev => [...prev, ...files])}
              onRemoveExisting={removeImage}
              onRemoveNew={removeNewFile}
              getPreviewUrl={getPreviewUrl}
            />
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Edit mode bottom bar — fixed at bottom, equal width */}
      {editMode && (
        <View style={styles.bottomBar}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderColor: c.secondary }}
              onPress={() => {
                setCategory(record.category || 'daily'); setAccount(record.account || 'payWechat');
                setAmount(toDec2(record.amount)); setDate(record.date || record.created_at?.slice(0, 10) || sd.today);
                setNote(record.note || ''); setImages(parseImages(record.images));
                setThumbImages(parseImages(record.thumb_images));
                newFiles.forEach(f => { const u = urlCache.current.get(f); if (u) URL.revokeObjectURL(u); });
                urlCache.current.clear(); setNewFiles([]); setEditMode(false);
              }} activeOpacity={0.7}>
              <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.textMain }}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[{ flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: c.primary }, (!hasChanges || saving) && { opacity: 0.4 }]}
              onPress={handleSave} disabled={!hasChanges || saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight }}>{t('confirm')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

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
        message="确认删除该笔支出数据，将无法恢复"
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

      {previewData && (
        <ImagePreview
          images={previewData.images}
          initialIdx={previewData.idx}
          visible={true}
          onClose={() => setPreviewData(null)}
        />
      )}
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
      fontSize: 14,
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
      fontSize: 14,
      fontWeight: '600' as const,
      color: c.textMain,
      maxWidth: 100,
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
      fontSize: 14,
      fontWeight: '500' as const,
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
      fontSize: 14, fontWeight: '500' as const,
      color: c.textSub, textTransform: 'uppercase' as any,
      letterSpacing: 0.5, marginBottom: 10,
    },
    thumb: {
      width: 72, height: 72, borderRadius: 8, marginRight: 8,
      borderWidth: 0.5, borderColor: withAlpha(c.textMain, 0.08),
    },
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
    // Preview — matches ProcurementDetailScreen

  } as any);
};
