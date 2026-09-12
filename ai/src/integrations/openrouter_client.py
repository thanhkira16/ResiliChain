"""OpenRouter -- structured output CO VALIDATE cho Agent 5 / Agent 4.

Nguyen tac bat di bat dich (plan/06 §3.5): **KHONG BAO GIO tra JSON chua validate**.
LLM la nguon du lieu khong dang tin; moi phan hoi phai chui qua dung Pydantic model
ma caller yeu cau. Sai schema -> thu lai DUNG MOT LAN voi loi validate duoc nhoi
nguoc vao prompt -> van sai thi nem `LLMSchemaError`.

Day chinh la lo hong cua lop AI TypeScript hien tai (`frontend/server.ts` goi Gemini,
prompt inline, khong validate) ma plan/06 §1 da chi ra.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from src.core.config import settings
from src.core.logging import get_logger
from src.integrations.http import HttpClient, HttpError

logger = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)

DEFAULT_SYSTEM = (
    "You are BikeSync AI, a supply-chain sourcing analyst. "
    "You ALWAYS answer with a single JSON object that matches the provided JSON Schema. "
    "No markdown, no code fences, no prose outside the JSON."
)

_client: HttpClient | None = None


class LLMError(RuntimeError):
    """Loi goi LLM khong the phuc hoi."""


class LLMSchemaError(LLMError):
    """LLM tra ve JSON khong khop schema sau ca lan thu lai."""

    def __init__(self, message: str, *, raw_content: str = "",
                 validation_error: str = ""):
        super().__init__(message)
        self.raw_content = raw_content
        self.validation_error = validation_error


def get_client() -> HttpClient:
    global _client
    if _client is None:
        _client = HttpClient(
            settings.openai_base_url,
            namespace="openrouter",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://bikesync.ai",
                "X-Title": "BikeSync-AI-Worker",
            },
            timeout=max(settings.http_timeout_seconds, 60.0),
        )
    return _client


def reset_client() -> None:
    global _client
    if _client is not None:
        _client.close()
    _client = None


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def _extract_json(content: str) -> Any:
    """Boc JSON ra khoi cau tra loi. Mot so model van boc code fence du da yeu cau."""
    text = _FENCE_RE.sub("", (content or "").strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start:end + 1])
    raise json.JSONDecodeError("khong tim thay object JSON trong phan hoi", text or "", 0)


def _harden(node: Any) -> Any:
    """Dong moi object CO `properties` lai (`additionalProperties: false`).

    OpenAI/OpenRouter doi dieu nay o MOI cap, khong chi cap goc -- thieu mot cap
    la ca request bi tu choi 400. Object mo that su (vd `dict[str, Any]` trong
    `rejectedOptionsAnalysis`) thi khong dong, vi no von khong co `properties`.
    """
    if isinstance(node, list):
        return [_harden(item) for item in node]
    if not isinstance(node, dict):
        return node
    out = {key: _harden(value) for key, value in node.items()}
    if out.get("type") == "object" and "properties" in out:
        out.setdefault("additionalProperties", False)
    return out


def _schema_of(model: type[BaseModel]) -> dict:
    return _harden(model.model_json_schema(by_alias=True))


def _call(messages: list[dict], schema_model: type[BaseModel],
          temperature: float, client: HttpClient) -> tuple[str, dict]:
    """Mot luot goi /chat/completions. Tra ve (noi dung, usage)."""
    payload = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": temperature,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                # `strict` = false co chu dich: che do strict cua OpenAI bat buoc MOI
                # truong phai nam trong `required` va cam moi object mo, nen no tu choi
                # cac contract hop le cua ta (`rejectedOptionsAnalysis: list[dict]`,
                # cac truong co default). Bao dam that nam o buoc validate Pydantic
                # ben duoi -- schema o day chi de dan model.
                "name": schema_model.__name__,
                "strict": False,
                "schema": _schema_of(schema_model),
            },
        },
    }
    started = time.monotonic()
    try:
        data = client.post_json("chat/completions", payload)
    except HttpError as exc:
        if exc.status_code == 400 and "response_format" in (exc.body or ""):
            # Model/provider khong nuot noi json_schema -> ha xuong json_object.
            # Prompt da mang san schema day du nen van du thong tin.
            logger.warning("llm_json_schema_unsupported",
                           extra={"model": settings.openrouter_model,
                                  "error": (exc.body or "")[:300]})
            payload["response_format"] = {"type": "json_object"}
            try:
                data = client.post_json("chat/completions", payload)
            except HttpError as exc2:
                raise LLMError(f"OpenRouter that bai: {exc2}") from exc2
        else:
            raise LLMError(f"OpenRouter that bai: {exc}") from exc
    latency_ms = round((time.monotonic() - started) * 1000, 1)

    choices = data.get("choices") or []
    if not choices:
        raise LLMError(f"OpenRouter khong tra choices: {str(data)[:300]}")
    content = (choices[0].get("message") or {}).get("content") or ""
    usage = data.get("usage") or {}

    logger.info(
        "llm_call",
        extra={
            "model": data.get("model") or settings.openrouter_model,
            "schema": schema_model.__name__,
            "latency_ms": latency_ms,
            "prompt_tokens": usage.get("prompt_tokens"),
            "completion_tokens": usage.get("completion_tokens"),
            "total_tokens": usage.get("total_tokens"),
            "finish_reason": choices[0].get("finish_reason"),
        },
    )
    return content, usage


def structured_completion(
    prompt: str,
    schema_model: type[T],
    system: str | None = None,
    *,
    temperature: float = 0.2,
    client: HttpClient | None = None,
) -> T:
    """Goi OpenRouter va tra ve MOT INSTANCE da validate cua `schema_model`.

    Args:
        prompt: noi dung user message.
        schema_model: Pydantic model bat buoc cho dau ra (vd `LLMProposalAnalysis`).
        system: system prompt, mac dinh `DEFAULT_SYSTEM`.

    Raises:
        LLMSchemaError: phan hoi khong khop schema sau 1 lan thu lai.
        LLMError: loi mang / API / khong co choices.
    """
    client = client or get_client()
    schema_text = json.dumps(_schema_of(schema_model), ensure_ascii=False)
    messages: list[dict] = [
        {"role": "system", "content": system or DEFAULT_SYSTEM},
        {"role": "user", "content": f"{prompt}\n\nJSON Schema bat buoc:\n{schema_text}"},
    ]

    last_content = ""
    last_error = ""
    for attempt in (1, 2):
        content, _usage = _call(messages, schema_model, temperature, client)
        last_content = content
        try:
            return schema_model.model_validate(_extract_json(content))
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = str(exc)[:1500]
            logger.warning(
                "llm_schema_invalid",
                extra={"schema": schema_model.__name__, "attempt": attempt,
                       "error": last_error[:300]},
            )
            if attempt == 2:
                break
            # Nhoi chinh loi validate nguoc vao hoi thoai -- model sua duoc nhieu hon
            # la goi lai y het prompt cu.
            messages.append({"role": "assistant", "content": content})
            messages.append({
                "role": "user",
                "content": (
                    "Phan hoi tren KHONG hop le so voi JSON Schema. Loi validate:\n"
                    f"{last_error}\n\n"
                    "Hay tra ve LAI chi mot object JSON hop le, dung moi truong bat buoc, "
                    "khong markdown, khong giai thich."
                ),
            })

    raise LLMSchemaError(
        f"LLM tra ve JSON khong khop {schema_model.__name__} sau 2 lan thu",
        raw_content=last_content,
        validation_error=last_error,
    )
