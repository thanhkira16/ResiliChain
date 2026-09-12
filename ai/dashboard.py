"""ResiliChain -- Streamlit dashboard.

Chi DOC database, khong ghi. Dung SQL rieng (khong phu thuoc db_client) de
dashboard van xem duoc ngay ca khi worker dang loi.

Chay:  cd ai && .venv/bin/streamlit run dashboard.py
"""

from __future__ import annotations

from typing import LiteralString, cast

import sys
from pathlib import Path

import pandas as pd
import plotly.express as px
import psycopg
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.core.config import settings  # noqa: E402
from src.core.contracts import RiskLevel  # noqa: E402

st.set_page_config(page_title="ResiliChain", page_icon="⚡", layout="wide")

RISK_COLORS = {
    RiskLevel.HIGH.value: "#dc2626",
    RiskLevel.MEDIUM.value: "#f59e0b",
    RiskLevel.LOW.value: "#16a34a",
}


@st.cache_resource
def _conn() -> psycopg.Connection:
    return psycopg.connect(settings.dsn, autocommit=True)


@st.cache_data(ttl=30)
def q(sql: str) -> pd.DataFrame:
    with _conn().cursor() as cur:
        # SQL la hang so trong file nay, khong co input nguoi dung.
        cur.execute(cast(LiteralString, sql))
        cols = [d[0] for d in (cur.description or [])]
        return pd.DataFrame(cur.fetchall(), columns=pd.Index(cols))


def _num(df: pd.DataFrame, *cols: str) -> pd.DataFrame:
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


st.title("⚡ ResiliChain")
st.caption("Nền tảng tự chủ chuỗi cung ứng xe điện")
st.caption(
    f"Ngưỡng incident: **{settings.incident_risk_threshold:g}** · "
    f"PORS CAO ≥ **{settings.pors_high_threshold:g}**, TRUNG BÌNH ≥ "
    f"**{settings.pors_medium_threshold:g}** · model `{settings.openrouter_model}`"
)

if st.button("🔄 Làm mới dữ liệu"):
    st.cache_data.clear()
    st.rerun()

# --------------------------------------------------------------------------
# Hang chi so tong quan
# --------------------------------------------------------------------------
try:
    kpi = q(
        """
        SELECT
          (SELECT count(*) FROM purchase_orders)                                   AS pos,
          (SELECT count(*) FROM purchase_orders WHERE current_risk_score IS NOT NULL) AS pos_scored,
          (SELECT count(*) FROM incidents
             WHERE state NOT IN ('RESOLVED','REJECTED','CANCELLED'))               AS open_incidents,
          (SELECT count(*) FROM sourcing_proposals WHERE status = 'Chờ duyệt')     AS pending_props,
          (SELECT count(*) FROM supplier_risk_analysis WHERE pors_score >= %s)     AS high_risk
        """.replace("%s", str(settings.pors_high_threshold))
    ).iloc[0]
except Exception as exc:  # noqa: BLE001
    st.error(f"Không kết nối được database: {exc}")
    st.stop()

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Đơn hàng", int(kpi.pos))
c2.metric("Đã chấm điểm", int(kpi.pos_scored))
c3.metric("Sự cố đang mở", int(kpi.open_incidents))
c4.metric("Đề xuất chờ duyệt", int(kpi.pending_props))
c5.metric("NCC rủi ro CAO", int(kpi.high_risk))

tab_risk, tab_inc, tab_prop, tab_jobs = st.tabs(
    ["🏭 Radar rủi ro NCC", "🚨 Sự cố", "📋 Đề xuất thay thế", "⚙️ Vòng quét AI"]
)

# --------------------------------------------------------------------------
with tab_risk:
    sra = _num(
        q(
            """
            SELECT r.supplier_id, s.name AS supplier_name, r.ticker,
                   r.ssi_news, r.ssi_fin, r.ssi_del, r.g_geo, r.altman_z,
                   r.pors_score, r.risk_level, r.status_label,
                   r.events_supply_chain_30d, r.key_events, r.analyzed_at
            FROM supplier_risk_analysis r
            LEFT JOIN suppliers s ON s.id = r.supplier_id
            ORDER BY r.pors_score DESC NULLS LAST
            """
        ),
        "ssi_news", "ssi_fin", "ssi_del", "g_geo", "altman_z", "pors_score",
    )

    if sra.empty:
        st.info("Chưa có dữ liệu — chạy `.venv/bin/python ai_worker.py --once --job supplier_risk_scan`")
    else:
        left, right = st.columns([3, 2])
        with left:
            fig = px.bar(
                sra, x="pors_score", y="supplier_name", orientation="h",
                color="risk_level", color_discrete_map=RISK_COLORS,
                labels={"pors_score": "PORS", "supplier_name": "", "risk_level": "Mức"},
                title="Điểm rủi ro tổng hợp PORS",
            )
            fig.add_vline(x=settings.pors_high_threshold, line_dash="dash", line_color="#dc2626")
            fig.add_vline(x=settings.pors_medium_threshold, line_dash="dot", line_color="#f59e0b")
            fig.update_layout(height=440, yaxis={"categoryorder": "total ascending"})
            st.plotly_chart(fig, width='stretch')
        with right:
            comp = sra.melt(
                id_vars="supplier_name",
                value_vars=["ssi_news", "ssi_fin", "ssi_del", "g_geo"],
                var_name="Thành phần", value_name="Điểm",
            )
            fig2 = px.bar(
                comp, x="supplier_name", y="Điểm", color="Thành phần",
                title="4 thành phần cấu thành PORS", labels={"supplier_name": ""},
            )
            fig2.update_layout(height=440, xaxis_tickangle=-40)
            st.plotly_chart(fig2, width='stretch')

        st.subheader("Sức khoẻ tài chính (Altman Z)")
        fin = sra.dropna(subset=["altman_z"]).copy()
        if not fin.empty:
            fin["Vùng"] = pd.cut(
                fin["altman_z"], bins=[-1e9, 1.81, 2.99, 1e9],
                labels=["Kiệt quệ", "Cảnh báo", "An toàn"],
            )
            fig3 = px.scatter(
                fin, x="altman_z", y="pors_score", text="supplier_name",
                color="Vùng", size="ssi_fin",
                color_discrete_map={"Kiệt quệ": "#dc2626", "Cảnh báo": "#f59e0b", "An toàn": "#16a34a"},
                labels={"altman_z": "Altman Z-Score", "pors_score": "PORS"},
            )
            fig3.add_vline(x=1.81, line_dash="dash", line_color="#dc2626")
            fig3.add_vline(x=2.99, line_dash="dash", line_color="#16a34a")
            fig3.update_traces(textposition="top center")
            st.plotly_chart(fig3, width='stretch')

        st.dataframe(sra.drop(columns=["key_events"]), width='stretch', hide_index=True)

        sel = st.selectbox("Xem sự kiện then chốt của", sra["supplier_name"].tolist())
        events = sra.loc[sra["supplier_name"] == sel, "key_events"].iloc[0]
        if events:
            st.dataframe(pd.DataFrame(events), width='stretch', hide_index=True)
        else:
            st.caption("Không có sự kiện nào được ghi nhận.")

# --------------------------------------------------------------------------
with tab_inc:
    inc = _num(
        q(
            """
            SELECT id, po_number, sku, sku_name, supplier_name, delay_days,
                   delay_risk_score, threshold_applied, state, status,
                   detected_at, summary, agent2_triggered, risk_breakdown
            FROM incidents ORDER BY delay_risk_score DESC
            """
        ),
        "delay_risk_score", "threshold_applied", "delay_days",
    )
    if inc.empty:
        st.info("Chưa có sự cố nào.")
    else:
        a, b = st.columns([2, 1])
        with a:
            fig = px.bar(
                inc, x="po_number", y="delay_risk_score", color="status",
                title="Điểm rủi ro trễ hạn theo đơn hàng",
                labels={"po_number": "", "delay_risk_score": "Điểm rủi ro", "status": "Trạng thái"},
            )
            fig.add_hline(
                y=float(inc["threshold_applied"].iloc[0]), line_dash="dash",
                line_color="#dc2626", annotation_text="Ngưỡng kích hoạt",
            )
            st.plotly_chart(fig, width='stretch')
        with b:
            st.plotly_chart(
                px.pie(  # pyright: ignore[reportArgumentType]
                    inc, names="status", title="Phân bố trạng thái", hole=0.45
                ),
                width='stretch',
            )

        st.dataframe(
            inc.drop(columns=["risk_breakdown", "summary"]),
            width='stretch', hide_index=True,
        )

        pick = st.selectbox("Diễn giải công thức của sự cố", inc["id"].tolist())
        row = inc.loc[inc["id"] == pick].iloc[0]
        st.write(row["summary"])
        rb = row["risk_breakdown"]
        if rb:
            st.info(rb.get("formulaExplanation", "—"))
            factors = pd.DataFrame(
                [
                    {"Yếu tố": "Trễ hạn (w1)", "Giá trị": rb.get("latenessFactor"), "Trọng số": rb.get("w1")},
                    {"Yếu tố": "Độ tin cậy NCC (w2)", "Giá trị": rb.get("supplierReliabilityFactor"), "Trọng số": rb.get("w2")},
                    {"Yếu tố": "Đệm tồn kho (w3)", "Giá trị": rb.get("inventoryBufferFactor"), "Trọng số": rb.get("w3")},
                ]
            )
            factors["Đóng góp"] = factors["Giá trị"] * factors["Trọng số"] * 100
            st.plotly_chart(
                px.bar(factors, x="Yếu tố", y="Đóng góp", text_auto=True,
                       title="Đóng góp từng yếu tố vào điểm rủi ro"),
                width='stretch',
            )
        else:
            st.caption("Sự cố này chưa có risk_breakdown.")

# --------------------------------------------------------------------------
with tab_prop:
    props = _num(
        q(
            """
            SELECT id, incident_id, po_number, sku_name, quantity,
                   original_supplier_name, original_unit_price, original_total_cost,
                   rankings, selected_rank, recommendation,
                   rejected_options_analysis, status, total_value_vnd
            FROM sourcing_proposals ORDER BY id
            """
        ),
        "original_unit_price", "original_total_cost", "total_value_vnd", "quantity",
    )
    if props.empty:
        st.info("Chưa có đề xuất nào.")
    else:
        st.dataframe(
            props[["id", "po_number", "sku_name", "quantity",
                   "original_supplier_name", "original_total_cost", "status"]],
            width='stretch', hide_index=True,
        )

        pid = st.selectbox("Chi tiết đề xuất", props["id"].tolist())
        p = props.loc[props["id"] == pid].iloc[0]
        ranks = pd.DataFrame(p["rankings"] or [])
        if ranks.empty:
            st.warning("Đề xuất này không có rankings.")
        else:
            st.success(f"**Kiến nghị:** {p['recommendation']}")
            saving = float(p["original_total_cost"]) - ranks["totalCost"].astype(float)
            chart = ranks.assign(**{"Chênh lệch chi phí (VNĐ)": saving})
            cc1, cc2 = st.columns(2)
            with cc1:
                st.plotly_chart(
                    px.bar(ranks, x="supplierName", y="score", text_auto=True,
                           color="score", color_continuous_scale="Blues",
                           title="Điểm MILP", labels={"supplierName": "", "score": "Điểm"}),
                    width='stretch',
                )
            with cc2:
                st.plotly_chart(
                    px.bar(chart, x="supplierName", y="Chênh lệch chi phí (VNĐ)",
                           color="Chênh lệch chi phí (VNĐ)",
                           color_continuous_scale="RdYlGn",
                           title="Tiết kiệm so với NCC gốc", labels={"supplierName": ""}),
                    width='stretch',
                )

            if "scoreBreakdown" in ranks.columns:
                sb = pd.json_normalize(
                    ranks["scoreBreakdown"]  # pyright: ignore[reportArgumentType]
                ).assign(
                    supplierName=ranks["supplierName"]
                )
                contrib = sb.melt(
                    id_vars="supplierName",
                    value_vars=["costScoreContribution", "timeScoreContribution", "reliabilityContribution"],
                    var_name="Tiêu chí", value_name="Đóng góp",
                )
                st.plotly_chart(
                    px.bar(contrib, x="supplierName", y="Đóng góp", color="Tiêu chí",
                           title="Phân rã điểm MILP theo 3 tiêu chí", labels={"supplierName": ""}),
                    width='stretch',
                )

            for _, r in ranks.iterrows():
                chosen = " ✅ **ĐƯỢC CHỌN**" if r["rank"] == p["selected_rank"] else ""
                with st.expander(f"#{r['rank']} · {r['supplierName']} · {r['score']} điểm{chosen}"):
                    st.write(f"Đơn giá **{float(r['unitPrice']):,.0f}** VNĐ · "
                             f"Tổng **{float(r['totalCost']):,.0f}** VNĐ · "
                             f"Lead time **{r['leadTimeDays']}** ngày")
                    pc1, pc2 = st.columns(2)
                    pc1.markdown("**Ưu điểm**\n" + "\n".join(f"- {x}" for x in (r.get("pros") or ["—"])))
                    pc2.markdown("**Nhược điểm**\n" + "\n".join(f"- {x}" for x in (r.get("cons") or ["—"])))
                    if r.get("reasoning"):
                        st.caption(r["reasoning"])

# --------------------------------------------------------------------------
with tab_jobs:
    jobs = _num(
        q(
            """
            SELECT id, job_name, trigger_source, started_at, finished_at, duration_ms,
                   status, orders_scanned, suppliers_scanned, incidents_created,
                   incidents_updated, proposals_created, skipped_locked, message, error_detail
            FROM ai_job_runs ORDER BY started_at DESC LIMIT 100
            """
        ),
        "duration_ms", "orders_scanned", "incidents_created", "proposals_created",
    )
    if jobs.empty:
        st.info("Worker chưa chạy lần nào.")
    else:
        j1, j2, j3 = st.columns(3)
        j1.metric("Vòng quét gần nhất", str(jobs["status"].iloc[0]))
        j2.metric("Thời lượng (ms)", f"{jobs['duration_ms'].iloc[0]:,.0f}"
                  if pd.notna(jobs["duration_ms"].iloc[0]) else "—")
        j3.metric("Tỉ lệ thành công", f"{(jobs['status'].str.upper() == 'SUCCESS').mean() * 100:.0f}%")

        st.plotly_chart(
            px.line(jobs.sort_values("started_at"), x="started_at", y="duration_ms",
                    color="job_name", markers=True, title="Thời lượng vòng quét theo thời gian",
                    labels={"started_at": "", "duration_ms": "ms"}),
            width='stretch',
        )
        st.dataframe(jobs, width='stretch', hide_index=True)
