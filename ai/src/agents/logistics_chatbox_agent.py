"""AGENT 4 -- Supplier Email Inquiry & B2B Logistics Chatbox Agent.

Sinh BAN NHAP email xac minh tien do va phuong an van tai thay the.
v1 KHONG TU GUI EMAIL -- chi tra ve draft de nguoi duyet. Day la chu y thiet ke:
mot worker chay 5 phut/lan tu gui mail cho nha cung ung la rui ro khong the hoan tac.
"""

from __future__ import annotations

from pydantic import Field

from src.agents.base import Agent
from src.core.config import settings
from src.core.contracts import OrderContext, Strict
from src.integrations.openrouter_client import LLMError, structured_completion

SYSTEM_PROMPT = (
    "Bạn là chuyên viên logistics B2B của nhà sản xuất xe điện. Bạn soạn email "
    "tiếng Việt lịch sự, ngắn gọn, đúng trọng tâm gửi nhà cung ứng để xác minh tiến độ "
    "giao hàng đang trễ, và đề xuất phương án vận tải thay thế. Không hứa hẹn điều khoản "
    "thương mại mới, không cam kết giá."
)

#: Phuong an van tai duoc phep de xuat (plan/06 -- Agent 4).
TRANSPORT_OPTIONS = (
    "Chuyển từ đường biển sang đường hàng không cho phần lô hàng gấp",
    "Chia nhỏ lô hàng: giao trước phần đủ bù tồn kho an toàn",
    "Giữ nguyên phương án nhưng yêu cầu cam kết mốc giao mới bằng văn bản",
)


class LogisticsDraft(Strict):
    """Schema bat buoc cho structured output -- validate truoc khi tra ve."""

    subject: str = Field(min_length=1)
    body: str = Field(min_length=1)
    proposed_transport_option: str = Field(min_length=1, validation_alias="proposedTransportOption", serialization_alias="proposedTransportOption")
    urgency: str = Field(min_length=1)


def build_prompt(ctx: OrderContext) -> str:
    shortfall = max(0, ctx.inventory.safety_stock - ctx.inventory.current_stock)
    weeks_left = (
        round(ctx.inventory.current_stock / ctx.inventory.weekly_burn_rate, 1)
        if ctx.inventory.weekly_burn_rate
        else None
    )
    return (
        f"Đơn hàng {ctx.order.po_number} với {ctx.order.supplier_name} đang trễ "
        f"{ctx.delay_days} ngày so với mốc cam kết {ctx.order.promised_delivery_date}.\n"
        f"Linh kiện: {ctx.order.sku_name} ({ctx.order.sku}), số lượng {ctx.order.quantity}.\n"
        f"Tồn kho hiện tại {ctx.inventory.current_stock}/{ctx.inventory.safety_stock} "
        f"(thiếu {shortfall} so với mức an toàn"
        + (f", còn đủ dùng khoảng {weeks_left} tuần" if weeks_left is not None else "")
        + ").\n"
        f"Người liên hệ: {ctx.supplier.contact_person or 'chưa rõ'} "
        f"<{ctx.supplier.email or 'chưa rõ'}>.\n\n"
        "Soạn email xác minh tiến độ giao hàng và chọn MỘT phương án vận tải phù hợp "
        f"trong danh sách sau: {list(TRANSPORT_OPTIONS)}. "
        "`urgency` là một trong: Thấp, Trung bình, Cao, Khẩn cấp."
    )


def fallback_draft(ctx: OrderContext) -> LogisticsDraft:
    """Ban nhap mau khi khong co LLM -- van du dung de nguoi gui tay."""
    shortfall = max(0, ctx.inventory.safety_stock - ctx.inventory.current_stock)
    option = TRANSPORT_OPTIONS[0] if shortfall > 0 else TRANSPORT_OPTIONS[2]
    return LogisticsDraft(
        subject=f"[{ctx.order.po_number}] Xác minh tiến độ giao {ctx.order.sku_name}",
        body=(
            f"Kính gửi {ctx.supplier.contact_person or ctx.order.supplier_name},\n\n"
            f"Đơn hàng {ctx.order.po_number} ({ctx.order.sku_name}, số lượng "
            f"{ctx.order.quantity}) hiện đã trễ {ctx.delay_days} ngày so với mốc cam kết "
            f"{ctx.order.promised_delivery_date}. Tồn kho của chúng tôi hiện ở mức "
            f"{ctx.inventory.current_stock}/{ctx.inventory.safety_stock}.\n\n"
            "Kính đề nghị Quý công ty xác nhận mốc giao hàng mới bằng văn bản, và cho "
            f"biết khả năng áp dụng phương án: {option}.\n\n"
            "Trân trọng cảm ơn."
        ),
        proposed_transport_option=option,
        urgency="Cao" if ctx.delay_days >= 10 or shortfall > 0 else "Trung bình",
    )


class LogisticsChatboxAgent(Agent[OrderContext, LogisticsDraft]):
    name = "agent4_logistics_chatbox"
    critical = False

    def execute(self, payload: OrderContext) -> LogisticsDraft:
        if not settings.llm_api_key:
            return fallback_draft(payload)
        try:
            return structured_completion(
                build_prompt(payload), LogisticsDraft, system=SYSTEM_PROMPT
            )
        except LLMError as exc:
            self.log.warning(
                "chatbox.llm_degraded",
                extra={"po_number": payload.order.po_number, "error": str(exc)[:200]},
            )
            return fallback_draft(payload)

    def fallback(self, payload: OrderContext, error: Exception) -> LogisticsDraft:
        return fallback_draft(payload)
