# CI/CD Medic Việt Nam

CI chạy trên pull request vào `main` và mọi push lên `main` hoặc `dev/**`:

- backend typecheck + toàn bộ Vitest;
- frontend ESLint + typecheck + build riêng `portal` và `forum`;
- kiểm tra cấu hình Docker Compose production.

CD chỉ hoạt động khi repository variable `CD_ENABLED` bằng `true`. GitHub
Environment `production` nên bật required reviewer. Các secret cần khai báo:

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`;
- `DEPLOY_SSH_KEY`;
- `DEPLOY_KNOWN_HOSTS` lấy trực tiếp từ máy chủ đã xác minh, không tự
  `ssh-keyscan` trong workflow.

File `.env` production nằm sẵn trong `DEPLOY_PATH` trên VPS và không bị workflow
ghi đè. Sau khi CI của `main` xanh, CD kéo fast-forward rồi chạy Docker Compose;
entrypoint backend tự áp dụng migration trước khi phục vụ traffic.
