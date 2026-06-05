import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api/client';
import { getCurrentUserId } from './utils/storage';
import { setLang } from './i18n';

// ═══════════════════════════════════════════
// 三方案主题色值定义
// ═══════════════════════════════════════════

export interface ThemeColors {
  /** 基础底色 */
  bg: string;
  /** 卡片/面板 */
  surface: string;
  /** 主色调/主按钮 */
  primary: string;
  /** 强调色/金额高亮 */
  accent: string;
  /** 次按钮/默认描边 */
  secondary: string;
  /** 主标题文字 */
  textMain: string;
  /** 副标题文字 */
  textSub: string;
  /** 成功 */
  success: string;
  /** 警告 */
  warning: string;
  /** 危险 */
  danger: string;
  /** 信息 */
  info: string;
}

export interface Theme {
  id: string;
  name: string;
  nameZh: string;
  nameTw: string;
  nameEn: string;
  description: string;
  descZh: string;
  descTw: string;
  descEn: string;
  colors: ThemeColors;
}

// ─── 方案一：勃艮第红与暖沙白 ───
const theme1: Theme = {
  id: 'burgundy-warm',
  name: 'Burgundy & Warm Sand',
  nameZh: '勃艮第红与暖沙白',
  nameTw: '勃艮第紅與暖沙白',
  nameEn: 'Burgundy & Warm Sand',
  description: '温润、沉稳、经典',
  descZh: '温润、沉稳、经典',
  descTw: '溫潤、沈穩、經典',
  descEn: 'Warm, Steady, Classic',
  colors: {
    bg: '#F9F7F4',
    surface: '#FFFFFF',
    primary: '#7D2329',
    accent: '#7D2329',
    secondary: '#EAE5E0',
    textMain: '#2C2626',
    textSub: '#8C8583',
    success: '#4C7A5D',
    warning: '#D59A53',
    danger: '#B34149',
    info: '#4A7299',
  },
};

// ─── 方案二：曜石黑与流沙金 ───
const theme2: Theme = {
  id: 'obsidian-gold',
  name: 'Obsidian & Gold',
  nameZh: '曜石黑与流沙金',
  nameTw: '曜石黑與流沙金',
  nameEn: 'Obsidian & Gold',
  description: '极简、冷峻、绝对专业',
  descZh: '极简、冷峻、绝对专业',
  descTw: '極簡、冷峻、絕對專業',
  descEn: 'Minimal, Crisp, Professional',
  colors: {
    bg: '#F3F4F6',
    surface: '#FFFFFF',
    primary: '#171A1F',
    accent: '#C5A880',
    secondary: '#E5E7EB',
    textMain: '#111827',
    textSub: '#6B7280',
    success: '#4C7A5D',
    warning: '#D59A53',
    danger: '#B34149',
    info: '#4A7299',
  },
};

// ─── 方案三：深空青与燕麦色 ───
const theme3: Theme = {
  id: 'deep-teal',
  name: 'Deep Teal & Oat',
  nameZh: '深空青与燕麦色',
  nameTw: '深空青與燕麥色',
  nameEn: 'Deep Teal & Oat',
  description: '现代、清新、克制',
  descZh: '现代、清新、克制',
  descTw: '現代、清新、克制',
  descEn: 'Modern, Fresh, Restrained',
  colors: {
    bg: '#F4F5F4',
    surface: '#FFFFFF',
    primary: '#2A4B4B',
    accent: '#2A4B4B',
    secondary: '#E1E5E4',
    textMain: '#1B2626',
    textSub: '#738080',
    success: '#4C7A5D',
    warning: '#D59A53',
    danger: '#B34149',
    info: '#4A7299',
  },
};

export const THEMES: Record<string, Theme> = {
  'burgundy-warm': theme1,
  'obsidian-gold': theme2,
  'deep-teal': theme3,
};

export const DEFAULT_THEME_ID = 'burgundy-warm';
export const THEME_STORAGE_KEY = 'snail-books-theme';

function getThemeKey(): string {
  try {
    const uid = getCurrentUserId();
    return uid ? `snail-books-theme-${uid}` : 'snail-books-theme';
  } catch { return 'snail-books-theme'; }
}

/**
 * Convert hex color to rgba string.
 * Example: withAlpha('#7D2329', 0.5) → 'rgba(125,35,41,0.5)'
 */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════
// 排版变量（所有主题通用，不随主题切换）
// ═══════════════════════════════════════════

export interface FontToken {
  size: number;
  weight: '300' | '400' | '500' | '600' | '700' | '800';
  color: 'textMain' | 'textSub';
}

export const FONTS = {
  h1:       { size: 24, weight: '600' as const, color: 'textMain' as const },
  h2:       { size: 18, weight: '700' as const, color: 'textMain' as const },
  body:     { size: 16, weight: '500' as const, color: 'textMain' as const },
  sub:      { size: 14, weight: '500' as const, color: 'textSub'  as const },
  subBold:  { size: 14, weight: '700' as const, color: 'textSub'  as const },
  micro:    { size: 12, weight: '500' as const, color: 'textSub'  as const },
  microBold:{ size: 12, weight: '700' as const, color: 'textSub'  as const },
  amount:   { size: 24, weight: '700' as const, color: 'textMain' as const },
} as const;

// ═══════════════════════════════════════════
// ThemeContext
// ═══════════════════════════════════════════

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  setTheme: (themeId: string) => void;
  allThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: theme1,
  colors: theme1.colors,
  setTheme: () => {},
  allThemes: Object.values(THEMES),
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(getThemeKey());
      if (stored && THEMES[stored]) return THEMES[stored];
    } catch {}
    return theme1;
  });

  const setTheme = useCallback((themeId: string) => {
    const t = THEMES[themeId];
    if (!t) return;
    setThemeState(t);
    try { localStorage.setItem(getThemeKey(), themeId); } catch {}
    // Fire-and-forget sync to server (don't block UI)
    api.saveTheme(themeId).catch(() => {});
  }, []);

  // On mount, pull theme AND language from server (per-user). If not
  // logged in yet, keep localStorage value. The mount listener fires
  // every time App.tsx bumps appKey (i.e. on every login / logout /
  // session-kicked), so the subtree always reflects the current
  // user's server-side preferences.
  useEffect(() => {
    // CRITICAL: short-circuit when there is no user. Otherwise this
    // useEffect would call api.getLang() / api.getTheme() with no
    // session, hit 401, and the 401 handler would dispatch
    // 'app:user-change' again, which would bump appKey and re-mount
    // us — creating the infinite-remount loop that made the login
    // screen flicker. By returning early here, the 401 still clears
    // the user (and the SessionKickedModal still shows) but no extra
    // remount is triggered.
    if (typeof localStorage === 'undefined' || !localStorage.getItem('user')) {
      return;
    }
    let cancelled = false;
    api.getTheme().then(resp => {
      if (cancelled) return;
      const serverThemeId = (resp as any)?.theme;
      if (serverThemeId && THEMES[serverThemeId]) {
        setThemeState(THEMES[serverThemeId]);
        try { localStorage.setItem(getThemeKey(), serverThemeId); } catch {}
      }
    }).catch(() => {
      // Not logged in or network error — keep current (localStorage) theme
    });
    // Pull language so a new user signing in sees THEIR preferred
    // language, not the previous user's localStorage value. i18n's
    // setLang() writes the curLang global + localStorage; React
    // child components mounted after this point will useState
    // (getLang()) and read the updated value.
    api.getLang().then((resp: any) => {
      if (cancelled) return;
      const serverLang = resp?.lang;
      // setLang is from i18n.ts — writes curLang + localStorage and
      // also fires a fire-and-forget PUT (no-op since we just pulled
      // the same value). i18n's setLang() validates the key against
      // its own I18N map and silently rejects unknown languages.
      // CurLang is consumed by t() at render time, so as long as
      // child components re-mount after this (which they do, because
      // appKey bumped in App.tsx), they'll see the new language.
      if (serverLang) setLang(serverLang);
    }).catch(() => {
      // Not logged in or network error — keep current (localStorage) lang
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, colors: theme.colors, setTheme, allThemes: Object.values(THEMES) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
