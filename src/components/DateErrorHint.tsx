import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';

/** Red error hint that auto-dismisses after 3000ms. Triggered by bumping `trigger`. */
export default function DateErrorHint({ trigger, message, color, textAlign = 'right' }: {
  trigger: number; message: string; color: string; textAlign?: 'left' | 'right' | 'center';
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (trigger > 0) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [trigger]);
  if (!show) return null;
  return <Text style={{ color, fontSize: 12, marginTop: 1, textAlign }}>{message}</Text>;
}
