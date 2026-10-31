/**
 * How a member can be reached. People who sign up with a mobile number get a
 * placeholder address (98…@mobile.theainf.in) that receives nothing, so the
 * portal shows and uses their phone instead. No server imports: the admin
 * components use this too.
 */

const MOBILE_ACCOUNT_EMAIL = /@mobile\.theainf\.in$/i;

export function isMobileAccountEmail(email: string): boolean {
  return MOBILE_ACCOUNT_EMAIL.test(email.trim());
}

/** "+91 9876543210" for Indian numbers stored with or without the code; other numbers as stored. */
export function displayPhone(phone: string | null | undefined): string | null {
  const raw = phone?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 10 ? digits : null;
  return local ? `+91 ${local}` : raw;
}

/** What to print under a member's name: their email, or their mobile for mobile sign-ups. */
export function contactLine(user: { email: string; phone: string | null }): string {
  if (!isMobileAccountEmail(user.email)) return user.email;
  return displayPhone(user.phone) ?? `+91 ${user.email.split("@")[0]}`;
}

/** wa.me link for an Indian mobile (or a full international number); null when there is no usable number. */
export function whatsappHref(phone: string | null | undefined, text: string): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  let number: string | null = null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) number = `91${digits}`;
  else if (digits.length === 12 && digits.startsWith("91")) number = digits;
  else if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) number = digits;
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** tel: link, or null. */
export function telHref(phone: string | null | undefined): string | null {
  const shown = displayPhone(phone);
  return shown ? `tel:${shown.replace(/\s+/g, "")}` : null;
}
