import { getLang } from '../i18n';

// ── Session-kicked event bus ──
// The api layer is not a React component, so it cannot render a modal directly.
// Expose a tiny pub/sub so SessionKickedModal (mounted at App level) can subscribe.
type SessionKickedListener = () => void;
const _sessionKickedListeners = new Set<SessionKickedListener>();
export function onSessionKicked(fn: SessionKickedListener): () => void {
  _sessionKickedListeners.add(fn);
  return () => { _sessionKickedListeners.delete(fn); };
}
function _emitSessionKicked() {
  _sessionKickedListeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

function getApiBase(): string {
  // Allow override via localStorage for development/testing
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('api_base');
    if (saved) return saved;
  }
  // Production: use relative URLs (same origin, auto HTTPS)
  return '';
}

const API_BASE = getApiBase();

// Session expiration: 100% backend-driven. When user_sessions.expires_at passes
// (or session_id gets revoked by another device via SSO), the next API call
// returns 401 and authFetch below redirects to /login. No frontend timer needed.

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'X-Lang': getLang(),
  };
  // Only set Content-Type for requests with a body (FormData sets its own)
  return h;
}

async function authFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const mergedHeaders: Record<string, string> = {
    ...headers(),
    ...(options?.headers as Record<string, string> || {}),
  };
  // Auto-set Content-Type: application/json for requests with a JSON body
  if (options?.body && typeof options.body === 'string' && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }
  const resp = await fetch(API_BASE + url, {
    ...options,
    headers: mergedHeaders,
  });
  if (resp.status === 401) {
    // Try to read body to detect specific kick reason before clearing state
    let kickCode: string | null = null;
    let kickMsg: string | null = null;
    try {
      const body = await resp.clone().json();
      if (body?.code) kickCode = body.code;
      if (body?.message) kickMsg = body.message;
    } catch {}
    localStorage.removeItem('user');
    // Notify App.tsx that the user was cleared so it can re-evaluate page
    // state (login vs home) without a hard reload. App.tsx is a pure SPA
    // with no router, so URL changes alone don't re-render anything.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('app:user-change'));
    }
    // If kicked by another device, let SessionKickedModal handle the UI.
    // The modal's confirm/close button will redirect to /login — we intentionally
    // do NOT redirect here so the user actually sees the modal.
    if (kickCode === 'session_kicked') {
      _emitSessionKicked();
    } else if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
    return Promise.reject(new Error(kickMsg || 'Unauthorized'));
  }
  if (!resp.ok) {
    let msg = `API error: ${resp.status} ${resp.statusText}`;
    try {
      const body = await resp.json();
      if (body.message) msg = body.message;
    } catch {}
    throw new Error(msg);
  }
  return resp.json();
}

export const api = {
  login: (username: string, password: string, remember = false) => {
    return fetch(API_BASE + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
      body: JSON.stringify({ username, password, remember }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Login failed (${r.status})`);
      return data;
    });
  },

  register: (username: string, password: string, email: string) =>
    fetch(API_BASE + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
      body: JSON.stringify({ username, password, email }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Register failed (${r.status})`);
      return data;
    }),

  verify: (email: string, code: string) =>
    fetch(API_BASE + '/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
      body: JSON.stringify({ email, code }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Verify failed (${r.status})`);
      return data;
    }),

  resendCode: (email: string) =>
    fetch(API_BASE + '/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
      body: JSON.stringify({ email }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Resend failed (${r.status})`);
      return data;
    }),

  forgotPassword: (email: string) =>
    fetch(API_BASE + '/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
      body: JSON.stringify({ email }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Request failed (${r.status})`);
      return data;
    }),

  resetPassword: (email: string, code: string, password: string) =>
    fetch(API_BASE + '/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lang': getLang() },
      body: JSON.stringify({ email, code, password }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `Reset failed (${r.status})`);
      return data;
    }),

  getSummary: () => authFetch('/api/summary'),
  getTransactions: (page = 1, perPage = 10, filters?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('per_page', String(perPage));
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    }
    return authFetch(`/api/transactions?${params}`);
  },
  createTransaction: (data: any) => authFetch('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => authFetch(`/api/transactions/${id}`, { method: 'DELETE' }),

  // Expense image upload — returns { images: [...], thumb_images: [...], has_thumbs: bool }
  uploadExpenseImages: async (files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const resp = await fetch(API_BASE + '/api/expenses/upload-images', {
      method: 'POST',
      headers: headers(),  // Use shared headers() for consistency
      body: form,
      credentials: 'same-origin' as RequestCredentials,
    });
    if (resp.status === 401) {
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }
    if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
    const data = await resp.json();
    return data as { status: 'ok'; images: string[]; thumb_images: string[]; has_thumbs: boolean };
  },

  getPartners: () => authFetch('/api/partners'),
  getDividends: () => authFetch('/api/dividends'),
  createDividend: (data: any) => authFetch('/api/dividends', { method: 'POST', body: JSON.stringify(data) }),
  deleteDividend: (id: number) => authFetch(`/api/dividends/${id}`, { method: 'DELETE' }),
  deleteDividendByNote: (note: string) => authFetch('/api/dividends/delete', { method: 'POST', body: JSON.stringify({ note }) }),

  // Background image
  getBackground: () => authFetch('/api/settings/background'),
  uploadBackground: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(API_BASE + '/api/settings/background', {
      method: 'POST',
      headers: { 'X-Lang': getLang() },
      body: form,
    });
    if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
    return resp.json();
  },
  resetBackground: () => authFetch('/api/settings/background', { method: 'DELETE' }),
  saveBackgroundSettings: (data: any) => authFetch('/api/settings/background', { method: 'PUT', body: JSON.stringify(data) }),

  // Avatar
  uploadAvatar: async (form: FormData) => {
    const resp = await fetch(API_BASE + '/api/users/avatar', {
      method: 'POST',
      headers: headers(),
      body: form,
      credentials: 'same-origin' as RequestCredentials,
    });
    if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
    return resp.json();
  },

  // Profile cover
  getProfileCover: () => authFetch('/api/profile/cover'),
  uploadProfileCover: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(API_BASE + '/api/profile/cover', {
      method: 'POST',
      headers: { 'X-Lang': getLang() },
      body: form,
    });
    if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
    return resp.json();
  },
  resetProfileCover: () => authFetch('/api/profile/cover', { method: 'DELETE' }),

  // Signature
  saveSignature: (signature: string) =>
    authFetch('/api/users/signature', { method: 'POST', body: JSON.stringify({ signature }) }),

  // Profile settings
  changePassword: (old_password: string, new_password: string) =>
    authFetch('/api/profile/password', { method: 'POST', body: JSON.stringify({ old_password, new_password }) }),
  sendEmailCode: (email: string) =>
    authFetch('/api/profile/email/send-code', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmailCode: (email: string, code: string) =>
    authFetch('/api/profile/email/verify', { method: 'POST', body: JSON.stringify({ email, code }) }),

  // Auth preferences (single-device login + session timeout)
  getAuthPrefs: () => authFetch('/api/users/me/auth-prefs'),
  updateAuthPrefs: (data: { enforce_single_session?: number; session_timeout_hours?: number }) =>
    authFetch('/api/users/me/auth-prefs', { method: 'PATCH', body: JSON.stringify(data) }),

  // Language preference (stored per-user in user_settings)
  getLang: () => authFetch('/api/settings/lang'),
  saveLang: (lang: string) => authFetch('/api/settings/lang', { method: 'PUT', body: JSON.stringify({ lang }) }),

  // Theme preference (stored per-user in user_settings)
  getTheme: () => authFetch('/api/settings/theme'),
  saveTheme: (theme: string) => authFetch('/api/settings/theme', { method: 'PUT', body: JSON.stringify({ theme }) }),

  getProducts: () => authFetch('/api/products'),
  createProduct: (data: any) => authFetch('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (data: any) => authFetch('/api/products', { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) => authFetch(`/api/products?id=${id}`, { method: 'DELETE' }),

  createReconciliation: (data: any) => authFetch('/api/reconciliations', { method: 'POST', body: JSON.stringify(data) }),
  getReconciliations: (limit = 30, filters?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    }
    return authFetch(`/api/reconciliations?${params}`);
  },

  // Paginated reconciliation query — returns { records, total, pages, page, per_page }
  getReconciliationsPage: (page = 1, perPage = 10, filters?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('per_page', String(perPage));
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });
    }
    return authFetch(`/api/reconciliations?${params}`);
  },

  getUsers: () => authFetch('/api/users'),

  // Platform fees
  getPlatformFees: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    const qs = params.toString();
    return authFetch('/api/platform-fees' + (qs ? '?' + qs : ''));
  },
  addPlatformFeeEntry: (data: any) => authFetch('/api/platform-fees/entry', { method: 'POST', body: JSON.stringify(data) }),
  updatePlatformFee: (id: number, data: any) => authFetch(`/api/platform-fees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Procurement batches (进货批次)
  getProcurementBatches: (page = 1, perPage = 10) => authFetch(`/api/procurement-batches?page=${page}&per_page=${perPage}`),
  createProcurementBatch: (data: any) => authFetch('/api/procurement-batches', { method: 'POST', body: JSON.stringify(data) }),
  getProcurementBatchDetail: (id: number) => authFetch(`/api/procurement-batches/${id}`),
  updateProcurementBatch: (id: number, data: any) => authFetch(`/api/procurement-batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProcurementBatch: (id: number) => authFetch(`/api/procurement-batches/${id}`, { method: 'DELETE' }),
  getProcurementStats: () => authFetch('/api/procurement-stats'),
  getProcurementShareLink: (id: number): Promise<{ url: string }> => authFetch(`/api/procurement-batches/${id}/share-link`),
  // Shared cart
  getCart: () => authFetch('/api/procurement-cart'),
  addToCart: (product_id: number, quantity: number) => authFetch('/api/procurement-cart', { method: 'POST', body: JSON.stringify({ product_id, quantity }) }),
  removeFromCart: (product_id: number) => authFetch(`/api/procurement-cart/${product_id}`, { method: 'DELETE' }),
  clearCart: () => authFetch('/api/procurement-cart', { method: 'DELETE' }),

  // Daily revenue (每日营收)
  getDailyRevenue: (page = 1, perPage = 30, year?: number, month?: number, date?: string, days?: number, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('per_page', String(perPage));
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    if (date) params.append('date', date);
    if (days) params.append('days', String(days));
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    const qs = params.toString();
    return authFetch('/api/daily-revenue?' + qs);
  },
  createDailyRevenue: (data: any) => authFetch('/api/daily-revenue', { method: 'POST', body: JSON.stringify(data) }),
  updateDailyRevenue: (id: number, data: any) => authFetch(`/api/daily-revenue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDailyRevenue: (id: number) => authFetch(`/api/daily-revenue/${id}`, { method: 'DELETE' }),
  getLast7Days: () => authFetch('/api/daily-revenue/last-7'),
  getDailyRevenueTotal: () => authFetch('/api/daily-revenue/total'),
  getBusinessSummary: () => authFetch('/api/business-summary'),

  getChart: () => authFetch('/api/chart'),
  getChartMonthly: () => authFetch('/api/chart/monthly'),
  getStats: () => authFetch('/api/stats'),

  // Use authFetch so 401 (session already expired / revoked) routes through the
  // same handler as other API calls: clear localStorage + redirect to /login.
  // Bare fetch would call .then() on 4xx and silently clear localStorage without
  // a redirect, leaving the user on a page that can't fetch anything.
  logout: () => authFetch('/logout', { method: 'POST' }).then(() => { localStorage.removeItem('user'); }),
};
