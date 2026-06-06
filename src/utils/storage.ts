/** Safe localStorage helpers — centralize user identity retrieval. */

/** Get current username from localStorage, with fallback. */
export function getCurrentUser(): string {
  try { return localStorage.getItem('user') || ''; } catch { return ''; }
}

/** Get current user ID from localStorage, or null. */
export function getCurrentUserId(): string | null {
  try { return localStorage.getItem('user_id'); } catch { return null; }
}
