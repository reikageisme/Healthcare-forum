import { eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, posts } from '../db/schema.js';
import { badRequest, notFound } from '../core/errors.js';

/**
 * Opening a parent category shows its own posts plus everything filed under
 * its children, which is what people expect from a forum tree. The depth cap
 * of two levels is what keeps this a single subquery instead of a recursive
 * CTE.
 */
export function categoryScope(categoryId: string): SQL {
  return sql`(${posts.category_id} = ${categoryId} or ${posts.category_id} in (
    select ch.id from ${categories} ch where ch.parent_id = ${categoryId}
  ))`;
}

/**
 * Visible post count for a category, including everything under its children.
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
       select ch.id from "categories" ch where ch.parent_id = "categories"."id"
     ))
)`;

/**
 * Enforces the two-level rule from both directions: the chosen parent must
 * be a root category, and a category that already has children cannot be
 * turned into a child itself.
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
  if (parent[0].parent_id) {
    throw badRequest('Chỉ hỗ trợ hai cấp: không thể đặt một chuyên mục con làm chuyên mục cha');
  }

  if (selfId) {
    const children = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parent_id, selfId))
      .limit(1);
    if (children[0]) {
      throw badRequest(
        'Chuyên mục này đang có chuyên mục con, không thể chuyển thành chuyên mục con của mục khác',
      );
    }
  }
}

