"""Script quet toan bo Database va phat tat ca canh bao rui ro qua Telegram Bot."""

from __future__ import annotations

import sys
from pathlib import Path

# Fix sys.path to root of ai package
root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir))

from src.core.config import settings
from src.database import db_client as db
from src.integrations.telegram import telegram_client


def dispatch_all_alerts():
    print("==================================================")
    print("🔍 BẮT ĐẦU KIỂM TRA DATABASE VÀ GỬI TELEGRAM ALERTS")
    print("==================================================")

    # 1. Quet va gui rui ro nha cung cap (Supplier PORS Risk >= 50 hoặc CAO/HIGH)
    print("\n[1/2] Đang kiểm tra rủi ro Nhà cung cấp (Supplier Risk)...")
    suppliers = {s.id: s for s in db.fetch_suppliers()}
    risk_records = db.fetch_all_supplier_risk()
    high_risk_suppliers = [
        r for r in risk_records
        if float(r.pors_score) >= 50.0 or (r.risk_level and str(r.risk_level).upper() in ("HIGH", "CAO"))
    ]

    print(f"-> Tìm thấy {len(high_risk_suppliers)} nhà cung cấp có rủi ro cao/trung bình cao.")
    for r in high_risk_suppliers:
        supplier = suppliers.get(r.supplier_id)
        supplier_name = supplier.name if supplier else r.supplier_id
        level_str = r.risk_level.value if hasattr(r.risk_level, "value") else str(r.risk_level)
        print(f"  📤 Gửi alert NCC: {supplier_name} ({r.supplier_id}) - PORS: {r.pors_score:.1f} - {level_str}")
        success = telegram_client.send_supplier_risk_alert(
            supplier_id=r.supplier_id,
            supplier_name=supplier_name,
            pors_score=float(r.pors_score),
            risk_level=level_str,
            status_label=r.status_label or "Cần theo dõi",
        )
        print(f"     Kết quả Telegram: {'✅ Thành công' if success else '❌ Thất bại'}")

    # 2. Quet va gui rui ro don hang (PO Delay Risk >= 35)
    print("\n[2/2] Đang kiểm tra rủi ro Đơn hàng (Purchase Order Delay Risk)...")
    orders = db.fetch_open_purchase_orders()
    high_risk_orders = [o for o in orders if float(o.current_risk_score or 0) >= 35.0]

    print(f"-> Tìm thấy {len(high_risk_orders)} đơn hàng có điểm rủi ro >= 35/100.")
    for o in high_risk_orders:
        score = float(o.current_risk_score or 0)
        summary = o.notes or f"Đơn hàng {o.po_number} ({o.sku_name}) có điểm rủi ro trễ hẹn {score:.1f}/100."
        print(f"  📤 Gửi alert PO: {o.po_number} ({o.sku_name}) - Supplier: {o.supplier_name} - Score: {score:.1f}")
        success = telegram_client.send_order_risk_alert(
            po_number=o.po_number,
            sku=o.sku,
            sku_name=o.sku_name,
            supplier_name=o.supplier_name,
            delay_risk_score=score,
            summary=summary,
            incident_id=f"INC-{o.po_number}",
        )
        print(f"     Kết quả Telegram: {'✅ Thành công' if success else '❌ Thất bại'}")

    print("\n==================================================")
    print("✨ ĐÃ HOÀN TẤT PHÁT TOÀN BỘ CẢNH BÁO QUA TELEGRAM BOT!")
    print("==================================================")


if __name__ == "__main__":
    dispatch_all_alerts()
