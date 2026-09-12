# 01. MASTER IMPLEMENTATION PLAN - BIKESYNC AI ENGINE

## 1. TỔNG QUAN KIẾN TRÚC MỤC TIÊU
BikeSync AI Engine là hệ thống **Background Worker AI đa tác vụ tự chủ (Hierarchical Multi-Agent Architecture)** cho sản xuất xe điện (EV Supply Chain Autonomy Platform).
Hệ thống vận hành theo 2 nhịp:
- **`order_risk_scan`** (Mỗi 5–10 phút): Quét đơn hàng ERP, dự báo ETA, chấm điểm rủi ro trễ hạn, tạo sự cố `incidents` (khi Risk Score $>65$ hoặc $PORS \ge 70$), giải bài toán PuLP MILP Solver + OpenRouter GPT-4o để sinh đề xuất `sourcing_proposals`.
- **`supplier_risk_scan`** (Nhịp 1 lần/ngày): Quét GDELT Cloud API v2 & FMP API để cập nhật chỉ số rủi ro $PORS$ và radar rủi ro nhà cung ứng `supplier_risk_analysis`.

---

## 2. KIẾN TRÚC 6 AI AGENTS CHUYÊN BIỆT

```text
                                ┌───────────────────────────────────────────────┐
                                │       BAN QUẢN TRỊ THU MUA DOANH NGHIỆP EV     │
                                └───────────────────────┬───────────────────────┘
                                                        │ Giao tiếp / Duyệt lệnh 1-Click
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AGENT 6: MASTER ORCHESTRATOR AGENT                                        │
│  - Điều phối 5 Sub-Agents, tính tổng hợp rủi ro PORS (0.35*SSI_news + 0.30*SSI_fin + 0.20*SSI_del + 0.15*G_geo)│
│  - Tự động kích hoạt Incident (khi PORS >= 70 hoặc Risk Score > 65) & chạy MILP Solver phân bổ lại sản lượng│
└───────┬───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┘
        │                       │                       │                       │
        │ 1. Đọc DB ERP PO      │ 2. Quét tin tức       │ 3. Quét tài chính     │ 4. Xác minh & Đàm phán│ 5. Replacement Sourcing
        ▼                       ▼                       ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    AGENT 1    │       │    AGENT 2    │       │    AGENT 3    │       │    AGENT 4    │       │    AGENT 5    │
│ Enterprise DB │       │ News Risk     │       │ Financial     │       │ Logistics     │       │ Supplier      │
│ Ingestion     │       │ Agent         │       │ Health Agent  │       │ Chatbox Agent │       │ Sourcing      │
│ - Đọc đơn hàng│       │ - GDELT Cloud │       │ - FMP API     │       │ - Email Magic │       │ - PuLP MILP   │
│   3 cụm HS    │       │   API Search  │       │   Altman Z    │       │   Link & B2B  │       │   Solver      │
│   Code ERP    │       │ - SSI_news    │       │ - SSI_fin     │       │   Logistics   │       │ - OpenRouter  │
│   (order_id,  │       │ (supplier_id) │       │ (supplier_id) │       │   Chatbox     │       │   API (LLM    │
│    sku_id)    │       │               │       │               │       │   (order_id)  │       │   Reasoning)  │
└───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 3. GIÁM SÁT 3 CỤM LINH KIỆN CỐT LÕI XE ĐIỆN
1. **Cụm 1: Pin & NVL Thô Battery** (`HS 850760`): Cell Pin LFP/NCM, BMS, Lithium Hydroxide, Nickel.
2. **Cụm 2: Truyền Động & Biến Tần E-Powertrain** (`HS 850153`, `HS 850440`): Động cơ điện $>75$kW, Inverter, SiC Converters.
3. **Cụm 3: Semiconductor & MCU Ô tô** (`HS 854110`, `HS 854231`): Chip điều khiển BMS, MOSFETs, IGBT, LiDAR/Radar.

---

## 4. QUY TRÌNH THỰC THI & VERIFICATION
1. **Khởi tạo DDL**: Chạy `ai_schema.sql` khởi tạo các bảng sở hữu trong PostgreSQL Supabase.
2. **Nạp dữ liệu Seed**: Chạy `seed_supabase.py` tạo dữ liệu ERP và rủi ro baseline.
3. **Kiểm tra API**: Chạy `test_openrouter.py` (Đã Verified HTTP 200 SUCCESS).
4. **Chạy Worker**: Chạy `ai_worker.py --once` hoặc `ai_worker.py --loop 300`.
