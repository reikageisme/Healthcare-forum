import { count, eq, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../core/security.js';

/**
 * Replaces app/create_admin.py, with one change: the password is no longer
 * the literal "admin123" baked into the image. It comes from ADMIN_PASSWORD,
 * and without one the bootstrap is skipped rather than creating an account
 * whose credentials are published in the repository.
 */
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@health.vn';
const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';

async function main() {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, USERNAME), eq(users.email, EMAIL)))
    .limit(1);

  if (existing.length > 0) {
    console.log('Admin account already exists.');
    return;
  }

  if (PASSWORD.length < 12) {
    // A forum with no accounts at all and no way to make one is a broken
    // deployment, and the login screen cannot say so — it answers "incorrect
    // email or password" for a missing account on purpose, so that nobody can
    // discover which emails are registered. So the boot log has to be the
    // thing that shouts.
    const total = await db.select({ n: count() }).from(users);
    const empty = Number(total[0]?.n ?? 0) === 0;

    if (empty) {
      const line = '='.repeat(72);
      console.error(
        [
          '',
          line,
          '  KHÔNG TẠO ĐƯỢC TÀI KHOẢN QUẢN TRỊ — DIỄN ĐÀN CHƯA DÙNG ĐƯỢC',
          line,
          '  Database chưa có tài khoản nào và ADMIN_PASSWORD đang trống,',
          '  nên không có admin nào được tạo. Đăng nhập sẽ luôn báo sai mật khẩu.',
          '',
          '  Cách sửa: đặt ADMIN_PASSWORD (ít nhất 12 ký tự) trong .env rồi',
          '  khởi động lại:',
          '',
          '      ADMIN_PASSWORD=mat-khau-that-dai-cua-ban',
          '      docker compose up -d --force-recreate backend',
          '',
          `  Tài khoản sẽ tạo: ${USERNAME} <${EMAIL}>`,
          line,
          '',
        ].join('\n'),
      );
      return;
    }

    console.warn(
      'Skipping admin bootstrap: set ADMIN_PASSWORD (at least 12 characters) to create the first admin account.',
    );
    return;
  }

  await db.insert(users).values({
    email: EMAIL,
    username: USERNAME,
    full_name: 'Quản Trị Viên',
    hashed_password: await hashPassword(PASSWORD),
    role: 'admin',
    is_active: true,
  });
  console.log(`Admin account ${USERNAME} created.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
