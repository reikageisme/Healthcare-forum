import React from 'react';

/**
 * Lưới ảnh kiểu Facebook cho thẻ bài viết ở feed.
 *
 * Tối đa 5 ô; ảnh thứ 5 gánh lớp phủ "+N" cho phần còn lại. Bố cục đổi theo
 * số ảnh đúng như Facebook: 1 ảnh tràn ngang, 2 ảnh chia đôi, 3 ảnh một lớn
 * bên trái, 4 ảnh lưới 2×2, từ 5 ảnh trở lên là 2 ô trên + 3 ô dưới.
 */

const CELL = 'w-full h-full object-cover bg-slate-100';

function cellClass(count: number, index: number): string {
  if (count === 3 && index === 0) return 'row-span-2';
  if (count >= 5) return index < 2 ? 'col-span-3' : 'col-span-2';
  return '';
}

function gridClass(count: number): string {
  if (count === 2) return 'grid-cols-2 grid-rows-1 h-72';
  if (count === 3) return 'grid-cols-2 grid-rows-2 h-80';
  if (count === 4) return 'grid-cols-2 grid-rows-2 h-80';
  return 'grid-cols-6 grid-rows-2 h-80';
}

interface PostGalleryProps {
  images: string[];
  alt: string;
  onOpen?: () => void;
}

export const PostGallery: React.FC<PostGalleryProps> = ({ images, alt, onOpen }) => {
  if (images.length === 0) return null;

  const shown = images.slice(0, 5);
  const extra = images.length - shown.length;

  if (shown.length === 1) {
    return (
      <div
        onClick={onOpen}
        className="mb-4 rounded-xl overflow-hidden bg-slate-100 border border-border cursor-pointer"
      >
        <img src={shown[0]} alt={alt} className="w-full max-h-80 object-cover" />
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      className={`mb-4 grid gap-1 rounded-xl overflow-hidden border border-border cursor-pointer ${gridClass(
        shown.length,
      )}`}
    >
      {shown.map((src, i) => (
        <div key={src + i} className={`relative overflow-hidden ${cellClass(shown.length, i)}`}>
          <img src={src} alt={`${alt} — ảnh ${i + 1}`} className={CELL} />
          {extra > 0 && i === shown.length - 1 && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-2xl font-bold">
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PostGallery;
