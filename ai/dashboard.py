"""ResiliChain - Bảng điều khiển phân tích rủi ro chuỗi cung ứng.

Chỉ đọc database, không ghi.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any, LiteralString, cast

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import psycopg
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.core.config import settings  # noqa: E402
from src.core.contracts import RiskLevel  # noqa: E402

st.set_page_config(
    page_title="ResiliChain - Trung Tâm Giám Sát Rủi Ro",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Theme CSS chuẩn phong cách Enterprise SaaS, sáng sủa, thanh lịch, không emoji
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Toàn bộ nền sáng dịu mắt */
    .stApp {
        background-color: #f8fafc;
        color: #0f172a;
    }

    /* Container căn lề thoáng đãng */
    .block-container {
        padding-top: 2rem;
        padding-bottom: 3rem;
        max-width: 1380px;
    }

    /* Ẩn header mặc định cồng kềnh của Streamlit */
    header[data-testid="stHeader"] {
        background: transparent;
    }

    /* Custom Header Bar */
    .brand-header {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
    }

    .brand-title {
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #0f172a;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .brand-badge {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        background: #eff6ff;
        color: #2563eb;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid #dbeafe;
    }

    .brand-subtitle {
        color: #64748b;
        font-size: 0.88rem;
        margin-top: 4px;
        margin-bottom: 0;
    }

    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 9999px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        font-size: 0.8rem;
        font-weight: 600;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #22c55e;
    }

    /* Metric Cards */
    .metric-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px 18px;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .metric-card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06);
    }

    .metric-label {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
        margin-bottom: 6px;
    }

    .metric-val {
        font-size: 1.85rem;
        font-weight: 800;
        color: #0f172a;
        font-family: 'JetBrains Mono', monospace;
        line-height: 1.2;
    }

    .metric-sub {
        font-size: 0.75rem;
        color: #94a3b8;
        margin-top: 6px;
    }

    .metric-card.alert-high {
        border-left: 4px solid #ef4444;
    }

    .metric-card.alert-warn {
        border-left: 4px solid #f59e0b;
    }

    .metric-card.alert-safe {
        border-left: 4px solid #10b981;
    }

    .metric-card.alert-primary {
        border-left: 4px solid #3b82f6;
    }

    /* Tabs Styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #f1f5f9;
        padding: 6px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        margin-bottom: 20px;
    }

    .stTabs [data-baseweb="tab"] {
        height: 38px;
        background-color: transparent;
        border-radius: 7px;
        color: #64748b;
        font-size: 0.88rem;
        font-weight: 600;
        padding: 0 16px;
        border: none;
    }

    .stTabs [aria-selected="true"] {
        background-color: #ffffff !important;
        color: #0f172a !important;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    /* Buttons */
    .stButton>button {
        background-color: #ffffff;
        color: #0f172a;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.86rem;
        padding: 6px 14px;
        transition: all 0.15s ease;
    }

    .stButton>button:hover {
        background-color: #f8fafc;
        border-color: #94a3b8;
        color: #0284c7;
    }

    /* Card Panels & Containers */
    .panel-box {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    }

    .panel-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f1f5f9;
    }

    /* Custom badges */
    .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
    }
    .badge-high {
        background-color: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
    }
    .badge-medium {
        background-color: #fffbeb;
        color: #d97706;
        border: 1px solid #fde68a;
    }
    .badge-low {
        background-color: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Màu sắc chuẩn hiển thị (tươi sáng, rõ ràng)
RISK_COLORS = {
    RiskLevel.HIGH.value: "#ef4444",      # Đỏ tươi
    RiskLevel.MEDIUM.value: "#f59e0b",    # Vàng cam
    RiskLevel.LOW.value: "#10b981",       # Xanh ngọc
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


# --------------------------------------------------------------------------
# Header chuẩn Enterprise (Không emoji)
# --------------------------------------------------------------------------
head_col1, head_col2 = st.columns([3, 1])

with head_col1:
    st.markdown(
        f"""
        <div class="brand-header">
            <div>
                <h1 class="brand-title">
                    ResiliChain
                    <span class="brand-badge">Giám Sát Rủi Ro</span>
                </h1>
                <p class="brand-subtitle">
                    Hệ thống đánh giá rủi ro đa nguồn và tối ưu hóa phục hồi chuỗi cung ứng linh kiện xe điện
                </p>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">
                    Mô hình AI: <code>{settings.openrouter_model}</code> &nbsp;·&nbsp;
                    Ngưỡng sự cố: <strong>{settings.incident_risk_threshold:g}</strong> &nbsp;·&nbsp;
                    Ngưỡng PORS: Cao &ge; <strong>{settings.pors_high_threshold:g}</strong>, Trung bình &ge; <strong>{settings.pors_medium_threshold:g}</strong>
                </div>
            </div>
            <div>
                <div class="status-pill">
                    <span class="status-dot"></span>
                    Hệ thống đang hoạt động
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with head_col2:
    st.write("")
    st.write("")
    if st.button("Làm mới dữ liệu", use_container_width=True):
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
    st.error(f"Không thể kết nối cơ sở dữ liệu: {exc}")
    st.stop()

kpi_cols = st.columns(5)
with kpi_cols[0]:
    st.markdown(
        f"""
        <div class="metric-card alert-primary">
            <div class="metric-label">Tổng đơn hàng (PO)</div>
            <div class="metric-val">{int(kpi.pos)}</div>
            <div class="metric-sub">Hợp đồng mua hàng lưu trữ</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_cols[1]:
    pct_scored = (int(kpi.pos_scored) / int(kpi.pos) * 100) if int(kpi.pos) > 0 else 0
    st.markdown(
        f"""
        <div class="metric-card alert-safe">
            <div class="metric-label">Đã quét rủi ro</div>
            <div class="metric-val">{int(kpi.pos_scored)}</div>
            <div class="metric-sub">Đạt {pct_scored:.0f}% tổng đơn hàng</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_cols[2]:
    alert_class = "alert-high" if int(kpi.open_incidents) > 0 else "alert-safe"
    st.markdown(
        f"""
        <div class="metric-card {alert_class}">
            <div class="metric-label">Sự cố đang mở</div>
            <div class="metric-val">{int(kpi.open_incidents)}</div>
            <div class="metric-sub">Yêu cầu can thiệp hoặc điều phối</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_cols[3]:
    st.markdown(
        f"""
        <div class="metric-card alert-warn">
            <div class="metric-label">Đề xuất chờ duyệt</div>
            <div class="metric-val">{int(kpi.pending_props)}</div>
            <div class="metric-sub">Phương án thay thế từ mô hình MILP</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with kpi_cols[4]:
    high_class = "alert-high" if int(kpi.high_risk) > 0 else "alert-safe"
    st.markdown(
        f"""
        <div class="metric-card {high_class}">
            <div class="metric-label">Nhà cung cấp rủi ro cao</div>
            <div class="metric-val">{int(kpi.high_risk)}</div>
            <div class="metric-sub">PORS &ge; {settings.pors_high_threshold:g} điểm</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.write("")

# --------------------------------------------------------------------------
# Tabs chính (Không dùng emoji)
# --------------------------------------------------------------------------
tab_risk, tab_inc, tab_prop, tab_jobs = st.tabs(
    [
        "Phân Tích Nhà Cung Cấp (PORS)",
        "Sự Cố & Cảnh Báo",
        "Phương Án Thay Thế MILP",
        "Nhật Ký Tác Vụ AI",
    ]
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
        st.info("Chưa có dữ liệu nhà cung ứng trong hệ thống. Vui lòng chạy chu trình quét dữ liệu.")
    else:
        # Hàng bộ lọc và tóm tắt
        filter_col, stat_col = st.columns([2, 4])
        with filter_col:
            risk_filter = st.selectbox(
                "Lọc theo mức rủi ro:",
                ["Tất cả", "Rủi ro cao (CAO)", "Rủi ro trung bình (TRUNG BÌNH)", "Rủi ro thấp (THẤP)"],
                index=0,
            )

        filtered_sra = sra.copy()
        if "CAO" in risk_filter:
            filtered_sra = filtered_sra[filtered_sra["risk_level"] == RiskLevel.HIGH.value]
        elif "TRUNG BÌNH" in risk_filter:
            filtered_sra = filtered_sra[filtered_sra["risk_level"] == RiskLevel.MEDIUM.value]
        elif "THẤP" in risk_filter:
            filtered_sra = filtered_sra[filtered_sra["risk_level"] == RiskLevel.LOW.value]

        left, right = st.columns([3, 2])
        with left:
            fig = px.bar(
                filtered_sra,
                x="pors_score",
                y="supplier_name",
                orientation="h",
                color="risk_level",
                color_discrete_map=RISK_COLORS,
                labels={"pors_score": "Điểm PORS", "supplier_name": "Nhà cung cấp", "risk_level": "Mức rủi ro"},
                title="Bảng Xếp Hạng Điểm Rủi Ro Tổng Hợp (PORS Score)",
                template="plotly_white",
            )
            fig.add_vline(
                x=settings.pors_high_threshold,
                line_dash="dash",
                line_color="#ef4444",
                annotation_text=f"Ngưỡng cao ({settings.pors_high_threshold:g})",
                annotation_position="top right",
            )
            fig.add_vline(
                x=settings.pors_medium_threshold,
                line_dash="dot",
                line_color="#f59e0b",
                annotation_text=f"Ngưỡng TB ({settings.pors_medium_threshold:g})",
                annotation_position="bottom right",
            )
            fig.update_layout(
                height=420,
                yaxis={"categoryorder": "total ascending"},
                margin=dict(l=20, r=20, t=50, b=20),
                paper_bgcolor="#ffffff",
                plot_bgcolor="#ffffff",
                font=dict(family="Plus Jakarta Sans, sans-serif", size=12, color="#334155"),
            )
            fig.update_xaxes(showgrid=True, gridcolor="#f1f5f9", range=[0, 100])
            fig.update_yaxes(showgrid=False)
            st.plotly_chart(fig, use_container_width=True)

        with right:
            comp = filtered_sra.melt(
                id_vars="supplier_name",
                value_vars=["ssi_news", "ssi_fin", "ssi_del", "g_geo"],
                var_name="Thành phần",
                value_name="Điểm",
            )
            # Đổi tên nhãn hiển thị thành phần cho rõ ràng
            component_names = {
                "ssi_news": "Tin tức tiêu cực",
                "ssi_fin": "Tài chính suy yếu",
                "ssi_del": "Trễ hạn lịch sử",
                "g_geo": "Rủi ro địa chính trị",
            }
            comp["Thành phần"] = comp["Thành phần"].map(component_names)

            fig2 = px.bar(
                comp,
                x="supplier_name",
                y="Điểm",
                color="Thành phần",
                barmode="group",
                title="Cơ Cấu 4 Thành Phần Rủi Ro",
                labels={"supplier_name": "Nhà cung cấp", "Điểm": "Điểm rủi ro"},
                color_discrete_sequence=["#3b82f6", "#8b5cf6", "#f59e0b", "#06b6d4"],
                template="plotly_white",
            )
            fig2.update_layout(
                height=420,
                xaxis_tickangle=-30,
                margin=dict(l=20, r=20, t=50, b=20),
                paper_bgcolor="#ffffff",
                plot_bgcolor="#ffffff",
                font=dict(family="Plus Jakarta Sans, sans-serif", size=12, color="#334155"),
                legend=dict(orientation="h", yanchor="bottom", y=-0.35, xanchor="center", x=0.5),
            )
            fig2.update_yaxes(showgrid=True, gridcolor="#f1f5f9", range=[0, 100])
            st.plotly_chart(fig2, use_container_width=True)

        # Biểu đồ Altman Z-Score
        st.write("")
        st.markdown("#### Sức Khoẻ Tài Chính Nhà Cung Cấp (Altman Z-Score)")
        fin = sra.dropna(subset=["altman_z"]).copy()
        if not fin.empty:
            fin["Vùng Rủi Ro"] = pd.cut(
                fin["altman_z"],
                bins=[-1e9, 1.81, 2.99, 1e9],
                labels=["Nguy cơ kiệt quệ (< 1.81)", "Vùng cảnh báo (1.81 - 2.99)", "Vùng an toàn (> 2.99)"],
            )
            zone_colors = {
                "Nguy cơ kiệt quệ (< 1.81)": "#ef4444",
                "Vùng cảnh báo (1.81 - 2.99)": "#f59e0b",
                "Vùng an toàn (> 2.99)": "#10b981",
            }
            fig3 = px.scatter(
                fin,
                x="altman_z",
                y="pors_score",
                color="Vùng Rủi Ro",
                color_discrete_map=zone_colors,
                text="supplier_name",
                hover_data=["ticker"],
                labels={"altman_z": "Chỉ số Altman Z-Score", "pors_score": "Điểm PORS Score"},
                template="plotly_white",
            )
            fig3.add_vline(x=1.81, line_dash="dash", line_color="#ef4444", annotation_text="Ngưỡng 1.81")
            fig3.add_vline(x=2.99, line_dash="dash", line_color="#10b981", annotation_text="Ngưỡng 2.99")
            fig3.update_traces(
                textposition="top center",
                marker=dict(size=11, line=dict(width=1.5, color="#ffffff")),
            )
            fig3.update_layout(
                height=380,
                margin=dict(l=20, r=20, t=30, b=20),
                paper_bgcolor="#ffffff",
                plot_bgcolor="#ffffff",
                font=dict(family="Plus Jakarta Sans, sans-serif", size=12, color="#334155"),
            )
            fig3.update_xaxes(showgrid=True, gridcolor="#f1f5f9")
            fig3.update_yaxes(showgrid=True, gridcolor="#f1f5f9")
            st.plotly_chart(fig3, use_container_width=True)

        # Bảng dữ liệu chi tiết
        st.write("")
        st.markdown("#### Bảng Dữ Liệu Chi Tiết Nhà Cung Cấp")

        display_df = sra[[
            "supplier_name", "ticker", "risk_level", "pors_score",
            "altman_z", "ssi_news", "ssi_fin", "ssi_del", "g_geo",
            "events_supply_chain_30d", "status_label",
        ]].copy()

        st.dataframe(
            display_df,
            column_config={
                "supplier_name": st.column_config.TextColumn("Nhà Cung Cấp", width="medium"),
                "ticker": st.column_config.TextColumn("Mã CK", width="small"),
                "risk_level": st.column_config.TextColumn("Mức Rủi Ro", width="small"),
                "pors_score": st.column_config.ProgressColumn(
                    "Điểm PORS",
                    format="%.1f",
                    min_value=0,
                    max_value=100,
                    width="medium",
                ),
                "altman_z": st.column_config.NumberColumn("Altman Z", format="%.2f"),
                "ssi_news": st.column_config.NumberColumn("Tin Tức", format="%.1f"),
                "ssi_fin": st.column_config.NumberColumn("Tài Chính", format="%.1f"),
                "ssi_del": st.column_config.NumberColumn("Trễ Hạn", format="%.1f"),
                "g_geo": st.column_config.NumberColumn("Địa Lý", format="%.1f"),
                "events_supply_chain_30d": st.column_config.NumberColumn("Sự Kiện 30N", format="%d"),
                "status_label": st.column_config.TextColumn("Đánh Giá Tình Trạng", width="medium"),
            },
            hide_index=True,
            use_container_width=True,
        )

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
        st.info("Hiện không có sự cố nào được ghi nhận trong cơ sở dữ liệu.")
    else:
        col_m1, col_m2, col_m3 = st.columns(3)
        with col_m1:
            st.metric("Tổng số sự cố phát hiện", len(inc))
        with col_m2:
            avg_delay = inc["delay_days"].dropna().mean()
            st.metric("Thời gian trễ trung bình", f"{avg_delay:.1f} ngày" if pd.notnull(avg_delay) else "0 ngày")
        with col_m3:
            high_sev = len(inc[inc["delay_risk_score"] >= settings.incident_risk_threshold])
            st.metric("Sự cố mức độ cao", high_sev)

        st.write("")
        st.markdown("#### Danh Sách Sự Cố Hoạt Động")

        st.dataframe(
            inc[[
                "id", "po_number", "sku", "supplier_name",
                "delay_days", "delay_risk_score", "state", "summary", "created_at"
            ]],
            column_config={
                "id": st.column_config.TextColumn("Mã Sự Cố", width="medium"),
                "po_number": st.column_config.TextColumn("Mã Đơn PO", width="small"),
                "sku": st.column_config.TextColumn("Mã SKU", width="small"),
                "supplier_name": st.column_config.TextColumn("Nhà Cung Cấp", width="medium"),
                "delay_days": st.column_config.NumberColumn("Trễ (Ngày)", format="%d ngày"),
                "delay_risk_score": st.column_config.NumberColumn("Điểm Rủi Ro", format="%.1f"),
                "state": st.column_config.TextColumn("Trạng Thái Xử Lý", width="small"),
                "summary": st.column_config.TextColumn("Tóm Tắt Diễn Biến", width="large"),
                "created_at": st.column_config.DatetimeColumn("Thời Điểm Ghi Nhận", format="YYYY-MM-DD HH:mm"),
            },
            hide_index=True,
            use_container_width=True,
        )

# --------------------------------------------------------------------------
# TAB 3: ĐỀ XUẤT THAY THẾ MILP
# --------------------------------------------------------------------------
with tab_prop:
    props = q(
        """
        SELECT id, incident_id, po_number, sku, sku_name, original_supplier_name,
               original_total_cost, status, created_at, rankings, recommendation
        FROM sourcing_proposals
        ORDER BY created_at DESC
        """
    )

    if props.empty:
        st.info("Chưa có đề xuất thay thế nào được khởi tạo từ thuật toán tối ưu hóa MILP.")
    else:
        st.markdown("#### Đề Xuất Phân Bổ Nguồn Cung Thay Thế (MILP Optimization)")
        st.caption("Các phương án được tính toán tự động dựa trên trọng số chi phí, thời gian giao hàng và độ tin cậy.")

        for _, row in props.iterrows():
            prop_id = row["id"]
            po_num = row["po_number"]
            sku_name = row["sku_name"] or row["sku"]
            orig_sup = row["original_supplier_name"] or "Không xác định"
            status_text = row["status"]
            recommendation = row["recommendation"] or "Không có ghi chú chi tiết."

            # Render Thẻ Đề Xuất hiện đại
            with st.expander(f"Đề xuất: {prop_id} — Đơn hàng {po_num} ({sku_name}) — Trạng thái: {status_text}", expanded=True):
                p_c1, p_c2, p_c3 = st.columns(3)
                p_c1.markdown(f"**Nhà cung cấp ban đầu:** {orig_sup}")
                p_c2.markdown(f"**Mã sự cố liên kết:** `{row['incident_id']}`")
                p_c3.markdown(f"**Trạng thái phê duyệt:** `{status_text}`")

                # Parse rankings
                rankings = row["rankings"]
                if isinstance(rankings, str):
                    try:
                        rankings = json.loads(rankings)
                    except Exception:
                        rankings = []

                if isinstance(rankings, list) and len(rankings) > 0:
                    st.write("")
                    st.markdown("**Bảng So Sánh Các Phương Án Lựa Chọn:**")
                    rank_records = []
                    for r in rankings:
                        tc = r.get("totalCost")
                        if tc is not None:
                            try:
                                formatted_cost = f"{int(float(tc)):,d} VNĐ"
                            except (ValueError, TypeError):
                                formatted_cost = f"{tc} VNĐ"
                        else:
                            formatted_cost = "-"
                        rank_records.append({
                            "Hạng": r.get("rank"),
                            "Nhà Cung Cấp Đề Xuất": r.get("supplierName"),
                            "Thời Gian Giao (Lead Time)": f"{r.get('leadTimeDays')} ngày" if r.get('leadTimeDays') is not None else "-",
                            "Tổng Chi Phí": formatted_cost,
                            "Điểm Tổng Hợp": r.get("score"),
                            "Lý Do Chính": r.get("reasoning", ""),
                        })
                    st.dataframe(pd.DataFrame(rank_records), hide_index=True, use_container_width=True)

                st.write("")
                st.markdown(f"**Nhận Định & Khuyến Nghị Thuật Toán:**")
                st.info(recommendation)

# --------------------------------------------------------------------------
# TAB 4: NHẬT KÝ TÁC VỤ AI
# --------------------------------------------------------------------------
with tab_jobs:
    jobs = _num(
        q(
            """
            SELECT id, job_name, status, trigger_source, orders_scanned, suppliers_scanned,
                   incidents_created, proposals_created, duration_ms, message, started_at
            FROM ai_job_runs
            ORDER BY started_at DESC
            LIMIT 50
            """
        ),
        "orders_scanned", "suppliers_scanned", "incidents_created", "proposals_created", "duration_ms",
    )

    if jobs.empty:
        st.info("Chưa có lịch sử vòng quét AI nào trong bảng `ai_job_runs`.")
    else:
        st.markdown("#### Nhật Ký Hoạt Động Các Chu Trình AI Engine")
        if "duration_ms" in jobs.columns:
            jobs["duration_sec"] = jobs["duration_ms"] / 1000.0

        st.dataframe(
            jobs[[
                "job_name", "status", "trigger_source", "orders_scanned",
                "suppliers_scanned", "incidents_created", "proposals_created",
                "duration_sec", "message", "started_at"
            ]],
            column_config={
                "job_name": st.column_config.TextColumn("Tên Tác Vụ", width="medium"),
                "status": st.column_config.TextColumn("Trạng Thái", width="small"),
                "trigger_source": st.column_config.TextColumn("Nguồn Kích Hoạt", width="small"),
                "orders_scanned": st.column_config.NumberColumn("Đơn Quét", format="%d"),
                "suppliers_scanned": st.column_config.NumberColumn("NCC Quét", format="%d"),
                "incidents_created": st.column_config.NumberColumn("Sự Cố Tạo", format="%d"),
                "proposals_created": st.column_config.NumberColumn("Đề Xuất Tạo", format="%d"),
                "duration_sec": st.column_config.NumberColumn("Thời Gian Chạy", format="%.2f s"),
                "message": st.column_config.TextColumn("Chi Tiết", width="large"),
                "started_at": st.column_config.DatetimeColumn("Khởi Chạy", format="YYYY-MM-DD HH:mm:ss"),
            },
            hide_index=True,
            use_container_width=True,
        )
