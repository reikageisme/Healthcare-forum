import React from 'react';
import { BadgeCheck, ExternalLink, FileText, Info } from 'lucide-react';
import { Post } from '../../types';

/**
 * Nội dung này từ đâu ra, và đã có ai chịu trách nhiệm chuyên môn chưa.
 *
 * Phần lớn kho bài hiện nay là biên soạn lại từ CDC, NIH, FDA và văn bản quy
 * phạm pháp luật, đứng tên một tài khoản toà soạn. Giấu chuyện đó đi thì bác
 * sĩ đọc vài dòng là nhận ra và mất lòng tin vào cả trang; nói thẳng ra thì
 * người đọc biết mình đang cầm cái gì trên tay. Vì vậy khối này hiện cả khi
 * câu trả lời là "chưa qua duyệt chuyên môn".
 */

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('vi-VN');
}

/** Chỉ coi là đã sửa khi cách lần đăng hơn một phút, tránh nhiễu lúc tạo bài. */
function wasUpdated(post: Post): boolean {
  const created = new Date(post.created_at || post.createdAt || '').getTime();
  const updated = new Date(post.updated_at || '').getTime();
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > 60_000;
}

const ContentProvenance: React.FC<{ post: Post }> = ({ post }) => {
  const status = post.review_status ?? 'none';
  const source = post.content_source;
  const updatedLabel = wasUpdated(post) ? formatDate(post.updated_at) : null;

  // Bài do thành viên tự viết, không nguồn ngoài, chưa ai duyệt: không có gì
  // để nói thêm, và một khối trống chỉ làm loãng trang.
  if (status === 'none' && !source && !updatedLabel) return null;

  const reviewed = status === 'reviewed';
  const tone = reviewed
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <section
      className={`mb-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${tone}`}
      aria-label="Nguồn gốc nội dung"
    >
      <div className="flex items-start gap-2">
        {reviewed ? (
          <BadgeCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        ) : (
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        )}

        <div className="min-w-0">
          {reviewed ? (
            <p className="font-semibold">
              Đã qua duyệt chuyên môn
              {formatDate(post.reviewed_at) ? ` ngày ${formatDate(post.reviewed_at)}` : ''}.
            </p>
          ) : (
            <p className="font-semibold">Chưa qua duyệt chuyên môn.</p>
          )}

          {source && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1">
              <FileText size={12} aria-hidden="true" />
              <span>
                Biên soạn từ <strong className="font-semibold">{source}</strong>
              </span>
              {post.source_url && (
                <a
                  href={post.source_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-0.5 underline underline-offset-2"
                >
                  xem nguồn gốc
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              )}
            </p>
          )}

          {!reviewed && (
            <p className="mt-0.5 opacity-90">
              Thông tin mang tính tham khảo, không thay thế chẩn đoán và chỉ định của bác sĩ.
            </p>
          )}

          {updatedLabel && <p className="mt-0.5 opacity-90">Cập nhật lần cuối: {updatedLabel}.</p>}
        </div>
      </div>
    </section>
  );
};

export default ContentProvenance;
