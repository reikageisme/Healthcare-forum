import { eq, isNull, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts } from '../db/schema.js';
import { toSearchText } from '../lib/slugify.js';

/**
 * Dựng lại cột search_text.
 *
 *   npm run backfill:search           # chỉ những bài đang trống
 *   npm run backfill:search -- --all  # dựng lại toàn bộ
 *
 * Cần chạy một lần sau khi nâng cấp tìm kiếm: truy vấn mới chỉ còn soi
 * search_text và title, không quét cột content nữa (quét content thì chỉ mục
 * trigram thành vô dụng). Bài nào được nạp bằng đường khác mà chưa dựng
 * search_text sẽ không tìm thấy cho tới khi chạy lệnh này.
 *
 * Script cố ý không đụng vào updated_at: dựng lại chỉ mục tìm kiếm không phải
 * là sửa nội dung, và nếu bump thì toàn bộ 1.100 bài sẽ mang ngày cập nhật
 * của hôm nay.
 */
const all = process.argv.slice(2).includes('--all');

async function main() {
  const rows = all
    ? await db.select().from(posts)
    : await db
        .select()
        .from(posts)
        .where(or(isNull(posts.search_text), eq(posts.search_text, '')));

  console.log(`Xét ${rows.length} bài${all ? ' (toàn bộ)' : ' đang trống search_text'}.`);

  let changed = 0;
  for (const row of rows) {
    const value = toSearchText(row.title, row.excerpt, row.content);
    if (value === row.search_text) continue;
    await db.update(posts).set({ search_text: value }).where(eq(posts.id, row.id));
    changed += 1;
    if (changed % 200 === 0) console.log(`  ...đã cập nhật ${changed}`);
  }

  console.log(`Xong: cập nhật ${changed} bài, bỏ qua ${rows.length - changed} bài đã đúng.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Dựng lại search_text thất bại:', err);
    process.exit(1);
  });
