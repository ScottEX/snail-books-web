import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NumberTicker from '../../components/NumberTicker';
import { useTheme, withAlpha, ThemeColors } from '../../theme';
import { FONTS } from '../../theme';
import { t } from '../../i18n';
import { fmtAmt as fmt } from '../../utils/format';

interface ExpenseSummaryCardsProps {
  todayExpense: number;
  monthExpense: number;
  todayIncome: number;
  monthIncome: number;
}

/** Top summary cards — today/month income/expense/profit with NumberTicker animation. */
export default function ExpenseSummaryCards({
  todayExpense,
  monthExpense,
  todayIncome,
  monthIncome,
}: ExpenseSummaryCardsProps) {
  const { colors } = useTheme();

  const todayProfit = todayIncome - todayExpense;
  const monthProfit = monthIncome - monthExpense;

  const st = useMemo(() => getSt(colors), [colors]);

  const cards = [
    { label: t('todayIncome'), value: todayIncome, color: colors.success, isProfit: false },
    { label: t('todayExpense'), value: todayExpense, color: colors.danger, isProfit: false },
    { label: t('monthIncome'), value: monthIncome, color: colors.success, isProfit: false },
    { label: t('monthExpense'), value: monthExpense, color: colors.danger, isProfit: false },
    { label: t('todayProfit'), value: todayProfit, color: todayProfit >= 0 ? colors.success : colors.danger, isProfit: true },
    { label: t('monthProfit'), value: monthProfit, color: monthProfit >= 0 ? colors.success : colors.danger, isProfit: true },
  ];

  return (
    <View style={st.wrap}>
      <Text style={st.sectionTitle}>{t('summary')}</Text>
      <View style={st.grid}>
        {cards.map((c, i) => (
          <View
            key={i}
            style={[
              st.card,
              { borderLeftColor: c.color, borderLeftWidth: 3 },
            ]}
          >
            <Text style={st.label}>{c.label}</Text>
            <View style={st.valueRow}>
              {c.isProfit && (
                <Text style={[st.prefix, { color: c.color }]}>
                  {c.value >= 0 ? '+' : ''}
                </Text>
              )}
              {c.isProfit ? (
                <Text style={[st.value, { color: c.color }]}>
                  ¥{Math.abs(c.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              ) : (
                <NumberTicker value={c.value} style={st.value} />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const getSt = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: colors.textSub,
      marginBottom: 10,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    card: {
      width: '48%' as any,
      flexGrow: 1,
      flexBasis: '46%' as any,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderWidth: 0.5,
      borderColor: colors.secondary,
      // @ts-ignore
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    },
    label: {
      fontSize: FONTS.micro.size,
      fontWeight: FONTS.micro.weight,
      color: colors.textSub,
      marginBottom: 4,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    prefix: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      marginRight: 1,
    },
    value: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: colors.textMain,
    },
  });
