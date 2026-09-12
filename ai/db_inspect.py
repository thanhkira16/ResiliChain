#!/usr/bin/env python3
"""In so dong + 1 dong mau cho tung bang ma AI Engine dung.

Dung de verify sau khi chay `seed_ai_data.sql` hoac sau khi worker ghi.
CHI DOC -- khong ghi gi vao DB.

    cd /Users/anhnon/4conbo/ai && .venv/bin/python db_inspect.py
    .venv/bin/python db_inspect.py --json
"""

from __future__ import annotations

from typing import LiteralString, cast

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.core.config import settings  # noqa: E402
from src.core.logging import setup_logging  # noqa: E402
from src.database import queries as q  # noqa: E402
from src.database.db_client import close_pool, connection  # noqa: E402

MAX_VALUE_CHARS = 90


def _fmt(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    text = " ".join(text.split())
    if len(text) > MAX_VALUE_CHARS:
        text = text[: MAX_VALUE_CHARS - 1] + "…"
    return text


def collect() -> dict[str, dict[str, Any]]:
    report: dict[str, dict[str, Any]] = {}
    with connection() as conn:
        for table in q.INSPECT_TABLES:
            entry: dict[str, Any] = {}
            with conn.cursor() as cur:
                try:
                    cur.execute(cast(LiteralString, q.count_sql(table)))
                    row = cur.fetchone()
                    entry["count"] = int(row["n"]) if row else 0
                except Exception as exc:  # bang chua ton tai / khong co quyen
                    entry["count"] = None
                    entry["error"] = str(exc).strip()
                    conn.rollback()
                    report[table] = entry
                    continue
            if entry["count"]:
                with conn.cursor() as cur:
                    cur.execute(cast(LiteralString, q.sample_sql(table)))
                    sample = cur.fetchone()
                entry["sample"] = dict(sample) if sample else None
            else:
                entry["sample"] = None
            report[table] = entry

    # Phan bo `purchase_orders.status` -- quan trong voi bo loc "don chua hoan thanh".
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT status, COUNT(*) AS n FROM purchase_orders GROUP BY status ORDER BY n DESC"
        )
        report["_po_status_breakdown"] = {
            r["status"]: int(r["n"]) for r in cur.fetchall()
        }
    return report


def render(report: dict[str, dict[str, Any]]) -> str:
    lines: list[str] = []
    host = settings.dsn.split("@")[-1].split("?")[0]
    lines.append(f"ResiliChain — DB inspect  ({host})")
    lines.append("=" * 78)
    lines.append(f"{'TABLE':<28}{'ROWS':>8}")
    lines.append("-" * 78)
    for table in q.INSPECT_TABLES:
        entry = report[table]
        count = entry["count"]
        lines.append(f"{table:<28}{'ERR' if count is None else count:>8}")
    lines.append("-" * 78)

    status_breakdown = report.get("_po_status_breakdown", {})
    if status_breakdown:
        lines.append("purchase_orders.status: " + ", ".join(
            f"{k}={v}" for k, v in status_breakdown.items()
        ))
        lines.append("-" * 78)

    for table in q.INSPECT_TABLES:
        entry = report[table]
        lines.append("")
        lines.append(f"## {table}  (rows={entry['count']})")
        if entry.get("error"):
            lines.append(f"   !! {entry['error']}")
            continue
        sample = entry.get("sample")
        if not sample:
            lines.append("   (bang rong — khong co dong mau)")
            continue
        width = max(len(k) for k in sample)
        for key, value in sample.items():
            lines.append(f"   {key:<{width}} : {_fmt(value)}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="in JSON thay vi bang")
    args = parser.parse_args()
    setup_logging(settings.log_level)
    try:
        report = collect()
    except Exception as exc:
        print(f"KHONG KET NOI DUOC DB: {exc}", file=sys.stderr)
        return 2
    finally:
        pass
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
    else:
        print(render(report))
    close_pool()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
