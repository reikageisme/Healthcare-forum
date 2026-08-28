import React, { useEffect, useState } from 'react';
import {
  Users,
  FileText,
  Clock,
  Flag,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { AdminStats, Post, Report } from '../../types';
import StatCard from '../../components/admin/StatCard';
import UserGrowthChart from '../../components/admin/UserGrowthChart';
import PostActivityChart from '../../components/admin/PostActivityChart';
import RejectModal from '../../components/admin/RejectModal';
import { formatDate, getAvatarUrl, getPostTypeInfo } from '../../lib/utils';

export const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [openReports, setOpenReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reject modal state
  const [rejectModalPost, setRejectModalPost] = useState<Post | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const [statsData, postsRes, reportsRes] = await Promise.allSettled([
        adminService.getStats(30),
        adminService.getModerationPosts({ status: 'pending', limit: 5 }),
        adminService.getReports({ status: 'open', limit: 5 }),
      ]);

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }
      if (postsRes.status === 'fulfilled') {
        setPendingPosts(postsRes.value.items || []);
      }
      if (reportsRes.status === 'fulfilled') {
        setOpenReports(reportsRes.value.items || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleQuickApprove = async (postId: string) => {
    try {
      setIsActionLoading(true);
      await adminService.approvePost(postId);
      setPendingPosts((prev) => prev.filter((p) => p.id !== postId));
      fetchDashboardData();
    } catch (err) {
      console.error('Approve failed', err);
      alert('Không thể phê duyệt bài viết.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleQuickReject = async (reason: string) => {
    if (!rejectModalPost) return;
    try {
      setIsActionLoading(true);
      await adminService.rejectPost(rejectModalPost.id, reason);
      setPendingPosts((prev) => prev.filter((p) => p.id !== rejectModalPost.id));
      setRejectModalPost(null);
      fetchDashboardData();
    } catch (err) {
      console.error('Reject failed', err);
      alert('Không thể từ chối bài viết.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Extract totals with fallback support for flat or nested responses
  const totalUsers = stats?.totals?.total_users ?? stats?.total_users ?? 0;
  const totalPosts = stats?.totals?.total_posts ?? stats?.total_posts ?? 0;
  const totalComments = stats?.totals?.total_comments ?? stats?.total_comments ?? 0;
  const pendingCount = stats?.totals?.total_pending_posts ?? stats?.pending_posts ?? stats?.total_pending_posts ?? 0;
  const openReportsCount = stats?.totals?.total_open_reports ?? stats?.open_reports ?? stats?.total_open_reports ?? 0;
  const totalDoctors = stats?.totals?.total_doctors ?? stats?.total_doctors ?? 0;
  const timeSeriesData = stats?.time_series ?? stats?.daily_metrics ?? [];

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Tổng quan Hệ thống
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Theo dõi chỉ số tăng trưởng, hàng chờ kiểm duyệt và báo cáo vi phạm 30 ngày qua
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDashboardData}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-border hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-xs disabled:opacity-50"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-primary' : ''} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Tổng Thành viên"
          value={totalUsers}
          icon={Users}
          color="blue"
          subtext={totalDoctors > 0 ? `Bao gồm ${totalDoctors} Bác sĩ xác thực` : 'Đang hoạt động trên nền tảng'}
        />

        <StatCard
          title="Tổng Bài viết"
          value={totalPosts}
          icon={FileText}
          color="emerald"
          subtext={`${totalComments} tổng số bình luận`}
        />

        <StatCard
          title="Chờ Kiểm duyệt"
          value={pendingCount}
          icon={Clock}
          color="amber"
          subtext="Bài viết đang trong hàng chờ"
        />

        <StatCard
          title="Báo cáo vi phạm"
          value={openReportsCount}
          icon={Flag}
          color="rose"
          subtext="Cần kiểm duyệt viên xử lý"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white rounded-2xl p-6 border border-border shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Tăng trưởng Người dùng</h3>
              <p className="text-xs text-slate-500">Số lượng tài khoản đăng ký mới 30 ngày qua</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
              30 ngày
            </span>
          </div>

          <UserGrowthChart data={timeSeriesData} />
        </div>

        {/* Post Activity Chart */}
        <div className="bg-white rounded-2xl p-6 border border-border shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Hoạt động Đăng bài & Bình luận</h3>
              <p className="text-xs text-slate-500">Tần suất thảo luận y khoa mỗi ngày</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">
              30 ngày
            </span>
          </div>

          <PostActivityChart data={timeSeriesData} />
        </div>
      </div>

      {/* Quick Action Panels (Pending Queue & Open Reports) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Moderation Queue Preview */}
        <div className="bg-white rounded-2xl p-6 border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Hàng chờ duyệt nhanh</h3>
              </div>
              <Link
                to="/admin/moderation"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Xem tất cả ({pendingCount}) <ArrowRight size={14} />
              </Link>
            </div>

            {pendingPosts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Hiện không có bài viết nào đang chờ duyệt.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pendingPosts.map((post) => {
                  const typeInfo = getPostTypeInfo(post.post_type || post.type);
                  return (
                    <div key={post.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${typeInfo.bgBadge}`}>
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(post.created_at || post.createdAt)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={post.title}>
                          {post.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          Tác giả: {post.author?.full_name || post.author?.username}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickApprove(post.id)}
                          disabled={isActionLoading}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Duyệt nhanh"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectModalPost(post)}
                          disabled={isActionLoading}
                          className="p-1.5 text-danger hover:bg-red-50 rounded-lg transition-colors"
                          title="Từ chối"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Open Reports Preview */}
        <div className="bg-white rounded-2xl p-6 border border-border shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Flag size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Báo cáo vi phạm mới</h3>
              </div>
              <Link
                to="/admin/reports"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                Xem tất cả ({openReportsCount}) <ArrowRight size={14} />
              </Link>
            </div>

            {openReports.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                Không có báo cáo vi phạm mở nào cần xử lý.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {openReports.map((report) => (
                  <div key={report.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 uppercase">
                          {String(report.target_type)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(report.created_at)}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-rose-700 truncate">
                        Lý do: {report.reason}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        Người gửi: {report.reporter?.full_name || report.reporter?.username || 'Thành viên'}
                      </p>
                    </div>

                    <Link
                      to="/admin/reports"
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                    >
                      Xử lý
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalPost && (
        <RejectModal
          isOpen={!!rejectModalPost}
          postTitle={rejectModalPost.title}
          onClose={() => setRejectModalPost(null)}
          onConfirm={handleQuickReject}
          isSubmitting={isActionLoading}
        />
      )}
    </div>
  );
};

export default AdminDashboardPage;
