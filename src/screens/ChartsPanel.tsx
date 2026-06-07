import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Area, ComposedChart,
  Legend,
} from 'recharts';
import { t } from '../i18n';
import { useTheme } from '../theme';
import { FONTS } from '../theme';

interface Props {
  months: string[];
  income: number[];
  expense: number[];
  profit: number[];
  categories: Record<string, number>;
}

// Theme-derived palette for donut
const DONUT_COLORS = [
  '#7D2329', // burgundy
  '#B34149', // light red
  '#D59A53', // gold
  '#4C7A5D', // green
  '#4A7299', // blue
  '#8C8583', // grey
  '#C5A880', // sand
  '#9B6B9E', // muted purple
];

/** Compact ¥ formatter */
const fmtY = (v: number) => {
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + 'w';
  return String(Math.round(v));
};

/** Custom tooltip — dark background matching the chart tab theme */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <View style={tooltipStyles.wrapper}>
      <Text style={tooltipStyles.label}>{label}</Text>
      {payload.map((p: any, i: number) => (
        <Text key={i} style={[tooltipStyles.value, { color: p.color }]}>
          {p.name}: ¥{Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      ))}
    </View>
  );
};

const tooltipStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(20,20,22,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default function ChartsPanel({ months, income, expense, profit, categories }: Props) {
  const { colors } = useTheme();

  // Build data arrays for recharts
  const incomeLabel = t('income');
  const expenseLabel = t('expense');
  const profitLabel = t('profit');

  const lineData = months.map((m, i) => ({
    month: m.slice(5),
    [incomeLabel]: income[i],
    [expenseLabel]: expense[i],
  }));

  const profitData = months.map((m, i) => ({
    month: m.slice(5),
    [profitLabel]: profit[i],
  }));

  // Donut data
  const donutData = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Axes stroke color — subtle white for dark background
  const axisColor = 'rgba(255,255,255,0.12)';
  const tickColor = 'rgba(255,255,255,0.35)';

  return (
    <View style={{ gap: 16, marginTop: 16 }}>
      {/* ── 月度利润趋势 ── */}
      <View style={[chartStyles.card, { backgroundColor: '#1A1A1E' }]}>
        <Text style={chartStyles.title}>{t('monthlyProfit')}</Text>
        <View style={chartStyles.chartWrap}>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={profitData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey={profitLabel} stroke="none" fill="url(#profitGrad)" />
              <Line type="monotone" dataKey={profitLabel} stroke={colors.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.primary }} />
            </ComposedChart>
          </ResponsiveContainer>
        </View>
      </View>

      {/* ── 月度收支趋势（双线） ── */}
      <View style={[chartStyles.card, { backgroundColor: '#1A1A1E' }]}>
        <Text style={chartStyles.title}>{t('monthlyTrend')}</Text>
        <View style={chartStyles.chartWrap}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, opacity: 0.7, color: '#fff' }}
                iconType="line"
              />
              <Line type="monotone" dataKey={incomeLabel} stroke={colors.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.primary }} />
              <Line type="monotone" dataKey={expenseLabel} stroke={colors.warning} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.warning }} />
            </LineChart>
          </ResponsiveContainer>
        </View>
      </View>

      {/* ── 支出分类占比（环形图） ── */}
      {donutData.length > 0 && (
        <View style={[chartStyles.card, { backgroundColor: '#1A1A1E' }]}>
          <Text style={chartStyles.title}>{t('expenseBreakdown')}</Text>
          <View style={[chartStyles.chartWrap, { alignItems: 'center' }]}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Color legend */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 }}>
              {donutData.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' }}>{d.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  title: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  chartWrap: {
    // recharts responsive container needs a non-zero width parent
  },
});
