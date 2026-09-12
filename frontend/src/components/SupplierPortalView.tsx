import React, { useState } from "react";
import { RFQItem, Supplier, UserRole } from "../types";
import {
  Building2,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react";

interface SupplierPortalViewProps {
  rfqs: RFQItem[];
  suppliers: Supplier[];
  activeSupplierId: string;
  setActiveSupplierId: (id: string) => void;
  onSubmitQuote: (
    rfqId: string,
    quote: {
      unitPrice: number;
      proposedLeadTimeDays: number;
      proposedDeliveryDate: string;
      notes: string;
    }
  ) => void;
  userRole: UserRole;
}

export const SupplierPortalView: React.FC<SupplierPortalViewProps> = ({
  rfqs,
  suppliers,
  activeSupplierId,
  setActiveSupplierId,
  onSubmitQuote,
  userRole,
}) => {
  const currentSupplier =
    suppliers.find((s) => s.id === activeSupplierId) || suppliers[0];

  // Filter RFQs assigned to this supplier
  const supplierRfqs = rfqs.filter(
    (r) => r.backupSupplierId === currentSupplier?.id
  );

  const [activeRfqId, setActiveRfqId] = useState<string | null>(
    supplierRfqs[0]?.id || null
  );

  const selectedRfq = supplierRfqs.find((r) => r.id === activeRfqId);

  const [unitPrice, setUnitPrice] = useState<number>(2450000);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(
    currentSupplier?.averageLeadTimeDays || 5
  );
  const [deliveryDate, setDeliveryDate] = useState<string>("2026-09-18");
  const [quoteNotes, setQuoteNotes] = useState<string>(
    "Cam kết đạt chuẩn OEM xe đạp, kiểm định xuất xưởng 100%, bảo hành 12 tháng."
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSelectRfq = (rfq: RFQItem) => {
    setActiveRfqId(rfq.id);
    setSuccessMsg(null);
    if (rfq.response) {
      setUnitPrice(rfq.response.unitPrice);
      setLeadTimeDays(rfq.response.proposedLeadTimeDays);
      setDeliveryDate(rfq.response.proposedDeliveryDate);
      setQuoteNotes(rfq.response.notes);
    } else {
      const hist = currentSupplier?.historicalPrice[rfq.sku] || 2400000;
      setUnitPrice(hist);
      setLeadTimeDays(currentSupplier?.averageLeadTimeDays || 6);
      setDeliveryDate(rfq.targetDeliveryDate);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfq) return;
    setIsSubmitting(true);

    onSubmitQuote(selectedRfq.id, {
      unitPrice: Number(unitPrice),
      proposedLeadTimeDays: Number(leadTimeDays),
      proposedDeliveryDate: deliveryDate,
      notes: quoteNotes,
    });

    setIsSubmitting(false);
    setSuccessMsg(
      `Đã gửi báo giá thành công cho RFQ ${selectedRfq.id}! Agent 2 đã nhận dữ liệu để tiến hành xếp hạng.`
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-purple-900 text-white p-5 rounded-xl border border-purple-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-300" />
            <h3 className="text-base font-bold text-white">
              CỔNG TỰ PHỤC VỤ DÀNH CHO NHÀ CUNG CẤP (Supplier Self-Service Portal)
            </h3>
          </div>
          <p className="text-xs text-purple-200 mt-1">
            Nhận yêu cầu báo giá khẩn cấp (RFQ) từ BikeSync AI, điền đơn giá và cam kết tiến độ giao hàng để tham gia quy trình đấu thầu tự động.
          </p>
        </div>

        {/* Switch Supplier dropdown */}
        <div className="flex items-center gap-2 bg-purple-950/80 px-3 py-2 rounded-lg border border-purple-700/60">
          <span className="text-xs text-purple-200">Đang đóng vai NCC:</span>
          <select
            id="supplier-portal-switcher"
            value={currentSupplier?.id}
            onChange={(e) => setActiveSupplierId(e.target.value)}
            className="text-xs font-bold bg-purple-800 text-white rounded px-2 py-1 border border-purple-600 focus:outline-none"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: RFQ List & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: List of RFQs sent to this supplier */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
            Yêu cầu báo giá nhận được ({supplierRfqs.length})
          </div>

          <div className="space-y-2">
            {supplierRfqs.map((rfq) => {
              const isSelected = rfq.id === selectedRfq?.id;
              const isResponded = rfq.status === "Đã phản hồi";

              return (
                <button
                  key={rfq.id}
                  id={`portal-rfq-item-${rfq.id}`}
                  onClick={() => handleSelectRfq(rfq)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-bold">{rfq.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                        isResponded
                          ? isSelected
                            ? "bg-emerald-900 text-emerald-200 border-emerald-700"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isSelected
                          ? "bg-amber-600 text-white border-amber-500"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {rfq.status}
                    </span>
                  </div>

                  <div className="text-xs font-semibold">{rfq.skuName}</div>
                  <div className={`text-[11px] mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                    Cần: {rfq.quantity} chiếc • Hạn giao: {rfq.targetDeliveryDate}
                  </div>
                </button>
              );
            })}

            {supplierRfqs.length === 0 && (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                Nhà cung cấp này chưa nhận được yêu cầu RFQ nào từ BikeSync AI.
              </div>
            )}
          </div>
        </div>

        {/* Right column: RFQ Details & Submission Form */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          {selectedRfq ? (
            <div className="space-y-5">
              <div className="pb-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    {selectedRfq.id}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mt-1.5">
                    Yêu Cầu Báo Giá: {selectedRfq.skuName} ({selectedRfq.sku})
                  </h4>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Số lượng yêu cầu: <strong>{selectedRfq.quantity} chiếc</strong> • Ngày cần trước:{" "}
                    <strong>{selectedRfq.targetDeliveryDate}</strong>
                  </div>
                </div>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    selectedRfq.status === "Đã phản hồi"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {selectedRfq.status}
                </span>
              </div>

              {/* RFQ Email Body Accordion / Preview */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Nội dung từ Phòng Mua Sắm BikeSync AI:</span>
                </div>
                <div className="font-medium text-slate-900">{selectedRfq.emailSubject}</div>
                <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed max-h-36 overflow-y-auto">
                  {selectedRfq.emailBody}
                </p>
              </div>

              {/* Quote Submission Form */}
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Biểu Mẫu Điền Báo Giá Chính Thức (Self-Service Quote Submission)
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Đơn giá đề xuất (VNĐ / chiếc) *
                    </label>
                    <div className="relative">
                      <input
                        id="input-quote-price"
                        type="number"
                        required
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(Number(e.target.value))}
                        className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        đ
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Tổng giá trị hợp đồng:{" "}
                      <strong className="text-slate-900">
                        {Number(unitPrice * selectedRfq.quantity).toLocaleString("vi-VN")} đ
                      </strong>
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Thời gian hoàn thành (Lead time ngày) *
                    </label>
                    <input
                      id="input-quote-leadtime"
                      type="number"
                      required
                      min={1}
                      max={60}
                      value={leadTimeDays}
                      onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Số ngày sản xuất và vận chuyển tới kho lắp ráp
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Ngày cam kết giao hàng thực tế *
                    </label>
                    <input
                      id="input-quote-delivery-date"
                      type="date"
                      required
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Cam kết chất lượng & Ghi chú
                    </label>
                    <input
                      id="input-quote-notes"
                      type="text"
                      placeholder="VD: Kiểm định 100%, bảo hành 12 tháng..."
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    id="btn-submit-quote-portal"
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {selectedRfq.status === "Đã phản hồi"
                        ? "Cập nhật lại báo giá"
                        : "Gửi báo giá chính thức"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400">
              Chọn một RFQ ở danh sách bên trái để mở mẫu báo giá.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
