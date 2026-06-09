import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme, withAlpha, ThemeColors } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';

interface Props {
  selected: string;
  onSelect: (cat: string) => void;
  label?: string;
}

const CATS = ['daily', 'rent', 'salary', 'goods'] as const;

const icons: Record<string, React.ReactElement> = {
  daily: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-2l-2-3H9L7 7H5a2 2 0 00-2 2z"/><Path d="M16 12a4 4 0 11-8 0"/></Svg>,
  rent: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 21h18"/><Path d="M3 10l9-7 9 7"/><Path d="M5 12v7h4v-4h6v4h4v-7"/></Svg>,
  salary: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Circle cx="12" cy="12" r="9"/><Path d="M14 8h-3.5a2 2 0 000 4h1a2 2 0 010 4H8"/><Path d="M12 6v2M12 16v2"/></Svg>,
  goods: <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 7l-3-4H7L4 7v12a2 2 0 002 2h12a2 2 0 002-2V7z"/><Path d="M4 7h16"/><Path d="M9 12h6"/><Path d="M12 9v6"/></Svg>,
};

export default function CategoryChips({ selected, onSelect, label }: Props) {
  const { colors: c } = useTheme();
  const activeColor = c.primary;
  const bgColor = withAlpha(c.textMain, 0.06);

  return (
    <View>
      <Text style={{ fontSize: FONTS.sub.size, fontWeight: FONTS.sub.weight, color: c.textSub, marginBottom: 6 }}>
        {label || t('expenseCategory')}
      </Text>
      <View style={{ flexDirection: 'row', width: '100%' as any, gap: 8 }}>
        {CATS.map(cat => {
          const active = selected === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[st.chip, { backgroundColor: bgColor }, active && { backgroundColor: activeColor }]}
              onPress={() => onSelect(cat)}
              activeOpacity={0.7}
            >
              <View style={[st.iconCircle, active && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                {icons[cat]}
              </View>
              <Text
                style={[st.label, { color: c.textSub }, active && { color: c.surface }]}
                numberOfLines={1}
              >
                {t(cat as any)}
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
