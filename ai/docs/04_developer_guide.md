# 04. HƯỚNG DẪN LẬP TRÌNH VIÊN & CẤU TRÚC MÃ NGUỒN (DEVELOPER GUIDE & SETUP)

## 1. Cấu Trúc Thư Mục Dự Án (Project File Layout Tree)

Dưới đây là cấu trúc hoàn chỉnh của mã nguồn AI Microservice trong thư mục `src/`:

```text
/Users/anhnon/HACKATHON/
├── docs/
│   ├── 01_architecture_overview.md        # Kiến trúc & hợp đồng dữ liệu
│   ├── 02_risk_assessment_engine.md       # Công thức rủi ro & 3 Weather API
│   ├── 03_replacement_sourcing_milp.md    # MILP & GPT-4o
│   ├── 04_developer_guide.md              # File này
│   └── 05_ai_worker_va_db_contract.md     # AI worker & bảng nào AI được ghi
│
├── bao-cao-rui-ro-nha-cung-ung.html   # Báo cáo radar rủi ro - NGUỒN dữ liệu seed
├── apidata/                           # Script crawl GDELT / FMP
│   ├── gdelt_supplier_risk.py
│   ├── fmp_supplier_financials.py
│   └── out/                           # Kết quả crawl (cache, tránh gọi lại API)
│
├── ai_schema.sql                      # DDL các bảng AI sở hữu
├── report_parser.py                   # Trích số liệu từ báo cáo HTML
├── seed_supabase.py                   # Seed DB dùng chung (--apply / --reset)
├── db_inspect.py                      # Đọc/kiểm tra DB (--table / --sql / --schema)
├── ai_worker.py                       # Worker chạy job  (CHƯA VIẾT)
│
├── .env                               # DB_* + GDELT_API_KEY + FMP_API_KEY
└── requirements.txt
```

> **Lưu ý**: mô hình HTTP API (`src/main.py`, FastAPI) đã bị bỏ. Backend không gọi AI nữa —
> AI là background worker ghi thẳng vào database dùng chung. Xem `docs/05`.

---

## 2. Hướng Dẫn Thiết Lập Môi Trường Phát Triển

### Bước 1: Khởi tạo Virtual Environment (Python 3.10+)
```bash
python3 -m venv venv
source venv/bin/activate
```

### Bước 2: Cài đặt Dependencies
```bash
pip install -r requirements.txt
```

### Bước 3: Đảm bảo File `.env` Đã Đủ Keys
```env
# OpenAI Key
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE

# Data APIs
GDELT_API_KEY=gdelt_sk_6d74aa58517daaba636e0ee11d8917e89af5946e9247532dec4eef1b78b12cdd
FMP_API_KEY=fNBkoB3Wdza7xwsadZo1Icf8S3UXOmZr

# Weather APIs
WEATHER_API_KEY=YOUR_WEATHERAPI_KEY_HERE
OPENWEATHER_API_KEY=YOUR_OPENWEATHER_KEY_HERE

# Server Config
PORT=8000
LOG_LEVEL=INFO
```

---

## 3. Chạy AI Background Worker & Utility Scripts

Vì hệ thống hoạt động theo mô hình **Background Worker** đọc/ghi trực tiếp với Supabase PostgreSQL, không sử dụng HTTP API server:

### 3.1 Chạy AI Background Worker (`ai_worker.py`)
```bash
# Chạy 1 vòng order_risk_scan rồi thoát
python3 ai_worker.py --once

# Chạy dạng daemon nền (lặp lại mỗi 5 phút / 300s)
python3 ai_worker.py --loop 300

# Chạy kèm quét cập nhật dữ liệu nhà cung ứng từ GDELT & FMP (quét nhịp ngày)
python3 ai_worker.py --once --scan-suppliers
```

### 3.2 Kiểm tra & Kiểm thử Database (`db_inspect.py`)
```bash
# Xem danh sách các bảng trong Supabase DB
python3 db_inspect.py --tables

# Đọc dữ liệu từ một bảng cụ thể
python3 db_inspect.py --table purchase_orders

# Chạy truy vấn SQL tùy chỉnh
python3 db_inspect.py --sql "SELECT po_number, current_risk_score FROM purchase_orders WHERE current_risk_score IS NOT NULL"
```

### 3.3 Crawl dữ liệu nhà cung cấp từ API bên ngoài (`apidata/`)
```bash
# Crawl tin tức rủi ro địa chính trị từ GDELT
python3 apidata/gdelt_supplier_risk.py

# Crawl báo cáo tài chính & Altman Z-score từ Financial Modeling Prep (FMP)
python3 apidata/fmp_supplier_financials.py
```
