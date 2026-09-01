export const MAX_TAGS = 8;

/**
 * Adding a tag is a pure list operation so a submit handler can apply it to
 * the list it is about to send.
 *
 * The tag input committed a half-typed tag only through onBlur, and the blur
 * fired by clicking "Lưu" lands in the same React batch as the submit: the
 * handler still saw the previous list and the tag was silently dropped.
 * Folding the pending input in at submit time is what makes the tag stick.
 */
export function withTag(list: string[], raw: string): string[] {
  const clean = raw.trim().replace(/^#+/, '');
  if (!clean || list.includes(clean) || list.length >= MAX_TAGS) return list;
  return [...list, clean];
}
