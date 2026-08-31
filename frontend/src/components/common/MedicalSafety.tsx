import React from 'react';
import { AlertTriangle, Info, Phone } from 'lucide-react';
import { deaccentLower } from '../../lib/text';

/**
 * Phrases that mean someone may be in immediate danger. Matched against
 * accent-stripped text so "kho tho" hits "khó thở" — people type without
 * diacritics on mobile far more often than not.
 */
const EMERGENCY_PHRASES = [
  'dau nguc',
  'kho tho',
  'ngat xiu',
  'bat tinh',
  'co giat',
  'liet nua nguoi',
  'meo mieng',
  'noi ngong',
  'chay mau khong cam',
  'chay mau nhieu',
  'nôn ra mau',
  'non ra mau',
  'di ngoai ra mau',
  'tu tu',
  'tu tu',
  'muon chet',
  'ket thuc cuoc doi',
  'ngo doc',
  'uong thuoc qua lieu',
  'qua lieu',
  'sot cao co giat',
  'kho tho tim tai',
];

export function hasEmergencySignal(...parts: (string | null | undefined)[]): boolean {
  const haystack = deaccentLower(parts.filter(Boolean).join(' ').replace(/<[^>]+>/g, ' '));
  return EMERGENCY_PHRASES.some((phrase) => haystack.includes(phrase));
}

/**
 * Shown above content whose wording suggests a medical emergency.
 * Deliberately a persistent banner, not a toast: this is the one message on
 * the page that must not disappear on its own. Icon plus text carry the
 * meaning, so it does not depend on colour alone.
 */
export const EmergencyBanner: React.FC<{ className?: string }> = ({ className }) => (
  <div
    role="alert"
    className={`flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 ${className ?? ''}`}
  >
    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
    <div className="text-sm leading-relaxed text-red-900">
      <p className="font-bold">Dấu hiệu có thể là cấp cứu</p>
      <p className="mt-1">
        Nội dung này nhắc tới triệu chứng có thể nguy hiểm tính mạng. Đừng chờ câu trả lời trên
        diễn đàn — hãy gọi{' '}
        <a
          href="tel:115"
          className="inline-flex items-center gap-1 font-bold text-red-800 underline underline-offset-2 hover:text-red-900"
        >
          <Phone size={14} aria-hidden="true" />
          115
        </a>{' '}
        hoặc tới cơ sở y tế gần nhất ngay.
      </p>
    </div>
  </div>
);

/**
 * Standing notice that the forum is not a substitute for seeing a doctor.
 * Required reading on a health site and the cheapest thing that separates a
 * serious medical forum from a blog.
 */
export const MedicalDisclaimer: React.FC<{ className?: string; compact?: boolean }> = ({
  className,
  compact = false,
}) => (
  <div
    className={`flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className ?? ''}`}
  >
    <Info size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
    <p className="text-xs leading-relaxed text-amber-900">
      <span className="font-bold">Lưu ý y tế.</span>{' '}
      {compact
        ? 'Nội dung trên diễn đàn mang tính tham khảo, không thay thế chẩn đoán hoặc chỉ định của bác sĩ.'
        : 'Thông tin trên diễn đàn do cộng đồng đóng góp và chỉ mang tính tham khảo. Nội dung này không phải là chẩn đoán, chỉ định điều trị hay đơn thuốc, và không thay thế việc thăm khám trực tiếp với nhân viên y tế có chuyên môn. Hãy trao đổi với bác sĩ trước khi áp dụng bất kỳ lời khuyên nào cho bản thân.'}
    </p>
  </div>
);
