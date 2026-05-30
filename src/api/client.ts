import { getLang } from '../i18n';

function getApiBase(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('api_base');
    if (saved) return saved;
  }
  if (
    typeof window !== 'undefined' &&
    ((window as any).Capacitor || navigator.userAgent.indexOf('Capacitor') !== -1)
  ) {
    return 'http://8.135.58.90:8600';
  }
  return '';
}

const API_BASE = getApiBase();

// ── Idle timeout: 2 hours no API call → redirect to login ──
const IDLE_MS = 120 * 60_000; // 120 minutes = 2 hours
let lastActivity = Date.now();

setInterval(() => {
  if (Date.now() - lastActivity > IDLE_MS) {
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
}, 10_000); // check every 10s

function bumpActivity() {
  lastActivity = Date.now();
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Lang': getLang(),
  };
}

async function authFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(API_BASE + url, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (resp.status === 401) {
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  bumpActivity();
  return resp.json();
}

export const api = {
  login: (username: string, password: string, remember = false) => {
    bumpActivity(); // login also counts as activity
    return fetch(API_BASE + '/login', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username, password, remember }),
    }).then((r) => r.json());
  },

  register: (username: string, password: string, email: string) =>
    fetch(API_BASE + '/register', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username, password, email }),
    }).then((r) => r.json()),

  verify: (email: string, code: string) =>
    fetch(API_BASE + '/verify', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, code }),
    }).then((r) => r.json()),

  resendCode: (email: string) =>
    fetch(API_BASE + '/resend-code', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email }),
    }).then((r) => r.json()),

  forgotPassword: (email: string) =>
    fetch(API_BASE + '/forgot-password', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email }),
    }).then((r) => r.json()),

  resetPassword: (email: string, code: string, password: string) =>
    fetch(API_BASE + '/reset-password', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, code, password }),
    }).then((r) => r.json()),

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

  // Expense image upload — returns { images: ['/expense-imgs/4/abc.jpg', ...] }
  uploadExpenseImages: async (files: File[]) => {
    bumpActivity();
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const resp = await fetch('/api/expenses/upload-images', {
      method: 'POST',
      headers: { 'X-Lang': getLang() },
      body: form,
    });
    return resp.json();
  },

  getPartners: () => authFetch('/api/partners'),
  getDividends: () => authFetch('/api/dividends'),
  createDividend: (data: any) => authFetch('/api/dividends', { method: 'POST', body: JSON.stringify(data) }),
  deleteDividend: (id: number) => authFetch(`/api/dividends/${id}`, { method: 'DELETE' }),
  deleteDividendByNote: (note: string) => authFetch('/api/dividends/delete', { method: 'POST', body: JSON.stringify({ note }) }),

  // Background image
  getBackground: () => authFetch('/api/settings/background'),
  uploadBackground: async (file: File) => {
    bumpActivity();
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch('/api/settings/background', {
      method: 'POST',
      headers: { 'X-Lang': getLang() },
      body: form,
    });
    return resp.json();
  },
  resetBackground: () => authFetch('/api/settings/background', { method: 'DELETE' }),
  saveBackgroundSettings: (data: any) => authFetch('/api/settings/background', { method: 'PUT', body: JSON.stringify(data) }),

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

  getProcurements: () => authFetch('/api/procurements'),
  createProcurement: (data: any) => authFetch('/api/procurements', { method: 'POST', body: JSON.stringify(data) }),
  deleteProcurement: (id: number) => authFetch(`/api/procurements/${id}`, { method: 'DELETE' }),

  // Procurement batches (进货批次)
  getProcurementBatches: (page = 1, perPage = 10) => authFetch(`/api/procurement-batches?page=${page}&per_page=${perPage}`),
  createProcurementBatch: (data: any) => authFetch('/api/procurement-batches', { method: 'POST', body: JSON.stringify(data) }),
  getProcurementBatchDetail: (id: number) => authFetch(`/api/procurement-batches/${id}`),
  getProcurementStats: () => authFetch('/api/procurement-stats'),

  // Daily revenue (每日营收)
  getDailyRevenue: (page = 1, perPage = 30, year?: number, month?: number, date?: string, days?: number) => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('per_page', String(perPage));
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    if (date) params.append('date', date);
    if (days) params.append('days', String(days));
    const qs = params.toString();
    return authFetch('/api/daily-revenue?' + qs);
  },
  createDailyRevenue: (data: any) => authFetch('/api/daily-revenue', { method: 'POST', body: JSON.stringify(data) }),
  updateDailyRevenue: (id: number, data: any) => authFetch(`/api/daily-revenue/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDailyRevenue: (id: number) => authFetch(`/api/daily-revenue/${id}`, { method: 'DELETE' }),
  getLast7Days: () => authFetch('/api/daily-revenue/last-7'),

  getChart: () => authFetch('/api/chart'),
  getStats: () => authFetch('/api/stats'),

  logout: () => fetch(API_BASE + '/logout').then(() => { localStorage.removeItem('user'); }),
};
