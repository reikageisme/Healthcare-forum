import React, { useState, useEffect } from 'react';
import { X, Folder, FolderPlus } from 'lucide-react';
import { Category } from '../../types';
import {
  MAX_CATEGORY_DEPTH,
  branchHeight,
  childrenMap,
  depthOf,
  descendantIds,
  flattenTree,
  indentLabel,
} from '../../lib/categoryTree';

interface CategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  /** Every category, used to offer the possible parents. */
  allCategories?: Category[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    slug?: string;
    icon?: string | null;
    description?: string | null;
    parent_id?: string | null;
    sort_order?: number;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  category,
  allCategories = [],
  onClose,
  onSave,
  isSubmitting = false,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setSlug(category.slug || '');
      setIcon(category.icon || '');
      setDescription(category.description || '');
      setParentId(category.parent_id || '');
      setSortOrder(String(category.sort_order ?? 0));
    } else {
      setName('');
      setSlug('');
      setIcon('');
      setDescription('');
      setParentId('');
      setSortOrder('0');
    }
  }, [category, isOpen]);

  if (!isOpen) return null;

  const isEdit = !!category;

  // Which categories may be the parent depends on both ends: how deep the
  // candidate already sits, and how tall the branch being moved is. A
  // category with grandchildren has nowhere left to go but the root.
  const children = childrenMap(allCategories);
  const ownHeight = category ? branchHeight(category.id, children) : 1;
  const blocked = category
    ? new Set([category.id, ...descendantIds(category.id, children)])
    : new Set<string>();
  const parentOptions = flattenTree(allCategories).filter(
    ({ item }) =>
      !blocked.has(item.id) &&
      depthOf(item.id, allCategories) + ownHeight <= MAX_CATEGORY_DEPTH,
  );

  const generateSlug = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isEdit) {
      setSlug(generateSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên chuyên mục.');
      return;
    }
    await onSave({
      name: name.trim(),
      slug: slug.trim() || generateSlug(name.trim()),
      icon: icon.trim() || undefined,
      description: description.trim() || undefined,
      // null detaches from the parent; the API treats an omitted field as
      // "leave alone", so this is always sent explicitly.
      parent_id: parentId || null,
      sort_order: Number(sortOrder) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              {isEdit ? <Folder size={18} /> : <FolderPlus size={18} />}
            </div>
            <h3 className="font-bold text-lg text-slate-900 leading-tight">
              {isEdit ? 'Chỉnh sửa chuyên mục' : 'Thêm chuyên mục mới'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Tên chuyên mục <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="VD: Tim mạch, Nhi khoa, Dinh dưỡng..."
              required
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Chuyên mục cha</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">— Là chuyên mục gốc —</option>
              {parentOptions.map(({ item, depth }) => (
                <option key={item.id} value={item.id}>
                  {indentLabel(item.name, depth, item.icon)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {ownHeight > 1
                ? `Chuyên mục này đang có mục con nên chỉ đặt được vào chỗ còn đủ ${MAX_CATEGORY_DEPTH} cấp.`
                : `Để trống nếu đây là chuyên mục gốc. Cây sâu tối đa ${MAX_CATEGORY_DEPTH} cấp.`}
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Đường dẫn tĩnh (Slug)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="VD: tim-mach, nhi-khoa..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-slate-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Thứ tự hiển thị</label>
            <input
              type="number"
              min={0}
              max={9999}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Số nhỏ hiện trước. Cùng số thì xếp theo tên, nên để 0 là đủ cho hầu hết chuyên mục.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Biểu tượng / Icon (Emoji hoặc ký tự)
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="VD: 🫀, 👶, 🩺, 💊, 🥗..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Mô tả chuyên mục</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả tóm tắt về chuyên khoa / nội dung..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-bold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CategoryModal;
