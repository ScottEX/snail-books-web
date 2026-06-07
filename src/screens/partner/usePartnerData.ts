import { useState, useEffect, useMemo } from 'react';
import { t, I18nKey } from '../../i18n';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';

// 合伙人持股/初始投资/姓名映射硬编码
export const partnerShare: Record<string, number> = { '张安武': 0.34, '江宽': 0.33, '蓝柳富': 0.33 };
export const initCapital: Record<string, number> = { '张安武': 44200, '江宽': 42900, '蓝柳富': 42900 };
export const initDate: Record<string, string> = { '张安武': '2024-04-01', '江宽': '2024-04-01', '蓝柳富': '2024-04-01' };
export const addDate: Record<string, string> = { '张安武': '2025-01-21', '江宽': '2025-01-21', '蓝柳富': '2025-01-21' };
const nameMap: Record<string, string> = { '张安武': 'nameZhang', '江宽': 'nameJiang', '蓝柳富': 'nameLan' };

export function translateName(name: string): string {
  const key = nameMap[name];
  return key ? t(key as I18nKey) : name;
}

export function translateDividendNote(note: string | null, date?: string): string {
  if (!note) return '';
  const m = note.match(/^(?:第(\d+)次分红|第(\d+)次)$/);
  if (m) {
    const n = m[1] || m[2];
    if (date) return t('dividendRoundFmt').replace('{n}', n).replace('{date}', formatDate(date));
    return t('dividendRoundOnly').replace('{n}', n);
  }
  const m2 = note.match(/^第(\d+)次分红 \((.+)\)$/);
  if (m2) return t('dividendRoundFmt').replace('{n}', m2[1]).replace('{date}', formatDate(m2[2]));
  return note;
}

export function getRoleKey(name: string): I18nKey {
  const map: Record<string, I18nKey> = { '张安武': 'chairman', '江宽': 'ceo', '蓝柳富': 'janitor' };
  return map[name] || 'janitor';
}

export function usePartnerData(setToast: (msg: string) => void) {
  const [partners, setPartners] = useState<any[]>([]);
  const [dividends, setDividends] = useState<any[]>([]);
  const [totalDiv, setTotalDiv] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const p = await api.getPartners();
      setPartners(p || []);
      const d = await api.getDividends();
      setDividends(d || []);
      setTotalDiv((d || []).reduce((s: number, x: any) => s + x.amount, 0));
    } catch { setToast(t('toastLoadFailed')); }
    setLoadingData(false);
  };

  useEffect(() => { loadData(); }, []);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    dividends.forEach((d: any) => {
      const n = d.note || '---';
      if (!g[n]) g[n] = [];
      g[n].push(d);
    });
    return g;
  }, [dividends]);

  const groupKeys = useMemo(() => Object.keys(grouped), [grouped]);

  const getPartnerHistory = (name: string) => {
    const history: { note: string; amount: number }[] = [];
    Object.entries(grouped).forEach(([note, items]) => {
      items.forEach((d: any) => {
        if (d.partner === name && d.amount > 0)
          history.push({ note: translateDividendNote(note, d.date), amount: d.amount });
      });
    });
    return history;
  };

  return {
    partners, dividends, totalDiv, loadingData, loadData,
    grouped, groupKeys, getPartnerHistory,
  };
}
