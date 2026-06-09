import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useTheme, withAlpha } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';

interface Props {
  selected: string;
  onSelect: (method: string) => void;
  label?: string;
}

const METHODS = ['payCash', 'payWechat', 'payAlipay'] as const;

const activeBg: Record<string, string> = {
  payCash: '',   // filled dynamically with c.primary
  payWechat: '#07C160',
  payAlipay: '#1677FF',
};

function payIcon(method: string, color: string) {
  switch (method) {
    case 'payCash':
      return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Rect x="1" y="4" width="22" height="16" rx="2"/><Path d="M1 10h22"/><Circle cx="12" cy="12" r="3"/></Svg>;
    case 'payWechat':
      return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z"/></Svg>;
    case 'payAlipay':
      return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><Path d="M9 12l2 2 4-4"/></Svg>;
    default:
      return null;
  }
}

export default function PaymentMethodChips({ selected, onSelect, label }: Props) {
  const { colors: c } = useTheme();

  return (
    <View>
      <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textMain, marginBottom: 6 }}>
        {label || t('paymentMethod')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {METHODS.map(m => {
          const active = selected === m;
          const bg = active ? (activeBg[m] || c.primary) : withAlpha(c.textMain, 0.06);
          const iconColor = active ? c.surface : c.textSub;
          return (
            <TouchableOpacity
              key={m}
              style={[st.chip, { backgroundColor: bg }]}
              onPress={() => onSelect(m)}
              activeOpacity={0.7}
            >
              <View style={[st.iconCircle, active && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                {payIcon(m, iconColor)}
              </View>
              <Text
                style={[st.label, { color: c.textSub }, active && { color: c.surface }]}
                numberOfLines={1}
              >
                {t(m as any)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  chip: {
    flex: 1, flexDirection: 'row', paddingVertical: 8, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
  label: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight },
});
