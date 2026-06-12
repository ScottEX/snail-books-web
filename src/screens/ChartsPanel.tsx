import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Area, ComposedChart,
  Legend, BarChart, Bar,
} from 'recharts';
import { t } from '../i18n';
import { useTheme } from '../theme';

interface Props {
  months: string[];
  income: number[];
  expense: number[];
  profit: number[];
  categories: Record<string, number>;
  dailyDates?: string[];
  dailyIncome?: number[];
  dailyExpense?: number[];
}

// ── Category → fixed color mapping (by i18n zh-CN key) ──
const CAT_COLORS_LIGHT: Record<string, string> = {
  daily:      '#4A7299', // blue
  rent:       '#7D2329', // burgundy
  salary:     '#D59A53', // gold
  goods:      '#4C7A5D', // green
  other:      '#8C8583', // grey
  eleme:      '#B34149', // light red
  meituan:    '#C5A880', // sand
  wages:      '#9B6B9E', // purple
};
const CAT_COLORS_DARK: Record<string, string> = {
  daily:      '#6B9AC7',
  rent:       '#A8454D',
  salary:     '#E8B86D',
  goods:      '#6BA87A',
  other:      '#A8A3A0',
  eleme:      '#D46B73',
  meituan:    '#D9C4A0',
  wages:      '#B88DB8',
};
const FALLBACK_COLORS = ['#4A7299','#7D2329','#D59A53','#4C7A5D','#8C8583','#B34149','#C5A880','#9B6B9E'];

function getCatColor(key: string, isLight: boolean, idx: number): string {
  const map = isLight ? CAT_COLORS_LIGHT : CAT_COLORS_DARK;
  if (map[key]) return map[key];
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

/** Compact ¥ formatter */
const fmtY = (v: number) => {
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + 'w';
  return String(Math.round(v));
};

/** Custom tooltip — dark popup, always looks good */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const labelStr = String(label ?? '');
  const displayLabel = labelStr.includes('月') ? labelStr : labelStr + '月';
  return (
    <View style={tooltipStyles.wrapper}>
      <Text style={tooltipStyles.label}>{displayLabel}</Text>
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

export default function ChartsPanel({ months, income, expense, profit, categories, dailyDates, dailyIncome, dailyExpense }: Props) {
  const { colors } = useTheme();
  const [showBar, setShowBar] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const hasDaily = !!(dailyDates?.length);

  // Current month number from the data
  const currentMonth = months.length > 0 ? parseInt(months[months.length - 1].slice(5), 10) : new Date().getMonth() + 1;

  // ── Kill recharts blue focus ring ──
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent =
      '[class*="recharts"]:focus{outline:none!important;}';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Build data arrays for recharts
  const incomeLabel = t('income');
  const expenseLabel = t('expense');
  const profitLabel = t('profit');

  // Build shared-line data (both month & day keys present for type compatibility)
  interface LinePt { month: string; day: string; [key: string]: string | number }
  const lineData: LinePt[] = months.map((m, i) => ({
    month: m.slice(5),
    day: '',
    [incomeLabel]: income[i],
    [expenseLabel]: expense[i],
  }));

  // Daily line data (MM-DD labels)
  const dailyLineData: LinePt[] = hasDaily
    ? (dailyDates || []).map((d, i) => ({
        month: '',
        day: d.slice(5),
        [incomeLabel]: (dailyIncome || [])[i] || 0,
        [expenseLabel]: (dailyExpense || [])[i] || 0,
      }))
    : [];

  const profitData = months.map((m, i) => ({
    month: m.slice(5),
    [profitLabel]: profit[i],
  }));

  // Donut / bar data — translate category keys
  const donutData = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, name: t(key as any) || key, value }))
    .sort((a, b) => b.value - a.value);

  // Axes colors — follow theme
  const isLight = colors.surface?.toLowerCase?.() !== '#141416';
  const axisColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const tickColor = isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
  const subTextColor = colors.textSub;
  const cardBg = colors.surface;
  const cardBorder = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  // Axis hints for title row
  const xLabel = t('chartXAxis');
  const yLabel = t('chartYAxis');

  return (
    <View style={{ gap: 12, marginTop: 0 }}>
      {/* ── 收支趋势（月度 / 每日切换） ── */}
      <View style={[chartStyles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={chartStyles.titleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[chartStyles.title, { color: subTextColor }]}>{showDaily ? t('dailyTrend') : t('monthlyTrend')}</Text>
            {hasDaily && (
              <TouchableOpacity
                onPress={() => setShowDaily(!showDaily)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
                  {showDaily ? t('chartSwitchMonth') : t('chartSwitchDay')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[chartStyles.axisHint, { color: tickColor }]}>{xLabel} · {yLabel}</Text>
        </View>
        <View style={chartStyles.chartWrap}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={showDaily && hasDaily ? dailyLineData : lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} />
              <XAxis dataKey={showDaily && hasDaily ? 'day' : 'month'} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: subTextColor }}
                iconType="line"
              />
              <Line type="monotone" dataKey={incomeLabel} stroke={colors.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.primary }} />
              <Line type="monotone" dataKey={expenseLabel} stroke={colors.warning} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: colors.warning }} />
            </LineChart>
          </ResponsiveContainer>
        </View>
      </View>

      {/* ── 月度利润趋势 ── */}
      <View style={[chartStyles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={chartStyles.titleRow}>
          <Text style={[chartStyles.title, { color: subTextColor }]}>{t('monthlyProfit')}</Text>
          <Text style={[chartStyles.axisHint, { color: tickColor }]}>{xLabel} · {yLabel}</Text>
        </View>
        <View style={chartStyles.chartWrap}>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={profitData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.15} />
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

      {/* ── 支出分类占比（环形图 / 柱状图切换） ── */}
      {donutData.length > 0 && (
        <View style={[chartStyles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={chartStyles.titleRow}>
            <Text style={[chartStyles.title, { marginBottom: 0 }]}>{currentMonth + t('expenseBreakdownOfMonth')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: tickColor, fontSize: 10 }}>{t('chartSwitchHint')}</Text>
              <TouchableOpacity
                onPress={() => setShowBar(!showBar)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
                }}
              >
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
                  {showBar ? t('chartSwitchPie') : t('chartSwitchBar')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[chartStyles.chartWrap, { alignItems: 'center' }]}>
            <ResponsiveContainer width="100%" height={240}>
              {showBar ? (
                <BarChart data={donutData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={axisColor} />
                  <XAxis dataKey="name" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={40} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={getCatColor(d.key, isLight, i)} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
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
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={getCatColor(d.key, isLight, i)} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              )}
            </ResponsiveContainer>
            {/* Color legend */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 }}>
              {donutData.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getCatColor(d.key, isLight, i) }} />
                  <Text style={{ color: subTextColor, fontSize: 11, fontWeight: '500' }}>{d.name}</Text>
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
    borderColor: 'rgba(0,0,0,0.06)',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  axisHint: {
    fontSize: 10,
    fontWeight: '400',
  },
  chartWrap: {},
});
