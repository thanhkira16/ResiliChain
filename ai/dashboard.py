"""ResiliChain -- Streamlit executive light minimalist dashboard.

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

st.set_page_config(
    page_title="ResiliChain AI Operations Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Dark Minimalist Theme Styling
st.markdown(
    """
    <style>
    .stApp {
        background-color: #0f172a;
        color: #f8fafc;
    }
    h1, h2, h3, h4, h5, h6, p, label, .stCaption {
        color: #f8fafc !important;
    }
    .metric-card {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
    }
    .metric-title {
        color: #94a3b8;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .metric-value {
        color: #f8fafc;
        font-size: 1.75rem;
        font-weight: 800;
        font-family: monospace;
        margin-top: 4px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

RISK_COLORS = {
    RiskLevel.HIGH.value: "#dc2626",
    RiskLevel.MEDIUM.value: "#d97706",
    RiskLevel.LOW.value: "#16a34a",
}


@st.cache_resource
def _conn() -> psycopg.Connection:
    return psycopg.connect(settings.dsn, autocommit=True)


@st.cache_data(ttl=30)
def q(sql: str) -> pd.DataFrame:
    with _conn().cursor() as cur:
        cur.execute(cast(LiteralString, sql))
        cols = [d[0] for d in (cur.description or [])]
        return pd.DataFrame(cur.fetchall(), columns=pd.Index(cols))


def _num(df: pd.DataFrame, *cols: str) -> pd.DataFrame:
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


st.title("⚡ ResiliChain — Bảng Tác Chiến AI Engine")
st.caption("Hệ thống tự chủ & phân tích rủi ro đa nguồn chuỗi cung ứng xe điện EV")
st.caption(
    f"Ngưỡng incident: **{settings.incident_risk_threshold:g}** · "
    f"PORS CAO ≥ **{settings.pors_high_threshold:g}**, TRUNG BÌNH ≥ "
    f"**{settings.pors_medium_threshold:g}** · model `{settings.openrouter_model}`"
)

if st.button("🔄 Làm mới dữ liệu live"):
    st.cache_data.clear()
    st.rerun()

# --------------------------------------------------------------------------
# Hàng chỉ số tổng quan (KPI Row)
# --------------------------------------------------------------------------
try:
    kpi = q(
        """
        SELECT
          (SELECT count(*) FROM purchase_orders)                                      AS pos,
          (SELECT count(*) FROM purchase_orders WHERE current_risk_score IS NOT NULL) AS pos_scored,
          (SELECT count(*) FROM incidents
             WHERE state NOT IN ('RESOLVED','REJECTED','CANCELLED'))                  AS open_incidents,
          (SELECT count(*) FROM sourcing_proposals WHERE status = 'Chờ duyệt')        AS pending_props,
          (SELECT count(*) FROM supplier_risk_analysis WHERE pors_score >= %s)        AS high_risk
        """.replace("%s", str(settings.pors_high_threshold))
    ).iloc[0]
except Exception as exc:  # noqa: BLE001
    st.error(f"Không kết nối được Supabase Database: {exc}")
    st.stop()

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("📦 Đơn hàng POs", int(kpi.pos))
c2.metric("🎯 Đã quét rủi ro", int(kpi.pos_scored))
c3.metric("🚨 Sự cố đang mở", int(kpi.open_incidents))
c4.metric("📋 Đề xuất chờ duyệt", int(kpi.pending_props))
c5.metric("🏭 NCC rủi ro CAO", int(kpi.high_risk))

tab_risk, tab_inc, tab_prop, tab_jobs = st.tabs(
    ["🏭 Radar rủi ro NCC (PORS & Altman Z)", "🚨 Sự cố & Cảnh báo", "📋 Đề xuất thay thế MILP", "⚙️ Nhật ký Vòng quét AI"]
)

# --------------------------------------------------------------------------
# TAB 1: RADAR RỦI RO NCC
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
        st.info("Chưa có dữ liệu nhà cung ứng trong database — chạy `just scan-suppliers` để AI quét dữ liệu mới.")
    else:
        left, right = st.columns([3, 2])
        with left:
            fig = px.bar(
                sra, x="pors_score", y="supplier_name", orientation="h",
                color="risk_level", color_discrete_map=RISK_COLORS,
                labels={"pors_score": "Điểm PORS Score", "supplier_name": "", "risk_level": "Mức Risk"},
                title="Bảng Điểm Rủi Ro Tổng Hợp PORS Score",
                template="plotly_dark",
            )
            fig.add_vline(x=settings.pors_high_threshold, line_dash="dash", line_color="#dc2626")
            fig.add_vline(x=settings.pors_medium_threshold, line_dash="dot", line_color="#d97706")
            fig.update_layout(height=440, yaxis={"categoryorder": "total ascending"})
            st.plotly_chart(fig, use_container_width=True)

        with right:
            comp = sra.melt(
                id_vars="supplier_name",
                value_vars=["ssi_news", "ssi_fin", "ssi_del", "g_geo"],
                var_name="Thành phần", value_name="Điểm",
            )
            fig2 = px.bar(
                comp, x="supplier_name", y="Điểm", color="Thành phần",
                title="4 Thành Phần Phân Tách Điểm PORS", labels={"supplier_name": ""},
                template="plotly_dark",
            )
            fig2.update_layout(height=440, xaxis_tickangle=-40)
            st.plotly_chart(fig2, use_container_width=True)

        st.subheader("Sức Khoẻ Tài Chính Nhà Cung Cấp (Altman Z-Score)")
        fin = sra.dropna(subset=["altman_z"]).copy()
        if not fin.empty:
            fin["Vùng Risk"] = pd.cut(
                fin["altman_z"], bins=[-1e9, 1.81, 2.99, 1e9],
                labels=["Kiệt quệ (Distress)", "Cảnh báo (Grey)", "An toàn (Safe)"],
            )
            fig3 = px.scatter(
                fin, x="altman_z", y="pors_score", color="Vùng Risk",
                text="supplier_name", hover_data=["ticker"],
                labels={"altman_z": "Altman Z-Score", "pors_score": "PORS"},
                title="Ma Trận Tương Quan Altman Z-Score vs PORS Score",
                template="plotly_dark",
            )
            fig3.add_vline(x=1.81, line_dash="dash", line_color="#dc2626")
            fig3.add_vline(x=2.99, line_dash="dash", line_color="#16a34a")
            fig3.update_traces(textposition="top center", marker={"size": 12})
            st.plotly_chart(fig3, use_container_width=True)

# --------------------------------------------------------------------------
# TAB 2: SỰ CỐ & CẢNH BÁO
# --------------------------------------------------------------------------
with tab_inc:
    inc = _num(
        q(
            """
            SELECT i.id, i.po_number, i.sku, i.status, i.state,
                   i.delay_days, i.delay_risk_score, i.summary, i.created_at,
                   po.supplier_name
            FROM incidents i
            LEFT JOIN purchase_orders po ON po.po_number = i.po_number
            ORDER BY i.created_at DESC
            """
        ),
        "delay_days", "delay_risk_score",
    )
    if inc.empty:
        st.info("Chưa phát hiện sự cố nghiêm trọng nào trong database.")
    else:
        st.dataframe(inc, use_container_width=True)

# --------------------------------------------------------------------------
# TAB 3: ĐỀ XUẤT THAY THẾ MILP
# --------------------------------------------------------------------------
with tab_prop:
    props = q(
        """
        SELECT id, incident_id, po_number, sku, status, created_at, rankings, recommendation
        FROM sourcing_proposals
        ORDER BY created_at DESC
        """
    )
    if props.empty:
        st.info("Chưa có đề xuất thay thế nào được sinh từ PuLP MILP Solver.")
    else:
        st.dataframe(props, use_container_width=True)

# --------------------------------------------------------------------------
# TAB 4: VÒNG QUÉT AI WORKER
# --------------------------------------------------------------------------
with tab_jobs:
    jobs = q(
        """
        SELECT id, job_name, status, trigger_source, orders_scanned, suppliers_scanned,
               incidents_created, proposals_created, duration_ms, message, started_at
        FROM ai_job_runs
        ORDER BY started_at DESC
        LIMIT 50
        """
    )
    if jobs.empty:
        st.info("Chưa có nhật ký vòng quét AI nào (`ai_job_runs`).")
    else:
        st.dataframe(jobs, use_container_width=True)
