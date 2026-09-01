import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
import { postService } from '../../services/postService';
import { Category, Post } from '../../types';
import { formatDate } from '../../lib/utils';
import { flattenTree, indentLabel } from '../../lib/categoryTree';

const PAGE_SIZE = 20;

/**
 * The moderation queue only ever showed pending posts, so an approved post
 * with a typo could not be found from the admin area at all. This page lists
 * every post whatever its status, with edit and delete on each row.
 */
export const AdminPostsPage: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await adminService.getModerationPosts({
        status: statusFilter,
        search: search.trim() || undefined,
        category_id: categoryFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setPosts(res.items || []);
      setTotal(res.total ?? (res.items ? res.items.length : 0));
    } catch (err) {
      console.error('Failed to load posts', err);
      setErrorMsg('Không tải được danh sách bài viết. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, search, page]);

  useEffect(() => {
    categoryService
      .getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleApprove = async (post: Post) => {
    try {
      setBusyId(post.id);
      await adminService.approvePost(post.id);
      await fetchPosts();
    } catch (err) {
      console.error('Failed to approve post', err);
      setErrorMsg('Không duyệt được bài viết.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (post: Post) => {
    const reason = window.prompt(`Lý do từ chối "${post.title}"?`, '');
    if (reason === null) return;
    try {
      setBusyId(post.id);
      await adminService.rejectPost(post.id, reason || undefined);
      await fetchPosts();
    } catch (err) {
      console.error('Failed to reject post', err);
      setErrorMsg('Không từ chối được bài viết.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (post: Post) => {
    if (!window.confirm(`Xóa vĩnh viễn "${post.title}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      setBusyId(post.id);
      await postService.deletePost(post.id);
      await fetchPosts();
    } catch (err) {
      console.error('Failed to delete post', err);
      setErrorMsg('Không xóa được bài viết.');
    } finally {
      setBusyId(null);
    }
  };

  const renderStatus = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 size={11} /> Đã duyệt
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-200">
            <XCircle size={11} /> Đã từ chối
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
            <Clock size={11} /> Chờ duyệt
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản lý Bài viết
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Toàn bộ bài viết của diễn đàn — tìm kiếm, sửa nội dung, đổi trạng thái hoặc xóa
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPosts}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-border hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-border shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc nội dung bài viết..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Đã từ chối</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium max-w-[220px]"
          >
            <option value="">Tất cả chuyên mục</option>
            {flattenTree(categories).map(({ item: cat, depth }) => (
              <option key={cat.id} value={cat.id}>
                {indentLabel(cat.name, depth)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-danger text-xs font-medium rounded-xl px-4 py-3">
          {errorMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic">
            Đang tải danh sách bài viết...
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Không tìm thấy bài viết nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Bài viết</th>
                  <th className="py-3.5 px-4">Tác giả</th>
                  <th className="py-3.5 px-4">Chuyên mục</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Tương tác</th>
                  <th className="py-3.5 px-4">Ngày đăng</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {posts.map((post) => {
                  const status = post.status?.toLowerCase();
                  const isBusy = busyId === post.id;

                  return (
                    <tr key={post.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 max-w-[320px]">
                        <Link
                          to={`/posts/${post.id}`}
                          className="font-bold text-slate-900 leading-snug hover:text-primary line-clamp-2"
                        >
                          {post.title}
                        </Link>
                        {post.rejection_reason && (
                          <p className="text-[11px] text-danger mt-0.5 line-clamp-1">
                            Lý do từ chối: {post.rejection_reason}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {post.author?.full_name || post.author?.username || '—'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {post.category?.name || <span className="text-slate-400">Chưa phân loại</span>}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatus(post.status)}</td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        <span className="inline-flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Eye size={12} /> {post.view_count ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle size={12} /> {post.comment_count ?? 0}
                          </span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {formatDate(post.created_at)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          {status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(post)}
                              disabled={isBusy}
                              title="Duyệt bài"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                          {status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleReject(post)}
                              disabled={isBusy}
                              title="Từ chối bài"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-40"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                          <Link
                            to={`/posts/${post.id}/edit`}
                            title="Sửa bài viết"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors inline-flex"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(post)}
                            disabled={isBusy}
                            title="Xóa bài viết"
                            className="p-1.5 rounded-lg text-danger hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            Trang <span className="font-bold text-slate-700">{page}</span> / {totalPages} —{' '}
            {total} bài viết
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPostsPage;
