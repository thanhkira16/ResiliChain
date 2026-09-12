"""AGENT 5 -- Supplier Replacement Sourcing Agent.

Hai dong co ghep lai:
  1. PuLP MILP Solver -- cham diem thuong mai (chi phi / lead time / do tin cay).
  2. OpenRouter LLM  -- sinh pros/cons/reasoning/recommendation.

Nguyen tac bat buoc (plan/06 §3.5): MILP la SU THAT, LLM chi la LOI GIAI THICH.
LLM chet hoac tra JSON sai schema -> van ghi de xuat, chi thieu phan dien giai.
Khong bao gio de JSON chua validate cham toi DB.
"""

from __future__ import annotations

import json
from typing import Any

from src.agents.base import Agent
from src.core.config import settings
from src.core.contracts import (
    LLMProposalAnalysis,
    OrderContext,
    ProposalRanking,
    ProposalStatus,
    SourcingProposal,
    Supplier,
)
from src.core.milp_solver import solve_replacement_sourcing
from src.database import db_client as db
from src.integrations.openrouter_client import LLMError, structured_completion

SYSTEM_PROMPT = (
    "Bạn là chuyên gia thu mua chuỗi cung ứng xe điện. Bạn nhận kết quả xếp hạng "
    "đã được giải bằng mô hình tối ưu MILP và chỉ có nhiệm vụ DIỄN GIẢI nó cho ban "
    "quản trị bằng tiếng Việt. TUYỆT ĐỐI không thay đổi thứ hạng, điểm số hay con số "
    "nào; không bịa thêm nhà cung ứng ngoài danh sách được cung cấp."
)


def build_prompt(ctx: OrderContext, rankings: list[ProposalRanking],
                 risk_notes: dict[str, Any] | None = None) -> str:
    payload = {
        "don_hang": {
            "po_number": ctx.order.po_number,
            "sku": ctx.order.sku,
            "ten_linh_kien": ctx.order.sku_name,
            "so_luong": ctx.order.quantity,
            "ncc_hien_tai": ctx.order.supplier_name,
            "don_gia_goc": ctx.order.unit_price,
            "tong_tien_goc": ctx.order.total_amount,
            "so_ngay_tre": ctx.delay_days,
            "ton_kho_hien_tai": ctx.inventory.current_stock,
            "ton_kho_an_toan": ctx.inventory.safety_stock,
        },
        "xep_hang_milp": [
            {
                "rank": r.rank,
                "supplierId": r.supplier_id,
                "supplierName": r.supplier_name,
                "unitPrice": r.unit_price,
                "totalCost": r.total_cost,
                "leadTimeDays": r.lead_time_days,
                "score": r.score,
                "scoreBreakdown": r.score_breakdown.model_dump(by_alias=True),
            }
            for r in rankings
        ],
        "radar_rui_ro_ncc": risk_notes or {},
    }
    return (
        "Dữ liệu đề xuất thay thế nhà cung ứng:\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        "Với MỖI nhà cung ứng trong `xep_hang_milp`, hãy nêu 2-4 ưu điểm (`pros`), "
        "2-4 nhược điểm (`cons`) và một đoạn `reasoning` ngắn. Nếu `radar_rui_ro_ncc` "
        "cho thấy nhà cung ứng nào có Altman Z thuộc vùng kiệt quệ hoặc PORS cao, "
        "BẮT BUỘC nêu điều đó trong `cons`. Cuối cùng viết `recommendation` là kiến "
        "nghị hành động cho ban quản trị, nêu rõ đánh đổi giữa lợi ích thương mại và "
        "rủi ro. Trả về đúng schema JSON được yêu cầu."
    )


def enrich_rankings(
    rankings: list[ProposalRanking], analysis: LLMProposalAnalysis
) -> list[ProposalRanking]:
    """Gan pros/cons/reasoning tu LLM vao ket qua MILP.

    Chi gan cac truong dien giai -- rank, score, gia, lead time GIU NGUYEN
    theo MILP du LLM co tra ve gi di nua.
    """
    by_id = {item.supplier_id: item for item in analysis.rankings}
    out: list[ProposalRanking] = []
    for r in rankings:
        item = by_id.get(r.supplier_id)
        if item is None:
            out.append(r)
            continue
        out.append(
            r.model_copy(
                update={"pros": item.pros, "cons": item.cons, "reasoning": item.reasoning}
            )
        )
    return out


def fallback_recommendation(ctx: OrderContext, rankings: list[ProposalRanking]) -> str:
    """Kien nghi thuan tu MILP khi khong co LLM -- de xuat van dung duoc."""
    if not rankings:
        return (
            f"Không tìm được nguồn thay thế cho {ctx.order.sku} "
            f"({ctx.order.sku_name}). Cần xử lý thủ công."
        )
    top = rankings[0]
    delta = ctx.order.total_amount - top.total_cost
    huong = "tiết kiệm" if delta >= 0 else "phát sinh thêm"
    return (
        f"Đề xuất chuyển sang {top.supplier_name} (điểm MILP {top.score}/100, "
        f"lead time {top.lead_time_days} ngày), {huong} {abs(delta):,.0f} VNĐ so với "
        f"hợp đồng gốc với {ctx.order.supplier_name}. "
        "Diễn giải AI chưa khả dụng — số liệu do bộ giải tối ưu MILP sinh ra."
    )


class ReplacementSourcingAgent(Agent[dict, SourcingProposal | None]):
    name = "agent5_replacement_sourcing"
    critical = False

    def execute(self, payload: dict) -> SourcingProposal | None:
        ctx: OrderContext = payload["context"]
        incident_id: str = payload["incident_id"]
        correlation_id: str = payload["correlation_id"]
        risk_notes: dict[str, Any] = payload.get("risk_notes") or {}

        candidates: list[Supplier] = db.fetch_alternative_suppliers_for_sku(
            ctx.order.sku, ctx.order.supplier_id
        )
        if not candidates:
            self.log.warning(
                "sourcing.no_alternative",
                extra={"po_number": ctx.order.po_number, "sku": ctx.order.sku},
            )
            return None

        rankings = solve_replacement_sourcing(
            sku=ctx.order.sku,
            quantity=ctx.order.quantity,
            candidates=candidates,
            original_unit_price=ctx.order.unit_price,
            original_lead_time=ctx.committed_lead_time_days,
        )
        if not rankings:
            return None

        # ---- LLM chi lam phan dien giai; that bai thi degrade, khong chan de xuat ----
        recommendation = fallback_recommendation(ctx, rankings)
        rejected: list[dict[str, Any]] = []
        llm_ok = False
        if settings.llm_api_key:
            try:
                analysis = structured_completion(
                    build_prompt(ctx, rankings, risk_notes),
                    LLMProposalAnalysis,
                    system=SYSTEM_PROMPT,
                )
                rankings = enrich_rankings(rankings, analysis)
                recommendation = analysis.recommendation
                rejected = analysis.rejected_options_analysis
                llm_ok = True
            except (LLMError, Exception) as exc:  # noqa: BLE001
                self.log.warning(
                    "sourcing.llm_degraded",
                    extra={"po_number": ctx.order.po_number, "error": str(exc)[:200]},
                )

        proposal = SourcingProposal(
            id=f"PROP-{ctx.order.po_number}",
            incident_id=incident_id,
            correlation_id=correlation_id,
            po_number=ctx.order.po_number,
            sku=ctx.order.sku,
            sku_name=ctx.order.sku_name,
            quantity=ctx.order.quantity,
            original_supplier_name=ctx.order.supplier_name,
            original_unit_price=ctx.order.unit_price,
            original_total_cost=ctx.order.total_amount,
            rankings=rankings,
            selected_rank=rankings[0].rank,
            recommendation=recommendation,
            rejected_options_analysis=rejected,
            status=ProposalStatus.PENDING,
            total_value_vnd=rankings[0].total_cost,
        )
        self.log.info(
            "sourcing.proposal_built",
            extra={
                "po_number": ctx.order.po_number,
                "candidates": len(candidates),
                "ranked": len(rankings),
                "llm_enriched": llm_ok,
            },
        )
        return proposal
