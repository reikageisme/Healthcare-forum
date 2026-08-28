import React, { useState } from 'react';
import { X, Flag, CheckCircle, Trash2, ShieldAlert } from 'lucide-react';
import { Report } from '../../types';
import { formatDate } from '../../lib/utils';

interface ReportActionModalProps {
  isOpen: boolean;
  report: Report | null;
  onClose: () => void;
  onResolve: (reportId: string, status: string, notes: string) => Promise<void>;
  onDeleteContent: (reportId: string, targetType: string, targetId: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const ReportActionModal: React.FC<ReportActionModalProps> = ({
  isOpen,
  report,
  onClose,
  onResolve,
  onDeleteContent,
  isSubmitting = false,
}) => {
  const [resolutionNotes, setResolutionNotes] = useState('');

  if (!isOpen || !report) return null;

  const isResolved = report.status?.toLowerCase() === 'resolved';

  const handleResolve = async (status: string) => {
    await onResolve(report.id, status, resolutionNotes.trim());
  };

  const handleDeleteContent = async () => {
    if (
      window.confirm(
        'Bạn có chắc chắn muốn xóa nội dung vi phạm này không? Thao tác này sẽ gỡ bỏ nội dung và tự động đánh dấu báo cáo là đã giải quyết.'
      )
    ) {
      await onDeleteContent(report.id, String(report.target_type), report.target_id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Flag size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">Chi tiết báo cáo vi phạm</h3>
              <p className="text-xs text-slate-500">ID: {report.id.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3.5 text-xs text-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500 block mb-0.5">Đối tượng bị báo cáo</span>
              <span className="font-bold uppercase text-slate-900 bg-slate-200 px-2 py-0.5 rounded text-[11px]">
                {String(report.target_type)}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500 block mb-0.5">Thời gian gửi</span>
              <span className="font-semibold text-slate-800">{formatDate(report.created_at)}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-500 block mb-0.5">Người báo cáo</span>
            <span className="font-semibold text-slate-800">
              {report.reporter?.full_name || report.reporter?.username || report.reporter_id || 'Thành viên'}
            </span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="font-bold text-amber-900 block mb-1 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-700" /> Lý do báo cáo: {report.reason}
            </span>
            {report.details && (
              <p className="text-amber-800 mt-1 italic leading-relaxed whitespace-pre-wrap">
                "{report.details}"
              </p>
            )}
          </div>

          {report.target_preview && (
            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700 block mb-1">Xem trước nội dung đối tượng:</span>
              {report.target_preview.title && (
                <p className="font-bold text-slate-900 mb-1">{report.target_preview.title}</p>
              )}
              {report.target_preview.content && (
                <p className="text-slate-600 line-clamp-3 leading-relaxed">
                  {report.target_preview.content}
                </p>
              )}
            </div>
          )}

          {!isResolved && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú xử lý (Tùy chọn):
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Ghi chú về biện pháp đã thực hiện..."
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between flex-wrap gap-2">
          {!isResolved ? (
            <>
              <button
                type="button"
                onClick={handleDeleteContent}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-bold text-danger bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>Xóa nội dung</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve('dismissed')}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve('resolved')}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  <span>Đã xử lý</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle size={14} /> Báo cáo đã được xử lý
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportActionModal;
