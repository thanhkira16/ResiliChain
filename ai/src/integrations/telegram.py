"""Integration voi Telegram Bot API de gui canh bao rui ro chuoi cung ung.

Su dung Telegram Bot API (https://api.telegram.org/bot<TOKEN>/sendMessage)
gui tin nhan den kenh hoac chat ID duoc cau hinh trong Settings.
"""

from __future__ import annotations

import httpx

from src.core.config import settings
from src.core.logging import get_logger

log = get_logger("integrations.telegram")


class TelegramClient:
    """Client phat tin nhan canh bao qua Telegram Bot API."""

    def __init__(
        self,
        bot_token: str | None = None,
        chat_id: str | None = None,
        timeout: float = 8.0,
    ) -> None:
        self.bot_token = bot_token if bot_token is not None else settings.telegram_bot_token
        self.chat_id = chat_id if chat_id is not None else settings.telegram_chat_id
        self.timeout = timeout
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

    def is_configured(self) -> bool:
        """Kiem tra xem Bot token va Chat ID da duoc cau hinh chua."""
        return bool(self.bot_token and self.chat_id and settings.enable_telegram_alerts)

    def send_message(self, text: str, parse_mode: str = "Markdown") -> bool:
        """Gui tin nhan den Telegram Chat / Channel."""
        if not self.is_configured():
            log.warning("telegram.disabled_or_unconfigured")
            return False

        if settings.dry_run:
            log.info("telegram.dry_run_skip", extra={"text_snippet": text[:80]})
            return True

        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(self.api_url, json=payload)
                if response.is_success:
                    log.info("telegram.send_success", extra={"chat_id": self.chat_id})
                    return True
                else:
                    log.error(
                        "telegram.send_failed",
                        extra={"status_code": response.status_code, "response": response.text},
                    )
                    return False
        except Exception as exc:
            log.error("telegram.request_exception", extra={"error": str(exc)})
            return False

    def send_order_risk_alert(
        self,
        po_number: str,
        sku: str,
        sku_name: str,
        supplier_name: str,
        delay_risk_score: float,
        summary: str,
        incident_id: str | None = None,
    ) -> bool:
        """Gui canh bao rui ro don hang (Order Delay Risk)."""
        severity_emoji = "🚨" if delay_risk_score >= 60 else "⚠️"
        inc_id = incident_id or f"INC-AUTO-{po_number}"

        message = (
            f"{severity_emoji} *[ResiliChain AI] CẢNH BÁO RỦI RO ĐƠN HÀNG*\n\n"
            f"📦 *Mã đơn hàng (PO)*: `{po_number}`\n"
            f"🛠 *Mã sự cố*: `{inc_id}`\n"
            f"⚙️ *Linh kiện (SKU)*: `{sku}` - {sku_name}\n"
            f"🏭 *Nhà cung cấp*: {supplier_name}\n"
            f"📊 *Điểm rủi ro (Risk Score)*: *{delay_risk_score:.1f}/100*\n\n"
            f"📝 *Tóm tắt sự cố*: {summary}\n\n"
            f"👉 _Hệ thống đã tự động kích hoạt Agent đàm phán & tìm nguồn cung dự phòng MILP._"
        )
        return self.send_message(message)

    def send_supplier_risk_alert(
        self,
        supplier_id: str,
        supplier_name: str,
        pors_score: float,
        risk_level: str,
        status_label: str,
    ) -> bool:
        """Gui canh bao rui ro nha cung cap (Supplier PORS Risk)."""
        level_emoji = "🔴 HIGH" if risk_level == "HIGH" else "🟡 MEDIUM"
        message = (
            f"⚠️ *[ResiliChain AI] CẢNH BÁO RỦI RO NHÀ CUNG CẤP*\n\n"
            f"🏭 *Nhà cung cấp*: {supplier_name} (`{supplier_id}`)\n"
            f"📈 *Điểm PORS (Overall Risk)*: *{pors_score:.1f}/100*\n"
            f"🚦 *Mức độ rủi ro*: *{level_emoji}*\n"
            f"📌 *Trạng thái đánh giá*: {status_label}\n\n"
            f"👉 _Kiến nghị Procurement Officer kiểm tra lại hợp đồng và lên phương án dự phòng._"
        )
        return self.send_message(message)


telegram_client = TelegramClient()
