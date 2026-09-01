import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { postTags, tags } from '../db/schema.js';
import { stripTagHyphens } from '../lib/postQueries.js';

/**
 * Dọn tên thẻ: "#benh-vien" -> "#benhvien".
 *
 *   npm run fix:tag-names -- --dry-run       # chỉ xem sẽ đổi gì
 *   npm run fix:tag-names                    # bỏ gạch nối trong tên
 *   npm run fix:tag-names -- --from-slug     # viết lại tên theo slug
 *   npm run fix:tag-names -- --from-slug --merge --prune-empty
 *
 * --from-slug  viết lại tên của MỌI thẻ theo slug của nó ("tim-mach" ->
 *              "timmach"), kể cả thẻ đang có tên có dấu. Dùng khi tên thẻ đã
 *              bị một lần dọn trước làm sai và cần đưa hết về một kiểu.
 * --merge      khi tên mới trùng một thẻ đã có (thẻ cũ "Bệnh Viện" và thẻ mới
 *              "benhvien" cùng chỉ một chủ đề), dời hết bài viết sang thẻ kia
 *              rồi xoá thẻ thừa. Không có cờ này thì chỉ bỏ qua và báo.
 * --prune-empty xoá những thẻ không còn bài viết nào — dọn thẻ gõ nhầm.
 *
 * Slug không bao giờ bị sửa; chỉ có thẻ bị gộp/xoá là biến mất.
 * Luôn chạy --dry-run trước.
 */

async function postCount(tagId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(postTags)
    .where(eq(postTags.tag_id, tagId));
  return Number(rows[0]?.n ?? 0);
}

/** Dời mọi liên kết bài viết của `fromId` sang `intoId`, rồi xoá thẻ thừa. */
async function mergeInto(fromId: string, intoId: string): Promise<number> {
  const links = await db
    .select({ post_id: postTags.post_id })
    .from(postTags)
    .where(eq(postTags.tag_id, fromId));

  if (links.length > 0) {
    await db
      .insert(postTags)
      .values(links.map((l) => ({ post_id: l.post_id, tag_id: intoId })))
      .onConflictDoNothing();
  }
  // post_tags có ON DELETE CASCADE nên xoá thẻ là dọn luôn liên kết cũ.
  await db.delete(tags).where(eq(tags.id, fromId));
  return links.length;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fromSlug = args.includes('--from-slug');
  const merge = args.includes('--merge');
  const pruneEmpty = args.includes('--prune-empty');

  const allTags = await db.select().from(tags);

  const renames: Array<{ id: string; from: string; to: string }> = [];
  for (const tag of allTags) {
    const next = fromSlug ? tag.slug.replace(/-/g, '') : stripTagHyphens(tag.name);
    if (!next || next === tag.name) continue;
    renames.push({ id: tag.id, from: tag.name, to: next });
  }

  const byName = new Map(allTags.map((t) => [t.name, t]));

  for (const r of renames) {
    const clash = byName.get(r.to);
    if (clash && clash.id !== r.id) {
      console.log(
        merge
          ? `  #${r.from}  ->  gộp vào #${r.to}`
          : `  #${r.from}  ->  #${r.to}   (BỎ QUA: đã có thẻ tên này, thêm --merge để gộp)`,
      );
    } else {
      console.log(`  #${r.from}  ->  #${r.to}`);
    }
  }

  let emptyTags: typeof allTags = [];
  if (pruneEmpty) {
    const survivors = new Set<string>();
    for (const r of renames) {
      const clash = byName.get(r.to);
      if (merge && clash && clash.id !== r.id) survivors.add(clash.id);
    }
    for (const tag of allTags) {
      if (survivors.has(tag.id)) continue; // sắp nhận bài từ thẻ bị gộp
      if ((await postCount(tag.id)) === 0) emptyTags.push(tag);
    }
    for (const tag of emptyTags) console.log(`  #${tag.name}   (XOÁ: không có bài viết nào)`);
  }

  if (renames.length === 0 && emptyTags.length === 0) {
    console.log('Không có thẻ nào cần dọn.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: chưa đổi gì. Bỏ cờ này để thực hiện.');
    return;
  }

  let renamed = 0;
  let merged = 0;
  let skipped = 0;

  for (const r of renames) {
    const clash = byName.get(r.to);
    if (clash && clash.id !== r.id) {
      if (!merge) {
        console.warn(`  Bỏ qua "#${r.from}": đã có thẻ tên "#${r.to}".`);
        skipped += 1;
        continue;
      }
      const moved = await mergeInto(r.id, clash.id);
      console.log(`  Đã gộp "#${r.from}" vào "#${r.to}" (${moved} liên kết bài viết).`);
      merged += 1;
      continue;
    }
    await db.update(tags).set({ name: r.to }).where(eq(tags.id, r.id));
    renamed += 1;
  }

  let pruned = 0;
  if (pruneEmpty) {
    const mergedIds = new Set<string>();
    for (const r of renames) {
      const clash = byName.get(r.to);
      if (merge && clash && clash.id !== r.id) mergedIds.add(r.id);
    }
    const stillThere = emptyTags.filter((t) => !mergedIds.has(t.id));
    for (const tag of stillThere) {
      // Kiểm lại ngay trước khi xoá: một thẻ vừa nhận bài từ thẻ bị gộp thì
      // không còn rỗng nữa.
      if ((await postCount(tag.id)) > 0) continue;
      await db.delete(tags).where(eq(tags.id, tag.id));
      pruned += 1;
    }
  }

  console.log(
    `\nXong: đổi tên ${renamed}, gộp ${merged}, xoá ${pruned}` +
      (skipped ? `, bỏ qua ${skipped}` : '') +
      '. Slug của thẻ còn lại giữ nguyên.',
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Dọn tên thẻ thất bại:', err);
    process.exit(1);
  });
