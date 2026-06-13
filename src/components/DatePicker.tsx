import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
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
 * Unified date picker: displays localized date text; tapping opens the native
 * date picker via `input.showPicker()` (iOS 16+ / Chrome 99+).
 *
 * On older browsers that lack showPicker(), falls back to a hidden
 * transparent <input type="date"> overlay.
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

  const c = color || colors.primary;
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

  const openPicker = () => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;

    // Preferred path: programmatic showPicker() — fixes iOS 18+ Safari
    // hit-testing bug where transparent overlay inputs don't respond.
    if (typeof (input as any).showPicker === 'function') {
      (input as any).showPicker();
      return;
    }

    // Fallback: briefly reveal the overlay and trigger a native click.
    // This handles older browsers (desktop Firefox, etc.) that lack
    // showPicker but don't have the iOS Safari overlay bug anyway.
    const prev = {
      opacity: input.style.opacity,
      pointerEvents: input.style.pointerEvents,
      width: input.style.width,
      height: input.style.height,
    };
    input.style.opacity = '1';
    input.style.pointerEvents = 'auto';
    input.style.width = `${fs * 10}px`;
    input.style.height = `${fs * 2}px`;
    input.focus();
    input.click();
    // Restore hidden state after picker opens
    setTimeout(() => {
      input.style.opacity = prev.opacity;
      input.style.pointerEvents = prev.pointerEvents;
      input.style.width = prev.width;
      input.style.height = prev.height;
    }, 200);
  };

  // Show nothing for disabled picker (read-only use case)
  if (disabled) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        {showCalendarIcon && <CalendarIcon color={c} />}
        <Text style={{ fontSize: fs, fontWeight: fw, color: c }}>
          {displayDate || fmtLocalDate(date)}
        </Text>
        {showChevron && <ChevronIcon color={c} />}
      </View>
    );
  }

  return (
    <Pressable
      onPress={openPicker}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}
    >
      {showCalendarIcon && <CalendarIcon color={c} />}
      <Text style={{ fontSize: fs, fontWeight: fw, color: c }}>
        {displayDate || fmtLocalDate(date)}
      </Text>
      {showChevron && <ChevronIcon color={c} />}
      {/* Hidden native input — only used as the picker target for showPicker() /
          onChange handler; never rendered visibly. Width/height 0 + opacity 0
          + pointerEvents none so it can't intercept clicks. */}
      {React.createElement('input', {
        ref: inputRef,
        type: 'date',
        key,
        defaultValue: date,
        max: max || undefined,
        onChange: handleChange,
        style: {
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: 'none',
        },
      })}
    </Pressable>
  );
}

/** Localized date format: 2026年6月11日 (zh) / June 11, 2026 (en) */
function fmtLocalDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${y}年${+m}月${+day}日`;
}

/** SVG calendar icon, extracted for reuse in both disabled and enabled branches. */
function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
    >
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

/** SVG chevron icon, extracted for reuse in both disabled and enabled branches. */
function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8 5l8 7-8 7" />
    </Svg>
  );
}
