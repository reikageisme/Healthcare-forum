/**
 * Pydantic serialises timezone-aware datetimes with an explicit +00:00
 * offset. JSON.stringify(Date) would emit a Z suffix instead. Both parse
 * identically in the browser, but keeping the exact shape means the golden
 * snapshots taken from the Python API compare byte for byte.
 */
export function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('Z', '+00:00');
}

export function toIsoRequired(value: Date | string): string {
  return toIso(value) ?? new Date(0).toISOString().replace('Z', '+00:00');
}

/** YYYY-MM-DD in UTC — the key format used by the admin time series. */
export function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}
