/** 邮箱格式正则 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 校验邮箱格式，非法返回错误提示 key（无 t）或翻译后文本（有 t），合法返回 null */
export function validateEmail(email: string, t?: (key: string) => string): string | null {
  if (!email) return null;
  const key = EMAIL_RE.test(email) ? null : 'errEmailInvalid';
  return key && t ? t(key) : key;
}

/** 手机号格式正则 — 允许国际号码：+国家码 + 7-20位数字，允许空格/横线 */
export const PHONE_RE = /^\+?[\d\s\-]{7,20}$/;

/** 校验手机号格式，非法返回错误提示 key（无 t）或翻译后文本（有 t），合法返回 null */
export function validatePhone(phone: string, t?: (key: string) => string): string | null {
  if (!phone) return null;
  const key = PHONE_RE.test(phone) ? null : 'errPhoneInvalid';
  return key && t ? t(key) : key;
}
