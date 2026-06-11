import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, ThemeColors } from '../theme';
import { FONTS } from '../theme';

export interface DatePickerProps {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Called with the selected date (YYYY-MM-DD) — only when valid (≤ max) */
  onChange: (date: string) => void;
  /** Max selectable date (YYYY-MM-DD), defaults to no limit */
  max?: string;
  /** Called when user picks a future date (ignored, reverted) */
  onFutureDate?: () => void;
  /** Show chevron '>' after the date text */
  showChevron?: boolean;
  /** Show calendar icon before the date text */
  showCalendarIcon?: boolean;
  /** Override displayed date text (bypasses internal formatting) */
  displayDate?: string;
  /** Override text color */
  color?: string;
  /** Override font size */
  fontSize?: number;
  /** Disable the picker (e.g. for read-only procurement records) */
  disabled?: boolean;
}

/**
 * Unified date picker: displays localized date text with a hidden native
 * `<input type="date">` overlay.  Matches the project's SVG icon style.
 *
 * Usage:
 *   <DatePicker date={recDate} onChange={setRecDate} max={sd.today}
 *     onFutureDate={() => setErr(c => c + 1)} showChevron />
 */
export default function DatePicker({
  date,
  onChange,
  max,
  onFutureDate,
  showChevron = true,
  showCalendarIcon = false,
  displayDate,
  color,
  fontSize,
  disabled = false,
}: DatePickerProps) {
  const { colors } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState(0);

  const c = color || colors.textSub;
  const fs = fontSize || FONTS.sub.size;
  const fw = (FONTS as any).subBold?.weight || '700';

  const isFuture = (d: string) => max && d > max;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (max && val > max) {
      // Reject future date: revert the input and bump key to re-render
      if (inputRef.current) inputRef.current.value = date;
      setKey(k => k + 1);
      onFutureDate?.();
      return;
    }
    onChange(val);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, position: 'relative' }}>
      {showCalendarIcon && (
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M8 2v4M16 2v4M3 10h18M21 14V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h8" />
        </Svg>
      )}
      <Text style={{ fontSize: fs, fontWeight: fw, color: c }}>
        {displayDate || fmtLocalDate(date)}
      </Text>
      {showChevron && (
        <Svg
          width={fs > 14 ? 14 : 12}
          height={fs > 14 ? 14 : 12}
          viewBox="0 0 24 24"
          fill="none"
          stroke={c}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M9 18l6-6-6-6" />
        </Svg>
      )}
      {!disabled && React.createElement('input', {
        ref: inputRef,
        type: 'date',
        key,
        defaultValue: date,
        max: max || undefined,
        onChange: handleChange,
        style: {
          position: 'absolute',
          top: -6,
          right: 0,
          bottom: -6,
          left: 0,
          opacity: 0.01,
          cursor: 'pointer',
          fontSize: fs,
        },
      })}
    </View>
  );
}

/** Localized date format: 2026年6月11日 (zh) / June 11, 2026 (en) */
function fmtLocalDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  // Simple heuristic: use Chinese locale by default (matches the rest of the app)
  // The app's i18n uses getLang() but DatePicker is a pure display component —
  // the parent can override via the `date` formatting if needed.
  // For now, use Chinese format since that's the primary app language.
  return `${y}年${+m}月${+day}日`;
}
