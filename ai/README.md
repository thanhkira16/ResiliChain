# ResiliChain — AI Engine

Worker nền AI đa tác vụ cho chuỗi cung ứng xe điện: quét đơn hàng ERP, chấm điểm rủi ro
trễ hạn, quét rủi ro nhà cung ứng (tin tức + tài chính), và sinh đề xuất nguồn thay thế
bằng MILP + LLM.

## Chạy nhanh (từ thư mục gốc dự án)

```bash
just setup        # cài dependencies cho BE + FE + AI
cp ai/.env.example ai/.env     # rồi điền khóa thật
just reset-demo   # schema → seed → 2 nhịp quét AI
just dev          # chạy đồng thời BE:3001 · FE:3000 · AI:8501
```

`just` một mình sẽ liệt kê toàn bộ lệnh. Chỉ chạy riêng dashboard: `just ai`.

## Các lệnh worker

| Lệnh `just` | Tương đương | Tác dụng |
| :--- | :--- | :--- |
| `just scan` | `ai_worker.py --once` | 1 vòng `order_risk_scan` |
| `just scan-suppliers` | `--job supplier_risk_scan` | quét GDELT + FMP, tính PORS |
| `just watch 300` | `--loop 300` | chạy liên tục mỗi 300 giây |
| `just scan-po PO-2026-011` | `--po ...` | chỉ quét 1 đơn (debug) |
| `just dry-run` | `--dry-run` | in SQL sẽ ghi, **không** chạm DB |
| `just inspect` | `db_inspect.py` | đếm dòng + 1 mẫu mỗi bảng |
| `just ports` / `just kill-ports` | — | xem / tắt tiến trình chiếm 3 cổng |

Chống chạy chồng bằng Postgres advisory lock — nhịp 5 phút không thể đẻ incident trùng.

## Kiến trúc 6 agents

```
                    ai_worker.py
                         │
              AGENT 6 Master Orchestrator (LangGraph)
   ingest → load_risk → score → detect → sourcing → chatbox → persist
        │                                    │         │         │
     AGENT 1                              AGENT 5   AGENT 4   (nơi DUY NHẤT ghi DB)
   DB Ingestion                           MILP+LLM  Email draft
                    ── nhịp ngày ──
              AGENT 2 (GDELT) ‖ AGENT 3 (FMP) → PORS
```

Mỗi agent tuân thủ 7 tiêu chí ở [plan/06_completion_plan.md](plan/06_completion_plan.md) §3.
Điểm quan trọng nhất: **MILP là sự thật, LLM chỉ là lời giải thích.** LLM chết hoặc trả
JSON sai schema thì đề xuất vẫn được ghi, chỉ thiếu phần diễn giải — số liệu không bao giờ
do LLM quyết định.

## Cấu trúc

```
ai/
├── ai_worker.py          # runner
├── dashboard.py          # Streamlit (chỉ đọc)
├── db_inspect.py         # kiểm tra DB
├── ai_schema.sql         # DDL 2 bảng AI + index (idempotent)
├── seed_ai_data.sql      # seed dữ liệu ERP + baseline
└── src/
    ├── core/             # config, logging, contracts, formulas, milp_solver
    ├── database/         # db_client (pool, upsert idempotent), queries
    ├── integrations/     # gdelt, fmp, open_meteo, openrouter_client, http
    └── agents/           # base + 6 agents
```

## Kiểm thử

```bash
just test               # 178 test, không cần mạng/DB
just test-integration   # chạm DB thật, ghi trong transaction rồi rollback
just lint               # pyright (AI) + tsc (FE)
```

Test bao gồm **golden test** khoá theo `seed_ai_data.sql`: điểm rủi ro 48, PORS SUP-01
58.03, MILP GM 60 / Tesla 51, sole-source Lucid 91. Lệch khỏi các số này nghĩa là công
thức đã sai.

## Ngưỡng

Đọc từ `.env`, mặc định trong `src/core/config.py`:

| Biến | Mặc định | Ghi chú |
| :--- | ---: | :--- |
| `INCIDENT_RISK_THRESHOLD` | 35 | ngưỡng 65 trong plan/01 cho **0 incident** trên dữ liệu thật |
| `PORS_HIGH_THRESHOLD` | 55 | PORS cao nhất quan sát được là ~59 |
| `PORS_MEDIUM_THRESHOLD` | 40 | |

## Quyền ghi DB

AI chỉ được ghi: `supplier_risk_analysis`, `ai_job_runs`, `incidents`,
`sourcing_proposals`, và **đúng 2 cột** `current_risk_score` + `risk_breakdown` trên
`purchase_orders`. Mọi upsert đều bỏ qua bản ghi đã có quyết định của con người
(`APPROVED`/`RESOLVED`/`REJECTED`/`CANCELLED`, `Đã duyệt`/`Từ chối`/`Sửa & Duyệt`) và
đếm chúng vào `skipped_locked`.
