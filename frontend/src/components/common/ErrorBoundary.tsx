import React from 'react';

interface State {
  error: Error | null;
}

/**
 * A render error anywhere below here used to blank the whole page: React
 * unmounts the entire tree when nothing catches, and the reader is left
 * staring at white with no way back and nothing to report.
 *
 * The bug that made this necessary was a hook called below an early return
 * in PostDetailPage — fixed — but "one mistake blanks the site" is the part
 * worth removing, not just that one mistake.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[render]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl p-8 text-center border border-border shadow-sm">
        <h2 className="text-xl font-extrabold text-text mb-2">Trang gặp sự cố hiển thị</h2>
        <p className="text-sm text-text-secondary mb-6">
          Đã có lỗi khi hiển thị nội dung này. Bạn thử tải lại trang, nếu vẫn lỗi vui lòng báo
          quản trị viên.
        </p>
        <details className="text-left mb-6">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
            Chi tiết lỗi (gửi cho quản trị viên)
          </summary>
          <pre className="mt-2 p-3 bg-slate-50 border border-border rounded-lg text-[11px] text-slate-600 whitespace-pre-wrap break-words max-h-48 overflow-auto">
            {this.state.error.message || String(this.state.error)}
          </pre>
        </details>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Tải lại trang
          </button>
          <a
            href="/"
            className="px-5 py-2.5 border border-border text-text text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
