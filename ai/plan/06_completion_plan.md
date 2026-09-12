# 06. KẾ HOẠCH HOÀN THIỆN AI SERVICE THEO CHUẨN AGENT

> Viết ngày 2026-09-12, sau khi đối chiếu plan/01–05 + docs/01–06 với **code thật** trong repo.
> Mục tiêu: từ trạng thái "có tài liệu, chưa có code" → một AI service chạy được, có kiểm thử,
> tuân thủ đúng hợp đồng DB của Backend.

---

## 1. HIỆN TRẠNG THỰC TẾ (GAP ANALYSIS)

| Thành phần theo plan/02 | Thực tế trong repo | Trạng thái |
| :--- | :--- | :--- |
| `ai/src/agents/*` (6 agents) | thư mục `ai/src/` **rỗng hoàn toàn** | ❌ chưa có |
| `ai/src/core/{formulas,milp_solver,llm_reasoning}.py` | không tồn tại | ❌ chưa có |
| `ai/src/database/db_client.py` | không tồn tại | ❌ chưa có |
| `ai/src/integrations/*` | logic nằm rải trong `ai/apidata/*.py` dạng script CLI | ⚠️ cần refactor |
| `ai/ai_worker.py` | không tồn tại | ❌ chưa có |
| `ai/ai_schema.sql` | không tồn tại (chỉ có `seed_ai_data.sql`) | ❌ chưa có |
| `ai/seed_supabase.py`, `ai/db_inspect.py` | không tồn tại | ❌ chưa có |
| `ai/requirements.txt` | không tồn tại → chưa pin `pulp/psycopg2/pydantic` | ❌ chưa có |
| `ai/test_openrouter.py` | có, verified HTTP 200 | ✅ |
| GDELT / FMP / Open-Meteo | 3 script chạy được, đã có fixture thật trong `apidata/out/` | ✅ dữ liệu, ⚠️ kiến trúc |
| Bảng DB + TypeORM entity | **đã có đủ** 4 entity AI (`supplier-risk-analysis`, `ai-job-run`, `incident`, `sourcing-proposal`) + API `GET /supply-chain/supplier-risk`, `/ai-job-runs` | ✅ (plan/04 mục 1 đã lỗi thời) |

### Phát hiện chưa được ghi trong plan
1. **Đã tồn tại một "lớp AI" thứ hai bằng TypeScript** trong `frontend/server.ts` (526 dòng):
   `POST /api/ai/rfq`, `/api/ai/analyze-proposals`, `/api/ai/forecast-explanation` — gọi thẳng
   **Gemini (`@google/genai`, model `gemini-3.8-flash`)**, prompt inline, không validate schema đầu ra.
   Cộng với `/api/ai/weather` dùng **LangGraph TS** (`ai/weatherGraph.ts`).
   → Hệ thống hiện có **2 bộ não AI, 2 ngôn ngữ, 2 nhà cung cấp LLM** (Gemini ở TS, OpenRouter ở Python).
   Đây là rủi ro kiến trúc lớn nhất, phải chốt trước khi viết code Python.
2. Ngưỡng trong plan/01 (`Risk > 65`, `PORS >= 70`) **không khớp dữ liệu thật**: max risk = 48,
   max PORS = 58,03. plan/04 đã hiệu chỉnh về **35** và **55/40**. Worker phải đọc ngưỡng từ
   config/env, không hardcode.
3. `apidata/*.py` là script `main()` ghi file JSON — không có hàm thuần để agent gọi lại,
   có cache riêng, có `load_dotenv` tự chế trùng lặp ở 2 file.

---

## 2. QUYẾT ĐỊNH KIẾN TRÚC CẦN CHỐT TRƯỚC

### D1 — Một bộ não AI hay hai? **(bắt buộc chốt, chặn Phase 2+)**
- **Khuyến nghị:** Python là bộ não AI duy nhất. `ai/` vừa chạy **worker nền** (2 nhịp quét),
  vừa expose một **FastAPI mỏng** cho các agent gọi theo yêu cầu (RFQ, phân tích đề xuất,
  giải trình dự báo, chatbox). `frontend/server.ts` chuyển 3 route Gemini thành **proxy** sang
  FastAPI. `weatherGraph.ts` giữ nguyên (đang chạy tốt, không phụ thuộc LLM) hoặc port sau ở Phase 6.
  - Lợi: một nơi định nghĩa prompt/schema/guardrail, một nơi log token & chi phí, test được bằng pytest.
  - Hại: thêm 1 process phải deploy.
- **Phương án B:** giữ nguyên 2 lớp, Python chỉ làm worker (đúng docs/01). Rẻ hơn nhưng prompt
  và schema sẽ tiếp tục trôi dạt giữa 2 codebase.

### D2 — Nhà cung cấp LLM
Chốt **OpenRouter** làm cổng duy nhất (đã verified), model **pin cứng** qua `OPENROUTER_MODEL`.
Gemini nếu muốn giữ thì cấu hình như một model id của OpenRouter, không dùng SDK riêng.

### D3 — Điều phối agent
Dùng **LangGraph (Python)** cho graph của Master Orchestrator, thay vì gọi hàm tuần tự:
state có kiểu (Pydantic), có checkpoint, retry/fallback theo node, dễ vẽ lại đúng sơ đồ docs/06.
Nếu muốn giảm phụ thuộc, có thể thay bằng orchestrator thuần + `asyncio.gather` — nhưng vẫn
phải giữ nguyên contract `AgentState`.

### D4 — Ngưỡng & trọng số
Toàn bộ hằng số (`w1..w3`, ngưỡng 35/55/40, trọng số PORS) nằm trong `src/core/config.py`
đọc từ env, có giá trị mặc định khớp plan/03 + hiệu chỉnh plan/04. Cấm hardcode trong agent.

---

## 3. "CHUẨN AGENT" NGHĨA LÀ GÌ TRONG DỰ ÁN NÀY

Mỗi agent phải thoả 7 tiêu chí, dùng làm checklist review:

1. **Contract rõ ràng** — input/output là Pydantic model, không phải `dict` trần.
2. **Một trách nhiệm** — Agent 2 chỉ biết GDELT, không biết DB; Agent 6 điều phối, không gọi API ngoài.
3. **Tách quyết định khỏi I/O** — công thức ở `core/formulas.py` là pure function, test không cần mạng.
4. **Chịu lỗi** — mọi call ngoài có timeout, retry backoff, circuit-breaker; một agent chết
   không làm sập vòng quét (degrade: dùng giá trị cũ trong `supplier_risk_analysis` + đánh dấu `stale`).
5. **LLM có rào chắn** — structured output validate bằng Pydantic, sai schema thì retry 1 lần rồi
   fallback về kết quả MILP thuần (không có `pros/cons`), **không bao giờ ghi JSON chưa validate vào DB**.
6. **Idempotent & tôn trọng con người** — mọi ghi dùng `ON CONFLICT (id) DO UPDATE` kèm mệnh đề
   loại trừ bản ghi đã có quyết định (plan/04 §5).
7. **Quan sát được** — mỗi vòng quét ghi 1 dòng `ai_job_runs` (số đơn quét, incident tạo/cập nhật,
   proposal tạo, skipped_locked, duration_ms, error_detail), log JSON có `correlation_id`.

---

## 4. LỘ TRÌNH TRIỂN KHAI

### Phase 0 — Nền móng (0,5 ngày) · chặn tất cả
- `ai/requirements.txt` (pin: `pydantic`, `psycopg[binary]`, `pulp`, `httpx`, `tenacity`,
  `python-dotenv`, `langgraph`, `fastapi`+`uvicorn` nếu chọn D1-A, `pytest`, `respx`).
- `ai/src/core/config.py` — `Settings` (Pydantic BaseSettings) gom toàn bộ env + hằng số của D4.
- `ai/src/core/logging.py` — structured log JSON + `correlation_id` contextvar.
- Bỏ `load_dotenv` tự chế trong `apidata/*`, dùng chung `config.py`.
- **DoD:** `python -c "from src.core.config import settings; print(settings.model_dump(exclude={'db_password'}))"` chạy được.

### Phase 1 — Lớp dữ liệu (1 ngày)
- `src/database/db_client.py`: connection pool, context manager transaction, helper
  `upsert_incident`, `upsert_proposal`, `upsert_supplier_risk`, `start_job_run/finish_job_run`.
- `src/database/queries.py`: SQL đọc ERP (PO chưa hoàn thành theo 3 cụm HS code, inventory theo `sku`,
  suppliers, `shipment_tracking_points` mới nhất theo `shipment_id`).
- `src/database/models.py`: Pydantic model **sinh từ schema thật** (`po_number`, `sku`, `supplier_id`,
  `altman_z`, `analyzed_at`, `job_name` — đúng tên cột plan/04 §4).
- `ai/db_inspect.py`: in ra số dòng + 1 sample mỗi bảng, dùng để verify sau seed.
- **Rủi ro cần chặn:** FK `ON DELETE RESTRICT` → trước khi ghi phải assert `po_number`/`sku`/
  `supplier_id` tồn tại; `state`/`status` phải khớp **đúng chuỗi tiếng Việt có dấu** (bảng plan/04 §3),
  sai 1 ký tự là UI trắng → viết enum trong `models.py` và test so khớp với
  `frontend/src/types/index.ts`.
- **DoD:** `db_inspect.py` chạy trên Supabase thật, đọc đủ 6 bảng.

### Phase 2 — Động cơ toán học thuần (1 ngày, song song được với Phase 1)
- `src/core/formulas.py`: `lateness_factor`, `supplier_reliability_factor`, `inventory_buffer_factor`,
  `delay_risk_score` (trả kèm `RiskBreakdown` có `formulaExplanation`), `altman_z`, `z_to_ssi_fin`,
  `pors_score`, `risk_level`. Tất cả pure, không import DB/HTTP.
- `src/core/milp_solver.py`: mô hình PuLP chọn tối đa 3 NCC thay thế, xuất `rankings[]` **đúng schema
  `ProposalRanking`** kèm `scoreBreakdown` đầy đủ 9 trường.
- **Test bắt buộc:** dùng chính số liệu trong plan/04 (`risk_breakdown` mẫu = 48/100,
  ca `INC-PO-2026-011` / Lucid Motors score 91, PORS SUP-01 = 58,03) làm **golden test**.
  Nếu code lệch số này nghĩa là sai công thức hoặc sai seed.
- **DoD:** `pytest tests/test_formulas.py tests/test_milp.py` xanh, không cần mạng/DB.

### Phase 3 — Integrations (1 ngày)
Refactor `apidata/*.py` thành client có contract, **giữ nguyên thuật toán đã verify**:
- `src/integrations/gdelt.py` → `fetch_supplier_news(supplier) -> NewsRiskResult` (rate limit 26 rpm,
  3 request/supplier).
- `src/integrations/fmp.py` → `fetch_financials(ticker) -> FinancialResult` (5 biến thô Altman Z).
- `src/integrations/open_meteo.py` → `weather_delay_forecast(waypoints) -> WeatherDelay`.
- `src/integrations/openrouter_client.py` → `structured_completion(prompt, schema)` với retry + validate.
- Tất cả: `httpx` + `tenacity` + timeout 8s + cache TTL trên đĩa (tái dùng `apidata/out/*.json` làm
  fixture cho test offline qua `respx`).
- **DoD:** test offline replay fixture cho cả 3 API, không đốt quota.

### Phase 4 — 6 Agents (2–3 ngày)
Thứ tự làm: 1 → 2 → 3 → 5 → 6 → 4.
- `agents/base.py`: `Agent` protocol (`name`, `run(state) -> AgentResult`), retry/degrade chung.
- `agents/db_ingestion_agent.py` (A1) — output `OrderContext[]` đã join inventory + supplier + GPS.
- `agents/news_risk_agent.py` (A2) — `SSI_news`, `key_events`, `events_supply_chain_30d`.
- `agents/financial_health_agent.py` (A3) — `altman_z`, `SSI_fin`, zone.
- `agents/replacement_sourcing_agent.py` (A5) — MILP → OpenRouter → `rankings[]` validated → proposal.
- `agents/master_orchestrator.py` (A6) — LangGraph: `ingest → [news ‖ financial] → score → decide →
  sourcing → persist → job_run`. Chỉ node này được ghi DB.
- `agents/logistics_chatbox_agent.py` (A4) — sinh **draft** email/chat + phương án vận tải
  (Sea→Air, chia lô). **Không tự gửi email** ở v1; chỉ ghi draft để người duyệt.
- **DoD:** `ai_worker.py --once --dry-run` in ra diff sẽ ghi mà không chạm DB; `--once` ghi thật
  và `db_inspect.py` thấy `ai_job_runs` +1.

### Phase 5 — Runner & vận hành (0,5 ngày)
- `ai/ai_worker.py`: `--once`, `--loop 300`, `--job order_risk_scan|supplier_risk_scan`,
  `--dry-run`, `--po PO-2026-011` (chạy 1 đơn để debug).
- Lock chống chạy chồng (advisory lock Postgres `pg_try_advisory_lock`) — bắt buộc vì nhịp 5 phút.
- `ai/ai_schema.sql`: DDL 2 bảng AI + unique index `uq_incidents_open_po` + các index plan/04 §5
  (idempotent `IF NOT EXISTS`), để dựng lại môi trường mới từ số 0.
- `Dockerfile` + healthcheck; biến `AI_DRY_RUN` để chạy an toàn ở staging.
- **DoD:** `--loop 300` chạy 3 vòng liên tiếp không tạo incident trùng.

### Phase 6 — Hợp nhất lớp AI TypeScript (1 ngày, phụ thuộc D1)
Nếu chọn D1-A:
- `ai/serve.py` (FastAPI): `POST /agents/rfq`, `/agents/analyze-proposals`, `/agents/forecast-explanation`,
  `/agents/logistics-chat` — dùng lại đúng agent & prompt của worker.
- Sửa `frontend/server.ts`: 3 handler Gemini → `fetch` sang FastAPI, giữ nguyên response shape để
  frontend không phải đổi. Xoá `@google/genai` khỏi `package.json` sau khi cắt xong.
- `weatherGraph.ts` giữ nguyên (không dùng LLM) hoặc port sang `agents/weather_agent.py` nếu muốn
  dùng chung `weather_delay_forecast` với A6.
- **DoD:** 3 route cũ trả đúng shape cũ, có test hợp đồng (contract test) ở cả 2 phía.

### Phase 7 — Kiểm thử & tài liệu (0,5 ngày)
- `tests/`: unit (formulas, MILP), integration offline (respx fixtures), contract test DB
  (ghi vào transaction rồi rollback), golden test enum `state`/`status` vs frontend types.
- Cập nhật lại tài liệu cho khớp thực tế: plan/04 §1 (entity đã có), plan/01 (ngưỡng 35/55),
  plan/02 (thêm `serve.py`, `tests/`, `Dockerfile`).
- README `ai/README.md`: cách chạy 4 lệnh (install → schema → seed → worker).

---

## 5. THỨ TỰ ƯU TIÊN & ƯỚC LƯỢNG

| # | Phase | Ngày | Chặn bởi |
| :-- | :--- | :--- | :--- |
| 1 | P0 Nền móng | 0,5 | — |
| 2 | P1 Lớp dữ liệu ‖ P2 Toán học | 1 | P0 |
| 3 | P3 Integrations | 1 | P0 |
| 4 | P4 6 Agents | 2–3 | P1,P2,P3 |
| 5 | P5 Runner | 0,5 | P4 |
| 6 | P6 Hợp nhất TS | 1 | **D1** |
| 7 | P7 Test & docs | 0,5 | P5 |
| | **Tổng** | **~6,5–7,5 ngày** | |

Đường tới hiệu quả sớm nhất: **P0 → P1+P2 → P3 → P4 → P5** cho ra worker chạy thật (≈5 ngày).
P6 có thể làm sau, nhưng càng để lâu thì 2 lớp AI càng lệch nhau.

---

## 6. RỦI RO ĐÃ NHẬN DIỆN

| Rủi ro | Ảnh hưởng | Cách chặn |
| :--- | :--- | :--- |
| Hai bộ não AI (Python/Gemini-TS) trôi dạt | prompt & schema lệch, khó debug | chốt **D1** trước Phase 2 |
| Ngưỡng 65/70 trong plan/01 → 0 incident | hệ thống "chạy mà không ra gì" | ngưỡng vào config, mặc định 35 / 55-40 |
| LLM trả JSON sai schema | ghi bẩn DB, UI vỡ | validate Pydantic + fallback MILP thuần (tiêu chí §3.5) |
| FK `RESTRICT` + enum tiếng Việt có dấu | INSERT fail hoặc UI trắng | assert tồn tại + enum test so với frontend types |
| Worker 5 phút chạy chồng | incident trùng | advisory lock + `uq_incidents_open_po` |
| GDELT free tier 30 req/phút | quét 10 supplier là chạm trần | rate limit 26 rpm, nhịp ngày, cache TTL |
| Ghi đè quyết định của con người | mất phê duyệt | mệnh đề loại trừ `APPROVED/RESOLVED/...` ở mọi upsert |
| Secret đã từng nằm trong `ai/.env` (12/12 biến SET) | lộ key | xác nhận `.env` trong `.gitignore`; nếu từng commit → **revoke & xoay key** |

---

## 7. ĐIỀU KIỆN NGHIỆM THU TOÀN HỆ THỐNG

1. `pip install -r ai/requirements.txt && pytest` — xanh, không cần mạng.
2. `psql "$SUPABASE_DB" -f ai/ai_schema.sql && psql "$SUPABASE_DB" -f ai/seed_ai_data.sql` — idempotent.
3. `python ai/ai_worker.py --once` — tạo/cập nhật incident & proposal, `ai_job_runs` có dòng mới
   với `status='success'`, `duration_ms` hợp lý.
4. Chạy `--loop 300` 15 phút: không incident trùng, không ghi đè bản ghi đã `Đã duyệt`.
5. `GET /supply-chain/supplier-risk` và `/ai-job-runs` của Backend trả dữ liệu worker vừa ghi.
6. Tắt mạng GDELT/FMP giả lập: worker vẫn hoàn thành vòng quét, đánh dấu dữ liệu `stale`,
   `ai_job_runs.status='partial'` kèm `error_detail`.
