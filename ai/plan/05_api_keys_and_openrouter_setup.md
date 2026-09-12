# 05. API KEYS & OPENROUTER INTEGRATION

> **KHÔNG commit giá trị key vào repo.** File `ai/.env` đã được đưa vào `.gitignore`.
> Template rỗng nằm ở `ai/.env.example` — copy sang `.env` rồi điền giá trị thật.

## 1. BIẾN MÔI TRƯỜNG (`ai/.env`)

| Biến | Dùng cho | Nguồn cấp | Ghi chú |
| :--- | :--- | :--- | :--- |
| `GDELT_API_KEY` | Agent 2 (News Risk) | [gdeltcloud.com](https://gdeltcloud.com) | Bearer token. Free tier **30 req/phút** — mỗi supplier tốn 3 request (1 `/search` + 2 `/events`), nên 10 supplier chạm đúng trần. Client tự điều tiết ở `RATE_LIMIT_RPM = 26`. |
| `FMP_API_KEY` | Agent 3 (Financial Health) | [financialmodelingprep.com](https://financialmodelingprep.com) | Endpoint `/financial-scores` trả sẵn 5 biến thô của Altman Z. |
| `OPENROUTER_API_KEY` | Agent 5 (LLM Reasoning) | [openrouter.ai](https://openrouter.ai) | |
| `OPENAI_API_KEY` | SDK tương thích OpenAI | — | Đặt bằng `OPENROUTER_API_KEY` |
| `OPENAI_BASE_URL` | — | — | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | Agent 5 | — | **Phải pin model id cụ thể**, ví dụ `openai/gpt-4o`. Không để worker tự chọn. |
| `DB_*` / `SUPABASE_DB` | Toàn bộ worker | Supabase | Dùng chung connection với Backend. |

## 2. TÌNH TRẠNG KIỂM THỬ

| API | Trạng thái | Bằng chứng |
| :--- | :--- | :--- |
| OpenRouter | ✅ HTTP 200 | `ai/test_openrouter.py` — trả về JSON hợp lệ |
| GDELT Cloud v2 | ✅ có dữ liệu thật | `ai/apidata/out/gdelt_supplier_risk.json` (212 KB, 10 supplier) |
| FMP | ✅ có dữ liệu thật | Altman Z + `SSI_fin` trong `ai/apidata/out/supplier_risk_fixture.json` |
| Open-Meteo | ⬜ chưa test trong pipeline | Không cần key |

**Lưu ý:** HTTP 200 chỉ chứng minh key sống. Nó **không** chứng minh structured output
đúng schema. Agent 5 phải validate response bằng Pydantic trước khi ghi DB —
xem `rankings[]` schema ở [04_db_schema_and_id_contracts.md](04_db_schema_and_id_contracts.md).

## 3. XỬ LÝ SỰ CỐ KEY

Nếu key từng bị lộ (commit nhầm, chia sẻ qua chat), **revoke và tạo key mới** —
xoá khỏi file không đủ, vì lịch sử git vẫn giữ giá trị cũ.
