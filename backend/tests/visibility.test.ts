import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { bookmarks, categories, comments, posts, reactions, users, type PostRow } from '../src/db/schema.js';
import { createRefreshToken } from '../src/core/security.js';
import { closeDatabase, freshDatabase, json, request, seedUser, type SeededUser } from './setup.js';

const STATES = [
  { name: 'public', status: 'approved', is_published: true },
  { name: 'pending', status: 'pending', is_published: true },
  { name: 'rejected', status: 'rejected', is_published: true },
  { name: 'unpublished', status: 'approved', is_published: false },
] as const;
type PostState = (typeof STATES)[number];

// Explicit actor/state expectations, independent of the production policy.
const ACTORS = [
  { name: 'anonymous', privateRead: false, hiddenMutation: 401 },
  { name: 'unrelated', privateRead: false, hiddenMutation: 404 },
  { name: 'owner', privateRead: true, hiddenMutation: 409 },
  { name: 'moderator', privateRead: true, hiddenMutation: 409 },
  { name: 'admin', privateRead: true, hiddenMutation: 409 },
] as const;
type ActorName = (typeof ACTORS)[number]['name'];
type MemberName = Exclude<ActorName, 'anonymous'>;
let people: Record<MemberName, SeededUser>;
let listCategory: string;
let listPosts: PostRow[];
let otherPrivatePost: PostRow;

const matrix = ACTORS.flatMap((actor) =>
  STATES.flatMap((state) =>
    (['id', 'slug'] as const).map((address) => ({
      actor: actor.name, privateRead: actor.privateRead, hiddenMutation: actor.hiddenMutation,
      state, stateName: state.name, address,
    })),
  ),
);

function tokenFor(actor: ActorName) {
  return actor === 'anonymous' ? undefined : people[actor].token;
}

async function makePost(state: PostState, extra: Partial<typeof posts.$inferInsert> = {}) {
  const key = randomUUID();
  const [post] = await db.insert(posts).values({
    title: `Visibility ${state.name} ${key}`,
    slug: `visibility-${state.name}-${key}`,
    content: '<p>Private or public post body.</p>',
    author_id: people.owner.id,
    status: state.status,
    is_published: state.is_published,
    ...extra,
  }).returning();
  return post!;
}

async function makeComment(postId: string, authorId = people.owner.id, parentId?: string) {
  const [comment] = await db.insert(comments).values({
    post_id: postId,
    author_id: authorId,
    parent_id: parentId ?? null,
    content: '<p>Existing comment.</p>',
  }).returning();
  return comment!;
}

async function snapshot(postId: string) {
  const [[post], thread, reactionRows, saved] = await Promise.all([
    db.select().from(posts).where(eq(posts.id, postId)),
    db.select().from(comments).where(eq(comments.post_id, postId)).orderBy(comments.id),
    db.select().from(reactions).where(eq(reactions.post_id, postId)).orderBy(reactions.id),
    db.select().from(bookmarks).where(eq(bookmarks.post_id, postId)).orderBy(bookmarks.id),
  ]);
  return { post, thread, reactions: reactionRows, bookmarks: saved };
}

async function expectDenied(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({
    detail: status === 401
      ? 'Not authenticated'
      : status === 404
        ? 'Post not found'
        : 'Post is not open for community interactions',
  });
  if (status === 401) expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
}

beforeAll(async () => {
  await freshDatabase();
  people = {
    unrelated: await seedUser('user'),
    owner: await seedUser('user'),
    moderator: await seedUser('moderator'),
    admin: await seedUser('admin'),
  };
  const [category] = await db.insert(categories).values({
    name: 'G4 list fixtures', slug: 'g4-list-fixtures',
  }).returning();
  listCategory = category!.id;
  listPosts = [];
  for (const state of STATES) {
    listPosts.push(await makePost(state, {
      category_id: listCategory, created_at: new Date('2026-01-01T00:00:00Z'),
    }));
  }
  otherPrivatePost = await makePost(STATES[1], {
    author_id: people.unrelated.id,
    category_id: listCategory,
    created_at: new Date('2026-01-01T00:00:00Z'),
  });
});

afterAll(closeDatabase);

describe('G4 read matrix', () => {
  it.each(matrix)(
    'VIS-01/02/03/08 $actor reads $stateName via $address without leaking hidden data',
    async ({ actor, privateRead, state, address }) => {
      const post = await makePost(state);
      const parent = await makeComment(post.id);
      const reply = await makeComment(post.id, people.owner.id, parent.id);
      await db.insert(reactions).values([
        { user_id: people.owner.id, post_id: post.id, reaction_type: 'helpful' },
        { user_id: people.unrelated.id, post_id: post.id, reaction_type: 'like' },
      ]);
      await db.update(posts).set({ comment_count: 2, helpful_count: 1 }).where(eq(posts.id, post.id));
      const before = await snapshot(post.id);
      const canRead = state.name === 'public' || privateRead;
      const key = post[address];
      const token = tokenFor(actor);

      const detail = await request(`/posts/${key}`, { token });
      const tree = await request(`/posts/${key}/comments`, { token });
      const counts = await request(`/posts/${key}/reactions`, { token });
      if (!canRead) {
        for (const response of [detail, tree, counts]) await expectDenied(response, 404);
        expect(await snapshot(post.id)).toEqual(before);
        return;
      }

      expect(detail.status).toBe(200);
      expect(await detail.json()).toMatchObject({
        id: post.id, content: post.content, status: state.status,
        is_published: state.is_published, view_count: 1,
      });
      expect(tree.status).toBe(200);
      expect(await tree.json()).toMatchObject([{ id: parent.id, replies: [{ id: reply.id }] }]);
      expect(counts.status).toBe(200);
      expect(await counts.json()).toEqual({
        counts: { helpful: 1, like: 1, informative: 0, total: 2 },
        user_reaction: actor === 'owner' ? 'helpful' : actor === 'unrelated' ? 'like' : null,
      });
      expect(await snapshot(post.id)).toEqual({
        ...before, post: { ...before.post, view_count: 1 },
      });
    },
  );

  it.each(['invalid', 'refresh', 'inactive'] as const)(
    'treats %s credentials as anonymous across every optional-auth post surface',
    async (credential) => {
      const viewer = await seedUser('admin');
      const post = await makePost(STATES[3], { author_id: viewer.id });
      let token = viewer.token;
      if (credential === 'invalid') token = 'not.a.valid-token';
      if (credential === 'refresh') token = await createRefreshToken(viewer.id, viewer.role);
      if (credential === 'inactive') {
        await db.update(users).set({ is_active: false }).where(eq(users.id, viewer.id));
      }
      const before = await snapshot(post.id);
      for (const suffix of ['', '/comments', '/reactions']) {
        await expectDenied(await request(`/posts/${post.slug}${suffix}`, { token }), 404);
      }
      const list = await request(`/posts?author_id=${viewer.id}&status=all`, { token });
      expect(list.status).toBe(200);
      expect((await list.json()).items).toEqual([]);
      expect(await snapshot(post.id)).toEqual(before);
    },
  );

  it.each(['id', 'slug'] as const)('returns the same post error for missing and hidden %s lookups', async (address) => {
    const post = await makePost(STATES[1]);
    const keys = [post[address], address === 'id' ? randomUUID() : 'g4-missing-post'];
    for (const key of keys) {
      for (const suffix of ['', '/comments', '/reactions']) {
        await expectDenied(await request(`/posts/${key}${suffix}`, { token: people.unrelated.token }), 404);
      }
    }
  });
});

describe('G4 community mutation matrix', () => {
  it.each(matrix)(
    'VIS-04/05/06 $actor mutates $stateName via $address only when public',
    async ({ actor, hiddenMutation, state, address }) => {
      const post = await makePost(state);
      const parent = await makeComment(post.id);
      await db.update(posts).set({ comment_count: 1 }).where(eq(posts.id, post.id));
      const before = await snapshot(post.id);
      const key = post[address];
      const token = tokenFor(actor);
      const responses = [
        await request(`/posts/${key}/comments`, {
          method: 'POST', token, body: json({ content: '<p>New comment.</p>' }),
        }),
        await request(`/posts/${key}/comments`, {
          method: 'POST', token, body: json({ content: '<p>New reply.</p>', parent_id: parent.id }),
        }),
        await request(`/posts/${key}/reactions`, {
          method: 'POST', token, body: json({ reaction_type: 'helpful' }),
        }),
        await request(`/posts/${key}/bookmark`, { method: 'POST', token }),
      ];

      if (actor === 'anonymous' || state.name !== 'public') {
        for (const response of responses) await expectDenied(response, hiddenMutation);
        expect(await snapshot(post.id)).toEqual(before);
        return;
      }

      expect(responses.map((response) => response.status)).toEqual([201, 201, 200, 200]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      expect(bodies[0]).toMatchObject({ post_id: post.id, author: { id: people[actor].id } });
      expect(bodies[1]).toMatchObject({ post_id: post.id, parent_id: parent.id });
      expect(bodies[2]).toMatchObject({ action: 'added', current_reaction: 'helpful' });
      expect(bodies[3]).toEqual({ is_bookmarked: true });
      const after = await snapshot(post.id);
      expect(after.post).toMatchObject({ comment_count: 3, helpful_count: 1, view_count: 0 });
      expect(after.thread).toHaveLength(3);
      expect(after.reactions).toMatchObject([{ user_id: people[actor].id, reaction_type: 'helpful' }]);
      expect(after.bookmarks).toMatchObject([{ user_id: people[actor].id }]);
    },
  );

  it('preserves cross-post parent validation without inserting a reply or incrementing counts', async () => {
    const post = await makePost(STATES[0]);
    const other = await makePost(STATES[0]);
    const foreignParent = await makeComment(other.id);
    const before = await snapshot(post.id);
    const response = await request(`/posts/${post.slug}/comments`, {
      method: 'POST', token: people.owner.token,
      body: json({ content: '<p>Invalid reply.</p>', parent_id: foreignParent.id }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: 'Parent comment belongs to a different post' });
    expect(await snapshot(post.id)).toEqual(before);
  });

  it.each(
    ACTORS.filter((actor) => actor.name !== 'anonymous').flatMap((actor) =>
      STATES.slice(1).map((state) => ({
        actor: actor.name as MemberName, state, stateName: state.name, denied: actor.hiddenMutation,
      })),
    ),
  )('does not remove or switch an existing reaction on $stateName for $actor', async ({ actor, state, denied }) => {
    const post = await makePost(state, { helpful_count: 1 });
    await db.insert(reactions).values({
      user_id: people[actor].id, post_id: post.id, reaction_type: 'helpful',
    });
    const before = await snapshot(post.id);
    for (const reaction_type of ['helpful', 'like']) {
      const response = await request(`/posts/${post.id}/reactions`, {
        method: 'POST', token: people[actor].token, body: json({ reaction_type }),
      });
      await expectDenied(response, denied);
      expect(await snapshot(post.id)).toEqual(before);
    }
  });

  it('checks hidden-post access before validating comment/reaction bodies', async () => {
    const post = await makePost(STATES[1]);
    const before = await snapshot(post.id);
    for (const actor of ['unrelated', 'owner'] as const) {
      for (const suffix of ['/comments', '/reactions']) {
        const response = await request(`/posts/${post.id}${suffix}`, {
          method: 'POST', token: people[actor].token, body: '{invalid json',
        });
        await expectDenied(response, actor === 'unrelated' ? 404 : 409);
      }
    }
    expect(await snapshot(post.id)).toEqual(before);
  });
});

describe('G4 bookmark state transitions', () => {
  it.each(
    ACTORS.filter((actor) => actor.name !== 'anonymous').flatMap((actor) =>
      STATES.slice(1).map((state) => ({
        actor: actor.name as MemberName, state, stateName: state.name, denied: actor.hiddenMutation,
      })),
    ),
  )('VIS-06 hides $stateName bookmarks from $actor and preserves a deterministic toggle', async ({ actor, state, denied }) => {
    const post = await makePost(STATES[0]);
    const token = people[actor].token;
    const added = await request(`/posts/${post.id}/bookmark`, { method: 'POST', token });
    expect(added.status).toBe(200);
    expect(await added.json()).toEqual({ is_bookmarked: true });
    const initial = await request('/users/me/bookmarks?limit=50', { token });
    expect((await initial.json()).items.map((item: { id: string }) => item.id)).toContain(post.id);

    await db.update(posts).set({ status: state.status, is_published: state.is_published })
      .where(eq(posts.id, post.id));
    const before = await snapshot(post.id);
    const hidden = await request('/users/me/bookmarks?limit=50', { token });
    expect(hidden.status).toBe(200);
    const page = await hidden.json();
    expect(page.items.map((item: { id: string }) => item.id)).not.toContain(post.id);
    expect(page.items.every((item: { status: string; is_published: boolean }) =>
      item.status === 'approved' && item.is_published)).toBe(true);
    await expectDenied(await request(`/posts/${post.slug}/bookmark`, { method: 'POST', token }), denied);
    expect(await snapshot(post.id)).toEqual(before);

    // A hidden bookmark is not silently deleted. Once public again, one toggle removes it.
    await db.update(posts).set({ status: 'approved', is_published: true }).where(eq(posts.id, post.id));
    const removed = await request(`/posts/${post.id}/bookmark`, { method: 'POST', token });
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ is_bookmarked: false });
    expect((await snapshot(post.id)).bookmarks).toHaveLength(0);
  });

  it('drops deleted posts from the bookmark feed through the existing cascade', async () => {
    const post = await makePost(STATES[0]);
    await db.insert(bookmarks).values({ user_id: people.unrelated.id, post_id: post.id });
    await db.delete(posts).where(eq(posts.id, post.id));
    expect(await db.select().from(bookmarks).where(eq(bookmarks.post_id, post.id))).toHaveLength(0);
    const response = await request('/users/me/bookmarks?limit=50', { token: people.unrelated.token });
    expect(response.status).toBe(200);
    expect((await response.json()).items.map((item: { id: string }) => item.id)).not.toContain(post.id);
  });

  it('filters hidden bookmarks before cursor pagination and keeps bookmark-time ordering', async () => {
    const viewer = await seedUser('user');
    const savedPosts: PostRow[] = [];
    for (let index = 0; index < 7; index += 1) {
      const state = index % 2 === 0 ? STATES[0] : STATES[1];
      const post = await makePost(state);
      savedPosts.push(post);
      await db.insert(bookmarks).values({
        user_id: viewer.id, post_id: post.id,
        created_at: new Date(`2026-02-0${index + 1}T00:00:00Z`),
      });
    }
    const collected: string[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
      const query = new URLSearchParams({ limit: '2' });
      if (cursor) query.set('cursor', cursor);
      const response = await request(`/users/me/bookmarks?${query}`, { token: viewer.token });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.items).toHaveLength(2);
      collected.push(...body.items.map((post: { id: string }) => post.id));
      cursor = body.next_cursor;
      expect(body.has_more).toBe(cursor !== null);
      if (!cursor) break;
    }
    expect(collected).toEqual(savedPosts.filter((_, index) => index % 2 === 0).reverse().map((post) => post.id));
    expect(new Set(collected).size).toBe(4);
  });
});

describe('G4 list visibility and cursor stability', () => {
  const queryCases = ACTORS.flatMap((actor) =>
    ['', 'all', 'pending', 'approved', 'rejected', 'bogus'].flatMap((status) =>
      [false, true].map((authorQuery) => ({
        actor: actor.name, status, authorQuery,
        label: `${actor.name} status=${status || '(default)'} author=${authorQuery}`,
      })),
    ),
  );

  it.each(queryCases)('VIS-07 keeps $label within its intended state set', async ({ actor, status, authorQuery }) => {
    const query = new URLSearchParams({ category: listCategory, limit: '50' });
    if (status) query.set('status', status);
    if (authorQuery) query.set('author_id', people.owner.id);
    const response = await request(`/posts?${query}`, { token: tokenFor(actor) });
    expect(response.status).toBe(200);
    const body = await response.json();

    const ownsQuery = actor === 'owner' && authorQuery;
    const staffQuery = (actor === 'moderator' || actor === 'admin') &&
      ['all', 'pending', 'approved', 'rejected'].includes(status);
    const candidates = authorQuery ? listPosts : [...listPosts, otherPrivatePost];
    const expected = candidates.filter((post) => {
      if (!ownsQuery && !staffQuery) return post.id === listPosts[0]!.id;
      if (status === 'pending') return post.status === 'pending';
      if (status === 'rejected') return post.status === 'rejected';
      if (status === 'approved') return post.status === 'approved';
      return true;
    });
    expect(body.items.map((post: { id: string }) => post.id).sort()).toEqual(expected.map((p) => p.id).sort());
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeNull();
  });

  it.each(['owner', 'moderator', 'admin'] as const)(
    'preserves newest/id cursor order across unpublished private rows for %s',
    async (actor) => {
      const collected: string[] = [];
      let cursor: string | null = null;
      for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
        const query = new URLSearchParams({
          category: listCategory, author_id: people.owner.id, status: 'all', limit: '1',
        });
        if (cursor) query.set('cursor', cursor);
        const response = await request(`/posts?${query}`, { token: people[actor].token });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.items).toHaveLength(1);
        collected.push(body.items[0].id);
        cursor = body.next_cursor;
        expect(body.has_more).toBe(cursor !== null);
        if (!cursor) break;
      }
      expect(collected).toEqual(listPosts.map((p) => p.id).sort().reverse());
      expect(new Set(collected).size).toBe(4);
    },
  );

  it('does not reveal anonymous authors through the author filter', async () => {
    const post = await makePost(STATES[0], { is_anonymous: true });
    const path = `/posts?author_id=${people.owner.id}&search=${post.slug.slice(-36)}&status=all`;
    for (const actor of ['anonymous', 'unrelated'] as const) {
      const response = await request(path, { token: tokenFor(actor) });
      expect(response.status).toBe(200);
      expect((await response.json()).items).toEqual([]);
    }
    const own = await request(path, { token: people.owner.token });
    expect(own.status).toBe(200);
    expect((await own.json()).items.map((item: { id: string }) => item.id)).toContain(post.id);
  });
});

describe('G4 existing editorial permissions', () => {
  it.each(STATES)('keeps owner/staff editing and hides unrelated edits of $name posts', async (state) => {
    const post = await makePost(state);
    const denied = await request(`/posts/${post.slug}`, {
      method: 'PUT', token: people.unrelated.token, body: json({ content: '<p>Not my post.</p>' }),
    });
    expect(denied.status).toBe(state.name === 'public' ? 403 : 404);
    expect(await denied.json()).toEqual({
      detail: state.name === 'public' ? 'Not enough permissions to edit this post' : 'Post not found',
    });
    expect((await snapshot(post.id)).post).toEqual(post);

    for (const actor of ['owner', 'moderator', 'admin'] as const) {
      const updated = await request(`/posts/${post.slug}`, {
        method: 'PUT', token: people[actor].token, body: json({ content: `<p>Edited by ${actor}.</p>` }),
      });
      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({
        id: post.id, content: `<p>Edited by ${actor}.</p>`,
        status: state.status, is_published: state.is_published,
      });
    }
  });

  it.each(STATES)('checks post visibility before comment edit/delete ownership on $name', async (state) => {
    const post = await makePost(state);
    const comment = await makeComment(post.id, people.unrelated.id);
    const before = await snapshot(post.id);
    const edit = await request(`/comments/${comment.id}`, {
      method: 'PUT', token: people.unrelated.token, body: json({ content: '<p>Comment edit.</p>' }),
    });
    const remove = await request(`/comments/${comment.id}`, {
      method: 'DELETE', token: people.unrelated.token,
    });
    if (state.name !== 'public') {
      for (const response of [edit, remove]) {
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ detail: 'Comment not found' });
      }
      expect(await snapshot(post.id)).toEqual(before);
    } else {
      expect(edit.status).toBe(200);
      expect(remove.status).toBe(204);
    }
  });

  it.each(['PUT', 'DELETE'])('makes hidden and missing comment errors identical for %s', async (method) => {
    const post = await makePost(STATES[1]);
    const comment = await makeComment(post.id, people.unrelated.id);
    const before = await snapshot(post.id);
    const responses = [];
    for (const id of [comment.id, randomUUID(), 'not-a-comment']) {
      responses.push(await request(`/comments/${id}`, {
        method, token: people.unrelated.token,
        body: method === 'PUT' ? json({ content: '<p>Attempted edit.</p>' }) : undefined,
      }));
    }
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ detail: 'Comment not found' });
    }
    expect(await snapshot(post.id)).toEqual(before);
  });

  it('does not grant the post owner permission to edit another member’s comment', async () => {
    const post = await makePost(STATES[1]);
    const comment = await makeComment(post.id, people.unrelated.id);
    const response = await request(`/comments/${comment.id}`, {
      method: 'PUT', token: people.owner.token, body: json({ content: '<p>Not my comment.</p>' }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ detail: 'Not enough permissions to edit this comment' });
    expect(await db.select().from(comments).where(eq(comments.id, comment.id))).toEqual([comment]);
  });

  it.each(['moderator', 'admin'] as const)('retains %s comment moderation on a hidden post', async (actor) => {
    const post = await makePost(STATES[1]);
    const comment = await makeComment(post.id, people.unrelated.id);
    const edited = await request(`/comments/${comment.id}`, {
      method: 'PUT', token: people[actor].token, body: json({ content: '<p>Moderated comment.</p>' }),
    });
    expect(edited.status).toBe(200);
    const removed = await request(`/comments/${comment.id}`, { method: 'DELETE', token: people[actor].token });
    expect(removed.status).toBe(204);
  });

  it.each(STATES)('checks visibility before delete/accepted-answer permissions on $name', async (state) => {
    const post = await makePost(state, { post_type: 'question' });
    const comment = await makeComment(post.id);
    const before = await snapshot(post.id);
    const accepted = await request(`/posts/${post.slug}/accepted-answer`, {
      method: 'PUT', token: people.unrelated.token, body: json({ comment_id: comment.id }),
    });
    const deleted = await request(`/posts/${post.slug}`, { method: 'DELETE', token: people.unrelated.token });
    const expected = state.name === 'public' ? 403 : 404;
    expect(accepted.status).toBe(expected);
    expect(deleted.status).toBe(expected);
    if (expected === 404) {
      expect(await accepted.json()).toEqual({ detail: 'Post not found' });
      expect(await deleted.json()).toEqual({ detail: 'Post not found' });
    }
    expect(await snapshot(post.id)).toEqual(before);
    const own = await request(`/posts/${post.slug}/accepted-answer`, {
      method: 'PUT', token: people.owner.token, body: json({ comment_id: comment.id }),
    });
    expect(own.status).toBe(200);
    expect(await own.json()).toEqual({ success: true, accepted_comment_id: comment.id });
  });

  it('does not treat a doctor role as staff for a hidden post', async () => {
    const doctor = await seedUser('doctor');
    const post = await makePost(STATES[3]);
    for (const suffix of ['', '/comments', '/reactions']) {
      await expectDenied(await request(`/posts/${post.id}${suffix}`, { token: doctor.token }), 404);
    }
    expect(await db.select().from(reactions).where(and(eq(reactions.user_id, doctor.id), eq(reactions.post_id, post.id))))
      .toHaveLength(0);
  });
});
