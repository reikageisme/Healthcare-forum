import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, postTags, posts, tags, users } from '../db/schema.js';
import { sanitizePlainText, sanitizeRichText, stripHtmlAndTruncate } from '../lib/sanitize.js';
import { slugify, toSearchText } from '../lib/slugify.js';

/**
 * Nạp bài biên soạn sẵn vào một chuyên mục có sẵn.
 *
 *   npm run seed:articles -- --muc=dich-benh
 *   npm run seed:articles -- --muc=dich-benh --dry-run
 *   npm run seed:articles -- --data=abc.json --category=tin-y-te
 *
 * Khác seedHospitals ở chỗ bài đã có sẵn tiêu đề và nội dung HTML trong file
 * dữ liệu, script chỉ lo chuyện đưa vào đúng chuyên mục, đúng tác giả và gắn
 * thẻ. Chạy lại bao nhiêu lần cũng được: đối chiếu theo slug, bài đã có thì
 * cập nhật nội dung và giữ nguyên tác giả, lượt xem, bình luận, ngày đăng.
 *
 * Nguồn dữ liệu đều thuộc phạm vi dùng lại hợp pháp: tài liệu của cơ quan
 * liên bang Hoa Kỳ (CDC, NIH, NLM, FDA) thuộc public domain; văn bản quy phạm
 * pháp luật Việt Nam không thuộc đối tượng bảo hộ quyền tác giả theo Điều 15
 * Luật Sở hữu trí tuệ.
 */

interface Article {
  title: string;
  excerpt?: string;
  content: string;
  tags?: string[];
}

const MUC: Record<string, { data: string; category: string }> = {
  'dich-benh': { data: 'canh-bao-dich-benh.json', category: 'canh-bao-dich-benh' },
  'nghien-cuu': { data: 'nghien-cuu-cong-nghe-y-te.json', category: 'nghien-cuu-cong-nghe-y-te' },
  'chinh-sach': { data: 'chinh-sach-bao-hiem-y-te.json', category: 'chinh-sach-bao-hiem-y-te' },
  'tin-y-te': { data: 'tin-y-te.json', category: 'tin-y-te' },
};

function argValue(flag: string): string | null {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}
const hasFlag = (flag: string) => process.argv.slice(2).includes(flag);

/** Tạo thẻ còn thiếu, trả về id của toàn bộ thẻ được yêu cầu. */
async function resolveTags(names: string[]): Promise<string[]> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (wanted.length === 0) return [];

  const slugs = wanted.map(slugify);
  const existing = await db.select().from(tags).where(inArray(tags.slug, slugs));
  const bySlug = new Map<string, string>(existing.map((t) => [t.slug, t.id] as const));

  for (const name of wanted) {
    const slug = slugify(name);
    if (bySlug.has(slug)) continue;
    const made = await db.insert(tags).values({ name, slug }).returning();
    const row = made[0];
    if (row) bySlug.set(slug, row.id);
  }
  return [...bySlug.values()];
}

/**
 * Slug tự nhiên theo tiêu đề; nếu slug đó đã thuộc về một bài khác thì nối
 * thêm hậu tố thay vì ghi đè lên bài của người ta.
 */
async function resolveSlot(title: string, categoryId: string) {
  const base = slugify(title).slice(0, 200);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    const existing = rows[0];
    if (!existing) return { slug, existing: null };
    if (existing.title === title && existing.category_id === categoryId) {
      return { slug, existing };
    }
  }
  throw new Error(`Không tìm được slug trống cho "${title}"`);
}

async function main() {
  const mucArg = argValue('--muc');
  if (mucArg && !MUC[mucArg]) {
    console.error(`--muc chỉ nhận: ${Object.keys(MUC).join(', ')}`);
    process.exit(1);
  }
  const preset = mucArg ? MUC[mucArg]! : null;

  const categorySlug = argValue('--category') ?? preset?.category;
  const dataName = argValue('--data') ?? preset?.data;
  if (!categorySlug || !dataName) {
    console.error('Cần --muc=<tên>, hoặc cả --data=<file.json> và --category=<slug>.');
    process.exit(1);
  }
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
    console.error('Chưa có tài khoản admin nào để đứng tên bài. Chạy npm run create-admin trước.');
    process.exit(1);
  }

  const list = JSON.parse(readFileSync(dataFile, 'utf8')) as Article[];
  console.log(
    `Nạp ${list.length} bài vào "${category.name}" (${category.surface}), đứng tên ${author.username}.` +
      (dryRun ? ' [dry-run — không ghi gì]' : ''),
  );

  let created = 0;
  let updated = 0;

  for (const a of list) {
    const title = sanitizePlainText(a.title).slice(0, 255);
    const content = sanitizeRichText(a.content);
    const excerpt = (a.excerpt ? sanitizePlainText(a.excerpt) : stripHtmlAndTruncate(content)).slice(
      0,
      480,
    );
    const search_text = toSearchText(title, excerpt, content, (a.tags ?? []).join(' '));

    const { slug, existing } = await resolveSlot(title, category.id);

    if (dryRun) {
      console.log(`  ${existing ? 'cập nhật' : 'tạo mới'}  ${slug}`);
      existing ? (updated += 1) : (created += 1);
      continue;
    }

    let postId: string;
    if (existing) {
      await db
        .update(posts)
        .set({ content, excerpt, search_text, updated_at: new Date() })
        .where(eq(posts.id, existing.id));
      postId = existing.id;
      updated += 1;
    } else {
      const made = await db
        .insert(posts)
        .values({
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
        })
        .returning();
      const row = made[0];
      if (!row) throw new Error(`Không tạo được bài "${title}"`);
      postId = row.id;
      created += 1;
    }

    const tagIds = await resolveTags(a.tags ?? []);
    if (tagIds.length > 0) {
      await db.delete(postTags).where(eq(postTags.post_id, postId));
      await db.insert(postTags).values(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
    }
  }

  console.log(`Xong: tạo mới ${created} bài, cập nhật ${updated} bài.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Nạp bài thất bại:', err);
    process.exit(1);
  });
