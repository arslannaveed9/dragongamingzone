export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Keep a leading plus and digits. Spaces and dashes are removed. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Old software ids are full UUIDs. Show the first 8 characters; new GZ- numbers stay as they are. */
export function displayBookingNumber(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value.slice(0, 8);
  return value;
}
