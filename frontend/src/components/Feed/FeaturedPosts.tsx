import React, { useEffect, useState } from 'react';
import { Eye, Heart, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { postService } from '../../services/postService';
import { Post } from '../../types';
import { formatRelativeTime, getAvatarUrl } from '../../lib/utils';

export const FeaturedPosts: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    postService
      .getPosts({ limit: 3, sort_by: 'helpful' })
      .then((page) => setPosts(page.items))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && posts.length === 0) return null;

  return (
    <section className="app-card mb-5 overflow-hidden p-4 sm:p-5" aria-labelledby="featured-posts-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="featured-posts-title" className="section-title">Bài viết nổi bật</h2>
            <p className="text-xs text-text-secondary">Nội dung hữu ích được cộng đồng quan tâm</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(loading ? Array.from({ length: 3 }) : posts).map((item, index) => {
          if (!item) {
            return <div key={index} className="h-56 animate-pulse rounded-2xl bg-sidebar" />;
          }
          const post = item as Post;
          return (
            <article
              key={post.id}
              className="group overflow-hidden rounded-2xl border border-border bg-bg transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
            >
              <Link to={`/posts/${post.id}`} className="block">
                {post.thumbnail ? (
                  <img
                    src={post.thumbnail}
                    alt=""
                    className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="h-28 bg-gradient-to-br from-primary/90 via-primary to-cyan-500 p-4 text-white">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">
                      Medic Việt Nam
                    </span>
                    <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug">{post.title}</p>
                  </div>
                )}
              </Link>
              <div className="p-3.5">
                <Link
                  to={`/posts/${post.id}`}
                  className="line-clamp-2 text-sm font-bold leading-snug text-text transition-colors group-hover:text-primary"
                >
                  {post.title}
                </Link>
                <div className="mt-3 flex items-center gap-2">
                  <img
                    src={getAvatarUrl(post.author, post.author?.full_name || post.author?.username)}
                    alt=""
                    className="h-6 w-6 rounded-full border border-border object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
                    {post.author?.full_name || post.author?.username || 'Cộng đồng'}
                  </span>
                  <span className="text-[10px] text-text-secondary">{formatRelativeTime(post.created_at)}</span>
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-border pt-2.5 text-[10px] font-semibold text-text-secondary">
                  <span className="inline-flex items-center gap-1"><Heart size={12} />{post.helpful_count ?? 0}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={12} />{post.comment_count ?? 0}</span>
                  <span className="inline-flex items-center gap-1"><Eye size={12} />{post.view_count ?? 0}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default FeaturedPosts;
