/**
 * Vietnamese diacritics stripped the same way the backend does it: NFD drops
 * tone and vowel marks, but đ/Đ have no decomposition and need mapping —
 * without it "đau dạ dày" becomes "au da day".
 */
export function deaccentLower(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}
