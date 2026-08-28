import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface RejectModalProps {
  isOpen: boolean;
  postTitle?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

const REASON_PRESETS = [
  'Thông tin y tế sai lệch, nguy hiểm hoặc chưa được kiểm chứng khoa học',
  'Quảng cáo sản phẩm, thuốc hoặc dịch vụ khám chữa bệnh trái phép',
  'Nội dung spam, câu tương tác hoặc bài viết trùng lặp',
  'Vi phạm tiêu chuẩn cộng đồng, ngôn từ phản cảm hoặc quấy rối',
  'Bài viết thiếu nội dung cơ bản hoặc không phù hợp chuyên mục',
];

export const RejectModal: React.FC<RejectModalProps> = ({
  isOpen,
  postTitle,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [useCustom, setUseCustom] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = useCustom ? customReason.trim() : selectedPreset;
    if (!finalReason) {
      alert('Vui lòng chọn hoặc nhập lý do từ chối.');
      return;
    }
    await onConfirm(finalReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 text-danger">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-danger" />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Từ chối bài viết</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {postTitle && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900 block mb-0.5">Tiêu đề bài viết:</span>
              <span className="line-clamp-2">{postTitle}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Chọn lý do từ chối:
            </label>
            <div className="space-y-2">
              {REASON_PRESETS.map((preset, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs transition-colors"
                >
                  <input
                    type="radio"
                    name="reasonPreset"
                    checked={!useCustom && selectedPreset === preset}
                    onChange={() => {
                      setSelectedPreset(preset);
                      setUseCustom(false);
                    }}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <span className="text-slate-800 leading-snug">{preset}</span>
                </label>
              ))}

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs transition-colors">
                <input
                  type="radio"
                  name="reasonPreset"
                  checked={useCustom}
                  onChange={() => setUseCustom(true)}
                  className="mt-0.5 text-primary focus:ring-primary"
                />
                <span className="text-slate-800 leading-snug font-medium">Lý do khác (Nhập chi tiết)</span>
              </label>
            </div>
          </div>

          {useCustom && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chi tiết lý do từ chối:
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do chi tiết để tác giả nắm rõ thông tin..."
                rows={3}
                required
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-danger hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectModal;
