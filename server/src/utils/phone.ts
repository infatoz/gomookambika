/**
 * Phone number normalization utility for Indian phone numbers (+91)
 */
export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length > 10) {
    return `+91${digits.slice(-10)}`;
  }
  return trimmed.startsWith('+') ? trimmed : `+91${digits}`;
}
