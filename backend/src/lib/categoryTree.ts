import { eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, posts } from '../db/schema.js';
import { badRequest, notFound } from '../core/errors.js';

/** Cha -> con -> cháu. Sâu hơn nữa thì sidebar và ô chọn cha hết đọc nổi. */
export const MAX_CATEGORY_DEPTH = 3;

/**
 * Opening a category shows its own posts plus everything filed anywhere
 * below it, which is what people expect from a forum tree. Three levels is
 * still two plain subqueries — shallow enough not to need a recursive CTE.
 */
export function categoryScope(categoryId: string): SQL {
  return sql`(${posts.category_id} = ${categoryId} or ${posts.category_id} in (
    select ch.id from ${categories} ch
     where ch.parent_id = ${categoryId}
        or ch.parent_id in (select g.id from ${categories} g where g.parent_id = ${categoryId})
  ))`;
}

/**
 * Visible post count for a category, including everything under its children
 * and grandchildren.
 *
 * The correlated reference to the outer row is written out as
 * "categories"."id" rather than interpolated: inside a SELECT projection
 * drizzle renders a column as a bare "id", which the subquery would resolve
 * against posts instead, making every count come back zero.
 */
export const categoryPostCount = sql<number>`(
  select count(*)::int from "posts" p
   where p.is_published = true
     and p.status = 'approved'
     and (p.category_id = "categories"."id" or p.category_id in (
       select ch.id from "categories" ch
        where ch.parent_id = "categories"."id"
           or ch.parent_id in (
             select g.id from "categories" g where g.parent_id = "categories"."id"
           )
     ))
)`;

/** Số cấp tính từ gốc: chuyên mục gốc là 1. */
async function depthOf(categoryId: string): Promise<number> {
  let depth = 1;
  let cursor: string | null = categoryId;

  // The loop is bounded by the depth cap plus a step, so a cycle left over
  // from older data cannot spin here forever.
  for (let i = 0; i < MAX_CATEGORY_DEPTH + 1 && cursor; i += 1) {
    const rows: { parent_id: string | null }[] = await db
      .select({ parent_id: categories.parent_id })
      .from(categories)
      .where(eq(categories.id, cursor))
      .limit(1);
    cursor = rows[0]?.parent_id ?? null;
    if (cursor) depth += 1;
  }
  return depth;
}

/** Chiều cao của nhánh: chuyên mục không có con là 1. */
async function heightOf(categoryId: string): Promise<number> {
  const children = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parent_id, categoryId));
  if (children.length === 0) return 1;

  for (const child of children) {
    const grandchild = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parent_id, child.id))
      .limit(1);
    if (grandchild[0]) return 3;
  }
  return 2;
}

/**
 * Enforces the depth cap from both directions: where the chosen parent sits,
 * and how tall the branch being moved is. Moving a two-level branch under a
 * root is fine; moving it under a child is not, because the grandchildren
 * would land on a fourth level.
 */
export async function assertValidParent(parentId: string, selfId?: string): Promise<void> {
  if (selfId && parentId === selfId) {
    throw badRequest('Chuyên mục không thể là chuyên mục cha của chính nó');
  }

  const parent = await db
    .select({ id: categories.id, parent_id: categories.parent_id })
    .from(categories)
    .where(eq(categories.id, parentId))
    .limit(1);
  if (!parent[0]) throw notFound('Parent category not found');

  if (selfId) {
    // Walking up from the new parent must not run into the category being
    // moved, otherwise the branch would be reparented into itself.
    let cursor: string | null = parent[0].parent_id;
    for (let i = 0; i < MAX_CATEGORY_DEPTH + 1 && cursor; i += 1) {
      if (cursor === selfId) {
        throw badRequest('Không thể đặt một chuyên mục con của chính nó làm chuyên mục cha');
      }
      const rows: { parent_id: string | null }[] = await db
        .select({ parent_id: categories.parent_id })
        .from(categories)
        .where(eq(categories.id, cursor))
        .limit(1);
      cursor = rows[0]?.parent_id ?? null;
    }
  }

  const parentDepth = await depthOf(parentId);
  const branchHeight = selfId ? await heightOf(selfId) : 1;

  if (parentDepth + branchHeight > MAX_CATEGORY_DEPTH) {
    throw badRequest(
      branchHeight > 1
        ? `Chuyên mục này đang có chuyên mục con nên không thể đặt vào đây: cây chỉ sâu tối đa ${MAX_CATEGORY_DEPTH} cấp`
        : `Cây chuyên mục chỉ sâu tối đa ${MAX_CATEGORY_DEPTH} cấp`,
    );
  }
}
