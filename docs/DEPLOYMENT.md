# CI/CD Medic Việt Nam

CI chạy trên self-hosted runner cho mọi push lên `main` hoặc `dev/**`:

- backend typecheck + toàn bộ Vitest;
- frontend ESLint + typecheck + build riêng `portal` và `forum`;
- kiểm tra cấu hình Docker Compose production.

## CD bằng self-hosted runner

Runner production cần có đủ ba label mặc định: `self-hosted`, `Linux`, `X64`.
Service account chạy runner phải đọc được checkout, sử dụng được Docker Compose
và có quyền cập nhật các container của ứng dụng. Không gắn runner production
vào workflow pull request chạy mã chưa được duyệt; vì vậy workflow hiện chỉ
nhận sự kiện `push`. Nếu sau này cần kiểm tra PR từ contributor, hãy dùng một
runner cách ly không giữ secret production hoặc sửa xong billing của
GitHub-hosted runner.

Trong GitHub repository:

- tạo repository variable `CD_ENABLED` với giá trị `true` khi sẵn sàng bật CD;
- trong Environment `production`, tạo secret `DEPLOY_PATH` trỏ đến checkout
  production, ví dụ `/root/Healthcare-forum`;
- nên bật required reviewer cho Environment `production` trong giai đoạn đầu.

Workflow chạy trực tiếp trên máy production nên không cần SSH key hay thông tin
host. File `.env` nằm sẵn trong `DEPLOY_PATH`, không được workflow ghi đè và
không được commit. Sau khi CI của `main` xanh, runner thực hiện `git pull
--ff-only`, build lại Compose và gọi health check công khai.

Nếu cài runner bên trong checkout như `actions-runner/`, thư mục này đã được
`.gitignore` loại ra để không vô tình đưa binary và log của runner vào Git.

## Lần triển khai đầu tiên

Trước khi bật `CD_ENABLED`, có thể chạy một lần thủ công trên máy production:

```bash
cd /root/Healthcare-forum
git fetch origin main
git checkout main
git pull --ff-only origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
curl --fail --show-error https://medicvn.com/api/v1/health
```

Entrypoint backend tự áp dụng migration trước khi phục vụ traffic.
