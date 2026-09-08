import { Hono } from 'hono';
import { and, asc, count, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, posts } from '../db/schema.js';
import { badRequest, notFound } from '../core/errors.js';
import { parseBody } from '../lib/validate.js';
import { slugify } from '../lib/slugify.js';
import { sanitizePlainText } from '../lib/sanitize.js';
import { asUuid } from '../core/security.js';
import { assertValidParent, categoryPostCount, categoryScope } from '../lib/categoryTree.js';
import { categoryCreateSchema, categoryUpdateSchema } from '../schemas/requests.js';
import { toCategoryResponse } from '../schemas/responses.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asSurface } from '../lib/surface.js';

export const categoryRoutes = new Hono();

/**
 * Id của một chuyên mục và toàn bộ nhánh dưới nó.
 *
 * Cây sâu tối đa ba cấp (cha -> con -> cháu) nên hai vòng lặp là đủ; không
 * đáng đổi lấy một câu WITH RECURSIVE cho một cái cây bốn mươi hàng.
 */
async function descendantIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  for (let depth = 0; depth < 2; depth += 1) {
    const kids = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parent_id, ids));
    const fresh = kids.map((k) => k.id).filter((id) => !ids.includes(id));
    if (fresh.length === 0) break;
    ids.push(...fresh);
  }
  return ids;
}

/**
 * The list stays flat and carries parent_id; the tree is assembled by the
 * caller. One shape serves the admin table, the sidebar and the post form,
 * and nothing has to stay in sync with a second nested endpoint.
 *
 * Order is depth-first — each category immediately followed by its own
 * branch — so a caller that just renders the array in order already gets the
 * tree reading top to bottom. Inside one level it is sort_order first, then
 * name, so an unordered category still lands alphabetically.
 */
categoryRoutes.get('/', async (c) => {
  /**
   * ?surface=portal|forum lấy đúng một cây.
   *
   * Trang tin xếp theo chuyên trang toà soạn, diễn đàn chia theo chuyên khoa —
   * hai cây khác nhau trong cùng một bảng. Không truyền gì thì trả cả hai, vì
   * trang quản trị cần quản lý cả hai ở một chỗ.
   */
  const surface = asSurface(c.req.query('surface'));

  const rows = await db
    .select({ category: categories, post_count: categoryPostCount })
    .from(categories)
    .where(surface ? eq(categories.surface, surface) : undefined)
    .orderBy(asc(categories.sort_order), asc(categories.name));

  const all = rows.map((r) => toCategoryResponse(r.category, Number(r.post_count)));
  const byId = new Map(all.map((x) => [x.id, x]));
  const childrenOf = new Map<string, typeof all>();
  for (const item of all) {
    // A child whose parent vanished is treated as a root rather than dropped.
    if (!item.parent_id || !byId.has(item.parent_id)) continue;
    const list = childrenOf.get(item.parent_id) ?? [];
    list.push(item);
    childrenOf.set(item.parent_id, list);
  }

  const ordered: typeof all = [];
  const emitted = new Set<string>();
  const walk = (item: (typeof all)[number]) => {
    if (emitted.has(item.id)) return; // cheap guard against a legacy cycle
    emitted.add(item.id);
    ordered.push(item);
    for (const child of childrenOf.get(item.id) ?? []) walk(child);
  };
  for (const item of all) {
    if (!item.parent_id || !byId.has(item.parent_id)) walk(item);
  }
  for (const item of all) if (!emitted.has(item.id)) ordered.push(item);

  return c.json(ordered);
});

categoryRoutes.post('/', requireAuth, requireRole('admin', 'moderator'), async (c) => {
  const body = await parseBody(c, categoryCreateSchema);
  const name = sanitizePlainText(body.name);
  const slug = body.slug ? slugify(body.slug) : slugify(name);

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(or(eq(categories.name, name), eq(categories.slug, slug)))
    .limit(1);
  if (existing.length > 0) {
    throw badRequest('Category with this name or slug already exists');
  }

  if (body.parent_id) await assertValidParent(body.parent_id);

  const inserted = await db
    .insert(categories)
    .values({
      name,
      slug,
      icon: body.icon ?? null,
      description: body.description ? sanitizePlainText(body.description) : null,
      parent_id: body.parent_id ?? null,
      sort_order: body.sort_order ?? 0,
      // Mục con luôn thuộc cùng cây với cha nó; không thì trang tin có một
      // nhánh treo dưới một chuyên khoa của diễn đàn.
      surface: asSurface(body.surface) ?? 'forum',
    })
    .returning();
  const category = inserted[0];
  if (!category) throw badRequest('Could not create category');
  return c.json(toCategoryResponse(category, 0), 201);
});

categoryRoutes.get('/:id_or_slug', async (c) => {
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const rows = await db
    .select({ category: categories, post_count: categoryPostCount })
    .from(categories)
    .where(id ? eq(categories.id, id) : eq(categories.slug, key))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound('Category not found');
  return c.json(toCategoryResponse(row.category, Number(row.post_count)));
});

categoryRoutes.put('/:id_or_slug', requireAuth, requireRole('admin', 'moderator'), async (c) => {
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);
  const body = await parseBody(c, categoryUpdateSchema);

  const found = await db
    .select()
    .from(categories)
    .where(id ? eq(categories.id, id) : eq(categories.slug, key))
    .limit(1);
  const category = found[0];
  if (!category) throw notFound('Category not found');

  const patch: Partial<typeof categories.$inferInsert> = {};
  if (body.name !== undefined && body.name !== null) patch.name = sanitizePlainText(body.name);

  if (body.slug !== undefined && body.slug !== null) {
    const newSlug = slugify(body.slug);
    const clash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, newSlug), ne(categories.id, category.id)))
      .limit(1);
    if (clash.length > 0) throw badRequest('Category slug already exists');
    patch.slug = newSlug;
  } else if (body.name !== undefined && body.name !== null) {
    // Name changed without an explicit slug: recompute, but only take the
    // new slug when it is free — matching the original silent skip.
    const newSlug = slugify(body.name);
    const clash = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, newSlug), ne(categories.id, category.id)))
      .limit(1);
    if (clash.length === 0) patch.slug = newSlug;
  }

  if (body.icon !== undefined && body.icon !== null) patch.icon = body.icon;
  // Chuyển một chuyên mục sang cây bên kia. Cả nhánh con đi theo, nếu không
  // trang tin sẽ có một mục cha mà bấm vào thì rơi vào chuyên khoa diễn đàn.
  const nextSurface = asSurface(body.surface);
  if (nextSurface && nextSurface !== category.surface) patch.surface = nextSurface;
  if (body.sort_order !== undefined && body.sort_order !== null) {
    patch.sort_order = body.sort_order;
  }
  if (body.description !== undefined && body.description !== null) {
    patch.description = sanitizePlainText(body.description);
  }

  // Sent as null means "detach from parent"; omitted means "leave alone".
  if (body.parent_id !== undefined) {
    if (body.parent_id === null) {
      patch.parent_id = null;
    } else {
      await assertValidParent(body.parent_id, category.id);
      patch.parent_id = body.parent_id;
    }
  }

  let updated = category;
  if (Object.keys(patch).length > 0) {
    const rows = await db
      .update(categories)
      .set({ ...patch, updated_at: new Date() })
      .where(eq(categories.id, category.id))
      .returning();
    updated = rows[0] ?? category;

    // Cả nhánh đi theo cha. Một mục con ở lại cây cũ nghĩa là bấm vào nó rơi
    // sang trang bên kia — đúng kiểu "hai trang dính vào nhau" cần bỏ.
    if (patch.surface) {
      await db
        .update(categories)
        .set({ surface: patch.surface, updated_at: new Date() })
        .where(inArray(categories.id, await descendantIds(category.id)));
    }
  }

  const counted = await db
    .select({ n: count() })
    .from(posts)
    .where(
      and(eq(posts.is_published, true), eq(posts.status, 'approved'), categoryScope(updated.id)),
    );
  return c.json(toCategoryResponse(updated, Number(counted[0]?.n ?? 0)));
});

/**
 * Deleting a parent leaves its children in place as root categories — the
 * foreign key is ON DELETE SET NULL — rather than cascading and taking a
 * whole branch of the forum with it.
 */
categoryRoutes.delete('/:id_or_slug', requireAuth, requireRole('admin'), async (c) => {
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const found = await db
    .select({ id: categories.id })
    .from(categories)
    .where(id ? eq(categories.id, id) : eq(categories.slug, key))
    .limit(1);
  const category = found[0];
  if (!category) throw notFound('Category not found');

  await db.delete(categories).where(eq(categories.id, category.id));
  return c.body(null, 204);
});
