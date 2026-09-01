import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, tags } from '../db/schema.js';
import { humanizeTagName } from '../lib/postQueries.js';

/**
 * Dọn tên thẻ đang là slug: "#phong-kham" -> "#Phòng khám".
 *
 *   npm run fix:tag-names -- --dry-run   # chỉ xem sẽ đổi gì
 *   npm run fix:tag-names                # đổi thật
 *
 * Slug giữ nguyên tuyệt đối, nên mọi đường dẫn /tags/phong-kham và mọi bài
 * viết đang gắn thẻ đều không đổi — chỉ phần chữ hiển thị đổi.
 *
 * Dấu tiếng Việt lấy lại được khi có một chuyên mục cùng slug (chuyên mục
 * "Phòng khám" có slug phong-kham), vì từ "phong-kham" không thể tự suy ra
 * dấu. Thẻ nào không khớp chuyên mục nào thì chỉ bỏ gạch nối và viết hoa
 * chữ đầu — anh sửa tay lại cho có dấu nếu muốn.
 */

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');

  const [allTags, allCategories] = await Promise.all([
    db.select().from(tags),
    db.select({ name: categories.name, slug: categories.slug }).from(categories),
  ]);
  const categoryNameBySlug = new Map(allCategories.map((c) => [c.slug, c.name]));

  const renames: Array<{ id: string; from: string; to: string; source: string }> = [];
  for (const tag of allTags) {
    const fromCategory = categoryNameBySlug.get(tag.slug);
    const next = fromCategory ?? humanizeTagName(tag.name);
    if (next === tag.name) continue;
    renames.push({
      id: tag.id,
      from: tag.name,
      to: next,
      source: fromCategory ? 'chuyên mục' : 'bỏ gạch nối',
    });
  }

  if (renames.length === 0) {
    console.log('Không có thẻ nào cần đổi tên.');
    return;
  }

  for (const r of renames) {
    console.log(`  #${r.from}  ->  #${r.to}   (${r.source})`);
  }

  if (dryRun) {
    console.log(`\n--dry-run: chưa đổi gì. Bỏ cờ này để đổi ${renames.length} thẻ.`);
    return;
  }

  let done = 0;
  for (const r of renames) {
    // Tên thẻ là unique: nếu tên mới đã có thẻ khác dùng thì bỏ qua, gộp hai
    // thẻ lại là việc khác hẳn và không nên làm lặng lẽ trong một script đổi tên.
    const clash = await db.select({ id: tags.id }).from(tags).where(eq(tags.name, r.to)).limit(1);
    if (clash[0] && clash[0].id !== r.id) {
      console.warn(`  Bỏ qua "#${r.from}": đã có thẻ tên "#${r.to}".`);
      continue;
    }
    await db.update(tags).set({ name: r.to }).where(eq(tags.id, r.id));
    done += 1;
  }

  console.log(`\nXong: đổi tên ${done}/${renames.length} thẻ. Slug giữ nguyên.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Dọn tên thẻ thất bại:', err);
    process.exit(1);
  });
