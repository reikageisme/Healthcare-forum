import React, { useEffect, useState } from 'react';
import { Flag, CheckCircle, Eye, RefreshCw, AlertTriangle, User as UserIcon, MessageSquare, FileText } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Report } from '../../types';
import ReportActionModal from '../../components/admin/ReportActionModal';
import { formatDate } from '../../lib/utils';

export const AdminReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Selected report for modal
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getReports({
        status: statusFilter === 'all' ? undefined : statusFilter,
        target_type: targetTypeFilter === 'all' ? undefined : targetTypeFilter,
        page,
        limit: 20,
      });

      setReports(res.items || []);
      setTotal(res.total || (res.items ? res.items.length : 0));
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter, targetTypeFilter, page]);

  const handleResolve = async (reportId: string, status: string, notes: string) => {
    try {
      setIsActionLoading(true);
      await adminService.resolveReport(reportId, {
        status,
        resolution_notes: notes,
      });
      alert('Đã cập nhật trạng thái báo cáo!');
      setSelectedReport(null);
      fetchReports();
    } catch (err) {
      console.error('Resolve report failed', err);
      alert('Không thể cập nhật báo cáo.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteContent = async (reportId: string, targetType: string, targetId: string) => {
    try {
      setIsActionLoading(true);
      await adminService.deleteViolatingContent(targetType, targetId);
      await adminService.resolveReport(reportId, {
        status: 'resolved',
        resolution_notes: 'Nội dung vi phạm đã bị gỡ bỏ bởi Quản trị viên.',
      });
      alert('Đã gỡ bỏ nội dung vi phạm và đóng báo cáo!');
      setSelectedReport(null);
      fetchReports();
    } catch (err) {
      console.error('Delete content failed', err);
      alert('Không thể gỡ bỏ nội dung vi phạm.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getTargetIcon = (type: string) => {
    const t = type?.toLowerCase();
    switch (t) {
      case 'post':
        return <FileText size={13} className="text-blue-600" />;
      case 'comment':
        return <MessageSquare size={13} className="text-emerald-600" />;
      case 'user':
        return <UserIcon size={13} className="text-purple-600" />;
      default:
        return <Flag size={13} className="text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản lý Báo cáo Vi phạm
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Xem xét các phản hồi từ người dùng về nội dung spam, thông tin y tế sai lệch hoặc xúc phạm
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-border hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter Tabs & Target Type */}
      <div className="bg-white rounded-2xl p-4 border border-border shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('open');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'open'
                ? 'bg-danger text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Chờ xử lý (Open)
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('resolved');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Đã giải quyết (Resolved)
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả báo cáo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Đối tượng:</span>
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium"
          >
            <option value="all">Tất cả đối tượng</option>
            <option value="post">Bài viết (Post)</option>
            <option value="comment">Bình luận (Comment)</option>
            <option value="user">Người dùng (User)</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic">
            Đang tải dữ liệu báo cáo...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Không có báo cáo nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Loại đối tượng</th>
                  <th className="py-3.5 px-4">Lý do & Chi tiết</th>
                  <th className="py-3.5 px-4">Người báo cáo</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report) => {
                  const isOpen = report.status?.toLowerCase() === 'open';

                  return (
                    <tr key={report.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700 uppercase text-[10px]">
                          {getTargetIcon(String(report.target_type))}
                          {String(report.target_type)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        <p className="font-bold text-slate-900 line-clamp-1">{report.reason}</p>
                        {report.details && (
                          <p className="text-slate-500 text-[11px] line-clamp-1 mt-0.5 italic">
                            "{report.details}"
                          </p>
                        )}
                        {report.target_title && (
                          <p className="text-slate-400 text-[10px] truncate mt-0.5">
                            Mục tiêu: {report.target_title}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                        {report.reporter?.full_name || report.reporter?.username || 'Ẩn danh'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {formatDate(report.created_at)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            <AlertTriangle size={11} /> Chờ xử lý
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={11} /> Đã xử lý
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReport(report)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedReport && (
        <ReportActionModal
          isOpen={!!selectedReport}
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onResolve={handleResolve}
          onDeleteContent={handleDeleteContent}
          isSubmitting={isActionLoading}
        />
      )}
    </div>
  );
};

export default AdminReportsPage;
