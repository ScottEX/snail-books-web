import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, ThemeColors, withAlpha } from '../theme';
import { FONTS } from '../theme';
import { t } from '../i18n';
import { onSessionKicked } from '../api/client';
import ModalOverlay from './ModalOverlay';

/** Standardized "your account was signed in elsewhere" modal.
 *  Triggered by the api client when a 401 with code=session_kicked is received.
 *  Single confirm button + ✕ close — both close the modal AND redirect to /login. */
export default function SessionKickedModal() {
  const { colors: c } = useTheme();
  const styles = getStyles(c);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return onSessionKicked(() => setVisible(true));
  }, []);

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
