import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Folder,
  ShieldCheck,
  Calendar,
  RefreshCw,
  X,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { categoryService } from '../../services/categoryService';
import { Post, Category } from '../../types';
import RejectModal from '../../components/admin/RejectModal';
import { formatDate, getAvatarUrl, getPostTypeInfo } from '../../lib/utils';

export const AdminModerationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [rejectingPost, setRejectingPost] = useState<Post | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const data = await categoryService.getCategories();
      setCategories(data || []);
    } catch {
      // Ignore category load error
    }
  };

  const fetchModerationPosts = async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getModerationPosts({
        status: activeTab === 'all' ? undefined : activeTab,
        search: searchKeyword.trim() || undefined,
        category_id: selectedCategory || undefined,
        page,
        limit: 20,
      });

      setPosts(res.items || []);
      setTotal(res.total || (res.items ? res.items.length : 0));
    } catch (err) {
      console.error('Failed to load moderation posts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchModerationPosts();
  }, [activeTab, selectedCategory, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchModerationPosts();
  };

  const handleApprove = async (postId: string) => {
    try {
      setIsActionLoading(true);
      await adminService.approvePost(postId);
      alert('Đã phê duyệt bài viết thành công!');
      fetchModerationPosts();
    } catch (err) {
      console.error('Approve failed', err);
      alert('Không thể phê duyệt bài viết.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectingPost) return;
    try {
      setIsActionLoading(true);
      await adminService.rejectPost(rejectingPost.id, reason);
      alert('Đã từ chối bài viết.');
      setRejectingPost(null);
      fetchModerationPosts();
    } catch (err) {
      console.error('Reject failed', err);
      alert('Không thể từ chối bài viết.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
            <CheckCircle size={12} className="text-emerald-600" /> Đã duyệt
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 bg-red-100 text-red-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-red-300">
            <XCircle size={12} className="text-red-600" /> Đã từ chối
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
            <Clock size={12} className="text-amber-600" /> Chờ duyệt
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
            Hàng chờ Kiểm duyệt Bài viết
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Xem xét, phê duyệt hoặc từ chối các bài viết được thành viên gửi lên hệ thống
          </p>
        </div>

        <button
          type="button"
          onClick={fetchModerationPosts}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-border hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-border shadow-xs space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('pending');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Chờ duyệt (Pending)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('approved');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đã phê duyệt
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('rejected');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'rejected'
                ? 'bg-danger text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đã từ chối
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả bài viết
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={15} />
            </div>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo tiêu đề, tác giả..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </form>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-medium"
          >
            <option value="">Tất cả chuyên mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Post List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 text-xs italic border border-border">
            Đang tải danh sách bài viết...
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-500 text-sm border border-border">
            Không tìm thấy bài viết nào phù hợp với bộ lọc.
          </div>
        ) : (
          posts.map((post) => {
            const author = post.author;
            const isDoctor = author?.role?.toUpperCase() === 'DOCTOR';
            const typeInfo = getPostTypeInfo(post.post_type || post.type);

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl p-5 border border-border shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {getStatusBadge(post.status)}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeInfo.bgBadge}`}>
                      {typeInfo.label}
                    </span>
                    {post.category && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                        <Folder size={12} className="text-slate-400" />
                        {post.category.name}
                      </span>
                    )}
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(post.created_at || post.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1.5 line-clamp-1">
                    {post.title}
                  </h3>

                  {post.excerpt && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Rejection reason if any */}
                  {post.rejection_reason && (
                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs text-danger mb-3">
                      <span className="font-bold">Lý do từ chối:</span> {post.rejection_reason}
                    </div>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <img
                      src={getAvatarUrl(author, author?.full_name || author?.username || 'User')}
                      alt="Avatar"
                      className="w-5 h-5 rounded-full object-cover border border-border"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      {author?.full_name || author?.username || 'Người dùng'}
                    </span>
                    {isDoctor && (
                      <span className="flex items-center gap-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                        <ShieldCheck size={10} /> BS.
                      </span>
                    )}
                    {author?.specialty && (
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        ({author.specialty})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                  <button
                    type="button"
                    onClick={() => setPreviewPost(post)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <Eye size={14} />
                    <span>Xem trước</span>
                  </button>

                  {post.status?.toLowerCase() !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleApprove(post.id)}
                      disabled={isActionLoading}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle size={14} />
                      <span>Phê duyệt</span>
                    </button>
                  )}

                  {post.status?.toLowerCase() !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => setRejectingPost(post)}
                      disabled={isActionLoading}
                      className="px-3.5 py-1.5 bg-danger hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      <span>Từ chối</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal */}
      {previewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Xem trước nội dung bài viết</span>
                {getStatusBadge(previewPost.status)}
              </div>
              <button
                type="button"
                onClick={() => setPreviewPost(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <h2 className="text-xl font-extrabold text-slate-900 leading-snug">
                {previewPost.title}
              </h2>

              {previewPost.thumbnail && (
                <div className="rounded-xl overflow-hidden bg-slate-100 max-h-72">
                  <img
                    src={previewPost.thumbnail}
                    alt="Thumbnail"
                    className="w-full object-cover max-h-72"
                  />
                </div>
              )}

              <div
                className="prose prose-sm max-w-none text-slate-800 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: previewPost.content || '' }}
              />
            </div>

            <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewPost(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                {previewPost.status?.toLowerCase() !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = previewPost.id;
                      setPreviewPost(null);
                      handleApprove(id);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCircle size={14} /> Phê duyệt ngay
                  </button>
                )}
                {previewPost.status?.toLowerCase() !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = previewPost;
                      setPreviewPost(null);
                      setRejectingPost(p);
                    }}
                    className="px-4 py-2 bg-danger hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    <XCircle size={14} /> Từ chối bài viết
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPost && (
        <RejectModal
          isOpen={!!rejectingPost}
          postTitle={rejectingPost.title}
          onClose={() => setRejectingPost(null)}
          onConfirm={handleRejectConfirm}
          isSubmitting={isActionLoading}
        />
      )}
    </div>
  );
};

export default AdminModerationPage;
