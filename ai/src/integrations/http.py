"""Ha tang HTTP dung chung cho moi integration cua AI Engine.

Gop 4 thu ma 3 script trong `apidata/` moi cai tu lam mot kieu:

* **timeout + retry** -- `tenacity` lui theo ham mu, CHI thu lai voi loi tam thoi
  (timeout, loi mang, 5xx, 429). Loi 4xx khac la loi cua ta -> that bai ngay.
* **cache dia** -- khoa theo (base_url, endpoint, params), TTL `settings.cache_ttl_seconds`.
  Bat buoc voi FMP vi han ngach tinh theo NGAY.
* **RateLimiter** -- token bucket, port nguyen tu `apidata/gdelt_supplier_risk.py`.
* **CircuitBreaker** -- ngung dap vao mot endpoint da chet thay vi cho het timeout
  cho tung supplier mot (10 supplier x 8s x 3 lan thu = 4 phut treo worker).
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

import httpx
from tenacity import (
    RetryCallState,
    Retrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.core.config import settings
from src.core.logging import get_logger

logger = get_logger(__name__)

__all__ = [
    "CircuitBreaker",
    "CircuitOpenError",
    "DiskCache",
    "HttpClient",
    "HttpError",
    "RateLimiter",
    "RetryableHttpError",
]


# ---------------------------------------------------------------------------
# Loi
# ---------------------------------------------------------------------------


class HttpError(RuntimeError):
    """Loi HTTP khong the phuc hoi bang cach thu lai (4xx tru 429)."""

    def __init__(self, message: str, *, status_code: int | None = None, body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class RetryableHttpError(HttpError):
    """5xx / 429 -- dang thu lai."""

    def __init__(self, message: str, *, status_code: int | None = None, body: str = "",
                 retry_after: float | None = None):
        super().__init__(message, status_code=status_code, body=body)
        self.retry_after = retry_after


class CircuitOpenError(HttpError):
    """Cau dao dang mo -- endpoint duoc coi la chet, khong goi nua."""


# ---------------------------------------------------------------------------
# Rate limiter (port nguyen ban tu apidata/*.py)
# ---------------------------------------------------------------------------


class RateLimiter:
    """Token bucket don gian, chan khong cho vuot `rpm` request moi 60 giay."""

    def __init__(self, rpm: int):
        self.interval = 60.0 / float(rpm) if rpm > 0 else 0.0
        self._lock = threading.Lock()
        self._next_slot = 0.0

    def acquire(self) -> None:
        if self.interval <= 0:
            return
        with self._lock:
            now = time.monotonic()
            wait = max(0.0, self._next_slot - now)
            self._next_slot = max(now, self._next_slot) + self.interval
        if wait > 0:
            time.sleep(wait)


# ---------------------------------------------------------------------------
# Circuit breaker
# ---------------------------------------------------------------------------


@dataclass
class CircuitBreaker:
    """Dem loi lien tiep; qua `failure_threshold` thi mo cau trong `reset_seconds`."""

    failure_threshold: int = 4
    reset_seconds: float = 60.0
    name: str = "default"

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._failures = 0
        self._opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        with self._lock:
            if self._opened_at is None:
                return False
            if time.monotonic() - self._opened_at >= self.reset_seconds:
                # half-open: cho mot request thu di qua
                self._opened_at = None
                self._failures = self.failure_threshold - 1
                return False
            return True

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = None

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self.failure_threshold and self._opened_at is None:
                self._opened_at = time.monotonic()
                logger.warning(
                    "circuit_breaker_open",
                    extra={"breaker": self.name, "failures": self._failures,
                           "reset_seconds": self.reset_seconds},
                )

    def raise_if_open(self) -> None:
        if self.is_open:
            raise CircuitOpenError(f"circuit open cho '{self.name}'")


# ---------------------------------------------------------------------------
# Cache dia
# ---------------------------------------------------------------------------


class DiskCache:
    """Cache JSON xuong dia, khoa = sha256(namespace|endpoint|params da sap xep)."""

    def __init__(self, namespace: str, ttl_seconds: int | None = None,
                 directory: Path | None = None):
        self.namespace = namespace
        self.ttl_seconds = settings.cache_ttl_seconds if ttl_seconds is None else ttl_seconds
        self.directory = Path(directory) if directory else Path(settings.cache_dir) / namespace
        self.directory.mkdir(parents=True, exist_ok=True)

    def path_for(self, endpoint: str, params: Mapping[str, Any] | None = None) -> Path:
        payload = json.dumps(
            {"ns": self.namespace, "endpoint": endpoint,
             "params": sorted((str(k), str(v)) for k, v in (params or {}).items())},
            sort_keys=True,
        )
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]
        safe = endpoint.strip("/").replace("/", "_") or "root"
        return self.directory / f"{safe}_{digest}.json"

    def get(self, endpoint: str, params: Mapping[str, Any] | None = None) -> Any | None:
        if self.ttl_seconds <= 0:
            return None
        path = self.path_for(endpoint, params)
        if not path.exists():
            return None
        if time.time() - path.stat().st_mtime >= self.ttl_seconds:
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:  # cache hong -> coi nhu miss
            return None

    def set(self, endpoint: str, params: Mapping[str, Any] | None, data: Any) -> None:
        if self.ttl_seconds <= 0:
            return
        path = self.path_for(endpoint, params)
        tmp = path.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            tmp.replace(path)
        except Exception as exc:  # pragma: no cover - loi dia khong duoc lam hong request
            logger.warning("cache_write_failed", extra={"path": str(path), "error": str(exc)})

    def clear(self) -> None:
        for file in self.directory.glob("*.json"):
            file.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

_RETRYABLE_TRANSPORT = (httpx.TimeoutException, httpx.TransportError)


class HttpClient:
    """`httpx.Client` co timeout, retry, cache, rate limit va circuit breaker."""

    def __init__(
        self,
        base_url: str,
        *,
        namespace: str,
        headers: Mapping[str, str] | None = None,
        rate_limit_rpm: int | None = None,
        cache_ttl_seconds: int | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
        failure_threshold: int = 4,
        circuit_reset_seconds: float = 60.0,
        retry_on_rate_limit: bool = True,
    ):
        self.base_url = base_url.rstrip("/")
        self.namespace = namespace
        self.timeout = settings.http_timeout_seconds if timeout is None else timeout
        self.max_retries = settings.http_max_retries if max_retries is None else max_retries
        # 429 cua GDELT la "cham tran 30 req/phut" -> cho roi thu lai la dung.
        # 429 cua FMP la "het han ngach NGAY" -> thu lai chi to lam cham worker.
        self.retry_on_rate_limit = retry_on_rate_limit
        self.limiter = RateLimiter(rate_limit_rpm) if rate_limit_rpm else None
        self.cache = DiskCache(namespace, ttl_seconds=cache_ttl_seconds)
        self.breaker = CircuitBreaker(
            failure_threshold=failure_threshold,
            reset_seconds=circuit_reset_seconds,
            name=namespace,
        )
        self._headers = {"User-Agent": "BikeSync-AI-Engine/1.0", **(headers or {})}
        self._client = httpx.Client(timeout=self.timeout, headers=self._headers,
                                    follow_redirects=True)

    # -- vong doi --------------------------------------------------------
    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # -- noi bo ----------------------------------------------------------
    def _url(self, endpoint: str) -> str:
        if endpoint.startswith("http://") or endpoint.startswith("https://"):
            return endpoint
        return f"{self.base_url}/{endpoint.lstrip('/')}"

    def _raise_for_status(self, resp: httpx.Response) -> None:
        if resp.status_code < 400:
            return
        body = resp.text[:400]
        if resp.status_code == 429:
            retry_after: float | None = None
            raw = resp.headers.get("Retry-After")
            if raw:
                try:
                    retry_after = float(raw)
                except ValueError:
                    retry_after = None
            if retry_after is None:
                try:
                    details = (resp.json().get("details") or {})
                    raw_retry = details.get("retry_after")
                    retry_after = float(raw_retry) if raw_retry is not None else None
                except Exception:
                    retry_after = None
            if self.retry_on_rate_limit:
                raise RetryableHttpError(
                    f"HTTP 429 rate limited: {body}", status_code=429, body=body,
                    retry_after=retry_after,
                )
            raise HttpError(f"HTTP 429 rate limited: {body}", status_code=429, body=body)
        if resp.status_code >= 500:
            raise RetryableHttpError(f"HTTP {resp.status_code}: {body}",
                                     status_code=resp.status_code, body=body)
        raise HttpError(f"HTTP {resp.status_code}: {body}",
                        status_code=resp.status_code, body=body)

    def _send(self, method: str, endpoint: str, *, params: Mapping[str, Any] | None,
              json_body: Any | None, headers: Mapping[str, str] | None) -> Any:
        if self.limiter:
            self.limiter.acquire()
        resp = self._client.request(
            method, self._url(endpoint), params=dict(params) if params else None,
            json=json_body, headers=dict(headers) if headers else None,
        )
        self._raise_for_status(resp)
        return resp.json()

    def _before_sleep(self, state: RetryCallState) -> None:
        exc = state.outcome.exception() if state.outcome else None
        logger.warning(
            "http_retry",
            extra={"namespace": self.namespace, "attempt": state.attempt_number,
                   "error": str(exc)[:200]},
        )

    def request(
        self,
        method: str,
        endpoint: str,
        *,
        params: Mapping[str, Any] | None = None,
        json_body: Any | None = None,
        headers: Mapping[str, str] | None = None,
        use_cache: bool = True,
        cache_params: Mapping[str, Any] | None = None,
    ) -> Any:
        """Goi mot endpoint, tra ve JSON da parse. Nem `HttpError` khi that bai."""
        cacheable = use_cache and method.upper() == "GET"
        key_params = cache_params if cache_params is not None else params
        if cacheable:
            cached = self.cache.get(endpoint, key_params)
            if cached is not None:
                logger.debug("cache_hit", extra={"namespace": self.namespace,
                                                 "endpoint": endpoint})
                return cached

        self.breaker.raise_if_open()
        started = time.monotonic()
        try:
            for attempt in Retrying(
                retry=retry_if_exception_type((RetryableHttpError, *_RETRYABLE_TRANSPORT)),
                stop=stop_after_attempt(max(1, self.max_retries)),
                wait=wait_exponential(multiplier=0.5, min=0.5, max=8.0),
                before_sleep=self._before_sleep,
                reraise=True,
            ):
                with attempt:
                    data = self._send(method, endpoint, params=params,
                                      json_body=json_body, headers=headers)
        except Exception:
            self.breaker.record_failure()
            raise
        self.breaker.record_success()
        logger.debug(
            "http_ok",
            extra={"namespace": self.namespace, "endpoint": endpoint,
                   "latency_ms": round((time.monotonic() - started) * 1000, 1)},
        )
        if cacheable:
            self.cache.set(endpoint, key_params, data)
        return data

    def get_json(self, endpoint: str, params: Mapping[str, Any] | None = None,
                 **kwargs: Any) -> Any:
        return self.request("GET", endpoint, params=params, **kwargs)

    def post_json(self, endpoint: str, json_body: Any, **kwargs: Any) -> Any:
        return self.request("POST", endpoint, json_body=json_body, use_cache=False, **kwargs)
