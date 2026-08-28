import React, { useRef, useState } from 'react';
import { UploadCloud, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { uploadService } from '../../services/uploadService';
import { cn } from '../../lib/utils';

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  label = 'Ảnh đại diện bài viết (Thumbnail)',
  className,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const res = await uploadService.uploadImage(file);
      onChange(res.url);
    } catch (error) {
      console.error('Failed to upload image', error);
      alert('Không thể tải ảnh lên. Vui lòng chọn ảnh định dạng JPG, PNG, WebP hoặc GIF dưới 5MB.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-semibold text-text">{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-border bg-slate-50 group max-h-64 flex items-center justify-center">
          <img src={value} alt="Thumbnail preview" className="w-full object-cover max-h-64" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-text font-medium text-xs rounded-lg shadow hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <ImageIcon size={14} /> Thay đổi
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 bg-red-600 text-white font-medium text-xs rounded-lg shadow hover:bg-red-700 transition-colors flex items-center gap-1"
            >
              <X size={14} /> Xóa ảnh
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-slate-50/50 hover:bg-slate-50',
            isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary',
            isUploading && 'pointer-events-none opacity-60'
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-medium">Đang tải ảnh lên...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                <UploadCloud size={24} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-text">
                  Nhấn để chọn ảnh hoặc kéo thả vào đây
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  PNG, JPG, WebP, GIF (tối đa 5MB)
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
