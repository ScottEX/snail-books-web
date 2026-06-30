import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated } from 'react-native';
import SubmitButton from './SubmitButton';
import { useTheme, withAlpha } from '../theme';
import { t } from '../i18n';
import { api } from '../api/client';
import ModalOverlay from './ModalOverlay';
import { FONTS } from '../theme';
import { useEffect, useRef, useState } from 'react';

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
  { key: 'phone', labelKey: 'companyPhone' },
];

export default function InvoiceModal({ visible, onClose }: Props) {
  const { colors: c } = useTheme();
  const [data, setData] = useState<InvoiceData>(EMPTY);
  const [original, setOriginal] = useState<InvoiceData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup close timer on unmount
  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Reset states when opening
    setSaved(false);
    (async () => {
      try {
        const invData = await api.getInvoice();
        if (invData.status === 'ok' && invData.data) {
          const d = { ...EMPTY, ...invData.data };
          setData(d);
          setOriginal(d);
        }
        const admResp = await fetch('/api/admin/check', { credentials: 'include' });
        if (admResp.ok) {
          const admJson = await admResp.json();
          setIsAdmin(admJson.is_admin === true);
        }
      } catch {}
    })();
  }, [visible]);

  const hasChanged = JSON.stringify(data) !== JSON.stringify(original);

  const handleSave = async () => {
    if (!hasChanged || saving) return;
    setSaving(true);
    try {
      const json = await api.updateInvoice(data as any);
      if (json.status === 'ok') {
        setSaved(true);
        setOriginal({ ...data });
        closeTimer.current = setTimeout(() => onClose(), 800);
      }
    } catch {}
    setSaving(false);
  };

  return (
    <ModalOverlay
      visible={visible}
      onClose={onClose}
      animation="stagger"
      staggerCount={3}
      contentStyle={{ alignItems: 'stretch' } as any}
    >
      {(anims) => (
        <View style={[s.card, { backgroundColor: c.surface }]}>
          {/* Stagger item 0: header (handle bar + title, theme bg) */}
          <Animated.View style={{
            opacity: anims[0],
            transform: [{ translateY: anims[0].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
          }}>
            <View style={{ backgroundColor: c.primary, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'column', alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 4, backgroundColor: '#D4D0C8', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
              <Text style={{ fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.surface }}>{t('invoiceTitle')}</Text>
            </View>
          </Animated.View>
          {/* Stagger item 1: content */}
          <Animated.View style={{
            opacity: anims[1],
            transform: [{ translateY: anims[1].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
          }}>
            <View style={s.body}>
              {FIELDS.map((f) => (
                <View key={f.key} style={s.fieldRow}>
                  <Text style={[s.label, { color: c.textSub }]}>{t(f.labelKey as any)}</Text>
                  <TextInput
                    style={[s.input, {
                      color: c.textMain,
                      borderColor: withAlpha(c.textMain, 0.1),
                      backgroundColor: isAdmin ? 'transparent' : c.bg,
                    }] as any}
                    value={data[f.key]}
                    onChangeText={(v) => setData((d) => ({ ...d, [f.key]: v }))}
                    placeholder={t(f.labelKey as any)}
                    placeholderTextColor={c.textSub}
                    editable={isAdmin && !saved}
                  />
                </View>
              ))}
              {isAdmin && (
                <SubmitButton
                  onPress={handleSave}
                  loading={saving}
                  disabled={saved || !hasChanged}
                  label={saved ? t('invoiceSaved') : t('invoiceSave')}
                  style={[s.saveBtn, { backgroundColor: c.primary, opacity: (saved || !hasChanged) ? 0.45 : 1 }]}
                  textStyle={[s.saveBtnText, { color: c.surface }]}
                />
              )}
            </View>
          </Animated.View>
        </View>
      )}
    </ModalOverlay>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    width: 340, maxWidth: '100%', overflow: 'hidden' as any,

  } as any,
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 12 },
  fieldRow: { gap: 4 },
  label: { fontSize: 12, fontWeight: '500' },
  input: {
    fontSize: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1,
  } as any,
  saveBtn: {
    marginTop: 6, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '600' },
});
