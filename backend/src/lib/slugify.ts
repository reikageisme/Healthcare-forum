/**
 * Stands in for python-slugify. Unicode NFD decomposition strips the tone
 * and vowel marks Vietnamese uses, but đ/Đ have no decomposition of their
 * own and have to be mapped explicitly — without that, "đau dạ dày" would
 * slug as "au-da-day".
 *
 * Kept as a few lines rather than a dependency; the alphabet in play here
 * is Vietnamese plus ASCII.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
