/** Strip everything except digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Format as XXX-XXX-XXXX while typing (US 10-digit numbers). */
export function formatPhoneInput(value: string): string {
  const digits = digitsOnly(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Format stored phone values for display; passes through non-US lengths unchanged. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = digitsOnly(phone);
  if (digits.length === 10) return formatPhoneInput(digits);
  if (digits.length === 11 && digits.startsWith("1")) {
    return formatPhoneInput(digits.slice(1));
  }
  return phone;
}
