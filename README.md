# 🏥 Healthcare Forum

Cổng thông tin Y tế cộng đồng — Dự án kết nối, chia sẻ kiến thức y tế.

## 🚀 Tech Stack

| Thành phần | Công nghệ |
| ---------- | --------- |
| Frontend | React 18, Vite 5, TypeScript, Tailwind |
| Backend | Hono, Drizzle ORM, Zod, Node 20 |
| Database | PostgreSQL 16 (máy ngoài: `192.168.1.102`) |
| Kiểm thử | Vitest + PGlite (Postgres thật, in-memory) |
| Docker | Docker Compose, multi-stage build |

## 📋 Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) và [Docker Compose](https://docs.docker.com/compose/install/)
- Một máy chủ PostgreSQL 16 truy cập được từ máy chạy Docker

## ⚡ Chạy lần đầu

### 1. Tạo file `.env`

```bash
cp .env.example .env
```

Sửa hai giá trị bắt buộc trong `.env`:

```env
# Trỏ đúng máy chủ Postgres của bạn. Database chưa cần tồn tại —
# backend sẽ tự tạo ở bước khởi động.
DATABASE_URL=postgresql://postgres:MẬT_KHẨU@192.168.1.102:5432/health
POSTGRES_HOST=192.168.1.102

# Bắt buộc từ 32 ký tự trở lên khi NODE_ENV=production, nếu không backend từ chối khởi động.
JWT_SECRET=chuỗi-ngẫu-nhiên-thật-dài-ít-nhất-32-ký-tự

# Tài khoản quản trị đầu tiên, được tạo thẳng vào database.
# Để trống thì bước tạo admin bị bỏ qua.
ADMIN_EMAIL=admin@health.vn
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mật-khẩu-ít-nhất-12-ký-tự
```

> Sinh `JWT_SECRET` nhanh: `openssl rand -base64 48`

### 2. Cho phép Postgres nhận kết nối từ ngoài

Nếu Postgres nằm trên máy khác (192.168.1.102), trên **máy đó** cần:

```conf
# postgresql.conf
listen_addresses = '*'

# pg_hba.conf — cho phép dải mạng LAN của bạn
host    all    all    192.168.1.0/24    scram-sha-256
```

Rồi `sudo systemctl restart postgresql`. Kiểm tra từ máy chạy Docker:

```bash
psql "postgresql://postgres:MẬT_KHẨU@192.168.1.102:5432/postgres" -c '\l'
```

Tài khoản trong `DATABASE_URL` cần quyền `CREATEDB` để backend tự tạo database.
Nếu không có quyền đó, tạo tay một lần:

```bash
psql -h 192.168.1.102 -U postgres -c 'CREATE DATABASE "health"'
```

### 3. Build và chạy

```bash
docker compose up --build
```

Lần khởi động đầu tiên backend tự làm tuần tự (tất cả đều idempotent, chạy lại vô hại):

1. **`createDatabase`** — tạo database `health` nếu máy chủ chưa có
2. **`migrate`** — tạo schema (chỉ khi database còn trống) rồi áp các patch
3. **`sanitizeExisting`** — làm sạch HTML của bài/bình luận lưu từ trước
4. **`createAdmin`** — tạo tài khoản quản trị từ `ADMIN_*` nếu chưa tồn tại

Truy cập:

| Dịch vụ | Địa chỉ |
| ------- | ------- |
| Diễn đàn | http://localhost:3000 |
| API | http://localhost:8000/api/v1/health |
| Adminer (xem DB) | http://localhost:8080 |

### Chạy production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Muốn dùng Postgres trong container thay vì máy ngoài

```bash
# Đổi DATABASE_URL thành ...@db:5432/health trong .env trước
docker compose -f docker-compose.yml -f docker-compose.db.yml up --build
```

## 🔧 Chạy không cần Docker

```bash
# Backend
cd backend
npm install
npm run db:setup     # tạo database + schema + tài khoản admin
npm run dev          # http://localhost:8000

# Frontend (terminal khác)
cd frontend
npm install
npm run dev          # http://localhost:3000
```

## 🧪 Kiểm thử

```bash
cd backend
npm test             # 49 test trên Postgres thật (PGlite), không cần database ngoài
npm run typecheck

cd ../frontend
npm run build        # đã bật lại tsc trước khi build
```

## 🗄️ Các lệnh database

| Lệnh | Việc |
| ---- | ---- |
| `npm run db:create` | Tạo database nếu chưa có |
| `npm run db:migrate` | Tạo schema / áp patch |
| `npm run create-admin` | Tạo tài khoản quản trị |
| `npm run db:setup` | Cả ba lệnh trên |
| `npm run sanitize-existing` | Quét lại và làm sạch nội dung đã lưu |

## 📁 Cấu trúc

```
backend/          Hono + Drizzle + Zod (xem backend/README.md)
frontend/         React + Vite + Tailwind
docker-compose.yml           Dev — Postgres ở máy ngoài
docker-compose.db.yml        Tùy chọn — thêm Postgres chạy trong container
docker-compose.prod.yml      Production
```

Chi tiết về API, quy tắc bảo mật và cây chuyên mục: [`backend/README.md`](backend/README.md).
