// ═══════════════════════════════════════════════════════════
// 项目计算全覆盖测试 · 东北虎
// ═══════════════════════════════════════════════════════════
// 测试策略：不 import 生产代码（避开 i18n/React 依赖），
// 直接复制函数源码到测试环境，独立跑。
// ═══════════════════════════════════════════════════════════

import { strict as assert } from 'assert';

// ═══ A. utils/numbers.ts 复现 ═══

export const blockNeg = (s: string) => s.replace(/[^0-9.]/g, '');

const stripLeadingZeros = (s: string) => s.replace(/^0+(?=\d)/, '');

export const fmtDecInput = (s: string) => {
  let clean = blockNeg(s);
  clean = stripLeadingZeros(clean);
  return clean.startsWith('.') ? '0' + clean : clean;
};

export const toDec2 = (v: any) => String((parseFloat(String(v ?? 0)) || 0).toFixed(2));

export const toDec2Comma = (v: any) => {
  const n = parseFloat(String(v ?? 0)) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ═══ A. utils/format.ts 复现（mock getLang） ═══

let _lang = 'zh';
const getLang = () => _lang;
const setLang = (l: string) => { _lang = l; };

export function fmtAmt(n: number): string {
  if (Math.abs(n) >= 10000) {
    if (getLang().startsWith('en')) return '¥' + (n / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'K';
    if (getLang().startsWith('zh-TW') || getLang().startsWith('zh-Hant')) return '¥' + (n / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '萬';
    return '¥' + (n / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '万';
  }
  return '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtAmtFull(n: number): string {
  return '¥' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const lang = getLang();
  if (lang.startsWith('en')) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[+m - 1]} ${+d}, ${y}`;
  }
  if (lang.startsWith('zh-TW') || lang.startsWith('zh-Hant')) return `${y}年${m}月${d}日`;
  return `${y}年${m}月${d}日`;
}

// ═══ B. ExpenseScreen 财务计算 复现（src/screens/ExpenseScreen.tsx L251-262）═══

// 源码：const channelTotal = toNum(dineIn) + toNum(meituan) + toNum(flashSale) + toNum(tuan) + toNum(jd);
const calcChannelTotal = (reconForm: { dineIn: string; meituan: string; flashSale: string; tuan: string; jd: string }) => {
  const toNum = (v: string) => parseFloat(String(v ?? 0)) || 0;
  return toNum(reconForm.dineIn) + toNum(reconForm.meituan) + toNum(reconForm.flashSale) + toNum(reconForm.tuan) + toNum(reconForm.jd);
};

// 源码：const realTotal = toNum(cardBalance) + toNum(cashBalance) + channelTotal;
const calcRealTotal = (reconForm: { cardBalance: string; cashBalance: string }) => {
  const toNum = (v: string) => parseFloat(String(v ?? 0)) || 0;
  return toNum(reconForm.cardBalance) + toNum(reconForm.cashBalance) + calcChannelTotal(reconForm);
};

// 源码：const diff = (businessSummary.cash_on_hand || 0) - realTotal;
const calcDiff = (businessSummary: { cash_on_hand?: number }, reconForm: any) => {
  return (businessSummary.cash_on_hand || 0) - calcRealTotal(reconForm);
};

// 源码：hasReconChanges 7 字段对比
const calcHasReconChanges = (reconForm: any, initReconValues: any) => {
  const toNum = (v: any) => parseFloat(String(v ?? 0)) || 0;
  return (
    toNum(reconForm.cardBalance) !== toNum(initReconValues.card) ||
    toNum(reconForm.cashBalance) !== toNum(initReconValues.cash) ||
    toNum(reconForm.dineIn) !== toNum(initReconValues.dine) ||
    toNum(reconForm.meituan) !== toNum(initReconValues.mt) ||
    toNum(reconForm.flashSale) !== toNum(initReconValues.fs) ||
    toNum(reconForm.jd) !== toNum(initReconValues.jd) ||
    toNum(reconForm.tuan) !== toNum(initReconValues.tuan)
  );
};

// ═══ C. useHomeData 图表聚合 复现（src/screens/home/useHomeData.ts L120-154）═══

const todayExpenseChart = (chartExpenses: any[], todayStr: string) =>
  chartExpenses.filter((e) => e.date === todayStr).reduce((s, e) => s + (e.amount || 0), 0);

const monthExpenseChart = (chartExpenses: any[], monthPrefix: string) =>
  chartExpenses.filter((e) => String(e.date || '').startsWith(monthPrefix)).reduce((s, e) => s + (e.amount || 0), 0);

const todayIncome = (dailyRevenues: any[], todayStr: string) =>
  dailyRevenues.filter((r) => r.date === todayStr).reduce((s, r) => s + (r.revenue || 0) + (r.jd_revenue || 0), 0);

const monthIncome = (dailyRevenues: any[]) =>
  dailyRevenues.reduce((s, r) => s + (r.revenue || 0) + (r.jd_revenue || 0), 0);

const dailyChartData = (dailyRevenues: any[], chartExpenses: any[], days: number = 12) => {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const income = dates.map((date) =>
    dailyRevenues.filter((r) => r.date === date).reduce((s, r) => s + (r.revenue || 0) + (r.jd_revenue || 0), 0)
  );
  const expense = dates.map((date) =>
    chartExpenses.filter((e) => e.date === date).reduce((s, e) => s + (e.amount || 0), 0)
  );
  return { dates, income, expense };
};

// ═══ D. ProcurementScreen 购物车 复现（src/screens/ProcurementScreen.tsx L618-624）═══

interface Product { id: number; name: string; spec: string; price: number; supplier: string; }
interface CartItem { product: Product; quantity: number; subtotal: number; }

const buildCartItems = (cart: Record<number, number>, products: Product[]) =>
  Object.entries(cart)
    .filter(([_, qty]) => qty > 0)
    .map(([pid, qty]) => {
      const product = products.find(p => p.id === Number(pid));
      if (!product) return null;
      return { product, quantity: qty, subtotal: product.price * qty };
    })
    .filter(Boolean) as CartItem[];

const cartTotal = (cartItems: CartItem[]) =>
  cartItems.reduce((s, c) => s + c.subtotal, 0);

const cartCount = (cartItems: CartItem[]) =>
  cartItems.reduce((s, c) => s + c.quantity, 0);

const parseStats = (s: any) => ({
  total_spent: Number(s?.total_spent) || 0,
  total_income: Number(s?.total_income) || 0,
  batch_count: Number(s?.batch_count) || 0,
  margin_pct: Number(s?.margin_pct) || 0,
});

const cartItemsTotal = (cartItems: CartItem[]) => cartItems.reduce((s, c) => s + c.subtotal, 0);

// ═══ 测试运行器 ═══

let pass = 0, fail = 0;
const tests: { name: string; fn: () => void }[] = [];

function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function approxEq(a: number, b: number, eps: number = 0.001) {
  return Math.abs(a - b) < eps;
}

function run() {
  for (const { name, fn } of tests) {
    try {
      fn();
      pass++;
      console.log(`✓ ${name}`);
    } catch (e: any) {
      fail++;
      console.log(`✗ ${name}`);
      console.log(`    ${e.message}`);
    }
  }
  console.log(`\n═══ ${pass} passed, ${fail} failed, ${tests.length} total ═══`);
  if (fail > 0) process.exit(1);
}

// ═══════════════════════════════════════════════════════════
// A.1  blockNeg
// ═══════════════════════════════════════════════════════════
test('A.1 blockNeg simple', () => assert.equal(blockNeg('abc'), ''));
test('A.1 blockNeg number', () => assert.equal(blockNeg('12.34'), '12.34'));
test('A.1 blockNeg mixed', () => assert.equal(blockNeg('12a3.4b'), '123.4'));
test('A.1 blockNeg negative', () => assert.equal(blockNeg('-12'), '12'));
test('A.1 blockNeg empty', () => assert.equal(blockNeg(''), ''));
test('A.1 blockNeg multiple dots', () => assert.equal(blockNeg('1.2.3'), '1.2.3'));

// ═══════════════════════════════════════════════════════════
// A.2  fmtDecInput
// ═══════════════════════════════════════════════════════════
test('A.2 fmtDecInput strip-leading-zero', () => assert.equal(fmtDecInput('0123'), '123'));
test('A.2 fmtDecInput leading-zero preserve 0', () => assert.equal(fmtDecInput('0'), '0'));
test('A.2 fmtDecInput decimal-leading-zero', () => assert.equal(fmtDecInput('0.5'), '0.5'));
test('A.2 fmtDecInput dot-prefix', () => assert.equal(fmtDecInput('.5'), '0.5'));
test('A.2 fmtDecInput neg', () => assert.equal(fmtDecInput('-1.5'), '1.5'));
test('A.2 fmtDecInput all-strip', () => assert.equal(fmtDecInput('abc'), ''));
test('A.2 fmtDecInput multiple-dots-preserve', () => assert.equal(fmtDecInput('1.2.3'), '1.2.3'));
test('A.2 fmtDecInput mixed', () => assert.equal(fmtDecInput('0a.5b'), '0.5'));

// ═══════════════════════════════════════════════════════════
// A.3  toDec2
// ═══════════════════════════════════════════════════════════
test('A.3 toDec2 123.456', () => assert.equal(toDec2(123.456), '123.46'));
test('A.3 toDec2 0', () => assert.equal(toDec2(0), '0.00'));
test('A.3 toDec2 null', () => assert.equal(toDec2(null), '0.00'));
test('A.3 toDec2 undefined', () => assert.equal(toDec2(undefined), '0.00'));
test('A.3 toDec2 string-num', () => assert.equal(toDec2('12.3'), '12.30'));
test('A.3 toDec2 invalid', () => assert.equal(toDec2('abc'), '0.00'));
test('A.3 toDec2 NaN', () => assert.equal(toDec2(NaN), '0.00'));

// ═══════════════════════════════════════════════════════════
// A.4  toDec2Comma
// ═══════════════════════════════════════════════════════════
test('A.4 toDec2Comma simple', () => assert.equal(toDec2Comma(1234.5), '1,234.50'));
test('A.4 toDec2Comma zero', () => assert.equal(toDec2Comma(0), '0.00'));
test('A.4 toDec2Comma big', () => assert.equal(toDec2Comma(1234567.89), '1,234,567.89'));
test('A.4 toDec2Comma 10k', () => assert.equal(toDec2Comma(10000), '10,000.00'));
test('A.4 toDec2Comma 100m', () => assert.equal(toDec2Comma(100000000), '100,000,000.00'));

// ═══════════════════════════════════════════════════════════
// A.5  fmtAmt (en)
// ═══════════════════════════════════════════════════════════
test('A.5 fmtAmt en small', () => { setLang('en'); assert.equal(fmtAmt(500), '¥500.00'); });
test('A.5 fmtAmt en 10k → K', () => { setLang('en'); assert.equal(fmtAmt(10000), '¥10.00K'); });
test('A.5 fmtAmt en 1m', () => { setLang('en'); assert.equal(fmtAmt(1000000), '¥1,000.00K'); });
test('A.5 fmtAmt en 9999', () => { setLang('en'); assert.equal(fmtAmt(9999), '¥9,999.00'); });
test('A.5 fmtAmt en negative small', () => { setLang('en'); assert.equal(fmtAmt(-500), '¥-500.00'); });
test('A.5 fmtAmt en negative 10k', () => { setLang('en'); assert.equal(fmtAmt(-10000), '¥-10.00K'); });
test('A.5 fmtAmt en zero', () => { setLang('en'); assert.equal(fmtAmt(0), '¥0.00'); });

// ═══════════════════════════════════════════════════════════
// A.6  fmtAmt (zh)
// ═══════════════════════════════════════════════════════════
test('A.6 fmtAmt zh small', () => { setLang('zh'); assert.equal(fmtAmt(500), '¥500.00'); });
test('A.6 fmtAmt zh 10k → 万', () => { setLang('zh'); assert.equal(fmtAmt(10000), '¥1.00万'); });
test('A.6 fmtAmt zh 1m', () => { setLang('zh'); assert.equal(fmtAmt(1000000), '¥100.00万'); });
test('A.6 fmtAmt zh 9999', () => { setLang('zh'); assert.equal(fmtAmt(9999), '¥9,999.00'); });
test('A.6 fmtAmt zh 100000000', () => { setLang('zh'); assert.equal(fmtAmt(100000000), '¥10,000.00万'); });
test('A.6 fmtAmt zh negative 10k', () => { setLang('zh'); assert.equal(fmtAmt(-10000), '¥-1.00万'); });

// ═══════════════════════════════════════════════════════════
// A.7  fmtAmt (zh-TW / zh-Hant)
// ═══════════════════════════════════════════════════════════
test('A.7 fmtAmt zh-TW 10k → 萬', () => { setLang('zh-TW'); assert.equal(fmtAmt(10000), '¥1.00萬'); });
test('A.7 fmtAmt zh-TW 1m', () => { setLang('zh-TW'); assert.equal(fmtAmt(1000000), '¥100.00萬'); });
test('A.7 fmtAmt zh-Hant 10k', () => { setLang('zh-Hant'); assert.equal(fmtAmt(10000), '¥1.00萬'); });

// ═══════════════════════════════════════════════════════════
// A.8  fmtAmtFull
// ═══════════════════════════════════════════════════════════
test('A.8 fmtAmtFull small', () => { setLang('zh'); assert.equal(fmtAmtFull(500), '¥500.00'); });
test('A.8 fmtAmtFull 10k', () => { setLang('zh'); assert.equal(fmtAmtFull(10000), '¥10,000.00'); });
test('A.8 fmtAmtFull big', () => { setLang('zh'); assert.equal(fmtAmtFull(1234567), '¥1,234,567.00'); });
test('A.8 fmtAmtFull negative', () => { setLang('zh'); assert.equal(fmtAmtFull(-100), '¥-100.00'); });

// ═══════════════════════════════════════════════════════════
// A.9  formatDate
// ═══════════════════════════════════════════════════════════
test('A.9 formatDate en', () => { setLang('en'); assert.equal(formatDate('2026-06-14'), 'Jun 14, 2026'); });
test('A.9 formatDate en Jan', () => { setLang('en'); assert.equal(formatDate('2026-01-05'), 'Jan 5, 2026'); });
test('A.9 formatDate en Dec', () => { setLang('en'); assert.equal(formatDate('2026-12-31'), 'Dec 31, 2026'); });
test('A.9 formatDate zh', () => { setLang('zh'); assert.equal(formatDate('2026-06-14'), '2026年06月14日'); });
test('A.9 formatDate zh day-pad', () => { setLang('zh'); assert.equal(formatDate('2026-06-05'), '2026年06月05日'); });
test('A.9 formatDate zh-TW', () => { setLang('zh-TW'); assert.equal(formatDate('2026-06-14'), '2026年06月14日'); });
test('A.9 formatDate empty', () => { setLang('en'); assert.equal(formatDate(''), ''); });
test('A.9 formatDate invalid', () => { setLang('en'); assert.equal(formatDate('not-a-date'), 'not-a-date'); });
test('A.9 formatDate slash', () => { setLang('en'); assert.equal(formatDate('2026/06/14'), '2026/06/14'); });

// ═══════════════════════════════════════════════════════════
// B.1  channelTotal
// ═══════════════════════════════════════════════════════════
test('B.1 channelTotal all-zero', () => assert.equal(calcChannelTotal({ dineIn: '', meituan: '', flashSale: '', tuan: '', jd: '' }), 0));
test('B.1 channelTotal sum', () => assert.equal(calcChannelTotal({ dineIn: '100', meituan: '200', flashSale: '300', tuan: '400', jd: '500' }), 1500));
test('B.1 channelTotal decimal', () => assert.equal(calcChannelTotal({ dineIn: '1.5', meituan: '2.5', flashSale: '0', tuan: '0', jd: '0' }), 4));
test('B.1 channelTotal negative-input', () => assert.equal(calcChannelTotal({ dineIn: '-10', meituan: '0', flashSale: '0', tuan: '0', jd: '0' }), -10));

// ═══════════════════════════════════════════════════════════
// B.2  realTotal = card + cash + channel
// ═══════════════════════════════════════════════════════════
test('B.2 realTotal all-zero', () => assert.equal(calcRealTotal({ cardBalance: '', cashBalance: '', dineIn: '', meituan: '', flashSale: '', tuan: '', jd: '' }), 0));
test('B.2 realTotal all-set', () => assert.equal(calcRealTotal({ cardBalance: '50000', cashBalance: '2000', dineIn: '600', meituan: '500', flashSale: '200', tuan: '50', jd: '100' }), 53450));
test('B.2 realTotal decimal', () => assert.equal(calcRealTotal({ cardBalance: '100.5', cashBalance: '50.25', dineIn: '10', meituan: '', flashSale: '', tuan: '', jd: '' }), 160.75));

// ═══════════════════════════════════════════════════════════
// B.3  diff = cash_on_hand - realTotal
// ═══════════════════════════════════════════════════════════
test('B.3 diff balanced (0)', () => {
  const rs = { cardBalance: '100', cashBalance: '0', dineIn: '0', meituan: '0', flashSale: '0', tuan: '0', jd: '0' };
  assert.equal(calcDiff({ cash_on_hand: 100 }, rs), 0);
});
test('B.3 diff positive (overage)', () => {
  const rs = { cardBalance: '50', cashBalance: '0', dineIn: '0', meituan: '0', flashSale: '0', tuan: '0', jd: '0' };
  assert.equal(calcDiff({ cash_on_hand: 100 }, rs), 50);
});
test('B.3 diff negative (shortage)', () => {
  const rs = { cardBalance: '200', cashBalance: '0', dineIn: '0', meituan: '0', flashSale: '0', tuan: '0', jd: '0' };
  assert.equal(calcDiff({ cash_on_hand: 100 }, rs), -100);
});
test('B.3 diff missing-cash-on-hand', () => {
  const rs = { cardBalance: '50', cashBalance: '0', dineIn: '0', meituan: '0', flashSale: '0', tuan: '0', jd: '0' };
  assert.equal(calcDiff({}, rs), -50);
});
test('B.3 diff undefined-cash-on-hand', () => {
  const rs = { cardBalance: '0', cashBalance: '0', dineIn: '0', meituan: '0', flashSale: '0', tuan: '0', jd: '0' };
  assert.equal(calcDiff({ cash_on_hand: undefined }, rs), 0);
});

// ═══════════════════════════════════════════════════════════
// B.4  hasReconChanges
// ═══════════════════════════════════════════════════════════
test('B.4 hasReconChanges none-changed', () => {
  const rf = { cardBalance: '100', cashBalance: '50', dineIn: '10', meituan: '20', flashSale: '30', jd: '40', tuan: '50' };
  const init = { card: '100', cash: '50', dine: '10', mt: '20', fs: '30', jd: '40', tuan: '50' };
  assert.equal(calcHasReconChanges(rf, init), false);
});
test('B.4 hasReconChanges cardBalance-changed', () => {
  const rf = { cardBalance: '101', cashBalance: '50', dineIn: '10', meituan: '20', flashSale: '30', jd: '40', tuan: '50' };
  const init = { card: '100', cash: '50', dine: '10', mt: '20', fs: '30', jd: '40', tuan: '50' };
  assert.equal(calcHasReconChanges(rf, init), true);
});
test('B.4 hasReconChanges meituan-changed', () => {
  const rf = { cardBalance: '100', cashBalance: '50', dineIn: '10', meituan: '21', flashSale: '30', jd: '40', tuan: '50' };
  const init = { card: '100', cash: '50', dine: '10', mt: '20', fs: '30', jd: '40', tuan: '50' };
  assert.equal(calcHasReconChanges(rf, init), true);
});
test('B.4 hasReconChanges decimal-precision', () => {
  // 100.00 vs 100 → parseFloat 都 = 100, 不算变化（设计如此）
  const rf = { cardBalance: '100.00', cashBalance: '50', dineIn: '10', meituan: '20', flashSale: '30', jd: '40', tuan: '50' };
  const init = { card: '100', cash: '50', dine: '10', mt: '20', fs: '30', jd: '40', tuan: '50' };
  assert.equal(calcHasReconChanges(rf, init), false);
});
test('B.4 hasReconChanges empty-vs-zero', () => {
  // '' parseFloat → NaN → || 0 = 0, vs '0' parseFloat → 0, 不算变化
  const rf = { cardBalance: '', cashBalance: '50', dineIn: '10', meituan: '20', flashSale: '30', jd: '40', tuan: '50' };
  const init = { card: '0', cash: '50', dine: '10', mt: '20', fs: '30', jd: '40', tuan: '50' };
  assert.equal(calcHasReconChanges(rf, init), false);
});
test('B.4 hasReconChanges string-vs-number', () => {
  // 字符串 '50' vs 数字 50 → toNum 都 50
  const rf = { cardBalance: '50', cashBalance: '50', dineIn: '10', meituan: '20', flashSale: '30', jd: '40', tuan: '50' };
  const init = { card: 50, cash: '50', dine: '10', mt: '20', fs: '30', jd: '40', tuan: '50' };
  assert.equal(calcHasReconChanges(rf, init), false);
});

// ═══════════════════════════════════════════════════════════
// C.1  todayExpenseChart
// ═══════════════════════════════════════════════════════════
test('C.1 todayExpenseChart empty', () => assert.equal(todayExpenseChart([], '2026-06-14'), 0));
test('C.1 todayExpenseChart no-match', () => assert.equal(todayExpenseChart([{ date: '2026-06-13', amount: 100 }], '2026-06-14'), 0));
test('C.1 todayExpenseChart single-match', () => assert.equal(todayExpenseChart([{ date: '2026-06-14', amount: 100 }], '2026-06-14'), 100));
test('C.1 todayExpenseChart multi-match', () => assert.equal(todayExpenseChart([
  { date: '2026-06-14', amount: 100 },
  { date: '2026-06-14', amount: 50 },
  { date: '2026-06-13', amount: 999 }
], '2026-06-14'), 150));
test('C.1 todayExpenseChart missing-amount', () => assert.equal(todayExpenseChart([{ date: '2026-06-14' }], '2026-06-14'), 0));

// ═══════════════════════════════════════════════════════════
// C.2  monthExpenseChart
// ═══════════════════════════════════════════════════════════
test('C.2 monthExpenseChart all-2026-06', () => assert.equal(monthExpenseChart([
  { date: '2026-06-01', amount: 100 },
  { date: '2026-06-15', amount: 200 },
  { date: '2026-06-30', amount: 50 }
], '2026-06'), 350));
test('C.2 monthExpenseChart cross-month', () => assert.equal(monthExpenseChart([
  { date: '2026-05-31', amount: 999 },
  { date: '2026-06-01', amount: 100 },
  { date: '2026-07-01', amount: 888 }
], '2026-06'), 100));
test('C.2 monthExpenseChart empty-month', () => assert.equal(monthExpenseChart([{ date: '2026-05-01', amount: 100 }], '2026-06'), 0));
test('C.2 monthExpenseChart missing-date', () => assert.equal(monthExpenseChart([{ amount: 100 }], '2026-06'), 0));

// ═══════════════════════════════════════════════════════════
// C.3  todayIncome — 注意 revenue + jd_revenue 双字段相加
// ═══════════════════════════════════════════════════════════
test('C.3 todayIncome revenue-only', () => assert.equal(todayIncome([{ date: '2026-06-14', revenue: 1000 }], '2026-06-14'), 1000));
test('C.3 todayIncome jd-only', () => assert.equal(todayIncome([{ date: '2026-06-14', jd_revenue: 500 }], '2026-06-14'), 500));
test('C.3 todayIncome both-fields', () => assert.equal(todayIncome([{ date: '2026-06-14', revenue: 1000, jd_revenue: 500 }], '2026-06-14'), 1500));
test('C.3 todayIncome multi-record', () => assert.equal(todayIncome([
  { date: '2026-06-14', revenue: 1000, jd_revenue: 200 },
  { date: '2026-06-14', revenue: 500, jd_revenue: 100 }
], '2026-06-14'), 1800));
test('C.3 todayIncome no-match', () => assert.equal(todayIncome([{ date: '2026-06-13', revenue: 999 }], '2026-06-14'), 0));

// ═══════════════════════════════════════════════════════════
// C.4  monthIncome
// ═══════════════════════════════════════════════════════════
test('C.4 monthIncome empty', () => assert.equal(monthIncome([]), 0));
test('C.4 monthIncome no-filter-all-included', () => assert.equal(monthIncome([
  { date: '2026-06-01', revenue: 1000, jd_revenue: 200 },
  { date: '2026-05-15', revenue: 500 }
]), 1700));
test('C.4 monthIncome missing-fields', () => assert.equal(monthIncome([
  { date: '2026-06-01' },
  { date: '2026-06-02', revenue: 100 }
]), 100));

// ═══════════════════════════════════════════════════════════
// C.5  dailyChartData — 12 天 daily income/expense
// ═══════════════════════════════════════════════════════════
test('C.5 dailyChartData length', () => {
  const r = dailyChartData([], [], 12);
  assert.equal(r.dates.length, 12);
  assert.equal(r.income.length, 12);
  assert.equal(r.expense.length, 12);
});
test('C.5 dailyChartData today-is-last', () => {
  const r = dailyChartData([], [], 12);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(r.dates[r.dates.length - 1], today);
});
test('C.5 dailyChartData 11-days-ago-is-first', () => {
  const r = dailyChartData([], [], 12);
  const d = new Date();
  d.setDate(d.getDate() - 11);
  const expected = d.toISOString().slice(0, 10);
  assert.equal(r.dates[0], expected);
});
test('C.5 dailyChartData sum-income-on-today', () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = dailyChartData([
    { date: today, revenue: 100, jd_revenue: 50 },
    { date: today, revenue: 200, jd_revenue: 0 }
  ], [], 12);
  assert.equal(r.income[r.income.length - 1], 350);
});
test('C.5 dailyChartData sum-expense-on-today', () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = dailyChartData([], [
    { date: today, amount: 80 },
    { date: today, amount: 120 }
  ], 12);
  assert.equal(r.expense[r.expense.length - 1], 200);
});

// ═══════════════════════════════════════════════════════════
// D.1  buildCartItems
// ═══════════════════════════════════════════════════════════
const products: Product[] = [
  { id: 1, name: '苹果', spec: '箱', price: 50, supplier: '果农A' },
  { id: 2, name: '鸡蛋', spec: '托', price: 30, supplier: '农贸B' },
  { id: 3, name: '牛奶', spec: '箱', price: 80, supplier: '奶场C' },
];

test('D.1 buildCartItems empty', () => assert.equal(buildCartItems({}, products).length, 0));
test('D.1 buildCartItems single-item', () => {
  const r = buildCartItems({ 1: 3 }, products);
  assert.equal(r.length, 1);
  assert.equal(r[0].product.name, '苹果');
  assert.equal(r[0].quantity, 3);
  assert.equal(r[0].subtotal, 150);  // 50 × 3
});
test('D.1 buildCartItems multi-item', () => {
  const r = buildCartItems({ 1: 3, 2: 5, 3: 1 }, products);
  assert.equal(r.length, 3);
  const subtotals = r.map(c => c.subtotal).sort((a, b) => a - b);
  assert.deepEqual(subtotals, [80, 150, 150]);  // 80*1, 50*3, 30*5 (sorted)
});
test('D.1 buildCartItems filter qty=0', () => {
  // 源码: filter(([_, qty]) => qty > 0) — 0 不算正数，过滤掉
  const r = buildCartItems({ 1: 0, 2: 5 }, products);
  assert.equal(r.length, 1);
  assert.equal(r[0].product.id, 2);
});
test('D.1 buildCartItems filter negative-qty', () => {
  const r = buildCartItems({ 1: -3, 2: 5 }, products);
  assert.equal(r.length, 1);
  assert.equal(r[0].product.id, 2);
});
test('D.1 buildCartItems missing-product', () => {
  // 源码: if (!product) return null — 过滤掉
  const r = buildCartItems({ 1: 3, 999: 5 }, products);
  assert.equal(r.length, 1);
  assert.equal(r[0].product.id, 1);
});
test('D.1 buildCartItems subtotal-decimal', () => {
  // 假设 product price 含小数
  const prods: Product[] = [{ id: 1, name: '小数商品', spec: '件', price: 9.99, supplier: 'X' }];
  const r = buildCartItems({ 1: 3 }, prods);
  assert.equal(r[0].subtotal, 29.97);
  // 重要：浮点精度
  assert.ok(Math.abs(r[0].subtotal - 29.97) < 0.001);
});
test('D.1 buildCartItems string-key', () => {
  // 源码: Number(pid) — 处理字符串 key
  const r = buildCartItems({ '1': 5 } as any, products);
  assert.equal(r.length, 1);
  assert.equal(r[0].product.id, 1);
  assert.equal(r[0].subtotal, 250);
});

// ═══════════════════════════════════════════════════════════
// D.2  cartTotal / cartCount
// ═══════════════════════════════════════════════════════════
test('D.2 cartTotal empty', () => assert.equal(cartTotal([]), 0));
test('D.2 cartTotal single', () => assert.equal(cartTotal([{ product: products[0], quantity: 3, subtotal: 150 }]), 150));
test('D.2 cartTotal multi', () => assert.equal(cartTotal([
  { product: products[0], quantity: 3, subtotal: 150 },
  { product: products[1], quantity: 5, subtotal: 150 },
  { product: products[2], quantity: 1, subtotal: 80 }
]), 380));
test('D.2 cartCount empty', () => assert.equal(cartCount([]), 0));
test('D.2 cartCount multi', () => assert.equal(cartCount([
  { product: products[0], quantity: 3, subtotal: 150 },
  { product: products[1], quantity: 5, subtotal: 150 }
]), 8));

// ═══════════════════════════════════════════════════════════
// D.3  parseStats
// ═══════════════════════════════════════════════════════════
test('D.3 parseStats normal', () => assert.deepEqual(parseStats({ total_spent: 100, total_income: 200, batch_count: 3, margin_pct: 50 }), { total_spent: 100, total_income: 200, batch_count: 3, margin_pct: 50 }));
test('D.3 parseStats null', () => assert.deepEqual(parseStats(null), { total_spent: 0, total_income: 0, batch_count: 0, margin_pct: 0 }));
test('D.3 parseStats undefined', () => assert.deepEqual(parseStats(undefined), { total_spent: 0, total_income: 0, batch_count: 0, margin_pct: 0 }));
test('D.3 parseStats string-numbers', () => assert.deepEqual(parseStats({ total_spent: '100', total_income: '200.5' }), { total_spent: 100, total_income: 200.5, batch_count: 0, margin_pct: 0 }));
test('D.3 parseStats NaN-fields', () => assert.deepEqual(parseStats({ total_spent: 'abc' }), { total_spent: 0, total_income: 0, batch_count: 0, margin_pct: 0 }));
test('D.3 parseStats empty-object', () => assert.deepEqual(parseStats({}), { total_spent: 0, total_income: 0, batch_count: 0, margin_pct: 0 }));

run();
