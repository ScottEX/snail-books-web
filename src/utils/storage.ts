/** Safe localStorage helpers — centralize user identity retrieval. */

/** Get current username from localStorage, with fallback. */
export function getCurrentUser(): string {
  try { return localStorage.getItem('user') || ''; } catch { return ''; }
}

/** Get current user ID from localStorage, or null. */
export function getCurrentUserId(): string | null {
  try { return localStorage.getItem('user_id'); } catch { return null; }
}

/** Get the login-to-now day count (for stamp display). */
export function getDaysSinceCreated(): number {
  try {
    const uid = localStorage.getItem('user_id');
    const key = uid ? `created-${uid}` : 'created';
    const ts = localStorage.getItem(key);
    if (ts) {
      const days = Math.floor((Date.now() - parseInt(ts)) / 86400000);
      return Math.max(0, days);
    }
  } catch {}
  return 0;
}
