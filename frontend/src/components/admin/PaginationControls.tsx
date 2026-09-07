import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  page: number;
  total: number;
  pageSize: number;
  isLoading?: boolean;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  total,
  pageSize,
  isLoading = false,
  itemLabel,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  return (
    <nav
      aria-label="Phân trang"
      className="flex items-center justify-between gap-3 flex-wrap"
    >
      <p className="text-xs text-slate-500">
        Trang <span className="font-bold text-slate-700">{currentPage}</span> / {totalPages} —{' '}
        {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Trang trước"
          className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          <ChevronLeft size={14} /> Trước
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || isLoading}
          aria-label="Trang sau"
          className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          Sau <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
};

export default PaginationControls;
