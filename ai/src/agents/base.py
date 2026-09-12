"""Khung Agent chuan cho BikeSync AI Engine.

Moi agent phai thoa 7 tieu chi o plan/06 §3. Module nay hien thuc hoa 3 tieu chi
co the ep buoc bang code: contract ro rang (AgentResult), chiu loi (degrade thay
vi crash) va quan sat duoc (log co correlation_id + duration).
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

from src.core.logging import current_correlation_id, get_logger

TIn = TypeVar("TIn")
TOut = TypeVar("TOut")


class AgentError(Exception):
    """Loi nghiep vu cua agent -- da duoc phan loai, khong phai bug."""


class AgentResult(BaseModel, Generic[TOut]):
    """Ket qua mot lan chay agent. `degraded=True` nghia la co du lieu nhung khong
    day du (vi du API ngoai chet, dung gia tri cache/DB cu)."""

    model_config = {"arbitrary_types_allowed": True}

    agent: str
    ok: bool
    degraded: bool = False
    data: TOut | None = None
    error: str | None = None
    duration_ms: int = 0
    correlation_id: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class Agent(ABC, Generic[TIn, TOut]):
    """Lop co so. Sub-class chi can hien thuc `execute`; `run` lo phan do dac,
    log va bat loi de mot agent chet khong lam sap ca vong quet."""

    name: str = "agent"
    #: Agent thiet yeu -- neu chet thi vong quet phai dung. Mac dinh False (degrade).
    critical: bool = False

    def __init__(self) -> None:
        self.log = get_logger(f"agent.{self.name}")

    @abstractmethod
    def execute(self, payload: TIn) -> TOut:
        """Logic that cua agent. Duoc phep raise -- `run` se bat."""

    def fallback(self, payload: TIn, error: Exception) -> TOut | None:
        """Gia tri degrade khi `execute` that bai. Mac dinh: khong co."""
        return None

    def run(self, payload: TIn) -> AgentResult[TOut]:
        started = time.perf_counter()
        cid = current_correlation_id()
        self.log.info("agent.start", extra={"agent": self.name})
        try:
            data = self.execute(payload)
        except Exception as exc:  # noqa: BLE001 -- bien moi loi thanh ket qua co kieu
            elapsed = int((time.perf_counter() - started) * 1000)
            if self.critical:
                self.log.error(
                    "agent.failed", extra={"agent": self.name, "duration_ms": elapsed},
                    exc_info=True,
                )
                raise
            fallback = self.fallback(payload, exc)
            self.log.warning(
                "agent.degraded",
                extra={
                    "agent": self.name,
                    "duration_ms": elapsed,
                    "error": str(exc),
                    "has_fallback": fallback is not None,
                },
            )
            return AgentResult[TOut](
                agent=self.name,
                ok=fallback is not None,
                degraded=True,
                data=fallback,
                error=f"{type(exc).__name__}: {exc}",
                duration_ms=elapsed,
                correlation_id=cid,
            )

        elapsed = int((time.perf_counter() - started) * 1000)
        self.log.info("agent.done", extra={"agent": self.name, "duration_ms": elapsed})
        return AgentResult[TOut](
            agent=self.name,
            ok=True,
            data=data,
            duration_ms=elapsed,
            correlation_id=cid,
        )
