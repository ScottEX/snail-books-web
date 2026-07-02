/** 邮箱格式正则 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 校验邮箱格式，非法返回错误提示 key，合法返回 null */
export function validateEmail(email: string): string | null {
  if (!email) return null;
  return EMAIL_RE.test(email) ? null : 'errEmailInvalid';
}
