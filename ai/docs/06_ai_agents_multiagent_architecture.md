# 06. ĐẶC TẢ KIẾN TRÚC MÔ HÌNH 6 AI AGENTS (HIERARCHICAL MULTI-AGENT ARCHITECTURE)

Tài liệu này tổng hợp toàn bộ kiến trúc 6 AI Agents chuyên biệt, quy trình vận hành, công thức rủi ro, bài toán MILP Solver và hợp đồng dữ liệu cho hệ thống **BikeSync AI Engine**.

---

## 1. Sơ Đồ Kiến Trúc Phân Cấp (Hierarchical Multi-Agent Blueprint)

```
                                ┌───────────────────────────────────────────────┐
                                │       BAN QUẢN TRỊ THU MUA DOANH NGHIỆP EV     │
                                └───────────────────────┬───────────────────────┘
                                                        │ Giao tiếp / Duyệt lệnh 1-Click
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AGENT 6: MASTER ORCHESTRATOR AGENT                                        │
│  - Tiếp nhận truy vấn/lịch chạy từ Background Worker, điều phối 5 Sub-Agents                               │
│  - Tổng hợp Chỉ số Rủi ro PORS: PORS = 0.35*SSI_news + 0.30*SSI_fin + 0.20*SSI_del + 0.15*G_geo             │
│  - Phát hiện sự cố (PORS >= 70 hoặc Risk Score > 65), tạo Incidents & kích hoạt MILP Sourcing Solver         │
└───────┬───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┘
        │                       │                       │                       │
        │ 1. Đọc DB ERP PO      │ 2. Quét tin tức       │ 3. Quét tài chính     │ 4. Gửi Email & Chatbox│ 5. Redirect Sourcing
        ▼                       ▼                       ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    AGENT 1    │       │    AGENT 2    │       │    AGENT 3    │       │    AGENT 4    │       │    AGENT 5    │
│ Enterprise DB │       │ News Risk     │       │ Financial     │       │ Logistics     │       │ Supplier      │
│ Ingestion     │       │ Agent         │       │ Health Agent  │       │ Chatbox Agent │       │ Sourcing      │
│ - Đọc đơn hàng│       │ - GDELT Cloud │       │ - FMP API     │       │ - B2B Portal  │       │ - Redirect    │
│   3 cụm HS    │       │   API v2      │       │   Altman Z    │       │   Xác minh    │       │   chọn đối tác│
│   Code ERP    │       │ - SSI_news    │       │ - SSI_fin     │       │   & Đàm phán  │       │ - PuLP MILP   │
│   (Pin, Motor,│       │   Score       │       │   Score       │       │   Logistics   │       │ - OpenRouter  │
│    Chip)      │       │               │       │               │       │               │       │   API (LLM)   │
└───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 2. Chi Tiết 6 Chuyên Viên AI Agent (Specialized Agent Roles)

### 2.1 AGENT 1: Enterprise DB Ingestion Agent
- **File implementation**: `ai/src/agents/db_ingestion_agent.py`
- **Nhiệm vụ**: Kết nối Supabase PostgreSQL, đọc danh sách POs chưa hoàn thành (`purchase_orders`), dữ liệu tồn kho (`inventory_items`), thông tin nhà cung ứng (`suppliers`) và các điểm dừng GPS (`shipment_tracking_points`).
- **Phạm vi giám sát**: Tập trung vào **3 Cụm Linh Kiện Cốt Lõi (HS Codes)**:
  - **Cụm 1**: Pin & Nguyên liệu Pin (`HS 850760`) - Cell Pin LFP/NCM, BMS, Lithium Hydroxide.
  - **Cụm 2**: Truyền động & Biến tần (`HS 850153`, `HS 850440`) - Động cơ điện $>75$kW, Inverter, SiC Converters.
  - **Cụm 3**: Chip bán dẫn & MCU (`HS 854110`, `HS 854231`) - BMS MCUs, PMIC, MOSFETs, LiDAR/Radar.

### 2.2 AGENT 2: News & Geopolitical Risk Agent
- **File implementation**: `ai/src/agents/news_risk_agent.py`
- **Nhiệm vụ**: Độc quyền truy vấn GDELT Cloud API v2 (`apidata/gdelt_supplier_risk.py`) để phân tích biến động địa chính trị, đình công, thiên tai, đứt gãy nguồn cung.
- **Công thức $SSI_{\text{news}}$**:
  $$SSI_{\text{news}} = 0.50 \cdot \text{ToneScore} + 0.25 \cdot \text{VolumeImpact} + 0.25 \cdot \text{GeoRiskPenalty}$$

### 2.3 AGENT 3: Financial Health Agent
- **File implementation**: `ai/src/agents/financial_health_agent.py`
- **Nhiệm vụ**: Độc quyền truy vấn Financial Modeling Prep (FMP) API (`apidata/fmp_supplier_financials.py`) để tính toán chỉ số kiệt quệ tài chính Altman Z-Score:
  $$Z = 1.2 X_1 + 1.4 X_2 + 3.3 X_3 + 0.6 X_4 + 0.999 X_5$$
- Quyết định vùng rủi ro ($Z \le 1.81 \rightarrow$ Vùng nguy hiểm / Distress) và tính $SSI_{\text{fin}}$.

### 2.4 AGENT 4: Supplier Email Inquiry & B2B Logistics Chatbox Agent
- **File implementation**: `ai/src/agents/logistics_chatbox_agent.py`
- **Nhiệm vụ**: Khi đơn hàng vượt ngưỡng cảnh báo, tự động tạo cấu hình Email xác minh tiến độ giao hàng và hỗ trợ đàm phán phương án vận tải (chuyển từ Sea Transport sang Air Freight, chia nhỏ lô hàng).

### 2.5 AGENT 5: Supplier Replacement Sourcing Agent
- **File implementation**: `ai/src/agents/replacement_sourcing_agent.py`
- **Nhiệm vụ**: 
  1. Chạy **PuLP MILP Optimization Solver** để chọn lọc và xếp hạng Top 1, Top 2, Top 3 nhà cung ứng thay thế có cùng khả năng sản xuất mã SKU/HS Code:
     $$\text{Score}_i = \text{round}(0.45 \cdot \text{CostScore}_i + 0.35 \cdot \text{LeadTimeScore}_i + 0.20 \cdot \text{ReliabilityScore}_i)$$
  2. Truyền kết quả vào **OpenRouter API (OpenAI GPT-4o)** với key `OPENROUTER_API_KEY` (hoặc `OPENAI_API_KEY`) để sinh danh sách Ưu điểm (`pros`), Nhược điểm (`cons`), Diễn giải (`reasoning`) và Kết luận kiến nghị (`recommendation`).

### 2.6 AGENT 6: Master Orchestrator Agent
- **File implementation**: `ai/src/agents/master_orchestrator.py`
- **Nhiệm vụ**:
  - Điều phối luồng xử lý giữa các Agent 1 đến 5.
  - Tính điểm rủi ro trễ hạn đơn hàng `delayRiskScore`:
    $$\text{delayRiskScore} = \text{round}\left(100 \cdot (0.50 \cdot \text{latenessFactor} + 0.25 \cdot \text{supplierReliabilityFactor} + 0.25 \cdot \text{inventoryBufferFactor})\right)$$
  - Tính điểm PORS tổng hợp cho nhà cung ứng:
    $$PORS = 0.35 \cdot SSI_{\text{news}} + 0.30 \cdot SSI_{\text{fin}} + 0.20 \cdot SSI_{\text{del}} + 0.15 \cdot G_{\text{geo}}$$
  - Lưu kết quả phân tích vào `incidents`, `sourcing_proposals`, `supplier_risk_analysis` và `ai_job_runs`.

---

## 3. Bảng Kê Biến Môi Trường (.env Checklist)

| Biến Môi Trường | Trạng Thái | Mô Tả / Endpoint |
| :--- | :---: | :--- |
| **`OPENROUTER_API_KEY`** | ✅ **VERIFIED (HTTP 200)** | API Key OpenRouter (`sk-or-v1-4c23f2d8cf...`) |
| `OPENAI_BASE_URL` | ✅ **VERIFIED** | Base URL: `https://openrouter.ai/api/v1` |
| `GDELT_API_KEY` | ✅ **CONFIGURED** | API key trích xuất tin tức địa chính trị GDELT Cloud v2 |
| `FMP_API_KEY` | ✅ **CONFIGURED** | API key trích xuất báo cáo tài chính Financial Modeling Prep |
| `SUPABASE_DB` / `DB_*` | ✅ **CONFIGURED** | Chuỗi kết nối PostgreSQL Supabase DB dùng chung |
