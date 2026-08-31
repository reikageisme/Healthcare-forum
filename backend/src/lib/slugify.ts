/**
 * Stands in for python-slugify. Unicode NFD decomposition strips the tone
 * and vowel marks Vietnamese uses, but đ/Đ have no decomposition of their
 * own and have to be mapped explicitly — without that, "đau dạ dày" would
 * slug as "au-da-day".
 *
 * Kept as a few lines rather than a dependency; the alphabet in play here
 * is Vietnamese plus ASCII.
 */
export function deaccent(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
}

export function slugify(input: string): string {
  return deaccent(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Lowercase, diacritic-free haystack stored on the row so "tieu duong" finds
 * "tiểu đường". HTML is stripped so tag names cannot match.
 *
 * ponytail: ILIKE over this column is a sequential scan. Fine at forum size;
 * if search gets slow, add a pg_trgm GIN index on search_text.
 */
export function toSearchText(...parts: (string | null | undefined)[]): string {
  return deaccent(parts.filter(Boolean).join(' '))
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);
}
