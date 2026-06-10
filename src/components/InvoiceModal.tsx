import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import Toast from './Toast';
import { modalCardAnimation, modalClose } from '../sharedStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface InvoiceData {
  company_name: string;
  tax_id: string;
  bank_name: string;
  bank_account: string;
  address: string;
  phone: string;
}

const EMPTY: InvoiceData = {
  company_name: '', tax_id: '', bank_name: '', bank_account: '', address: '', phone: '',
};

const FIELDS: { key: keyof InvoiceData; labelKey: string }[] = [
  { key: 'company_name', labelKey: 'companyName' },
  { key: 'tax_id', labelKey: 'taxId' },
  { key: 'bank_name', labelKey: 'bankName' },
  { key: 'bank_account', labelKey: 'bankAccount' },
  { key: 'address', labelKey: 'addressPhone' },
  { key: 'phone', labelKey: 'addressPhone' },
];

export default function InvoiceModal({ visible, onClose }: Props) {
  const { colors: c } = useTheme();
  const [data, setData] = useState<InvoiceData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [invResp, admResp] = await Promise.all([
          api.getInvoice(),
          fetch('/api/admin/check', { credentials: 'include' }),
        ]);
        const invJson = await invResp.json();
        if (invJson.status === 'ok' && invJson.data) {
          setData({ ...EMPTY, ...invJson.data });
        }
        if (admResp.ok) {
          const admJson = await admResp.json();
          setIsAdmin(admJson.is_admin === true);
        }
      } catch {}
    })();
  }, [visible]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await api.updateInvoice(data as any);
      const json = await resp.json();
      if (json.status === 'ok') {
        setToast('已保存');
        setTimeout(() => onClose(), 600);
      } else {
        setToast(json.message || '保存失败');
      }
    } catch {
      setToast('保存失败');
    }
    setSaving(false);
  };

  if (!visible) return null;

  return createPortal(
    <View style={[s.overlay, { backgroundColor: 'rgba(0,0,0,0.3)' }] as any}>
      <View style={[s.card, { backgroundColor: c.surface }] as any}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: c.primary }]}>
          <Text style={s.title}>{t('invoiceTitle')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={s.body}>
          {FIELDS.map((f) => (
            <View key={f.key} style={s.fieldRow}>
              <Text style={[s.label, { color: c.textSub }]}>{t(f.labelKey as any)}</Text>
              <TextInput
                style={[s.input, { color: c.textMain, borderColor: withAlpha(c.textMain, 0.1) }] as any}
                value={data[f.key]}
                onChangeText={(v) => setData((d) => ({ ...d, [f.key]: v }))}
                placeholder={t(f.labelKey as any)}
                placeholderTextColor={c.textSub}
                editable={isAdmin}
              />
            </View>
          ))}

          {isAdmin && (
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: c.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={s.saveBtnText}>{saving ? '...' : t('invoiceSave')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Toast message={toast} visible={!!toast} onDismiss={() => setToast('')} />
    </View>,
    document.body
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 600, justifyContent: 'center', alignItems: 'center',
  },
  card: {
    borderRadius: 16, width: 340, maxWidth: '90%', overflow: 'hidden' as any,
    ...modalCardAnimation,
  },
  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', color: '#fff' },
  closeBtn: { ...modalClose },
  body: { padding: 20, gap: 14 },
  fieldRow: { gap: 4 },
  label: { fontSize: 12, fontWeight: '500' },
  input: {
    fontSize: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1,
  } as any,
  saveBtn: {
    marginTop: 6, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
