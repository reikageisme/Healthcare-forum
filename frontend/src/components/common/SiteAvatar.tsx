import React, { useState } from 'react';
import { Globe } from 'lucide-react';

/**
 * Ảnh đại diện của một trang trong mạng lưới.
 *
 * Ba mức, rơi dần khi mức trên hỏng:
 *   1. Ảnh quản trị viên tải lên — luôn đúng, luôn sắc nét.
 *   2. /favicon.ico của chính tên miền đó. Trình duyệt người xem tải trực
 *      tiếp, nên server không đi fetch địa chỉ do người dùng nhập (tránh
 *      SSRF) và cũng không phải nhờ dịch vụ favicon của bên thứ ba, thứ sẽ
 *      biết mọi khách vào trang của bạn.
 *   3. Ô chữ cái đầu, màu suy ra từ tên miền — luôn có gì đó để nhìn, và mỗi
 *      trang giữ nguyên một màu qua các lần tải.
 *
 * onError của <img> là thứ chuyển giữa các mức: favicon.ico không tồn tại thì
 * trình duyệt báo lỗi tải, không phải trả về HTML, nên đây là cách nhận biết
 * đáng tin mà không tốn một request nào từ phía chúng ta.
 */

const TILE_COLORS = ['#2563EB', '#0D9488', '#7C3AED', '#DB2777', '#EA580C', '#059669', '#0891B2'];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

interface SiteAvatarProps {
  name: string;
  url: string;
  iconUrl?: string;
  size?: number;
  className?: string;
}

export const SiteAvatar: React.FC<SiteAvatarProps> = ({
  name,
  url,
  iconUrl,
  size = 24,
  className = '',
}) => {
  const host = hostOf(url);
  const [step, setStep] = useState<0 | 1 | 2>(iconUrl ? 0 : host ? 1 : 2);

  const src = step === 0 ? iconUrl : step === 1 && host ? `https://${host}/favicon.ico` : null;
  const box = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        style={box}
        onError={() => setStep((prev) => (prev === 0 && host ? 1 : 2))}
        className={`rounded-md object-cover bg-white border border-border shrink-0 ${className}`}
      />
    );
  }

  const letter = (name.trim()[0] || host?.[0] || '?').toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{ ...box, background: colorFor(host || name), fontSize: Math.round(size * 0.5) }}
      className={`rounded-md flex items-center justify-center font-bold text-white shrink-0 ${className}`}
    >
      {letter === '?' ? <Globe size={Math.round(size * 0.6)} /> : letter}
    </span>
  );
};

export default SiteAvatar;
