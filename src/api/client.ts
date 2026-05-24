import { getLang } from '../i18n';

const API_BASE = '';

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
  return resp.json();
}

export const api = {
  login: (username: string, password: string) =>
    fetch(API_BASE + '/login', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username, password }),
    }).then((r) => r.json()),

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
  getTransactions: (page = 1) => authFetch(`/api/transactions?page=${page}`),
  createTransaction: (data: any) => authFetch('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => authFetch(`/api/transactions/${id}`, { method: 'DELETE' }),

  getPartners: () => authFetch('/api/partners'),
  getDividends: () => authFetch('/api/dividends'),
  createDividend: (data: any) => authFetch('/api/dividends', { method: 'POST', body: JSON.stringify(data) }),
  deleteDividend: (id: number) => authFetch(`/api/dividends/${id}`, { method: 'DELETE' }),
  deleteDividendByNote: (note: string) => authFetch('/api/dividends/delete', { method: 'POST', body: JSON.stringify({ note }) }),

  getProducts: () => authFetch('/api/products'),
  createProduct: (data: any) => authFetch('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (data: any) => authFetch('/api/products', { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) => authFetch(`/api/products?id=${id}`, { method: 'DELETE' }),

  getProcurements: () => authFetch('/api/procurements'),
  createProcurement: (data: any) => authFetch('/api/procurements', { method: 'POST', body: JSON.stringify(data) }),
  deleteProcurement: (id: number) => authFetch(`/api/procurements/${id}`, { method: 'DELETE' }),

  getChart: () => authFetch('/api/chart'),
  getStats: () => authFetch('/api/stats'),

  logout: () => fetch(API_BASE + '/logout').then(() => { localStorage.removeItem('user'); }),
};
