import { Hono } from 'hono';
import { and, asc, count, eq, ne, or } from 'drizzle-orm';
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

export const categoryRoutes = new Hono();

/**
 * The list stays flat and carries parent_id; the tree is assembled by the
 * caller. One shape serves the admin table, the sidebar and the post form,
 * and nothing has to stay in sync with a second nested endpoint.
 *
 * Roots come first, then children grouped under them, both alphabetical.
 */
categoryRoutes.get('/', async (c) => {
  const rows = await db
    .select({ category: categories, post_count: categoryPostCount })
    .from(categories)
    .orderBy(asc(categories.name));

  const all = rows.map((r) => toCategoryResponse(r.category, Number(r.post_count)));
  const roots = all.filter((x) => !x.parent_id);
  const childrenOf = new Map<string, typeof all>();
  for (const item of all) {
    if (!item.parent_id) continue;
    const list = childrenOf.get(item.parent_id) ?? [];
    list.push(item);
    childrenOf.set(item.parent_id, list);
  }

  const ordered = [];
  for (const root of roots) {
    ordered.push(root);
    ordered.push(...(childrenOf.get(root.id) ?? []));
  }
  // A child whose parent was deleted is shown as a root rather than dropped.
  const seen = new Set(ordered.map((x) => x.id));
  for (const item of all) if (!seen.has(item.id)) ordered.push(item);

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
