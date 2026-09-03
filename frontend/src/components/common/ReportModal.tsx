import React, { useState } from 'react';
import { X, Flag, AlertCircle, CheckCircle } from 'lucide-react';
import { reportService } from '../../services/reportService';
import { useAuth } from '../../hooks/useAuth';
import { ReportTargetType } from '../../types';
import { describeApiError } from '../../lib/apiError';

interface ReportModalProps {
  isOpen: boolean;
  targetType: 'post' | 'comment' | 'user' | 'story';
  targetId: string;
  targetTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REPORT_REASONS = [
  'Spam / Quảng cáo trái phép hoặc liên kết độc hại',
  'Thông tin y tế sai lệch, phản khoa học hoặc nguy hiểm',
  'Quấy rối, xúc phạm hoặc ngôn từ kích động thù địch',
  'Nội dung phản cảm, bạo lực hoặc vi phạm thuần phong mỹ tục',
  'Mạo danh chuyên gia y tế / Bác sĩ',
  'Lý do khác',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetType,
  targetId,
  targetTitle,
  onClose,
  onSuccess,
}) => {
  const { isAuthenticated } = useAuth();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [customDetails, setCustomDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Vui lòng đăng nhập để gửi báo cáo vi phạm.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await reportService.createReport({
        target_type: targetType as ReportTargetType,
        target_id: targetId,
        reason: selectedReason,
        details: customDetails.trim() || undefined,
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Failed to submit report', err);
      setErrorMsg(describeApiError(err, 'Không thể gửi báo cáo. Vui lòng thử lại sau.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetTypeName = () => {
    switch (targetType) {
      case 'post':
        return 'bài viết';
      case 'comment':
        return 'bình luận';
      case 'user':
        return 'người dùng';
      default:
        return 'nội dung';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 text-danger">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Flag size={18} className="text-danger" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 leading-tight">
              Báo cáo {getTargetTypeName()}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle size={28} />
            </div>
            <h4 className="font-bold text-base text-slate-900">Đã gửi báo cáo thành công!</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Cảm ơn bạn đã đóng góp xây dựng cộng đồng y tế Medic Việt Nam an toàn và đáng tin cậy.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {targetTitle && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                <span className="font-bold block text-slate-900 mb-0.5">Đối tượng:</span>
                <span className="line-clamp-2 italic font-medium">"{targetTitle}"</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-danger flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
                Lý do báo cáo vi phạm <span className="text-danger">*</span>
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="mt-0.5 text-danger focus:ring-danger"
                    />
                    <span className="text-slate-800 leading-snug">{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mô tả chi tiết (Tùy chọn):
              </label>
              <textarea
                value={customDetails}
                onChange={(e) => setCustomDetails(e.target.value)}
                placeholder="Cung cấp thêm thông tin giúp ban quản trị xác minh..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 font-bold text-white bg-danger hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
