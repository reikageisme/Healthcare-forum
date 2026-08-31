import React from 'react';
import { BadgeCheck, EyeOff, CheckCircle2 } from 'lucide-react';
import { User } from '../../types';

/**
 * Every badge here pairs an icon with a word. Colour alone would not carry
 * the meaning for anyone who cannot see it, and on a health forum "this
 * person is a verified doctor" is the single most consequential label on the
 * page.
 */

export function isVerifiedDoctor(user?: User | null): boolean {
  return !!user?.verified_at && user.role?.toUpperCase() === 'DOCTOR';
}

/** Blue tick — earned only by an approved practising licence. */
export const VerifiedDoctorBadge: React.FC<{ user?: User | null; showWorkplace?: boolean }> = ({
  user,
  showWorkplace = false,
}) => {
  if (!isVerifiedDoctor(user)) return null;

  return (
    <>
      <span
        className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700"
        title="Bác sĩ đã xác thực giấy phép hành nghề"
      >
        <BadgeCheck size={11} aria-hidden="true" />
        BS. đã xác thực
      </span>
      {showWorkplace && user?.workplace && (
        <span className="hidden text-xs text-text-secondary sm:inline">• {user.workplace}</span>
      )}
    </>
  );
};

/** Marks content the poster chose to publish without their name. */
export const AnonymousBadge: React.FC<{ isOwn?: boolean }> = ({ isOwn = false }) => (
  <span
    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
    title={isOwn ? 'Bạn đã đăng nội dung này ẩn danh' : 'Người đăng đã chọn ẩn danh'}
  >
    <EyeOff size={11} aria-hidden="true" />
    {isOwn ? 'Bạn đăng ẩn danh' : 'Ẩn danh'}
  </span>
);

/** Answer the asker marked as the one that solved their question. */
export const AcceptedAnswerBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
    <CheckCircle2 size={11} aria-hidden="true" />
    Câu trả lời được chấp nhận
  </span>
);
