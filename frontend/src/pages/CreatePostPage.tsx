import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, X, Hash } from 'lucide-react';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import { ImageUploader } from '../components/common/ImageUploader';
import { MedicalDisclaimer } from '../components/common/MedicalSafety';
import { postService } from '../services/postService';
import { categoryService } from '../services/categoryService';
import { tagService } from '../services/tagService';
import { Category, TagWithCount, PostType } from '../types';
import { useAuth } from '../hooks/useAuth';

const POST_TYPES: { type: PostType; label: string; desc: string }[] = [
  { type: 'ARTICLE', label: 'Bài viết', desc: 'Kiến thức y khoa, cẩm nang sức khỏe' },
  { type: 'QUESTION', label: 'Hỏi đáp', desc: 'Thắc mắc triệu chứng, tư vấn bác sĩ' },
  { type: 'REVIEW', label: 'Đánh giá', desc: 'Review bệnh viện, phòng khám, dịch vụ' },
  { type: 'SHARE', label: 'Chia sẻ', desc: 'Kinh nghiệm cá nhân, mẹo chăm sóc' },
];

export const CreatePostPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Form State
  const initialType = (searchParams.get('type') || 'ARTICLE').toUpperCase() as PostType;
  const [postType, setPostType] = useState<PostType>(initialType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Auxiliary data
  const [categories, setCategories] = useState<Category[]>([]);
  const [hotTags, setHotTags] = useState<TagWithCount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, navigate, location]);

  useEffect(() => {
    const loadCategoriesAndTags = async () => {
      try {
        const [cats, tagsRes] = await Promise.all([
          categoryService.getCategories(),
          tagService.getHotTags(12),
        ]);
        setCategories(cats);
        if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
        setHotTags(tagsRes);
      } catch (err) {
        console.error('Failed to load categories or tags', err);
      }
    };
    loadCategoriesAndTags();
  }, []);

  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#+/, '');
    if (clean && !tags.includes(clean) && tags.length < 8) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setErrorMsg('Tiêu đề bài viết phải có ít nhất 3 ký tự.');
      return;
    }

    if (!content.trim() || content.trim().length < 5) {
      setErrorMsg('Nội dung bài viết quá ngắn. Vui lòng viết chi tiết hơn.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payload = {
        title: title.trim(),
        content: content.trim(),
        post_type: postType,
        category_id: categoryId || undefined,
        tag_names: tags,
        thumbnail: thumbnail || undefined,
        is_anonymous: isAnonymous,
      };

      const created = await postService.createPost(payload);
      navigate(`/posts/${created.id || created.slug}`);
    } catch (err: any) {
      console.error('Failed to create post', err);
      let errorMessage = 'Đã có lỗi xảy ra khi đăng bài viết. Vui lòng thử lại!';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail[0]?.msg || errorMessage;
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        }
      }
      setErrorMsg(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-primary transition-colors bg-white px-3 py-2 rounded-xl border border-border"
        >
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-extrabold text-text">Tạo bài viết mới</h1>

        <div className="w-20" />
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-danger rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <MedicalDisclaimer className="mb-6" compact />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Post Type Selector */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <label className="block text-sm font-bold text-text mb-3">
            Loại bài viết <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {POST_TYPES.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setPostType(item.type)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  postType === item.type
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border bg-slate-50 hover:bg-white hover:border-slate-300'
                }`}
              >
                <span
                  className={`font-bold text-sm ${
                    postType === item.type ? 'text-primary' : 'text-text'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-[11px] text-text-secondary mt-1 line-clamp-2">
                  {item.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Title & Category */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-bold text-text mb-1.5">
              Tiêu đề bài viết <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề rõ ràng, súc tích (vd: Hướng dẫn chăm sóc bé bị sốt xuất huyết tại nhà)..."
              maxLength={255}
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50 focus:bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-base font-semibold transition-all"
            />
            <div className="flex justify-end mt-1 text-xs text-text-secondary">
              {title.length}/255 ký tự
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-text mb-1.5">
              Chuyên mục sức khỏe <span className="text-danger">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-sm transition-all cursor-pointer"
            >
              <option value="" disabled>
                -- Chọn chuyên mục --
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ''}
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Thumbnail Image */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <ImageUploader value={thumbnail} onChange={setThumbnail} />

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-slate-50/60 p-3.5 transition-colors hover:border-primary/40">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-sm">
              <span className="font-semibold text-text">Đăng ẩn danh</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                Tên và ảnh đại diện của bạn sẽ không hiển thị với người đọc. Quản trị viên và
                kiểm duyệt viên vẫn xem được để xử lý vi phạm.
              </span>
            </span>
          </label>
        </div>

        {/* Content Rich Text Editor */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <label className="block text-sm font-bold text-text mb-2">
            Nội dung chi tiết <span className="text-danger">*</span>
          </label>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Viết nội dung bài viết sức khỏe chi tiết, có thể chèn ảnh, đề mục, trích dẫn..."
            minHeight="340px"
          />
        </div>

        {/* Tags */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <label className="block text-sm font-bold text-text mb-1.5">
            Thẻ gắn (Tags)
          </label>
          <p className="text-xs text-text-secondary mb-3">
            Thêm tối đa 8 tags để người đọc dễ tìm thấy bài viết của bạn. Nhấn Enter hoặc dấu phẩy
            để thêm.
          </p>

          <div className="flex flex-wrap items-center gap-2 p-2 border border-border rounded-xl bg-slate-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg"
              >
                <Hash size={12} />
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="p-0.5 hover:text-danger rounded-full transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {tags.length < 8 && (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={() => handleAddTag(tagInput)}
                placeholder={tags.length === 0 ? 'Thêm thẻ (vd: nhi-khoa, sot-xuat-huyet)...' : ''}
                className="flex-1 min-w-[140px] bg-transparent text-sm focus:outline-none px-2 py-1"
              />
            )}
          </div>

          {/* Hot tags suggestions */}
          {hotTags.length > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium text-text-secondary mr-2">Gợi ý thẻ:</span>
              <div className="inline-flex flex-wrap gap-1.5 mt-1">
                {hotTags.slice(0, 8).map((ht) => (
                  <button
                    key={ht.id}
                    type="button"
                    onClick={() => handleAddTag(ht.name)}
                    className="text-xs text-text-secondary hover:text-primary bg-slate-100 hover:bg-primary/10 px-2 py-0.5 rounded-md transition-colors"
                  >
                    #{ht.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl border border-border text-text-secondary hover:text-text hover:bg-slate-100 font-semibold text-sm transition-colors"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span>Đang đăng bài...</span>
            ) : (
              <>
                <Send size={18} />
                <span>Đăng bài viết</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePostPage;
