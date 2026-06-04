import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createPortal } from 'react-dom';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { getLang } from '../i18n';

interface ThemePickerModalProps {
  visible: boolean;
  onClose: () => void;
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'fixed' as any, inset: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center', alignItems: 'center', zIndex: 500,
    },
    card: {
      backgroundColor: colors.surface, borderRadius: 16,
      width: 360, maxWidth: '90%', overflow: 'hidden' as any,
    },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20, paddingVertical: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    title: { fontSize: 14, fontWeight: '700', color: colors.surface },
    closeBtn: { fontSize: 18, color: colors.surface, lineHeight: 20 },
    body: { padding: 20, gap: 8 } as any,
  });
}

export default function ThemePickerModal({ visible, onClose }: ThemePickerModalProps) {
  const { colors, setTheme, allThemes } = useTheme();
  const styles = getStyles(colors);

  if (!visible) return null;

  const lang = getLang();
  const tn = (t: any) => lang === 'zh-TW' ? (t.nameTw || t.nameZh) : lang === 'en' ? (t.nameEn || t.nameZh) : t.nameZh;
  const td = (t: any) => lang === 'zh-TW' ? (t.descTw || t.descZh) : lang === 'en' ? (t.descEn || t.descZh) : t.descZh;

  return createPortal(
    <TouchableOpacity style={styles.overlay as any} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity style={styles.card as any} activeOpacity={1} onPress={() => {}}>
        <View style={styles.header}>
          <Text style={styles.title}>主题</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {allThemes.map((theme: any) => {
            const isActive = theme.colors.primary === colors.primary;
            return (
              <TouchableOpacity
                key={theme.id}
                onPress={() => { setTheme(theme.id); onClose(); }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  padding: 12, borderRadius: 12,
                  backgroundColor: isActive ? withAlpha(colors.primary, 0.06) : colors.bg,
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.primary : (colors as any).secondary || '#e0e0e0',
                }}
              >
                <View style={{ flexDirection: 'row', gap: 4, marginRight: 12 }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.primary }} />
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: (colors as any).secondary || '#e0e0e0' }} />
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: theme.colors.accent }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONTS.sub.size, fontWeight: isActive ? '700' : '500', color: colors.textMain, marginBottom: 2 }}>
                    {tn(theme)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSub }}>
                    {td(theme)}
                  </Text>
                </View>
                {isActive && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </TouchableOpacity>,
    document.body
  );
}
