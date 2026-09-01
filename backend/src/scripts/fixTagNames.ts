import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tags } from '../db/schema.js';
import { stripTagHyphens } from '../lib/postQueries.js';

/**
 * Bỏ gạch nối trong tên thẻ: "#benh-vien" -> "#benhvien".
 *
 *   npm run fix:tag-names -- --dry-run     # chỉ xem sẽ đổi gì
 *   npm run fix:tag-names                  # đổi thật
 *   npm run fix:tag-names -- --from-slug   # viết lại tên theo slug
 *
 * Mặc định chỉ đụng tới thẻ có tên đúng dạng slug thuần chữ thường
 * ("benh-vien"): "COVID-19" hay thẻ đã có tên tử tế đều giữ nguyên.
 *
 * --from-slug viết lại tên của MỌI thẻ theo slug của nó ("tim-mach" ->
 * "timmach"), kể cả thẻ đang có tên đẹp có dấu. Dùng khi tên thẻ đã bị một
 * lần dọn trước đó làm sai và cần đưa hết về một kiểu. Chạy --dry-run trước.
 *
 * Slug không bao giờ đổi, nên đường dẫn /tags/benh-vien và mọi bài viết
 * đang gắn thẻ đều nguyên vẹn — chỉ phần chữ hiển thị đổi.
 */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fromSlug = args.includes('--from-slug');

  const allTags = await db.select().from(tags);

  const renames: Array<{ id: string; from: string; to: string }> = [];
  for (const tag of allTags) {
    const next = fromSlug ? tag.slug.replace(/-/g, '') : stripTagHyphens(tag.name);
    if (!next || next === tag.name) continue;
    renames.push({ id: tag.id, from: tag.name, to: next });
  }

  if (renames.length === 0) {
    console.log('Không có thẻ nào cần đổi tên.');
    return;
  }

  for (const r of renames) console.log(`  #${r.from}  ->  #${r.to}`);

  if (dryRun) {
    console.log(`\n--dry-run: chưa đổi gì. Bỏ cờ này để đổi ${renames.length} thẻ.`);
    return;
  }

  let done = 0;
  for (const r of renames) {
    // Tên thẻ là unique: nếu tên mới đã có thẻ khác dùng thì bỏ qua, gộp hai
    // thẻ lại là việc khác hẳn, không nên làm lặng lẽ trong script đổi tên.
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
