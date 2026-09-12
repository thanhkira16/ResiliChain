# 🛠️ ResiliChain — Hướng Dẫn Cài Đặt & Vận Hành Chi Tiết (SETUP.md)

Tài liệu này hướng dẫn chi tiết cách cài đặt môi trường, thiết lập biến môi trường `.env`, seed cơ sở dữ liệu Supabase PostgreSQL, khởi chạy toàn bộ 3 phân hệ (Frontend, Backend, AI Service) và vận hành các tác vụ phát cảnh báo Telegram real-time.

---

## 📌 1. Tiền Đề Hệ Thống (Prerequisites)

Đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
- **Node.js**: phiên bản `>= 18.0.0` và `npm` `>= 9.0.0`.
- **Python**: phiên bản `>= 3.10` và `pip`, `venv`.
- **Just CLI** (Trình quản lý lệnh tự động):
  - macOS: `brew install just`
  - Linux: `sudo apt install just` hoặc `cargo install just`
  - Windows: `choco install just` hoặc `scoop install just`
- **PostgreSQL Database** (hoặc Supabase Cloud Account).

---

## 🔑 2. Cấu Hình Biến Môi Trường (.env)

Hệ thống gồm 3 phân hệ độc lập. Bạn cần tạo các file `.env` tương ứng theo mẫu dưới đây:

### 2.1 File Cấu Hình AI Service (`ai/.env`)
Tạo file `/Users/anhnon/4conbo/ai/.env`:

```env
# Database Connection (Supabase PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
SUPABASE_DB_PORT=6543
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres.your_ref
SUPABASE_DB_PASSWORD=your_db_password

# External Risk Data APIs
GDELT_API_KEY=your_gdelt_key_if_any
FMP_API_KEY=your_fmp_financial_prep_key

# OpenRouter / OpenAI API (GPT-4o Reasoning for Pros/Cons)
OPENROUTER_API_KEY=sk-or-v1-4c23f2d8cf...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o

# Telegram Bot Alert Integration
TELEGRAM_BOT_TOKEN=7891234567:AAFn_your_bot_token_here
TELEGRAM_CHAT_ID=-1001234567890

# AI Engine Weights & Thresholds
RISK_THRESHOLD_INCIDENT=65.0
RISK_THRESHOLD_TELEGRAM=35.0
PORS_THRESHOLD_TELEGRAM=50.0
```

### 2.2 File Cấu Hình Backend (`backend/nestjs-boilerplate/.env`)
Tạo file `/Users/anhnon/4conbo/backend/nestjs-boilerplate/.env`:

```env
PORT=3001
NODE_ENV=development

# Supabase PostgreSQL Database
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres.your_ref
DB_PASSWORD=your_db_password

JWT_SECRET=super-secret-jwt-key-2026
JWT_EXPIRATION_TIME=3600s
```

### 2.3 File Cấu Hình Frontend (`frontend/.env`)
Tạo file `/Users/anhnon/4conbo/frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_CESIUM_ION_TOKEN=your_cesium_ion_token_optional
```

---

## 📦 3. Cài Đặt Dependencies (`just setup`)

Từ thư mục gốc dự án `/Users/anhnon/4conbo`, chạy lệnh duy nhất:

```bash
just setup
```

Lệnh trên sẽ tự động thực hiện các công việc:
1. **Backend**: Di chuyển vào `backend/nestjs-boilerplate` và chạy `npm install`.
2. **Frontend**: Di chuyển vào `frontend`, chạy `npm install` và thực hiện `npm run copy-cesium` (sao chép tài nguyên Workers/Assets của CesiumJS sang `public/cesium`).
3. **AI Service**: Tạo Python virtual environment (`ai/.venv`), nâng cấp `pip` và cài đặt toàn bộ package trong `ai/requirements.txt` (PuLP, OpenAI, Streamlit, psycopg2, requests, pydantic,...).

---

## 🗄️ 4. Khởi Tạo Cấu Trúc Bảng & Seed Dữ Liệu

Nếu sử dụng Supabase PostgreSQL mới, hãy chạy các script SQL để khởi tạo schema và seed dữ liệu mẫu:

1. **Khởi tạo Schema AI & ERP**:
   Nạp file [`ai/ai_schema.sql`](file:///Users/anhnon/4conbo/ai/ai_schema.sql) vào Supabase SQL Editor.
2. **Nạp Dữ liệu Mẫu (Suppliers, POs, Shipments, Waypoints)**:
   Nạp file [`ai/seed_ai_data.sql`](file:///Users/anhnon/4conbo/ai/seed_ai_data.sql) vào Supabase SQL Editor.

---

## 🚀 5. Khởi Chạy Hệ Thống (`just dev`)

Để chạy đồng thời cả 3 dịch vụ trong cùng một terminal window:

```bash
just dev
```

Output console hiển thị:
```text
BE  http://localhost:3001/api/v1
FE  http://localhost:3000
AI  http://localhost:8501

[BE] [Nest] Nest application successfully started
[FE]   VITE v5.x.x  ready in 450 ms
[AI]   Streamlit app running at http://localhost:8501
```

> **Mẹo**: Nhấn `Ctrl + C` để đóng đồng thời cả 3 phân hệ.

### Hoặc khởi chạy riêng lẻ từng dịch vụ:
- **Chỉ Backend (NestJS Watch Mode)**: `just be`
- **Chỉ Frontend (Vite Dev Server)**: `just fe`
- **Chỉ AI Streamlit Dashboard**: `just ai`

---

## 🤖 6. Vận Hành AI Background Worker & Telegram Alerts

Các lệnh điều khiển AI Background Engine:

| Lệnh `just` | Mô Tả Chức Năng |
| :--- | :--- |
| **`just scan`** | Quét 1 vòng rủi ro tất cả đơn hàng PO mở, cập nhật `delayRiskScore`, nếu rủi ro $>65$ sẽ tự tạo Incident & chạy PuLP MILP Solver sinh Sourcing Proposals. |
| **`just scan-suppliers`** | Quét rủi ro toàn bộ nhà cung ứng bằng GDELT Cloud v2 API & FMP API (chạy nhịp 1 lần/ngày), lưu bảng `supplier_risk_analysis`. |
| **`just send-alerts`** | Trích xuất các đơn hàng $Score \ge 35$ và NCC $PORS \ge 50$ để phát tin nhắn trực tiếp qua Telegram Bot. |
| **`just watch interval="300"`** | Khởi chạy AI Worker vòng lặp liên tục (mặc định mỗi 300 giây quét 1 lần). |
| **`just dry-run`** | In ra danh sách câu lệnh SQL worker sẽ ghi mà KHÔNG thực hiện chỉnh sửa DB. |

---

## 📱 7. Test Cảnh Báo Telegram Real-time

Để kiểm tra bot Telegram có hoạt động chính xác không, chạy lệnh:

```bash
cd ai
.venv/bin/python scripts/send_all_alerts.py
```

Console sẽ xuất nhật ký:
```text
==================================================
🔍 BẮT ĐẦU KIỂM TRA DATABASE VÀ GỬI TELEGRAM ALERTS
==================================================

[1/2] Đang kiểm tra rủi ro Nhà cung cấp (Supplier Risk)...
-> Tìm thấy 2 nhà cung cấp có rủi ro cao/trung bình cao.
  📤 Gửi alert NCC: CATL Battery Corp (SUP-01) - PORS: 68.5 - HIGH
     Kết quả Telegram: ✅ Thành công

[2/2] Đang kiểm tra rủi ro Đơn hàng (Purchase Order Delay Risk)...
-> Tìm thấy 1 đơn hàng có điểm rủi ro >= 35/100.
  📤 Gửi alert PO: PO-2026-003 (Bộ phanh đĩa thủy lực 2 piston) - Supplier: SUP-03 - Score: 66.3
     Kết quả Telegram: ✅ Thành công
```

---

## ❓ 8. Xử Lý Lỗi Thường Gặp (Troubleshooting)

1. **Lỗi `Address already in use (EADDRINUSE)` tại port 3000 / 3001 / 8501**:
   - Tìm và tắt process đang chiếm cổng:
     ```bash
     lsof -i :3000 -t | xargs kill -9
     lsof -i :3001 -t | xargs kill -9
     lsof -i :8501 -t | xargs kill -9
     ```
2. **Lỗi CesiumJS 3D Map hiển thị màn hình trắng**:
   - Chạy lại lệnh copy tài liệu Cesium sang public:
     ```bash
     just copy-cesium
     ```
3. **Lỗi `psycopg2.OperationalError: cannot connect to server` trong AI Worker**:
   - Kiểm tra lại chuỗi kết nối Supabase Postgres trong `ai/.env` (Host, Port 6543, Password).
   - Đảm bảo IP hiện tại không bị chặn bởi Supabase Network Restrictions.

---
*Cập nhật lần cuối: Tháng 09/2026 — ResiliChain Team.*
