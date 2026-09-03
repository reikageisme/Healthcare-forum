import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, GripVertical, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { adminNetworkService, NetworkConfigInput } from '../../services/forumService';
import { uploadService } from '../../services/uploadService';
import SiteAvatar from '../../components/common/SiteAvatar';

/**
 * Mạng lưới & chân trang.
 *
 * Một form, một nút Lưu, ghi cả cụm cấu hình xuống một bản ghi JSON. Không có
 * lưu từng dòng: danh sách này ngắn và người sửa thường sắp lại vài mục cùng
 * lúc, nên "sửa rồi bấm Lưu" đúng với cách họ làm việc hơn là mỗi ô một lượt
 * gọi API.
 */

const EMPTY: NetworkConfigInput = {
  name: '',
  tagline: '',
  sites: [],
  footer_links: [],
  contact_email: '',
};

const inputClass =
  'w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all';

const MAX_ICON_BYTES = 2 * 1024 * 1024;

/**
 * Ô chọn ảnh đại diện cho một trang.
 *
 * Bỏ trống là lựa chọn hợp lệ, không phải thiếu sót: SiteAvatar sẽ tự thử
 * /favicon.ico của tên miền đó, và phần lớn trang có sẵn. Chỉ tải lên khi
 * favicon xấu hoặc không có.
 */
const IconPicker: React.FC<{
  name: string;
  url: string;
  iconUrl?: string;
  onChange: (iconUrl: string | undefined) => void;
  onError: (message: string) => void;
}> = ({ name, url, iconUrl, onChange, onError }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return onError('Chỉ nhận file ảnh.');
    if (file.size > MAX_ICON_BYTES) return onError('Ảnh vượt quá 2 MB.');

    try {
      setBusy(true);
      const res = await uploadService.uploadImage(file);
      onChange(res.url);
    } catch (err) {
      console.error('Icon upload failed', err);
      onError('Tải ảnh lên thất bại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={pick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title={iconUrl ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện (bỏ trống sẽ dùng favicon của trang)'}
        aria-label={`Ảnh đại diện cho ${name || url || 'trang này'}`}
        className="w-10 h-10 rounded-lg border border-border bg-white hover:border-primary/40 flex items-center justify-center transition-colors disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin text-slate-400" aria-hidden="true" />
        ) : iconUrl || url ? (
          <SiteAvatar name={name} url={url} iconUrl={iconUrl} size={24} />
        ) : (
          <Upload size={15} className="text-slate-400" aria-hidden="true" />
        )}
      </button>
      {iconUrl && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          title="Gỡ ảnh, quay lại dùng favicon của trang"
          aria-label="Gỡ ảnh đại diện"
          className="w-6 h-10 text-slate-400 hover:text-danger flex items-center justify-center transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export const AdminNetworkPage: React.FC = () => {
  const [config, setConfig] = useState<NetworkConfigInput>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminNetworkService
      .get()
      .then((data) => setConfig({ ...EMPTY, ...data }))
      .catch((err) => {
        console.error('Failed to load network config', err);
        setError('Không tải được cấu hình.');
      })
      .finally(() => setLoading(false));
  }, []);

  const patch = (next: Partial<NetworkConfigInput>) => {
    setConfig((prev) => ({ ...prev, ...next }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const result = await adminNetworkService.save(config);
      setConfig({ ...EMPTY, ...result });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save network config', err);
      setError('Không lưu được. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-text-secondary text-sm py-12 justify-center">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Đang tải cấu hình...
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Mạng lưới &amp; Chân trang
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Các trang anh em hiện ở thẻ &ldquo;Mạng lưới&rdquo; bên sidebar phải và ở cột
          &ldquo;Kết nối&rdquo; trong chân trang. Trang nào có địa chỉ trùng <code>SITE_URL</code>{' '}
          sẽ tự mang nhãn &ldquo;Đang xem&rdquo;.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-border shadow-sm mb-4">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold text-slate-900">Giới thiệu mạng lưới</h2>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="net-name" className="block text-xs font-bold text-slate-700 mb-1.5">
              Tên mạng lưới
            </label>
            <input
              id="net-name"
              type="text"
              value={config.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Mạng lưới Medic Việt Nam"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="net-email" className="block text-xs font-bold text-slate-700 mb-1.5">
              Email liên hệ (chân trang)
            </label>
            <input
              id="net-email"
              type="email"
              value={config.contact_email}
              onChange={(e) => patch({ contact_email: e.target.value })}
              placeholder="lienhe@medicvn.com"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="net-tagline" className="block text-xs font-bold text-slate-700 mb-1.5">
              Mô tả một dòng
            </label>
            <input
              id="net-tagline"
              type="text"
              value={config.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Hệ thống thông tin y tế — mỗi chuyên khoa một cộng đồng."
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-border shadow-sm mb-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Các trang trong mạng lưới</h2>
            <p className="text-xs text-slate-500 mt-0.5">Tối đa 20 trang, hiện theo đúng thứ tự này. Bỏ trống ảnh đại diện thì dùng favicon của chính trang đó.</p>
          </div>
          <button
            type="button"
            onClick={() => patch({ sites: [...config.sites, { name: '', url: '' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-colors shrink-0"
          >
            <Plus size={14} aria-hidden="true" />
            Thêm trang
          </button>
        </div>
        <div className="p-6">
          {config.sites.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Chưa có trang nào — thẻ &ldquo;Mạng lưới&rdquo; sẽ không hiện ở sidebar.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {config.sites.map((site, i) => (
                <div key={i} className="flex items-start gap-2">
                  <GripVertical size={16} className="text-slate-300 mt-2.5 shrink-0" aria-hidden="true" />
                  <IconPicker
                    name={site.name}
                    url={site.url}
                    iconUrl={site.icon_url}
                    onError={setError}
                    onChange={(icon_url) => {
                      const sites = [...config.sites];
                      sites[i] = { ...sites[i], icon_url };
                      patch({ sites });
                    }}
                  />
                  <div className="grid sm:grid-cols-[1fr_1.4fr] gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={site.name}
                      onChange={(e) => {
                        const sites = [...config.sites];
                        sites[i] = { ...sites[i], name: e.target.value };
                        patch({ sites });
                      }}
                      placeholder="Tên hiển thị"
                      aria-label={`Tên trang ${i + 1}`}
                      className={inputClass}
                    />
                    <input
                      type="url"
                      value={site.url}
                      onChange={(e) => {
                        const sites = [...config.sites];
                        sites[i] = { ...sites[i], url: e.target.value };
                        patch({ sites });
                      }}
                      placeholder="https://..."
                      aria-label={`Địa chỉ trang ${i + 1}`}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => patch({ sites: config.sites.filter((_, j) => j !== i) })}
                    aria-label={`Xóa trang ${site.name || i + 1}`}
                    className="w-10 h-10 shrink-0 rounded-lg border border-border text-danger hover:bg-red-50 flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-border shadow-sm mb-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Liên kết pháp lý ở chân trang</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Điều khoản, quyền riêng tư, miễn trừ trách nhiệm. Đường dẫn nội bộ dạng{' '}
              <code>/dieu-khoan</code> cũng được.
            </p>
          </div>
          <button
            type="button"
            onClick={() => patch({ footer_links: [...config.footer_links, { name: '', url: '' }] })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-colors shrink-0"
          >
            <Plus size={14} aria-hidden="true" />
            Thêm liên kết
          </button>
        </div>
        <div className="p-6">
          {config.footer_links.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Chưa có liên kết nào — chân trang chỉ hiện dòng bản quyền.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {config.footer_links.map((link, i) => (
                <div key={i} className="flex items-start gap-2">
                  <GripVertical size={16} className="text-slate-300 mt-2.5 shrink-0" aria-hidden="true" />
                  <div className="grid sm:grid-cols-[1fr_1.4fr] gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={link.name}
                      onChange={(e) => {
                        const footer_links = [...config.footer_links];
                        footer_links[i] = { ...footer_links[i], name: e.target.value };
                        patch({ footer_links });
                      }}
                      placeholder="Điều khoản sử dụng"
                      aria-label={`Tên liên kết ${i + 1}`}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => {
                        const footer_links = [...config.footer_links];
                        footer_links[i] = { ...footer_links[i], url: e.target.value };
                        patch({ footer_links });
                      }}
                      placeholder="/dieu-khoan"
                      aria-label={`Địa chỉ liên kết ${i + 1}`}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      patch({ footer_links: config.footer_links.filter((_, j) => j !== i) })
                    }
                    aria-label={`Xóa liên kết ${link.name || i + 1}`}
                    className="w-10 h-10 shrink-0 rounded-lg border border-border text-danger hover:bg-red-50 flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-4"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="sticky bottom-0 bg-white border border-border rounded-2xl shadow-sm px-5 py-3.5 flex flex-wrap items-center gap-3">
        {saved && !saving && (
          <span role="status" className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle2 size={15} aria-hidden="true" />
            Đã lưu — người dùng thấy ngay sau khi tải lại trang
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </div>
  );
};

export default AdminNetworkPage;
