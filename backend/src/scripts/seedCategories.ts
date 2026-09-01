import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories } from '../db/schema.js';
import { slugify } from '../lib/slugify.js';

/**
 * Nạp cây chuyên mục y khoa (theo danh mục của yso.vn) vào diễn đàn.
 *
 *   npm run seed:categories                  # nạp thành cây 2 cấp ở gốc
 *   npm run seed:categories -- --parent=danh-muc
 *                                            # lồng cả cây dưới 1 mục có sẵn
 *
 * Chạy lại bao nhiêu lần cũng được: đối chiếu theo slug, mục đã có thì giữ
 * nguyên và chỉ điền vào những ô còn trống (chưa có cha, chưa có icon, thứ tự
 * còn 0). Không đổi tên, không xoá, không gỡ bài viết khỏi chuyên mục nào.
 */

interface SeedNode {
  name: string;
  icon?: string;
  children?: string[];
}

// Sáu nhóm đầu lấy đúng theo menu "Danh mục" của yso.vn. Hai nhóm cuối
// (Sức khỏe thường thức, Y học cơ sở) là cách gom những chuyên mục còn lại
// trong trang /explore — yso.vn để phẳng, gom lại cho sidebar đỡ dài.
const TREE: SeedNode[] = [
  {
    name: 'Cấp cứu - Hồi sức - Gây mê',
    icon: '🚑',
    children: [
      'Cấp cứu',
      'Chống độc',
      'Đường thở - Thở máy',
      'Gây mê hồi sức',
      'Hồi sức tích cực',
      'Hồi sức tim phổi',
      'Kiểm soát đau',
    ],
  },
  {
    name: 'Nội khoa',
    icon: '🩺',
    children: [
      'Cơ xương khớp - Miễn dịch',
      'Da liễu',
      'Hô hấp',
      'Huyết học - Ung bướu',
      'Lão khoa',
      'Nội tiết - Chuyển hóa',
      'Thần kinh',
      'Thận - Tiết niệu',
      'Tiêu hóa - Gan mật',
      'Tim mạch',
    ],
  },
  {
    name: 'Ngoại khoa',
    icon: '🔪',
    children: [
      'Bỏng - Tạo hình',
      'Chấn thương chỉnh hình',
      'Hậu phẫu - Biến chứng',
      'Ngoại lồng ngực - Mạch máu',
      'Ngoại thần kinh',
      'Ngoại tiết niệu',
      'Ngoại tổng quát',
    ],
  },
  {
    name: 'Sản - Phụ - Nhi',
    icon: '👶',
    children: ['Nhi khoa', 'Phụ khoa', 'Sản khoa', 'Sơ sinh'],
  },
  {
    name: 'Chuyên khoa',
    icon: '🏥',
    children: [
      'Mắt',
      'Phục hồi chức năng',
      'Răng Hàm Mặt',
      'Tai Mũi Họng',
      'Tâm thần',
      'Y học cổ truyền',
    ],
  },
  {
    name: 'Dược - Cận lâm sàng',
    icon: '💊',
    children: [
      'Chẩn đoán hình ảnh',
      'Dinh dưỡng lâm sàng',
      'Dược lâm sàng',
      'Giải phẫu bệnh',
      'Kiểm soát nhiễm khuẩn',
      'Thăm dò chức năng',
      'Thông tin thuốc - Tương tác thuốc',
      'Vi sinh',
      'Xét nghiệm',
    ],
  },
  {
    name: 'Y học cơ sở',
    icon: '📚',
    children: ['Bệnh học', 'Dược lý', 'Giải phẫu', 'Hóa sinh'],
  },
  {
    name: 'Sức khỏe thường thức',
    icon: '🥗',
    children: ['Bệnh thường gặp', 'Dinh dưỡng - Lối sống', 'Dùng thuốc an toàn'],
  },
];

function argValue(flag: string): string | null {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function findBySlug(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/**
 * Tạo mới nếu chưa có; nếu đã có thì chỉ điền vào ô còn trống. Trả về id.
 */
async function upsert(
  name: string,
  parentId: string | null,
  sortOrder: number,
  icon?: string,
): Promise<{ id: string; created: boolean }> {
  const slug = slugify(name);
  const existing = await findBySlug(slug);

  if (existing) {
    const patch: Partial<typeof categories.$inferInsert> = {};
    if (parentId && !existing.parent_id) patch.parent_id = parentId;
    if (icon && !existing.icon) patch.icon = icon;
    if (sortOrder && !existing.sort_order) patch.sort_order = sortOrder;
    if (Object.keys(patch).length > 0) {
      await db
        .update(categories)
        .set({ ...patch, updated_at: new Date() })
        .where(eq(categories.id, existing.id));
    }
    return { id: existing.id, created: false };
  }

  const inserted = await db
    .insert(categories)
    .values({ name, slug, icon: icon ?? null, parent_id: parentId, sort_order: sortOrder })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error(`Không tạo được chuyên mục "${name}"`);
  return { id: row.id, created: true };
}

async function main() {
  const parentArg = argValue('--parent');
  let rootParentId: string | null = null;

  if (parentArg) {
    const parent = await findBySlug(slugify(parentArg));
    if (!parent) {
      console.error(
        `Không tìm thấy chuyên mục "${parentArg}". Bỏ --parent để nạp cây ở cấp gốc.`,
      );
      process.exit(1);
    }
    if (parent.parent_id) {
      // Cây chỉ sâu 3 cấp: lồng dưới một mục con nữa là thành 4.
      console.error(
        `"${parent.name}" đang là chuyên mục con. Chỉ lồng được cây dưới một chuyên mục gốc.`,
      );
      process.exit(1);
    }
    rootParentId = parent.id;
    console.log(`Nạp cây dưới chuyên mục gốc "${parent.name}".`);
  }

  let created = 0;
  let kept = 0;

  for (const [i, group] of TREE.entries()) {
    const parent = await upsert(group.name, rootParentId, (i + 1) * 10, group.icon);
    parent.created ? (created += 1) : (kept += 1);

    for (const [j, child] of (group.children ?? []).entries()) {
      const node = await upsert(child, parent.id, (j + 1) * 10);
      node.created ? (created += 1) : (kept += 1);
    }
  }

  console.log(`Xong: tạo mới ${created} chuyên mục, giữ nguyên ${kept} chuyên mục đã có.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Nạp chuyên mục thất bại:', err);
    process.exit(1);
  });
