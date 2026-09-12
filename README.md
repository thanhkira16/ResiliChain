# ⚡ ResiliChain — Nền Tảng Tự Chủ & Quản Trị Rủi Ro Chuỗi Cung Ứng Xe Điện (EV)

> **Autonomous Electric Vehicle Supply Chain Resilience Platform**  
> *Hệ thống Giám sát 3D Digital Twin, Phân tích Rủi ro Đa nguồn với 6 AI Agents, Tối ưu hóa Sourcing Thay thế PuLP MILP và Phát Cảnh báo Real-time Telegram.*

---

## 📌 1. Giới Thiệu Đề Tài & Bối Cảnh

Trong bối cảnh ngành công nghiệp xe điện (Electric Vehicle - EV) tăng trưởng bùng nổ, **chuỗi cung ứng linh kiện xe điện** đối mặt với những rủi ro đứt gãy cực kỳ nghiêm trọng:
- **Nguyên liệu & Pin (`HS 850760`)**: Giá Lithium biến động, nguy cơ từ các nhà cung ứng gặp khủng hoảng tài chính.
- **Biến tần & Động cơ điện (`HS 850153`, `HS 850440`)**: Thiếu hụt công suất, trễ hạn giao vận tuyến biển/đường bộ do thời tiết cực đoan.
- **Chip bán dẫn & MCU (`HS 854110`, `HS 854231`)**: Biến động địa chính trị, thiên tai, đình công tại các cảng trung chuyển lớn.

**ResiliChain** được xây dựng nhằm giải quyết triệt để bài toán này bằng cách kết hợp **Bản đồ số 3D Digital Twin (CesiumJS)** với **Kiến trúc Phân cấp 6 AI Agents** tự động quét dữ liệu ERP, tin tức địa chính trị GDELT, chỉ số tài chính FMP và dự báo thời tiết Open-Meteo để phát hiện rủi ro trễ hạn sớm, đồng thời tự động đề xuất nhà cung cấp thay thế tối ưu bằng **Thuật toán Quy hoạch Tuyến tính PuLP MILP Solver** & **LLM GPT-4o**.

---

## 🔥 2. Tính Năng Nổi Bật

- 🌍 **3D Digital Twin Supply Chain Visualizer**: Trực quan hóa toàn bộ luồng vận chuyển PO, vị trí kho bãi, cảng biển và tuyến đường GPS thời gian thực trên quả địa cầu 3D với hiệu ứng thời tiết (mưa, tuyết, dông bão).
- 🤖 **Hierarchical Multi-Agent AI Engine**: Mô hình 6 AI Agents hoạt động dạng background worker, không gây nghẽn REST API backend, liên tục giám sát và tự động đánh giá chỉ số rủi ro $PORS$ và `delayRiskScore`.
- 📊 **Cơ chế Phân tích Rủi ro Đa Nguồn (Multi-Source Risk Engine)**:
  - **Địa chính trị (GDELT Cloud API v2)**: Đánh giá tone tin tức & các sự kiện đình công, thiên tai.
  - **Sức khỏe Tài chính (Financial Modeling Prep API)**: Tính điểm kiệt quệ tài chính **Altman Z-Score**.
  - **Thời tiết Tuyến (Open-Meteo APIs)**: Dự báo chậm trễ do bão/tuyết dựa trên mã thời tiết WMO 4677 & tốc độ gió $>50$ km/h.
- 🧮 **Tối Ưu Hóa Nhà Cung Cấp Thay Thế (PuLP MILP Solver & GPT-4o)**: Khi sự cố vượt ngưỡng ($>65/100$), hệ thống tự động chạy bài toán Quy hoạch tuyến tính hỗn hợp nguyên (MILP) để tìm Top 1, Top 2, Top 3 đối tác thay thế kèm giải trình Pros/Cons.
- 📱 **Real-time Alerting & 1-Click Approval**: Tự động phát tin nhắn cảnh báo trực tiếp qua Telegram Bot đến Ban Quản lý Thu mua, cho phép thao tác **Phê duyệt 1-Click (`RESOLVED_REPLACED`)** ngay trên Web Dashboard.

---

## 🏗️ 3. Kiến Trúc Tổng Thể Hệ Thống

Hệ thống được thiết kế theo kiến trúc **3 Lớp Decoupled** chia sẻ chung cơ sở dữ liệu **Supabase PostgreSQL**:

```
                         ┌────────────────────────────────────────────────────────┐
                         │              FRONTEND WEB DASHBOARD                    │
                         │   - React 18 + Vite + TypeScript                       │
                         │   - CesiumJS 3D Globe + Tailwind CSS / Lucide Icons    │
                         └───────────────────────────┬────────────────────────────┘
                                                     │ REST API & Realtime UI
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       BACKEND REST API (NestJS)                                         │
│   - Controller & DTO Contracts: POs, Suppliers, Incidents, Proposals                                    │
│   - Domain Entities & Repositories (NestJS Clean Architecture)                                          │
└────────────────────────────────────────────────────────────┬────────────────────────────────────────────┘
                                                             │ Read / Write
                                                             ▼
                         ┌────────────────────────────────────────────────────────┐
                         │         SUPABASE POSTGRESQL DATABASE (Dùng chung)      │
                         │  purchase_orders  ·  suppliers  ·  incidents           │
                         │  sourcing_proposals  ·  supplier_risk_analysis         │
                         └───────────────────────────▲────────────────────────────┘
                                                     │ Direct DB Sync (Async)
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       AI ENGINE BACKGROUND WORKER                                       │
│   - 6 Specialized AI Agents (Master Orchestrator, Ingestion, News, Financial, Logistics, Sourcing)    │
│   - Integration: GDELT Cloud API  ·  FMP API  ·  Open-Meteo Weather APIs  ·  OpenRouter GPT-4o         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 4. Mô Hình Phân Cấp 6 AI Agents

```
                                ┌───────────────────────────────────────────────┐
                                │       BAN QUẢN TRỊ THU MUA DOANH NGHIỆP EV     │
                                └───────────────────────┬───────────────────────┘
                                                        │ Duyệt lệnh 1-Click / Telegram Bot
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AGENT 6: MASTER ORCHESTRATOR AGENT                                        │
│  - Tiếp nhận lịch chạy Background Worker (ai_worker.py), điều phối 5 Sub-Agents                             │
│  - Tính điểm rủi ro trễ hạn delayRiskScore & điểm PORS tổng hợp                                             │
│  - Tạo Incident PENDING_APPROVAL & kích hoạt PuLP MILP Solver khi điểm rủi ro > 65                          │
└───────┬───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┘
        │                       │                       │                       │
        │ 1. Đọc PO/Tồn kho     │ 2. Tin tức GDELT      │ 3. Tài chính FMP      │ 4. Hỗ trợ đàm phán    │ 5. MILP Sourcing
        ▼                       ▼                       ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    AGENT 1    │       │    AGENT 2    │       │    AGENT 3    │       │    AGENT 4    │       │    AGENT 5    │
│ Enterprise DB │       │ News Risk     │       │ Financial     │       │ Logistics     │       │ Supplier      │
│ Ingestion     │       │ Agent         │       │ Health Agent  │       │ Chatbox Agent │       │ Sourcing      │
│ Quét POs, GPS,│       │ GDELT Cloud   │       │ FMP API       │       │ Chatbox B2B   │       │ PuLP MILP +   │
│ 3 cụm HS Code │       │ SSI_news      │       │ Altman Z-Score│       │ Đàm phán      │       │ GPT-4o        │
└───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

---

## ⚡ 5. Khởi Chạy Nhanh (Quick Start)

### Tiền đề
- **Node.js**: v18.0+
- **Python**: 3.10+
- **Just CLI**: (`brew install just` hoặc `cargo install just`)

### Bước 1: Clone & Cài đặt Dependencies
```bash
git clone https://github.com/thanhkira16/4conbo.git
cd 4conbo
just setup
```

### Bước 2: Cấu hình File `.env`
Đảm bảo đã khai báo cấu hình trong `ai/.env`, `backend/nestjs-boilerplate/.env` và `frontend/.env`.  
*(Chi tiết mẫu `.env` xem tại [`SETUP.md`](file:///Users/anhnon/4conbo/SETUP.md))*

### Bước 3: Khởi chạy Đồng thời Toàn bộ Hệ thống
```bash
just dev
```
Hệ thống sẽ khởi động tại các cổng:
- 🌐 **Frontend App**: `http://localhost:3000`
- ⚡ **Backend API**: `http://localhost:3001/api/v1`
- 🤖 **AI Streamlit Dashboard**: `http://localhost:8501`

### Bước 4: Chạy AI Worker Quét Rủi Ro & Phát Alert
```bash
# Một vòng quét rủi ro đơn hàng
just scan

# Quét rủi ro nhà cung ứng (GDELT + FMP)
just scan-suppliers

# Phát toàn bộ cảnh báo qua Telegram Bot
just send-alerts
```

---

## 📂 6. Cấu Trúc Thư Mục Project

```
4conbo/
├── README.md                              # Trang chủ giới thiệu dự án
├── SETUP.md                               # Hướng dẫn cài đặt & vận hành A-Z
├── justfile                               # Lệnh điều khiển tự động hóa (Just runner)
├── docs/
│   └── MASTER_PRODUCT_DEMO_DOCUMENTATION.md # Tài liệu thuyết minh & Demo sản phẩm hoàn chỉnh
├── ai/                                    # Phân hệ AI Engine (Python 3.10)
│   ├── ai_worker.py                       # Master background worker
│   ├── dashboard.py                       # Streamlit AI Dashboard
│   ├── requirements.txt                   # Thư viện Python (PuLP, OpenAI, Streamlit,...)
│   ├── apidata/                           # Integrations API (GDELT, FMP, Open-Meteo)
│   ├── scripts/send_all_alerts.py         # Telegram alert dispatcher
│   ├── src/
│   │   ├── agents/                        # 6 Specialized AI Agents
│   │   ├── core/                          # Formulas, MILP Solver, Contracts
│   │   └── database/                      # Supabase DB Client
│   └── docs/                              # Bộ tài liệu kỹ thuật phân hệ AI
├── backend/nestjs-boilerplate/            # Phân hệ Backend API (NestJS)
│   └── src/
│       ├── core/domain/supply-chain/      # Entities & Domain Models
│       └── infrastructure/api/            # REST Controllers
└── frontend/                              # Phân hệ Frontend Web (Vite + React + Cesium)
    └── src/
        ├── components/                    # Cesium 3D Map, Approval, Incidents, Orders
        └── services/                      # API Clients & AI Agents Services
```

---

## 📚 7. Bộ Tài Liệu Thuyết Minh & Hướng Dẫn

- 📖 **[Cẩm Nang Cài Đặt Chi Tiết (SETUP.md)](file:///Users/anhnon/4conbo/SETUP.md)**
- 🎓 **[Tài Liệu Thuyết Minh & Demo Sản Phẩm Hoàn Chỉnh (MASTER_PRODUCT_DEMO_DOCUMENTATION.md)](file:///Users/anhnon/4conbo/docs/MASTER_PRODUCT_DEMO_DOCUMENTATION.md)**
- 🤖 **[Đặc Tả Mô Hình Tương Tác Agents & APIs (AI_AGENTS_INTERACTION_AND_APIS.md)](file:///Users/anhnon/4conbo/docs/AI_AGENTS_INTERACTION_AND_APIS.md)**
- 📐 **[Đặc Tả Động Cơ Đánh Giá Rủi Ro (02_risk_assessment_engine.md)](file:///Users/anhnon/4conbo/ai/docs/02_risk_assessment_engine.md)**
- 🧮 **[Đặc Tả Thuật Toán MILP Sourcing (03_replacement_sourcing_milp.md)](file:///Users/anhnon/4conbo/ai/docs/03_replacement_sourcing_milp.md)**

---
*© 2026 ResiliChain Team — Autonomous EV Supply Chain Project.*
