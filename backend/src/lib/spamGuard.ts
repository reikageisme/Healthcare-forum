import { deaccent } from './slugify.js';

/**
 * Supplement spam is what turns a Vietnamese health forum into a marketplace.
 * These are hard rules, not a model: cheap, explainable, and they run before
 * anything reaches the queue. An LLM risk score can be layered on later —
 * `assessContent` is the single place it would plug into.
 */

/** Matched against accent-stripped, lowercased text, so "cam kết" hits "cam ket". */
const RISK_PHRASES: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /\bcam ket (khoi|het|100)/, weight: 40, label: 'cam kết khỏi bệnh' },
  { pattern: /\b(khoi|het) (benh )?(hoan toan|100|vinh vien)/, weight: 40, label: 'hứa khỏi hoàn toàn' },
  { pattern: /\bchua (khoi|dut diem|tan goc)\b/, weight: 35, label: 'hứa chữa dứt điểm' },
  { pattern: /\bthuc pham chuc nang\b|\btpcn\b/, weight: 25, label: 'thực phẩm chức năng' },
  { pattern: /\b(inbox|nhan tin|lien he) (de |ngay |minh |em |shop )?(tu van|dat hang|mua)/, weight: 30, label: 'kêu gọi inbox mua hàng' },
  { pattern: /\b(gia chi|chi con|uu dai|khuyen mai|giam gia|freeship|ship cod)\b/, weight: 30, label: 'chào giá / khuyến mãi' },
  { pattern: /\b(dat hang|mua ngay|order|so luong co han)\b/, weight: 25, label: 'kêu gọi đặt hàng' },
  { pattern: /\b(thuoc gia truyen|bai thuoc gia truyen|thuoc nam gia truyen)\b/, weight: 30, label: 'thuốc gia truyền' },
  { pattern: /\b(0|\+84)\d{8,10}\b/, weight: 20, label: 'số điện thoại' },
  { pattern: /\bzalo\b.{0,20}\d{6,}/, weight: 30, label: 'Zalo kèm số' },
];

const URL_RE = /\bhttps?:\/\/[^\s"'<>]+/gi;

/** Links to the forum's own uploads are not outbound links. */
function outboundLinks(html: string): string[] {
  return (html.match(URL_RE) ?? []).filter((u) => !/\/uploads\//.test(u));
}

export interface ContentRisk {
  score: number;
  reasons: string[];
  /** True when the post must go to the moderation queue regardless of role. */
  forceReview: boolean;
}

export function assessContent(
  parts: { title?: string; content: string },
  author: { createdAt: Date; role: string },
): ContentRisk {
  const haystack = deaccent(`${parts.title ?? ''} ${parts.content}`)
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase();

  const reasons: string[] = [];
  let score = 0;

  for (const rule of RISK_PHRASES) {
    if (rule.pattern.test(haystack)) {
      score += rule.weight;
      reasons.push(rule.label);
    }
  }

  // A brand-new account posting outbound links is the standard spam shape.
  // Established members and staff are exempt.
  const ageMs = Date.now() - author.createdAt.getTime();
  const isNewAccount = ageMs < 7 * 24 * 60 * 60_000;
  const isStaff = author.role === 'admin' || author.role === 'moderator';
  const links = outboundLinks(parts.content);

  if (links.length > 0 && isNewAccount && !isStaff) {
    score += 40;
    reasons.push(`tài khoản mới kèm ${links.length} liên kết ngoài`);
  }

  return { score, reasons, forceReview: score >= 40 };
}
