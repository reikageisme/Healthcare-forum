import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, posts } from '../db/schema.js';
import { sanitizeRichText } from '../lib/sanitize.js';
import { eq } from 'drizzle-orm';

/**
 * Rows written before the migration were stored exactly as submitted, so a
 * script planted back then is still sitting in the database waiting for the
 * next moderator to open the post. Sanitising on write only protects new
 * content; this pass cleans what is already there.
 *
 * Idempotent: rows that are already clean are left untouched, so it is safe
 * to run on every boot.
 */
async function main() {
  let postsChanged = 0;
  let commentsChanged = 0;

  const allPosts = await db.select({ id: posts.id, content: posts.content }).from(posts);
  for (const row of allPosts) {
    const clean = sanitizeRichText(row.content);
    if (clean !== row.content) {
      await db.update(posts).set({ content: clean }).where(eq(posts.id, row.id));
      postsChanged += 1;
    }
  }

  const allComments = await db
    .select({ id: comments.id, content: comments.content })
    .from(comments);
  for (const row of allComments) {
    const clean = sanitizeRichText(row.content);
    if (clean !== row.content) {
      await db.update(comments).set({ content: clean }).where(eq(comments.id, row.id));
      commentsChanged += 1;
    }
  }

  if (postsChanged === 0 && commentsChanged === 0) {
    console.log('Sanitiser: stored content already clean.');
  } else {
    console.log(`Sanitiser: cleaned ${postsChanged} post(s) and ${commentsChanged} comment(s).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
