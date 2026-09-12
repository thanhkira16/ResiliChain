# ResiliChain — nền tảng tự chủ chuỗi cung ứng xe điện
#
#   just            liệt kê toàn bộ lệnh
#   just setup      cài dependencies cho cả 3 phần
#   just dev        chạy đồng thời BE + FE + AI dashboard
#
# Cổng:  BE 3001 (api/v1)  ·  FE 3000  ·  AI dashboard 8501
# FE gọi BE qua VITE_API_BASE_URL, mặc định http://localhost:3001/api/v1

set shell := ["bash", "-uc"]

be_dir  := justfile_directory() / "backend/nestjs-boilerplate"
fe_dir  := justfile_directory() / "frontend"
ai_dir  := justfile_directory() / "ai"
py      := ai_dir / ".venv/bin/python"
venv    := ai_dir / ".venv"

BE_PORT := "3001"
FE_PORT := "3000"
AI_PORT := "8501"

# Liệt kê các lệnh có sẵn
default:
    @just --list --unsorted

# ---------------------------------------------------------------- setup ----

# Cài dependencies cho cả 3 phần
setup: setup-be setup-fe setup-ai
    @echo "✅ Đã cài xong. Chạy 'just dev' để khởi động."

setup-be:
    cd {{be_dir}} && npm install

setup-fe:
    cd {{fe_dir}} && npm install

# Tạo venv + cài requirements cho AI service
setup-ai:
    cd {{ai_dir}} && test -d .venv || python3 -m venv .venv
    {{venv}}/bin/pip install -q --upgrade pip
    {{venv}}/bin/pip install -q -r {{ai_dir}}/requirements.txt

# ------------------------------------------------------------------ dev ----

# Chạy đồng thời BE + FE + AI dashboard (Ctrl-C để tắt tất cả)
dev:
    #!/usr/bin/env bash
    set -uo pipefail
    trap 'echo; echo "→ đang tắt..."; kill 0 2>/dev/null' EXIT INT TERM
    echo "BE  http://localhost:{{BE_PORT}}/api/v1"
    echo "FE  http://localhost:{{FE_PORT}}"
    echo "AI  http://localhost:{{AI_PORT}}"
    echo
    ( cd {{be_dir}} && PORT={{BE_PORT}} npm run start:dev   2>&1 | sed 's/^/[BE] /' ) &
    ( cd {{fe_dir}} && PORT={{FE_PORT}} npm run dev         2>&1 | sed 's/^/[FE] /' ) &
    ( cd {{ai_dir}} && {{venv}}/bin/streamlit run dashboard.py \
        --server.port {{AI_PORT}} --server.headless true \
        --browser.gatherUsageStats false                 2>&1 | sed 's/^/[AI] /' ) &
    wait

# Chỉ chạy backend (NestJS, watch mode)
be:
    cd {{be_dir}} && PORT={{BE_PORT}} npm run start:dev

# Chỉ chạy frontend (Vite + Express)
fe:
    cd {{fe_dir}} && PORT={{FE_PORT}} npm run dev

# Chỉ chạy AI dashboard (Streamlit)
ai:
    cd {{ai_dir}} && {{venv}}/bin/streamlit run dashboard.py --server.port {{AI_PORT}}

# ------------------------------------------------------------- ai worker ----

# Một vòng quét rủi ro đơn hàng
scan:
    cd {{ai_dir}} && {{py}} ai_worker.py --once

# Quét rủi ro nhà cung ứng (GDELT + FMP), nhịp 1 lần/ngày
scan-suppliers:
    cd {{ai_dir}} && {{py}} ai_worker.py --once --job supplier_risk_scan

# Chạy worker liên tục, mặc định 300 giây mỗi vòng
watch interval="300":
    cd {{ai_dir}} && {{py}} ai_worker.py --loop {{interval}}

# In ra SQL worker sẽ ghi mà KHÔNG chạm database
dry-run:
    cd {{ai_dir}} && {{py}} ai_worker.py --once --dry-run

# Quét đúng một đơn hàng để debug, ví dụ: just scan-po PO-2026-011
scan-po po:
    cd {{ai_dir}} && {{py}} ai_worker.py --once --po {{po}}

# -------------------------------------------------------------- database ----

# Đếm dòng + xem mẫu mỗi bảng
inspect:
    cd {{ai_dir}} && {{py}} db_inspect.py

# Tạo bảng AI + index (idempotent, an toàn chạy lại)
schema:
    cd {{ai_dir}} && psql "$({{py}} -c 'import sys;sys.path.insert(0,".");from src.core.config import settings;print(settings.dsn)')" -v ON_ERROR_STOP=1 -f ai_schema.sql

# Nạp dữ liệu nền (GHI ĐÈ incidents/proposals hiện có)
seed:
    cd {{ai_dir}} && psql "$({{py}} -c 'import sys;sys.path.insert(0,".");from src.core.config import settings;print(settings.dsn)')" -v ON_ERROR_STOP=1 -f seed_ai_data.sql

# Dựng lại toàn bộ dữ liệu demo: schema → seed → 2 nhịp quét AI
reset-demo: schema seed scan scan-suppliers
    @just inspect

# ----------------------------------------------------------------- test ----

# Toàn bộ test của AI service (không cần mạng/DB)
test:
    cd {{ai_dir}} && {{py}} -m pytest -q

# Test có chạm DB thật, ghi trong transaction rồi rollback
test-integration:
    cd {{ai_dir}} && AI_INTEGRATION_TESTS=1 {{py}} -m pytest -q -m integration

# Kiểm tra kiểu: pyright cho AI, tsc cho FE
lint:
    cd {{ai_dir}} && {{venv}}/bin/pyright
    cd {{fe_dir}} && npm run lint

# --------------------------------------------------------------- tiện ích ----

# Xem tiến trình đang chiếm 3 cổng của dự án
ports:
    #!/usr/bin/env bash
    for p in {{BE_PORT}} {{FE_PORT}} {{AI_PORT}}; do
      pid=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null | head -1) || true
      if [ -n "$pid" ]; then
        printf "  %-5s  pid %-7s  %s\n" "$p" "$pid" "$(ps -p $pid -o comm= 2>/dev/null)"
      else
        printf "  %-5s  trống\n" "$p"
      fi
    done

# Tắt mọi tiến trình đang chiếm 3 cổng của dự án
kill-ports:
    #!/usr/bin/env bash
    for p in {{BE_PORT}} {{FE_PORT}} {{AI_PORT}}; do
      pids=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null | tr '\n' ' ') || true
      if [ -n "${pids// /}" ]; then kill $pids 2>/dev/null && echo "đã tắt cổng $p (pid ${pids% })"; else echo "cổng $p trống"; fi
    done
