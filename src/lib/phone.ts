/**
 * Bangladeshi mobile numbers. Accepts 01XXXXXXXXX, +8801XXXXXXXXX and 8801XXXXXXXXX.
 * Returns the number as 01XXXXXXXXX, or null when it is not a valid mobile number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, "");
  const m = digits.match(/^(?:\+?88)?(01\d{9})$/);
  return m ? m[1] : null;
}
