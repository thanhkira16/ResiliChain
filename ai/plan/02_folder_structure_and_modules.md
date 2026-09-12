# 02. CẤU TRÚC THƯ MỤC & PHÂN CHIA MÔ-ĐỦN (`ai/src/`)

## CẤU TRÚC CÂY THƯ MỤC MÃ NGUỒN

```text
ai/
├── ai_schema.sql                           # DDL 4 bảng AI sở hữu & 2 cột purchase_orders (100% ID Foreign Keys)
├── seed_supabase.py                        # Seed dữ liệu ERP + baseline rủi ro
├── db_inspect.py                           # Tool kiểm tra dữ liệu Supabase DB
├── test_openrouter.py                      # Script test kết nối OpenRouter API Key (Verified HTTP 200)
├── ai_worker.py                            # Runner chính (loop 5-10 phút & daily scan)
├── .env / .env.example                     # GDELT, FMP, Supabase DB & OpenRouter API Keys
├── requirements.txt                        # Dependencies (pulp, pydantic, psycopg2, python-dotenv)
├── plan/                                   # THƯ MỤC LƯU TRỮ KẾ HOẠCH & ĐẮC TẢ KIẾN TRÚC
│   ├── 01_master_implementation_plan.md
│   ├── 02_folder_structure_and_modules.md
│   ├── 03_mathematical_formulas_clean.md
│   ├── 04_db_schema_and_id_contracts.md
│   └── 05_api_keys_and_openrouter_setup.md
└── src/
    ├── __init__.py
    │
    ├── agents/                             # 1. BỘ 6 CHUYÊN VIÊN AI AGENTS CHUYÊN BIỆT
    │   ├── __init__.py
    │   ├── master_orchestrator.py          # AGENT 6: Master Orchestrator (Điều phối, tính PORS, ghi DB)
    │   ├── db_ingestion_agent.py           # AGENT 1: Enterprise DB Ingestion Agent (Đọc 3 cụm HS Code & GPS)
    │   ├── news_risk_agent.py              # AGENT 2: News & Geopolitical Risk Agent (GDELT API v2 -> SSI_news)
    │   ├── financial_health_agent.py       # AGENT 3: Financial Health Agent (FMP API -> Altman Z & SSI_fin)
    │   ├── logistics_chatbox_agent.py      # AGENT 4: Supplier Email Inquiry & B2B Logistics Chatbox Agent
    │   └── replacement_sourcing_agent.py   # AGENT 5: Supplier Replacement Sourcing Agent (PuLP MILP + OpenRouter)
    │
    ├── core/                               # 2. ĐỘNG CƠ TOÁN HỌC & CÔNG THỨC SCORING (PURE FUNCTIONS)
    │   ├── __init__.py
    │   ├── formulas.py                     # RiskBreakdown, latenessFactor, PORS, Altman Z, Weather penalties
    │   ├── milp_solver.py                  # PuLP Solver mô hình MILP đa tiêu chí (Cost, LeadTime, Reliability)
    │   └── llm_reasoning.py                # OpenRouter API Structured Output (Pros, Cons, Reasoning)
    │
    ├── database/                           # 3. KẾT NỐI & TƯƠNG TÁC POSTGRESQL/SUPABASE
    │   ├── __init__.py
    │   └── db_client.py                    # Connection pool, đọc ERP queries, ghi kết quả AI theo IDs
    │
    └── integrations/                       # 4. TÍCH HỢP CÁC APIS NGOÀI
        ├── __init__.py
        ├── open_meteo.py                   # Open-Meteo Geocoding & Weather Forecast API
        ├── gdelt.py                        # GDELT Cloud API v2 Integration
        ├── fmp.py                          # Financial Modeling Prep API Integration
        └── openrouter_client.py            # OpenRouter API Client Integration
```
