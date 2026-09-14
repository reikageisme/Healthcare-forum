import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, posts, users } from '../db/schema.js';
import { sanitizePlainText, sanitizeRichText, stripHtmlAndTruncate } from '../lib/sanitize.js';
import { slugify, toSearchText } from '../lib/slugify.js';

/**
 * Nạp danh bạ bệnh viện vào một chuyên mục có sẵn, mỗi bệnh viện là một bài.
 *
 *   npm run seed:hospitals                       # miền Nam (mặc định)
 *   npm run seed:hospitals -- --mien=bac         # miền Bắc
 *   npm run seed:hospitals -- --mien=trung       # miền Trung
 *   npm run seed:hospitals -- --mien=bac --dry-run
 *
 * --mien chọn sẵn cặp file dữ liệu + chuyên mục; muốn tự chỉ định thì dùng
 * --data=<tên file trong thư mục data> và --category=<slug chuyên mục>.
 *
 * Chạy lại bao nhiêu lần cũng được: đối chiếu theo slug, bài đã có thì cập
 * nhật lại nội dung và giữ nguyên tác giả, lượt xem, bình luận, ngày đăng.
 * Không xoá bài nào, kể cả bài không còn trong file dữ liệu.
 *
 * Nguồn dữ liệu: thư mục data/ — miền Nam gộp từ ba sheet của file khảo sát;
 * miền Bắc và miền Trung khảo sát từ danh mục cơ sở KCB của Bộ Y tế
 * (benhandientu.moh.gov.vn), quy đổi về địa giới 34 tỉnh/thành từ 2025.
 */

interface Hospital {
  name: string;
  province?: string;
  type?: string;
  tier?: string;
  specialties?: string;
  strengths?: string;
  highlights?: string;
  leading_level?: string;
  website?: string;
  founded?: string;
  history?: string;
  history_source?: string;
  milestones?: string;
  verification?: string;
}

const DEFAULT_DATA = 'hospitals-mien-nam.json';
const DEFAULT_CATEGORY = 'benh-vien-mien-nam';

/** Mỗi miền một file dữ liệu và một chuyên mục; truyền --mien là đủ. */
const MIEN: Record<string, { data: string; category: string }> = {
  nam: { data: 'hospitals-mien-nam.json', category: 'benh-vien-mien-nam' },
  bac: { data: 'hospitals-mien-bac.json', category: 'benh-vien-mien-bac' },
  trung: { data: 'hospitals-mien-trung.json', category: 'benh-vien-mien-trung' },
};

function argValue(flag: string): string | null {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}
const hasFlag = (flag: string) => process.argv.slice(2).includes(flag);

/** Giá trị "Chưa bổ sung", "Chưa xác minh..." là chỗ trống, không phải nội dung. */
function filled(value: string | undefined): value is string {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v.length > 0 && !v.startsWith('chưa bổ sung') && v !== 'không có';
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function buildContent(h: Hospital): string {
  const out: string[] = [];

  const facts: [string, string | undefined][] = [
    ['Tỉnh/TP hiện hành (2026)', h.province],
    ['Loại hình', h.type],
    ['Tuyến/Hạng', h.tier],
    ['Mức độ đầu ngành', h.leading_level],
    ['Năm/mốc hình thành', h.founded],
  ];
  const rows = facts
    .filter(([, v]) => filled(v))
    .map(([k, v]) => `<tr><td><strong>${esc(k)}</strong></td><td>${esc(v!)}</td></tr>`);
  if (rows.length > 0) out.push(`<table><tbody>${rows.join('')}</tbody></table>`);

  const sections: [string, string | undefined][] = [
    ['Chuyên khoa chính', h.specialties],
    ['Điều trị / thế mạnh', h.strengths],
    ['Đặc điểm nổi bật', h.highlights],
    ['Lịch sử hình thành và hoạt động', h.history],
  ];
  for (const [title, body] of sections) {
    if (filled(body)) out.push(`<h2>${esc(title)}</h2><p>${esc(body!)}</p>`);
  }

  if (filled(h.milestones)) {
    const items = h.milestones!
      .split(/\s*;\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<li>${esc(s)}</li>`);
    if (items.length > 0) {
      out.push(`<h2>Các mốc lịch sử tiêu biểu</h2><ul>${items.join('')}</ul>`);
    }
  }

  const refs: string[] = [];
  if (filled(h.website)) {
    refs.push(`<li>Website / nguồn: <a href="${esc(h.website!)}">${esc(h.website!)}</a></li>`);
  }
  if (filled(h.history_source) && h.history_source !== h.website) {
    refs.push(
      `<li>Nguồn lịch sử: <a href="${esc(h.history_source!)}">${esc(h.history_source!)}</a></li>`,
    );
  }
  if (filled(h.verification)) {
    refs.push(`<li>Mức độ xác minh: ${esc(h.verification!)}</li>`);
  }
  if (refs.length > 0) out.push(`<h2>Nguồn tham khảo</h2><ul>${refs.join('')}</ul>`);

  return out.join('');
}

function buildExcerpt(h: Hospital, content: string): string {
  const parts = [h.type, h.tier, h.province].filter(filled);
  const head = parts.length > 0 ? `${parts.join(' · ')}. ` : '';
  const tail = filled(h.strengths) ? h.strengths! : filled(h.specialties) ? h.specialties! : '';
  const line = `${head}${tail}`.trim();
  return sanitizePlainText(line || stripHtmlAndTruncate(content)).slice(0, 480);
}

/**
 * Slug tự nhiên theo tên bệnh viện; nếu slug đó đã thuộc về một bài khác
 * (trùng tên với bài sẵn có của người dùng) thì nối thêm hậu tố thay vì
 * ghi đè lên bài của người ta.
 */
async function resolveSlot(title: string, categoryId: string) {
  const base = slugify(title);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    const existing = rows[0];
    if (!existing) return { slug, existing: null };
    // Bài do chính script này tạo ở lần chạy trước: cùng tên, cùng chuyên mục.
    if (existing.title === title && existing.category_id === categoryId) {
      return { slug, existing };
    }
  }
  throw new Error(`Không tìm được slug trống cho "${title}"`);
}

async function main() {
  const mienArg = argValue('--mien');
  if (mienArg && !MIEN[mienArg]) {
    console.error(`--mien chỉ nhận: ${Object.keys(MIEN).join(', ')}`);
    process.exit(1);
  }
  const preset = mienArg ? MIEN[mienArg]! : null;

  const categorySlug = argValue('--category') ?? preset?.category ?? DEFAULT_CATEGORY;
  const dataName = argValue('--data') ?? preset?.data ?? DEFAULT_DATA;
  const dataFile = fileURLToPath(new URL(`./data/${dataName}`, import.meta.url));
  const authorArg = argValue('--author');
  const dryRun = hasFlag('--dry-run');

  const catRows = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);
  const category = catRows[0];
  if (!category) {
    console.error(`Không tìm thấy chuyên mục "${categorySlug}".`);
    const all = await db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .orderBy(asc(categories.name));
    console.error('Các chuyên mục hiện có:');
    for (const c of all) console.error(`  ${c.slug}  —  ${c.name}`);
    process.exit(1);
  }

  const authorRows = authorArg
    ? await db.select().from(users).where(eq(users.username, authorArg)).limit(1)
    : await db
        .select()
        .from(users)
        .where(eq(users.role, 'admin'))
        .orderBy(asc(users.created_at))
        .limit(1);
  const author = authorRows[0];
  if (!author) {
    console.error(
      authorArg
        ? `Không tìm thấy tài khoản "${authorArg}".`
        : 'Chưa có tài khoản admin nào để đứng tên bài. Chạy npm run create-admin trước.',
    );
    process.exit(1);
  }

  const list = JSON.parse(readFileSync(dataFile, 'utf8')) as Hospital[];
  console.log(
    `Nạp ${list.length} bệnh viện vào "${category.name}" (${category.surface}), đứng tên ${author.username}.` +
      (dryRun ? ' [dry-run — không ghi gì]' : ''),
  );

  let created = 0;
  let updated = 0;

  for (const h of list) {
    const title = sanitizePlainText(h.name).slice(0, 255);
    const content = sanitizeRichText(buildContent(h));
    const excerpt = buildExcerpt(h, content);
    const search_text = toSearchText(title, excerpt, content, h.province, h.specialties);

    const { slug, existing } = await resolveSlot(title, category.id);

    if (dryRun) {
      console.log(`  ${existing ? 'cập nhật' : 'tạo mới'}  ${slug}`);
      existing ? (updated += 1) : (created += 1);
      continue;
    }

    if (existing) {
      await db
        .update(posts)
        .set({ content, excerpt, search_text, updated_at: new Date() })
        .where(eq(posts.id, existing.id));
      updated += 1;
    } else {
      await db.insert(posts).values({
        title,
        slug,
        content,
        excerpt,
        post_type: 'article',
        status: 'approved',
        surface: category.surface,
        is_published: true,
        search_text,
        author_id: author.id,
        category_id: category.id,
      });
      created += 1;
    }
  }

  console.log(`Xong: tạo mới ${created} bài, cập nhật ${updated} bài.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Nạp danh bạ bệnh viện thất bại:', err);
    process.exit(1);
  });
