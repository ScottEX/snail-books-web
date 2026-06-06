// ═══════════════════════════════════════════════════════════════
// i18nHelpers — translate raw DB enum values to current-language labels
// ═══════════════════════════════════════════════════════════════
//
// Why this exists:
//   Before this helper, several screens wrote t('goods') / t('procPurchase')
//   into DB and read raw strings back out, leaving three languages mixed
//   in the same column. The fix is two-sided:
//
//     1. Forms now store INTERNAL KEYS (see i18n.tsx for the canonical set):
//        expense cats: daily/rent/salary/goods/wages
//        income cats: dineIn/meituan/meituanTuan/jd
//        payment methods: payCash/payWechat/payAlipay
//        transaction type: income/expense
//
//     2. This helper translates ANY string — new internal key OR legacy
//        Chinese substring (with or without emoji prefix) — into the
//        current-language label. It also feeds the internal aggregation
//        logic in ExpenseScreen so daily/rent/salary/goods buckets still
//        work after the data has been migrated.
//
// Migration boundary:
//   - Until DB migration runs, both shapes coexist in production. The
//     helper normalizes both. After migration, only internal keys remain
//     and the legacy tables below become dead code (kept for one release
//     as a safety net).
// ═══════════════════════════════════════════════════════════════

import { t } from './i18n';

// All known category internal keys. Anything outside this set is treated
// as legacy (Chinese) data and normalized via LEGACY_CAT_TO_KEY.
const CAT_KEYS = new Set<string>([
  // expense
  'daily', 'rent', 'salary', 'goods', 'wages',
  // income
  'dineIn', 'meituan', 'meituanTuan', 'jd',
]);

const PAY_KEYS = new Set<string>(['payCash', 'payWechat', 'payAlipay']);

// Legacy Chinese (and a few EN/legacy Alipay) strings → internal key.
// The substring check handles emoji-prefixed values like '📦 原材料进货'.
// Order matters: more specific (longer) keys first to win substring matches.
const LEGACY_CAT_TO_KEY: Array<[string, string]> = [
  // income (long, distinctive substrings)
  ['美团团购', 'meituanTuan'],
  ['美团外卖', 'meituan'],
  // expense
  ['日常', 'daily'],
  ['房租', 'rent'],
  ['薪资', 'salary'],
  ['采购', 'goods'],
  ['堂食', 'dineIn'],
  ['京东', 'jd'],
];

const LEGACY_PAY_TO_KEY: Array<[string, string]> = [
  ['支付宝', 'payAlipay'],
  ['Alipay', 'payAlipay'],
  ['支付寶', 'payAlipay'],
  ['微信', 'payWechat'],
  ['现金', 'payCash'],
  ['現金', 'payCash'],
];

function normalizeCategory(raw: string): string {
  if (!raw) return raw;
  if (CAT_KEYS.has(raw)) return raw;
  if (LEGACY_CAT_TO_KEY.some(([legacy]) => raw === legacy)) {
    return LEGACY_CAT_TO_KEY.find(([legacy]) => raw === legacy)![1];
  }
  for (const [legacy, key] of LEGACY_CAT_TO_KEY) {
    if (raw.includes(legacy)) return key;
  }
  return raw;
}

function normalizePayment(raw: string): string {
  if (!raw) return raw;
  if (PAY_KEYS.has(raw)) return raw;
  if (LEGACY_PAY_TO_KEY.some(([legacy]) => raw === legacy)) {
    return LEGACY_PAY_TO_KEY.find(([legacy]) => raw === legacy)![1];
  }
  for (const [legacy, key] of LEGACY_PAY_TO_KEY) {
    if (raw.includes(legacy)) return key;
  }
  return raw;
}

/** Translate a raw category string to the current-language label.
 *  Accepts internal keys AND legacy Chinese (with/without emoji prefix). */
export function trCategory(raw: string): string {
  if (!raw) return raw;
  const key = normalizeCategory(raw);
  if (CAT_KEYS.has(key)) return t(key);
  return raw;
}

/** Translate a raw payment-method string to the current-language label. */
export function trPayment(raw: string): string {
  if (!raw) return raw;
  const key = normalizePayment(raw);
  if (PAY_KEYS.has(key)) return t(key);
  return raw;
}

/** Resolve a raw category to its internal key (for grouping/aggregation).
 *  Use this in logic, not display — for display, use trCategory. */
export function catKey(raw: string): string {
  return normalizeCategory(raw);
}

/** Resolve a raw payment method to its internal key. */
export function payKey(raw: string): string {
  return normalizePayment(raw);
}
