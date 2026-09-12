# 07. ĐẶC TẢ MÔ HÌNH TƯƠNG TÁC AI AGENTS & HỆ THỐNG APIS (FE, BE, DB, AI, TELEGRAM, SENDEMAIL)

Tài liệu này là bản đặc tả kỹ thuật chi tiết về cách mô hình **6 AI Agents** tương tác nội bộ và tương tác toàn diện với 6 phân hệ hệ thống: **Frontend (FE)**, **Backend (BE)**, **Supabase PostgreSQL (DB)**, **AI Background Engine (AI)**, **Telegram Bot Dispatcher (TELEGRAM)** và **SendEmail / SMTP Inquiry Client (SENDEMAIL)**.

---

## 📌 1. SƠ ĐỒ KIẾN TRÚC PHÂN CẤP 6 AI AGENTS (AI AGENT ARCHITECTURE)

```mermaid
graph TB
    subgraph MasterLevel ["LAYER 1: MASTER ORCHESTRATION & DECISION ENGINE"]
        A6["🤖 AGENT 6: MASTER ORCHESTRATOR AGENT<br/>(ai/src/agents/master_orchestrator.py)"]
        Cron["⏰ Background Worker Loop / Just Scheduler<br/>(ai_worker.py --once / --loop 300)"]
        Cron --> A6
    end

    subgraph DataIngestion ["LAYER 2: DATA INGESTION & TRACKING"]
        A1["📦 AGENT 1: ENTERPRISE DB INGESTION AGENT<br/>(db_ingestion_agent.py)"]
        DB[(Supabase PostgreSQL)]
        A1 <-->|SELECT POs, Inventory, GPS Waypoints| DB
        A6 -->|1. Request ERP & GPS Data| A1
    end

    subgraph RiskAgents ["LAYER 3: MULTI-SOURCE RISK INTELLIGENCE AGENTS"]
        A2["📰 AGENT 2: NEWS & GEOPOLITICAL RISK AGENT<br/>(news_risk_agent.py)"]
        GDELT["🌐 GDELT Cloud API v2<br/>(News Tone & Strikes)"]
        A2 <-->|Query Search & Events| GDELT
        A6 -->|2. Request News Risk| A2

        A3["📊 AGENT 3: FINANCIAL HEALTH AGENT<br/>(financial_health_agent.py)"]
        FMP["💰 Financial Modeling Prep API<br/>(Balance Sheet & Income)"]
        A3 <-->|Query Financial Statements| FMP
        A6 -->|3. Request Financial Risk| A3

        Meteo["🌤️ Open-Meteo Weather APIs<br/>(WMO Codes, Wind, Rain)"]
        A6 <-->|Query Route Forecast| Meteo
    end

    subgraph OperationsAgents ["LAYER 4: LOGISTICS & SOURCING OPTIMIZATION AGENTS"]
        A4["📧 AGENT 4: SUPPLIER EMAIL & LOGISTICS CHATBOX AGENT<br/>(logistics_chatbox_agent.py)"]
        Email["✉️ SendEmail / SMTP Inquiry Engine<br/>(Auto Email Dispatcher)"]
        A4 -->|Dispatch Email Inquiry| Email
        A6 -->|4. Trigger Email & Negotiation| A4

        A5["🧮 AGENT 5: REPLACEMENT SOURCING AGENT<br/>(replacement_sourcing_agent.py)"]
        MILP["📐 PuLP MILP Solver<br/>(Cost, LeadTime, Reliability)"]
        LLM["🧠 OpenRouter API (GPT-4o)<br/>(Pros/Cons & Reasoning)"]
        A5 --> MILP
        A5 --> LLM
        A6 -->|5. Trigger Sourcing Optimization| A5
    end

    subgraph NotificationLayer ["LAYER 5: DISPATCH & ALERTS"]
        TG["📱 Telegram Bot Dispatcher<br/>(send_all_alerts.py)"]
        A6 -->|PORS >= 50 or PO Risk >= 35| TG
        A6 -->|PO Risk >= 65: Create Incident PENDING_APPROVAL| DB
        A5 -->|Save Top 1-3 Sourcing Proposal| DB
    end

    classDef master fill:#2b4c7e,stroke:#1b2a47,color:#fff,stroke-width:2px;
    classDef agent fill:#386fa4,stroke:#134074,color:#fff,stroke-width:2px;
    classDef external fill:#d90429,stroke:#ef233c,color:#fff,stroke-width:2px;
    classDef db fill:#2a9d8f,stroke:#264653,color:#fff,stroke-width:2px;

    class A6 master;
    class A1,A2,A3,A4,A5 agent;
    class GDELT,FMP,Meteo,LLM,TG,Email external;
    class DB db;
```

---

## 🏗️ 2. SƠ ĐỒ TƯƠNG TÁC HỆ THỐNG (FE + BE + DB + AI + TELEGRAM + SENDEMAIL)

```mermaid
graph TD
    subgraph FrontendLayer ["FRONTEND LAYER (Vite + React 18)"]
        FE_Dashboard["📊 Web Dashboard UI<br/>(DashboardView.tsx)"]
        FE_Cesium["🌍 3D Digital Twin Globe<br/>(GlobalRouteWeatherMap.tsx)"]
        FE_Approval["✅ 1-Click Approval Panel<br/>(ApprovalView.tsx)"]
        FE_Chat["💬 Logistics Chatbox Modal<br/>(LogisticsChatModal.tsx)"]
    end

    subgraph BackendLayer ["BACKEND REST API (NestJS Clean Architecture)"]
        BE_Controller["⚡ REST API Controllers<br/>(/api/v1/orders, /suppliers, /incidents)"]
        BE_Service["⚙️ Supply Chain Services<br/>(SupplyChainService)"]
        BE_Repo["🗄️ Domain Repositories & Entities"]
        BE_Controller --> BE_Service --> BE_Repo
    end

    subgraph SharedDatabase ["SHARED DATABASE LAYER (Supabase PostgreSQL)"]
        DB_Orders[("tbl: purchase_orders")]
        DB_Suppliers[("tbl: suppliers")]
        DB_Incidents[("tbl: incidents")]
        DB_Proposals[("tbl: sourcing_proposals")]
        DB_Risk[("tbl: supplier_risk_analysis")]
        DB_Tracking[("tbl: shipment_tracking_points")]
    end

    subgraph AIEngine ["AI ENGINE BACKGROUND WORKER (Python 3.10)"]
        AI_Worker["🤖 ai_worker.py / Master Orchestrator"]
        AI_6Agents["🧩 6 Specialized AI Agents"]
        AI_MILP["🧮 PuLP MILP Solver"]
        AI_Worker --> AI_6Agents --> AI_MILP
    end

    subgraph ExternalIntegrations ["EXTERNAL SERVICES & APIS"]
        Ext_GDELT["📰 GDELT Cloud API v2"]
        Ext_FMP["💰 Financial Modeling Prep API"]
        Ext_Meteo["🌤️ Open-Meteo Weather APIs"]
        Ext_GPT4o["🧠 OpenRouter API (GPT-4o)"]
        Ext_Telegram["📱 Telegram Bot API"]
        Ext_SendEmail["✉️ SendEmail / SMTP Client"]
    end

    %% Interactions FE -> BE
    FE_Dashboard <-->|REST API / HTTP| BE_Controller
    FE_Cesium <-->|Fetch Route & Weather Data| BE_Controller
    FE_Approval -->|POST /incidents/:id/approve| BE_Controller
    FE_Chat <-->|POST /chatbox/messages| BE_Controller

    %% Interactions BE -> DB
    BE_Repo <-->|TypeORM / SQL Queries| SharedDatabase

    %% Interactions AI -> DB
    AI_Worker <-->|READ POs, Inventory, Waypoints| DB_Orders
    AI_Worker <-->|READ/WRITE Tracking GPS| DB_Tracking
    AI_Worker -->|UPSERT Supplier Risk| DB_Risk
    AI_Worker -->|UPSERT Incidents PENDING_APPROVAL| DB_Incidents
    AI_Worker -->|INSERT Sourcing Proposals| DB_Proposals

    %% Interactions AI -> External APIs
    AI_6Agents <-->|Fetch News Tone & Strikes| Ext_GDELT
    AI_6Agents <-->|Fetch Financial Balance Sheet| Ext_FMP
    AI_6Agents <-->|Fetch Route Forecast WMO Codes| Ext_Meteo
    AI_6Agents <-->|Structured Output Pros/Cons| Ext_GPT4o
    AI_Worker -->|Send Real-time Risk Alerts| Ext_Telegram
    AI_6Agents -->|Dispatch Progress & Negotiation Emails| Ext_SendEmail
```

---

## 🔄 3. SEQUENCE DIAGRAM LUỒNG XỬ LÝ CHI TIẾT (PROCESSING SEQUENCE FLOW)

```mermaid
sequenceDiagram
    autonumber
    participant DB as Supabase PostgreSQL
    participant A6 as Agent 6: Master Orchestrator
    participant A1 as Agent 1: DB Ingestion
    participant A2 as Agent 2: News Risk (GDELT)
    participant A3 as Agent 3: Financial Health (FMP)
    participant Meteo as Open-Meteo Weather APIs
    participant A5 as Agent 5: Sourcing (PuLP + GPT-4o)
    participant TG as Telegram Bot Dispatcher
    participant Email as SendEmail Service

    Note over A6: Nhịp quét Background Worker (ai_worker.py)
    A6->>A1: Kích hoạt quét POs chưa xong, Tồn kho & Tracking Pings
    A1->>DB: SELECT purchase_orders, inventory_items, shipment_tracking_points
    DB-->>A1: Trả về danh sách đơn hàng & tọa độ GPS
    A1-->>A6: Danh sách POs + Trạng thái GPS

    Note over A6: Đánh giá Rủi ro Đơn hàng & Tuyến Vận chuyển
    A6->>Meteo: Truy vấn Weather Forecast qua tọa độ GPS (Open-Meteo API)
    Meteo-->>A6: Trả về WMO Code, Tốc độ gió, Lượng mưa

    Note over A6: Nhịp quét Rủi ro Nhà Cung Cấp (1 lần/ngày)
    A6->>A2: Yêu cầu phân tích tin tức rủi ro địa chính trị
    A2->>A2: Gọi GDELT Cloud API v2 (/search, /events)
    A2-->>A6: Trả về ToneScore, VolumeImpact, SSI_news

    A6->>A3: Yêu cầu phân tích sức khỏe tài chính nhà cung ứng
    A3->>A3: Gọi Financial Modeling Prep API (/balance-sheet, /income-statement)
    A3-->>A6: Trả về Altman Z-Score & SSI_fin

    Note over A6: Tính toán PORS Score & delayRiskScore
    A6->>DB: UPSERT supplier_risk_analysis & Cập nhật current_risk_score PO

    alt Point Rủi ro PO >= 35.0 hoặc Supplier PORS >= 50.0
        A6->>TG: Gửi tin nhắn Cảnh báo Real-time qua Telegram Bot
        A6->>Email: Tự động gửi Email xác minh tiến độ giao hàng tới Nhà cung cấp
    end

    alt Point Rủi ro PO >= 65.0 (Vượt ngưỡng nghiêm trọng)
        A6->>DB: UPSERT Incident mới (status: PENDING_APPROVAL)
        A6->>A5: Kích hoạt Tìm kiếm Đối tác Thay thế Tối ưu
        A5->>DB: SELECT suppliers có khả năng sản xuất cùng SKU
        A5->>A5: Chạy PuLP MILP Optimization Solver (Cost, LeadTime, Reliability)
        A5->>A5: Gọi OpenRouter API (OpenAI GPT-4o) sinh Pros/Cons & Reasoning
        A5-->>A6: Danh sách Top 1, Top 2, Top 3 Proposal
        A6->>DB: INSERT sourcing_proposals (JSONB rankings)
    end
```

---
*© 2026 ResiliChain AI Engine Documentation.*
