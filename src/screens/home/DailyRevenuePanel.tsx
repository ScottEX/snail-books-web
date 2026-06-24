import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import SubmitButton from '../../components/SubmitButton';
import Svg, { Path } from 'react-native-svg';
import { t } from '../../i18n';
import { useTheme, withAlpha, ThemeColors } from '../../theme';
import { FONTS } from '../../theme';
import DateErrorHint from '../../components/DateErrorHint';
import DatePicker from '../../components/DatePicker';
import { useMemo } from 'react';

interface DailyRevenuePanelProps {
  revDate: string;
  revRevenue: string;
  revTurnover: string;
  revJD: string;
  revNote: string;
  revDateErr: number;
  revDateKey: number;
  revDateInputRef: React.RefObject<HTMLInputElement | null>;
  revSaving: boolean;
  revMarkedClosed: boolean;
  yesterdayRev: any;
  weekRev: any;
  setRevRevenue: (v: string) => void;
  setRevTurnover: (v: string) => void;
  setRevJD: (v: string) => void;
  setRevNote: (v: string) => void;
  setRevMarkedClosed: (v: boolean) => void;
  setRevDateErr: (cb: (c: number) => number) => void;
  setRevDateKey: (cb: (k: number) => number) => void;
  loadRevForDate: (d: string) => void;
  submitDailyRev: () => void;
  todayDateStr: () => string;
  yesterdayDateStr: () => string;
  dayBeforeDateStr: () => string;
  isFuture: (d: string) => boolean;
  fmtDecInput: (s: string) => string;
  toDec2: (x: any) => string;
}

export default function DailyRevenuePanel(props: DailyRevenuePanelProps) {
  const {
    revDate, revRevenue, revTurnover, revJD, revNote,
    revDateErr, revDateKey, revDateInputRef,
    revSaving, revMarkedClosed,
    yesterdayRev, weekRev,
    setRevRevenue, setRevTurnover, setRevJD, setRevNote,
    setRevMarkedClosed, setRevDateErr, setRevDateKey,
    loadRevForDate, submitDailyRev,
    todayDateStr, yesterdayDateStr, dayBeforeDateStr, isFuture,
    fmtDecInput, toDec2,
  } = props;

  const { colors } = useTheme();
  const styles = useMemoizedStyles(colors);

  const td = todayDateStr();

  const pickDate = (d: string) => { if (d <= td) loadRevForDate(d); };

  return (
    <View style={styles.revCard}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.textMain}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 3v18h18M7 16l4-8 4 4 4-6" />
          </Svg>
          <Text style={styles.revTitle}>{t('dailyRevenue')}</Text>
        </View>
        {/*
          editingRevId no longer shows cancel — date selection auto-loads data,
          user can modify and save directly without explicit cancel/edit modes.
        */}
      </View>

      {/* Quick date pills + date picker */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[
            { key: 'today', label: t('revQuickToday'), d: td },
            { key: 'yesterday', label: t('revQuickYesterday'), d: yesterdayDateStr() },
            { key: 'db4', label: t('revQuickDB4'), d: dayBeforeDateStr() },
          ].map((pill) => (
            <TouchableOpacity
              key={pill.key}
              onPress={() => pickDate(pill.d)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 22,
                backgroundColor: revDate === pill.d ? colors.primary : colors.bg,
              }}
            >
              <Text
                style={{
                  fontSize: FONTS.subBold.size,
                  fontWeight: FONTS.subBold.weight,
                  color: revDate === pill.d ? colors.surface : colors.textSub,
                }}
              >
                {pill.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ position: 'relative' }}>
          <DatePicker
            date={revDate}
            onChange={(d) => { loadRevForDate(d); }}
            max={todayDateStr()}
            onFutureDate={() => setRevDateErr(c => c + 1)}
            showCalendarIcon
            showChevron
            fontSize={FONTS.subBold.size}
          />
          <DateErrorHint trigger={revDateErr} message={t('errDateFuture')} color={colors.danger} textAlign="left" />
        </View>
      </View>

      {/* Three input cards */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <View style={styles.revInputCard}>
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.textSub}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 6 }}
          >
            <Path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </Svg>
          <Text style={styles.revInputCardTitle}>{t('revRevenue')}</Text>
          <Text style={styles.revInputCardSub}>{t('revRevenueSub')}</Text>
          <View style={styles.revInputCardInputWrap}>
            <Text style={styles.revInputCardSymbol}>¥</Text>
            <TextInput
              style={styles.revInputCardInput}
              value={revRevenue}
              onChangeText={(v) => setRevRevenue(fmtDecInput(v))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSub}
            />
          </View>
          <Text style={styles.revInputCardFooter}>
            {t('revYesterdayLabel')}{' '}
            {yesterdayRev ? `¥${toDec2(yesterdayRev.revenue)}` : t('revYesterdayNA')}
          </Text>
        </View>
        <View style={styles.revInputCard}>
          <Text style={{ fontSize: FONTS.sub.size, marginBottom: 6 }}>🛒</Text>
          <Text style={styles.revInputCardTitle}>{t('revTurnover')}</Text>
          <Text style={styles.revInputCardSub}>{t('revTurnoverSub')}</Text>
          <View style={styles.revInputCardInputWrap}>
            <Text style={styles.revInputCardSymbol}>¥</Text>
            <TextInput
              style={styles.revInputCardInput}
              value={revTurnover}
              onChangeText={(v) => setRevTurnover(fmtDecInput(v))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSub}
            />
          </View>
          <Text style={styles.revInputCardFooter}>
            {t('revYesterdayLabel')}{' '}
            {yesterdayRev ? `¥${toDec2(yesterdayRev.turnover)}` : t('revYesterdayNA')}
          </Text>
        </View>
        <View style={styles.revInputCard}>
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.textSub}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 6 }}
          >
            <Path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
          </Svg>
          <Text style={styles.revInputCardTitle}>{t('revJD')}</Text>
          <Text style={styles.revInputCardSub}>{t('revJDSub')}</Text>
          <View style={styles.revInputCardInputWrap}>
            <Text style={styles.revInputCardSymbol}>¥</Text>
            <TextInput
              style={styles.revInputCardInput}
              value={revJD}
              onChangeText={(v) => setRevJD(fmtDecInput(v))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.textSub}
            />
          </View>
          <Text style={styles.revInputCardFooter}>
            {t('revYesterdayLabel')}{' '}
            {yesterdayRev && yesterdayRev.jd_revenue > 0
              ? `¥${toDec2(yesterdayRev.jd_revenue)}`
              : t('revYesterdayNA')}
          </Text>
        </View>
      </View>

      {/* Note */}
      <TextInput
        style={styles.revNoteInput}
        value={revNote}
        onChangeText={setRevNote}
        placeholder={t('revNoteHint')}
        placeholderTextColor={colors.textSub}
      />

      {/* Two action buttons */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          style={[styles.revArchiveBtn, { flex: 2 }, revMarkedClosed && styles.revArchiveBtnDone]}
          onPress={() => {
            const next = !revMarkedClosed;
            setRevMarkedClosed(next);
            if (next && !revNote.trim()) {
              setRevNote(t('revClosedReason'));
            } else if (!next && revNote.trim() === t('revClosedReason')) {
              setRevNote('');
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.revArchiveText, revMarkedClosed && styles.revArchiveTextDone]}>
            {revMarkedClosed ? t('revCancelArchive') : t('revMarkArchive')}
          </Text>
        </TouchableOpacity>
        <SubmitButton
          onPress={submitDailyRev}
          loading={revSaving}
          disabled={!revMarkedClosed && (!revTurnover || parseFloat(revTurnover) <= 0)}
          style={[
            styles.revSubmitBtn,
            { flex: 4 },
            (!revMarkedClosed && (!revTurnover || parseFloat(revTurnover) <= 0)) &&
              { opacity: 0.5 },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.surface}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8" />
            </Svg>
            <Text style={styles.revSubmitText}>
              {revDate === todayDateStr()
                ? t('revSaveToday')
                : revDate === yesterdayDateStr()
                ? t('revSaveYesterday')
                : revDate === dayBeforeDateStr()
                ? t('revSaveDayBefore')
                : t('revSaveDate').replace('{date}', revDate.slice(5).replace('-', ''))}
            </Text>
          </View>
        </SubmitButton>
      </View>

      {/* Last 7 days summary */}
      <View
        style={{
          marginTop: 14,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
        }}
      >
        <View style={{ alignItems: 'flex-start' }}>
          <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 2 }}>
            {t('revWeekRevenue')}
          </Text>
          <Text
            style={{
              fontSize: FONTS.subBold.size,
              fontWeight: FONTS.subBold.weight,
              color: colors.textMain,
            }}
          >
            ¥{weekRev ? toDec2(weekRev.revenue) : '0.00'}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 2 }}>
            {t('revWeekTurnover')}
          </Text>
          <Text
            style={{
              fontSize: FONTS.subBold.size,
              fontWeight: FONTS.subBold.weight,
              color: colors.textMain,
            }}
          >
            ¥{weekRev ? toDec2(weekRev.turnover) : '0.00'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: FONTS.micro.size, color: colors.textSub, marginBottom: 2 }}>
            {t('revWeekJD')}
          </Text>
          <Text
            style={{
              fontSize: FONTS.subBold.size,
              fontWeight: FONTS.subBold.weight,
              color: colors.textMain,
            }}
          >
            ¥{weekRev ? toDec2(weekRev.jd_revenue) : '0.00'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function useMemoizedStyles(colors: ThemeColors) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create({
    /* ── Daily Revenue (每日营收) ── */
    revCard: {
      backgroundColor: withAlpha(colors.surface, 0.65),
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: withAlpha(colors.textMain, 0.08),
      padding: 18,
      // @ts-ignore

      // @ts-ignore

    },
    revTitle: {
      fontSize: FONTS.h2.size,
      fontWeight: FONTS.h2.weight,
      color: colors.textMain,
    },
    // Three input cards
    revInputCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
      borderWidth: 0.5,
      borderColor: colors.secondary,
    },
    revInputCardTitle: {
      fontSize: FONTS.microBold.size,
      fontWeight: FONTS.microBold.weight,
      color: colors.textSub,
      marginBottom: 2,
    },
    revInputCardSub: {
      fontSize: FONTS.micro.size,
      color: colors.textSub,
      marginBottom: 8,
    },
    revInputCardInputWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 6,
    },
    revInputCardSymbol: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: colors.textSub,
      marginRight: 2,
      marginBottom: 1,
    },
    revInputCardInput: {
      flex: 1,
      fontSize: FONTS.body.size,
      fontWeight: FONTS.h2.weight,
      color: colors.textMain,
      padding: 0,
      outline: 'none',
    },
    revInputCardFooter: {
      fontSize: FONTS.micro.size,
      color: colors.textSub,
    },
    revNoteInput: {
      fontSize: FONTS.sub.size,
      color: colors.textSub,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.secondary,
      marginBottom: 14,
      outline: 'none',
    },
    revSubmitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    revSubmitText: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: colors.surface,
    },
    revArchiveBtn: {
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    revArchiveBtnDone: {
      backgroundColor: withAlpha(colors.primary, 0.1),
    },
    revArchiveText: {
      fontSize: FONTS.subBold.size,
      fontWeight: FONTS.subBold.weight,
      color: colors.textSub,
    },
    revArchiveTextDone: {
      color: colors.primary,
    },
  } as any), [colors]);
}
