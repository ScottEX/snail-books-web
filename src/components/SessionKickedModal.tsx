import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEMES, DEFAULT_THEME_ID, getThemeKey, ThemeColors, withAlpha, FONTS } from '../theme';
import { t } from '../i18n';
import { onSessionKicked } from '../api/client';
import ModalOverlay from './ModalOverlay';

/**
 * Read the per-user theme id from localStorage and resolve it to
 * ThemeColors. Falls back to DEFAULT_THEME_ID ('burgundy-warm') if
 * the stored id is missing or unknown — same fallback ThemeProvider
 * uses internally, so the modal and the rest of the app agree on
 * what "no theme set" looks like.
 *
 * This module sits OUTSIDE the keyed <ThemeProvider> subtree (see
 * App.tsx), so useTheme() here would only ever return the default
 * ThemeContext value (theme1, burgundy-red). Instead we read the
 * theme id directly from localStorage — the same place ThemeProvider
 * writes when the user picks a theme — so the modal renders in the
 * current user's actual theme at the moment the kick fires.
 */
function readStoredColors(): ThemeColors {
  try {
    const key = getThemeKey();
    const id = localStorage.getItem(key) || DEFAULT_THEME_ID;
    return THEMES[id]?.colors ?? THEMES[DEFAULT_THEME_ID].colors;
  } catch {
    return THEMES[DEFAULT_THEME_ID].colors;
  }
}

/** Standardized "your account was signed in elsewhere" modal.
 *  Triggered by the api client when a 401 with code=session_kicked is received.
 *  Single confirm button + ✕ close — both close the modal AND redirect to /login. */
export default function SessionKickedModal() {
  // Mount-time snapshot: in case the user already had a theme set in
  // localStorage from a previous session before the app booted.
  const [colors, setColors] = useState<ThemeColors>(readStoredColors);
  const styles = getStyles(colors);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return onSessionKicked(() => setVisible(true));
  }, []);

  // Re-read the stored theme each time the modal becomes visible.
  // The modal mounts once at app boot (visible=false), but the user
  // may sign in and pick a different theme long after that. We don't
  // need to track theme changes in real time — the kick is the only
  // moment this UI is shown, and at that moment localStorage already
  // holds the user's final choice (ThemeProvider writes it on every
  // setTheme). Reading here, instead of at mount, guarantees we
  // show the most recent theme.
  useEffect(() => {
    if (visible) {
      setColors(readStoredColors());
    }
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    // Defer the redirect to the next macrotask. setVisible(false) is a
    // batched setState (React 18); calling window.location.replace in the
    // same tick causes the navigation to race with React's commit and
    // get swallowed. setTimeout(0) lets the modal's close animation and
    // any pending state commits complete before we navigate.
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }, 0);
  };

  return (
    <ModalOverlay visible={visible} onClose={handleClose}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('sessionKickedTitle') || '账号已退出'}</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{t('sessionKickedToast')}</Text>
          </View>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleClose}>
            <Text style={styles.confirmBtnText}>{t('sessionKickedButton') || '我知道了'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ModalOverlay>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface, borderRadius: 16,
    width: 340, maxWidth: '90%', overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: {
    backgroundColor: c.primary,
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: FONTS.subBold.size, fontWeight: FONTS.subBold.weight, color: c.surface },
  closeBtn: { fontSize: 18, color: c.surface, fontWeight: '300' },
  body: { padding: 24, alignItems: 'center', gap: 18 },
  warningBox: {
    backgroundColor: withAlpha(c.primary, 0.1), borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  warningText: { fontSize: FONTS.micro.size, color: c.textSub, textAlign: 'center' },
  confirmBtn: {
    width: '100%', paddingVertical: 13, borderRadius: 10,
    backgroundColor: c.primary, alignItems: 'center',
  },
  confirmBtnText: { fontSize: FONTS.sub.size, fontWeight: '600', color: c.surface },
});
