import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, X, Hash } from 'lucide-react';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import { ImageUploader } from '../components/common/ImageUploader';
import { postService } from '../services/postService';
import { withTag } from '../lib/tags';
import { categoryService } from '../services/categoryService';
import { tagService } from '../services/tagService';
import { Category, TagWithCount, PostType, Post } from '../types';
import { flattenTree, indentLabel } from '../lib/categoryTree';

const POST_TYPES: { type: PostType; label: string; desc: string }[] = [
  { type: 'ARTICLE', label: 'Bài viết', desc: 'Kiến thức y khoa, cẩm nang sức khỏe' },
  { type: 'QUESTION', label: 'Hỏi đáp', desc: 'Thắc mắc triệu chứng, tư vấn bác sĩ' },
  { type: 'REVIEW', label: 'Đánh giá', desc: 'Review bệnh viện, phòng khám, dịch vụ' },
  { type: 'SHARE', label: 'Chia sẻ', desc: 'Kinh nghiệm cá nhân, mẹo chăm sóc' },
];

export const EditPostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Loading & State
  const [isLoading, setIsLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [postType, setPostType] = useState<PostType>('ARTICLE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [hotTags, setHotTags] = useState<TagWithCount[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [postData, cats, tagsRes] = await Promise.all([
          postService.getPostById(id),
          categoryService.getCategories(),
          tagService.getHotTags(12),
        ]);

        setPost(postData);
        setTitle(postData.title);
        setContent(postData.content || '');
        setPostType((postData.post_type || postData.type || 'ARTICLE').toUpperCase() as PostType);
        setCategoryId(postData.category?.id || '');
        setThumbnail(postData.thumbnail || null);
        setTags(postData.tags ? postData.tags.map((t) => t.name) : []);

        setCategories(cats);
        setHotTags(tagsRes);
      } catch (err: any) {
        console.error('Failed to load post for editing', err);
        setErrorMsg('Không tìm thấy bài viết hoặc không thể tải dữ liệu.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleAddTag = (rawTag: string) => {
    setTags((prev) => withTag(prev, rawTag));
    setTagInput('');
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
    if (!id) return;

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

      // A tag typed but not confirmed with Enter is still in the input
      // when Save is clicked; it belongs in this request.
      const finalTags = withTag(tags, tagInput);
      setTags(finalTags);
      setTagInput('');

      const payload = {
        title: title.trim(),
        content: content.trim(),
        post_type: postType,
        category_id: categoryId || undefined,
        tag_names: finalTags,
        thumbnail: thumbnail || null,
      };

      const updated = await postService.updatePost(id, payload);
      navigate(`/posts/${updated.id || updated.slug}`);
    } catch (err: any) {
      console.error('Failed to update post', err);
      setErrorMsg(
        err.response?.data?.detail || 'Đã có lỗi xảy ra khi cập nhật bài viết. Vui lòng thử lại!'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-text-secondary">Đang tải bài viết...</span>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center bg-white rounded-2xl p-8 border border-border shadow-sm">
        <p className="text-danger font-semibold mb-4">{errorMsg || 'Không tìm thấy bài viết.'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm"
        >
          Về trang chủ
        </button>
      </div>
    );
  }

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

        <h1 className="text-xl sm:text-2xl font-extrabold text-text">Chỉnh sửa bài viết</h1>

        <div className="w-20" />
      </div>

      {errorMsg && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-danger rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Post Type Selector */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <label className="block text-sm font-bold text-text mb-3">Loại bài viết</label>
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
              placeholder="Nhập tiêu đề..."
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
              {flattenTree(categories).map(({ item: cat, depth }) => (
                <option key={cat.id} value={cat.id}>
                  {indentLabel(cat.name, depth, cat.icon)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Thumbnail Image */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <ImageUploader value={thumbnail} onChange={setThumbnail} />
        </div>

        {/* Content Rich Text Editor */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <label className="block text-sm font-bold text-text mb-2">
            Nội dung chi tiết <span className="text-danger">*</span>
          </label>
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Nội dung bài viết..."
            minHeight="340px"
          />
        </div>

        {/* Tags */}
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-sm">
          <label className="block text-sm font-bold text-text mb-1.5">Thẻ gắn (Tags)</label>
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
                placeholder={tags.length === 0 ? 'Thêm thẻ...' : ''}
                className="flex-1 min-w-[140px] bg-transparent text-sm focus:outline-none px-2 py-1"
              />
            )}
          </div>

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
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save size={18} />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPostPage;
