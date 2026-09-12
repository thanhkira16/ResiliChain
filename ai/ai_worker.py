#!/usr/bin/env python
"""BikeSync AI Engine -- runner chinh.

    python ai_worker.py --once                          # 1 vong order_risk_scan
    python ai_worker.py --once --job supplier_risk_scan  # quet rui ro NCC
    python ai_worker.py --loop 300                      # chay lien tuc moi 300s
    python ai_worker.py --once --po PO-2026-011         # debug 1 don hang
    python ai_worker.py --once --dry-run                # khong ghi DB

Chong chay chong bang Postgres advisory lock -- nhip 5 phut khong the de incident trung.
"""

from __future__ import annotations

import argparse
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.core.config import settings  # noqa: E402
from src.core.contracts import JobName, JobStatus  # noqa: E402
from src.core.logging import (  # noqa: E402
    correlation_scope,
    get_logger,
    new_correlation_id,
    setup_logging,
)
from src.database import db_client as db  # noqa: E402

log = get_logger("worker")
_stop = False


def _handle_signal(signum, _frame) -> None:
    global _stop
    _stop = True
    log.info("worker.stop_requested", extra={"signal": signum})


def run_once(job: JobName, trigger_source: str, po_number: str | None = None) -> dict:
    """Chay dung mot vong quet. Luon ghi mot dong `ai_job_runs`."""
    correlation_id = new_correlation_id(job.value)
    lock_key = f"ai_worker:{job.value}"

    with correlation_scope(correlation_id):
        with db.advisory_lock(lock_key) as acquired:
            if not acquired:
                log.warning("worker.already_running", extra={"job": job.value})
                return {"status": "skipped", "reason": "another worker holds the lock"}

            started = datetime.now(timezone.utc)
            job_run_id = db.start_job_run(job.value, trigger_source)
            log.info(
                "worker.scan_start",
                extra={"job": job.value, "job_run_id": job_run_id,
                       "dry_run": settings.dry_run},
            )

            stats: dict[str, int] = {}
            errors: list[str] = []
            degraded = False
            status = JobStatus.SUCCESS

            try:
                if job is JobName.ORDER_RISK_SCAN:
                    from src.agents.master_orchestrator import run_order_risk_scan

                    final = run_order_risk_scan(correlation_id, po_number)
                    stats = final.get("stats", {})
                    errors = final.get("errors", [])
                    degraded = final.get("degraded", False)
                else:
                    from src.agents.master_orchestrator import scan_supplier_risk

                    final = scan_supplier_risk(correlation_id)
                    stats = final.get("stats", {})
                    errors = final.get("errors", [])
                    degraded = final.get("degraded", False)

                if errors:
                    status = JobStatus.PARTIAL
                elif degraded:
                    status = JobStatus.PARTIAL
            except Exception as exc:  # noqa: BLE001
                status = JobStatus.FAILED
                errors.append(f"{type(exc).__name__}: {exc}")
                log.error("worker.scan_failed", exc_info=True)

            finished = datetime.now(timezone.utc)
            duration_ms = int((finished - started).total_seconds() * 1000)
            message = (
                f"{job.value}: " + ", ".join(f"{k}={v}" for k, v in sorted(stats.items()))
            ) or job.value

            db.finish_job_run(
                job_run_id,
                status=status,
                started_at=started,
                finished_at=finished,
                message=message[:2000],
                error_detail="\n".join(errors)[:4000] if errors else None,
                **{k: v for k, v in stats.items()},
            )

            log.info(
                "worker.scan_done",
                extra={"job": job.value, "status": status.value,
                       "duration_ms": duration_ms, **stats},
            )
            return {
                "status": status.value,
                "job_run_id": job_run_id,
                "duration_ms": duration_ms,
                "stats": stats,
                "errors": errors,
            }


def main() -> int:
    parser = argparse.ArgumentParser(description="BikeSync AI Engine worker")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--once", action="store_true", help="chay mot vong roi thoat")
    mode.add_argument("--loop", type=int, metavar="SECONDS",
                      help="chay lien tuc, nghi SECONDS giua cac vong")
    parser.add_argument("--job", choices=[j.value for j in JobName],
                        default=JobName.ORDER_RISK_SCAN.value)
    parser.add_argument("--po", dest="po_number", help="chi quet mot po_number (debug)")
    parser.add_argument("--dry-run", action="store_true", help="khong ghi DB")
    parser.add_argument("--trigger", default=None, help="nhan trigger_source cho ai_job_runs")
    parser.add_argument("--log-level", default=settings.log_level)
    args = parser.parse_args()

    setup_logging(args.log_level)
    if args.dry_run:
        settings.dry_run = True

    job = JobName(args.job)
    trigger = args.trigger or ("manual" if args.once else "scheduler")

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        if args.once:
            result = run_once(job, trigger, args.po_number)
            return 0 if result.get("status") in ("success", "SUCCESS", "skipped") else 1

        while not _stop:
            run_once(job, trigger, args.po_number)
            for _ in range(args.loop):
                if _stop:
                    break
                time.sleep(1)
        return 0
    finally:
        db.close_pool()


if __name__ == "__main__":
    raise SystemExit(main())
