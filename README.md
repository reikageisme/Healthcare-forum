# 🏥 Healthcare Forum

Cổng thông tin Y tế cộng đồng - Dự án kết nối, chia sẻ kiến thức y tế.

## 🚀 Tech Stack

| Thành phần | Công nghệ |
| ---------- | --------- |
| Frontend | React, Vite, Node 20 |
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL 16 |
| Docker | Docker Compose, Multi-stage builds |

## 📋 Prerequisites

Yêu cầu cài đặt các phần mềm sau trước khi bắt đầu:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## ⚡ Quick Start

1. Clone dự án và truy cập vào thư mục:
```bash
git clone <repository-url>
cd healthcare-forum
```

2. (Tùy chọn) Khởi tạo file `.env` nếu chưa có, hoặc điều chỉnh nếu cần:
```bash
cp .env.example .env
```

3. Khởi động các services bằng Docker Compose:
```bash
docker compose up --build
```

Dự án sẽ khả dụng tại:
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs
- Adminer (DB UI): http://localhost:8080

## 🛠 Development Workflow

Trong môi trường phát triển (Development):
- **Hot Reload**: Backend và Frontend được mount volume trực tiếp, mọi thay đổi trong source code sẽ được cập nhật tự động mà không cần build lại container.
- **Database**: Dữ liệu được lưu persist qua docker volumes, an toàn kể cả khi restart container.

Để chạy môi trường Production:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

## 📁 Project Structure

```
├── backend/                # Backend API (FastAPI)
│   ├── app/                # Source code Python
│   └── Dockerfile          # Docker configuration for backend
├── frontend/               # Frontend Client (React)
│   ├── src/                # Source code Node.js/React
│   ├── nginx.conf          # Nginx config for Production
│   └── Dockerfile          # Docker configuration for frontend
├── .env.example            # Environment variables template
├── .env                    # Local environment variables
├── docker-compose.yml      # Base & Dev docker compose config
├── docker-compose.prod.yml # Production overrides
└── README.md               # Project documentation
```

## 📚 API Documentation

Xem tài liệu API tương tác tại: [Swagger UI](http://localhost:8000/docs) hoặc [ReDoc](http://localhost:8000/redoc).

## 🤝 Contributing

1. Fork dự án
2. Tạo nhánh tính năng mới (`git checkout -b feature/amazing-feature`)
3. Commit các thay đổi (`git commit -m 'Add some amazing feature'`)
4. Push nhánh của bạn (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## 📄 License

Dự án này được cấp phép theo giấy phép MIT.
