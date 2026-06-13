import { useState, useCallback } from 'react';

/**
 * Simple boolean toggle — replaces useState(false) + setX(true) / setX(false)
 * scattered across ExpenseScreen, ProfileScreen, and ProcurementScreen.
 */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    show: useCallback(() => setOpen(true), []),
    hide: useCallback(() => setOpen(false), []),
    toggle: useCallback(() => setOpen(o => !o), []),
  };
}
