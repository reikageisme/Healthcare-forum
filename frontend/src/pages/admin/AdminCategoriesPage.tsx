import React, { useEffect, useState } from 'react';
import {
  FolderPlus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  FileText,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { categoryService, CategoryInput } from '../../services/categoryService';
import { Category } from '../../types';
import CategoryModal from '../../components/admin/CategoryModal';
import { childrenMap, flattenTree } from '../../lib/categoryTree';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const data = await categoryService.getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (data: CategoryInput & { name: string }) => {
    try {
      setIsSubmitting(true);
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, data);
        alert('Đã cập nhật chuyên mục thành công!');
      } else {
        await categoryService.createCategory(data);
        alert('Đã tạo chuyên mục mới thành công!');
      }
      setIsModalOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      console.error('Save category failed', err);
      const msg = err.response?.data?.detail || 'Không thể lưu chuyên mục.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Moving a category swaps it with the sibling above or below and then
   * renumbers that one level in tens. Renumbering the whole level rather than
   * swapping two numbers is what keeps the order stable when several
   * categories still sit on the default 0.
   */
  const handleMove = async (cat: Category, direction: 'up' | 'down') => {
    const parentKey = cat.parent_id ?? null;
    const siblings = flattenTree(categories)
      .map(({ item }) => item)
      .filter((c) => (c.parent_id ?? null) === parentKey);

    const index = siblings.findIndex((c) => c.id === cat.id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= siblings.length) return;

    const reordered = [...siblings];
    reordered[index] = siblings[target];
    reordered[target] = cat;

    const changed = reordered
      .map((c, i) => ({ c, order: (i + 1) * 10 }))
      .filter(({ c, order }) => (c.sort_order ?? 0) !== order);
    if (changed.length === 0) return;

    // Optimistic: the table reorders immediately, the reload settles it.
    setCategories((prev) =>
      prev.map((c) => {
        const hit = changed.find((x) => x.c.id === c.id);
        return hit ? { ...c, sort_order: hit.order } : c;
      }),
    );

    try {
      for (const { c, order } of changed) {
        await categoryService.updateCategory(c.id, { sort_order: order });
      }
    } catch (err: any) {
      console.error('Reorder category failed', err);
      alert(err.response?.data?.detail || 'Không thể lưu thứ tự chuyên mục.');
    } finally {
      fetchCategories();
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const postWarning =
      typeof cat.post_count === 'number' && cat.post_count > 0
        ? ` Chuyên mục này hiện có ${cat.post_count} bài viết liên kết.`
        : '';

    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa chuyên mục "${cat.name}" không?${postWarning}`
      )
    ) {
      try {
        setIsLoading(true);
        await categoryService.deleteCategory(cat.id);
        alert('Đã xóa chuyên mục thành công!');
        fetchCategories();
      } catch (err: any) {
        console.error('Delete category failed', err);
        const msg = err.response?.data?.detail || 'Không thể xóa chuyên mục.';
        alert(msg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!searchKeyword.trim()) return true;
    const q = searchKeyword.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  // Direct children per category, for the badge in the table.
  const childCountOf = new Map<string, number>();
  for (const [parentId, kids] of childrenMap(categories)) {
    childCountOf.set(parentId, kids.length);
  }

  // Rows in tree order, each carrying its depth so the name can be indented.
  const rows = flattenTree(filteredCategories);
  const isSearching = searchKeyword.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản lý Chuyên mục Y tế
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tổ chức cây thư mục, chuyên khoa và chủ đề thảo luận cho toàn diễn đàn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCategories}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-border hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <FolderPlus size={16} />
            <span>Thêm chuyên mục</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-border shadow-xs flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo tên hoặc đường dẫn slug chuyên mục..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic">
            Đang tải danh sách chuyên mục...
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Chưa có chuyên mục nào được tạo hoặc không khớp với tìm kiếm.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">Icon</th>
                  <th className="py-3.5 px-4">Tên chuyên mục</th>
                  <th className="py-3.5 px-4">Đường dẫn (Slug)</th>
                  <th className="py-3.5 px-4">Mô tả</th>
                  <th className="py-3.5 px-4 text-center">Số bài viết</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ item: cat, depth }) => (
                  <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-center text-base">
                      {cat.icon || '📁'}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div
                        className="flex items-center gap-1.5"
                        style={{ paddingLeft: (depth - 1) * 18 }}
                      >
                        {depth > 1 && (
                          <span className="text-slate-300 select-none" aria-hidden="true">
                            └
                          </span>
                        )}
                        <span
                          className={
                            depth === 1
                              ? 'font-bold text-slate-900'
                              : depth === 2
                                ? 'font-semibold text-slate-700'
                                : 'text-slate-600'
                          }
                        >
                          {cat.name}
                        </span>
                        {childCountOf.get(cat.id) ? (
                          <span className="bg-slate-100 text-slate-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-slate-200">
                            {childCountOf.get(cat.id)} mục con
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono">
                      /{cat.slug}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs text-slate-600 truncate">
                      {cat.description || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                        <FileText size={12} className="text-slate-400" />
                        {cat.post_count ?? 0}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                      <span className="inline-flex align-middle rounded-lg overflow-hidden border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleMove(cat, 'up')}
                          disabled={isSearching}
                          className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-100"
                          title={
                            isSearching
                              ? 'Xoá từ khoá tìm kiếm để sắp xếp'
                              : 'Đưa lên trên (trong cùng cấp)'
                          }
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(cat, 'down')}
                          disabled={isSearching}
                          className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 border-l border-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                          title={
                            isSearching
                              ? 'Xoá từ khoá tìm kiếm để sắp xếp'
                              : 'Đưa xuống dưới (trong cùng cấp)'
                          }
                        >
                          <ChevronDown size={12} />
                        </button>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cat)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1"
                        title="Chỉnh sửa chuyên mục"
                      >
                        <Edit2 size={12} />
                        <span>Sửa</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-danger hover:bg-red-50 rounded-lg text-xs font-bold transition-colors inline-flex items-center"
                        title="Xóa chuyên mục"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CategoryModal
          isOpen={isModalOpen}
          category={editingCategory}
          allCategories={categories}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCategory(null);
          }}
          onSave={handleSaveCategory}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

export default AdminCategoriesPage;
