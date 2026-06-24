import { View, Text, StyleSheet } from 'react-native';
import NumberTicker from '../../components/NumberTicker';
import { useTheme, ThemeColors } from '../../theme';
import { FONTS } from '../../theme';
import { t } from '../../i18n';
import { fmtAmtFull } from '../../utils/format';
import { useMemo } from 'react';

interface ExpenseSummaryCardsProps {
  yesterdayExpense: number;
  monthExpense: number;
  yesterdayIncome: number;
  monthIncome: number;
}

/** Top summary cards — yesterday/month income/expense/profit with NumberTicker animation. */
export default function ExpenseSummaryCards({
  yesterdayExpense,
  monthExpense,
  yesterdayIncome,
  monthIncome,
}: ExpenseSummaryCardsProps) {
  const { colors } = useTheme();

  const yesterdayProfit = yesterdayIncome - yesterdayExpense;
  const monthProfit = monthIncome - monthExpense;

  const st = useMemo(() => getSt(colors), [colors]);

  const cards = [
    { label: t('yesterdayIncome'), value: yesterdayIncome, color: colors.success, isProfit: false },
    { label: t('yesterdayExpense'), value: yesterdayExpense, color: colors.danger, isProfit: false },
    { label: t('monthIncome'), value: monthIncome, color: colors.success, isProfit: false },
    { label: t('monthExpense'), value: monthExpense, color: colors.danger, isProfit: false },
    { label: t('yesterdayProfit'), value: yesterdayProfit, color: yesterdayProfit >= 0 ? colors.success : colors.danger, isProfit: true },
    { label: t('monthProfit'), value: monthProfit, color: monthProfit >= 0 ? colors.success : colors.danger, isProfit: true },
  ];

  return (
    <View style={st.wrap}>
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
              {c.isProfit ? (
                <Text style={[st.value, { color: c.color }]}>
                  {c.value >= 0 ? '+' : '-'}{fmtAmtFull(Math.abs(c.value))}
                </Text>
              ) : (
                <NumberTicker value={c.value} style={st.value} formatFn={fmtAmtFull} />
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
