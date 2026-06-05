import { getLang } from '../i18n';

/** Format amount with ¥ prefix, 万/萬/K for large numbers, 2 decimal places. */
export function fmtAmt(n: number): string {
  if (Math.abs(n) >= 10000) {
    const lang = getLang();
    if (lang.startsWith('en')) return '\u00A5' + (n / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'K';
    if (lang.startsWith('zh-TW') || lang.startsWith('zh-Hant')) return '\u00A5' + (n / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u842C';
    return '\u00A5' + (n / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u4E07';
  }
  return '\u00A5' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format amount with ¥ prefix, full digits + thousands separator, no 万/萬/K unit. */
export function fmtAmtFull(n: number): string {
  return '\u00A5' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format ISO date string (yyyy-mm-dd) to locale-aware display: en→"Jun 5, 2026", zh→"2026年06月05日" */
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
