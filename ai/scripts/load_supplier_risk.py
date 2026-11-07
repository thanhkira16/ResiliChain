"""Load supplier risk scores (GDELT news + Altman Z) from a JSON snapshot into
supplier_risk_analysis.

Used by the demo seed when GDELT Cloud / FMP API keys are not configured.
The JSON uses the schema of apidata/out/supplier_risk_fixture.json.

ssi_del, pors_score and risk_level are left NULL here: ai/seed_ai_data.sql
computes them from ERP delivery history.

Usage:
    .venv/bin/python scripts/load_supplier_risk.py [path/to/snapshot.json]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir))

import psycopg  # noqa: E402
from psycopg.types.json import Jsonb  # noqa: E402

from src.core.config import settings  # noqa: E402

DEFAULT_SNAPSHOT = root_dir / "apidata" / "out" / "supplier_risk_fixture.json"

UPSERT_SQL = """
INSERT INTO supplier_risk_analysis (
    supplier_id, ticker, ssi_news, ssi_fin, g_geo, altman_z, status_label,
    events_supply_chain_30d, key_events, analyzed_at)
VALUES (%(supplier_id)s, %(ticker)s, %(ssi_news)s, %(ssi_fin)s, %(g_geo)s,
        %(altman_z)s, %(status_label)s, %(events)s, %(key_events)s,
        COALESCE(%(analyzed_at)s::timestamptz AT TIME ZONE 'UTC', CURRENT_TIMESTAMP))
ON CONFLICT (supplier_id) DO UPDATE SET
    ticker = EXCLUDED.ticker,
    ssi_news = EXCLUDED.ssi_news,
    ssi_fin = EXCLUDED.ssi_fin,
    g_geo = EXCLUDED.g_geo,
    altman_z = EXCLUDED.altman_z,
    status_label = EXCLUDED.status_label,
    events_supply_chain_30d = EXCLUDED.events_supply_chain_30d,
    key_events = EXCLUDED.key_events,
    analyzed_at = EXCLUDED.analyzed_at
"""


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SNAPSHOT
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    rendered_at = snapshot.get("metadata", {}).get("rendered_at_utc")

    with psycopg.connect(settings.dsn) as conn, conn.cursor() as cur:
        cur.execute("SELECT name, id FROM suppliers")
        name_to_id = dict(cur.fetchall())

        loaded = 0
        for item in snapshot["suppliers"]:
            supplier_id = name_to_id.get(item["name"]) or name_to_id.get(
                {"Nvidia": "NVIDIA"}.get(item["name"], "")
            )
            if not supplier_id:
                print(f"skip {item['ticker']}: no supplier named {item['name']!r}")
                continue
            scores = item["scores"]
            cur.execute(
                UPSERT_SQL,
                {
                    "supplier_id": supplier_id,
                    "ticker": item["ticker"],
                    "ssi_news": scores.get("ssi_news"),
                    "ssi_fin": scores.get("ssi_fin"),
                    "g_geo": scores.get("geo_political"),
                    "altman_z": scores.get("altman_z"),
                    "status_label": item.get("status"),
                    "events": item.get("events_30d", {}).get("supply_chain_related", 0),
                    "key_events": Jsonb(item.get("key_events", [])),
                    "analyzed_at": rendered_at,
                },
            )
            loaded += 1
        conn.commit()

    print(f"loaded {loaded} suppliers from {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
