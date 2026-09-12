import React, { useState } from "react";
import { RFQItem, Incident, PurchaseOrder, Supplier, UserRole } from "../types";
import {
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
  Eye,
  FileText,
  DollarSign,
  ArrowRight,
  UserCheck,
} from "lucide-react";

interface RfqViewProps {
  rfqs: RFQItem[];
  incidents: Incident[];
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  onSimulateQuoteResponse: (rfqId: string) => void;
  onRunAiEvaluation: (incidentId: string) => void;
  isEvaluating: boolean;
  userRole: UserRole;
  onNavigateToApprovals: () => void;
}

export const RfqView: React.FC<RfqViewProps> = ({
  rfqs,
  incidents,
  orders,
  suppliers,
  onSimulateQuoteResponse,
  onRunAiEvaluation,
  isEvaluating,
  userRole,
  onNavigateToApprovals,
}) => {
  const [selectedRfq, setSelectedRfq] = useState<RFQItem | null>(null);

  // Group RFQs by Incident ID
  const groupedByIncident = incidents.map((inc) => {
    const incidentRfqs = rfqs.filter((r) => r.incidentId === inc.id);
    const respondedCount = incidentRfqs.filter((r) => r.status === "Đã phản hồi").length;
    return {
      incident: inc,
      rfqs: incidentRfqs,
      respondedCount,
      totalRfqs: incidentRfqs.length,
    };
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              AGENT 2 — Yêu Cầu Báo Giá (RFQ) & Phản Hồi Báo Giá Nhà Cung Cấp
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Agent 2 tự động lọc top 3 nhà cung cấp dự phòng cùng SKU, dùng Gemini AI soạn thảo RFQ chuyên nghiệp bằng tiếng Việt và thu thập báo giá có cấu trúc để xếp hạng.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700">Tổng RFQ đã phát hành:</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
            {rfqs.length} yêu cầu
          </span>
        </div>
      </div>

      {/* RFQ Incident Groups */}
      <div className="space-y-6">
        {groupedByIncident.map(({ incident, rfqs: incidentRfqs, respondedCount, totalRfqs }) => {
          if (totalRfqs === 0) return null;

          return (
            <div
              key={incident.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              {/* Incident Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {incident.id}
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">
                      Xử lý trễ hạn đơn {incident.poNumber} — {incident.skuName}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ({incident.correlationId})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Đã gửi RFQ đến {totalRfqs} nhà cung cấp dự phòng • Đã nhận phản hồi:{" "}
                    <strong className="text-emerald-600">{respondedCount}/{totalRfqs}</strong>
                  </div>
                </div>

                {/* Trigger AI Evaluation button */}
                <div className="flex items-center gap-2">
                  <button
                    id={`btn-evaluate-quotes-${incident.id}`}
                    onClick={() => onRunAiEvaluation(incident.id)}
                    disabled={respondedCount === 0 || isEvaluating}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                    title="Gọi Gemini AI đánh giá và xếp hạng tối đa 3 phương án"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isEvaluating ? "animate-spin" : ""}`} />
                    <span>
                      {isEvaluating
                        ? "Gemini đang phân tích..."
                        : "Xếp hạng phương án (Gemini AI)"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Grid of RFQ Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {incidentRfqs.map((rfq) => {
                  const hasResponse = Boolean(rfq.response);

                  return (
                    <div
                      key={rfq.id}
                      id={`rfq-card-${rfq.id}`}
                      className={`rounded-xl border p-4 flex flex-col justify-between text-xs transition-all ${
                        hasResponse
                          ? "bg-emerald-50/30 border-emerald-300"
                          : "bg-slate-50/50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                              {rfq.id}
                            </span>
                            <h5 className="font-bold text-slate-900 mt-1 line-clamp-1">
                              {rfq.backupSupplierName}
                            </h5>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              hasResponse
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {rfq.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-1 mb-3">
                          <div>Số lượng cần: <strong>{rfq.quantity} chiếc</strong></div>
                          <div>Hạn giao yêu cầu: <strong>{rfq.targetDeliveryDate}</strong></div>
                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>Gửi lúc: {rfq.sentAt}</span>
                          </div>
                        </div>

                        {/* Quote Response Summary if available */}
                        {rfq.response ? (
                          <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs space-y-1">
                            <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Báo giá chính thức đã nhận</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Đơn giá:</span>
                              <span className="font-bold text-slate-900">
                                {Number(rfq.response.unitPrice).toLocaleString("vi-VN")} đ
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Tổng chi phí:</span>
                              <span className="font-bold text-slate-900">
                                {Number(rfq.response.totalCost).toLocaleString("vi-VN")} đ
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Lead time:</span>
                              <span className="font-semibold text-emerald-700">
                                {rfq.response.proposedLeadTimeDays} ngày (Giao {rfq.response.proposedDeliveryDate})
                              </span>
                            </div>
                            {rfq.response.notes && (
                              <p className="text-[10px] text-slate-600 italic pt-1 border-t border-slate-100 mt-1">
                                &quot;{rfq.response.notes}&quot;
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-[11px] text-amber-800">
                            <span>Đang chờ NCC phản hồi qua Supplier Portal...</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedRfq(rfq)}
                          className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 text-[11px]"
                        >
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>Xem email RFQ</span>
                        </button>

                        {!hasResponse && (
                          <button
                            id={`btn-simulate-quote-${rfq.id}`}
                            onClick={() => onSimulateQuoteResponse(rfq.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-semibold transition-colors"
                            title="Mô phỏng nhà cung cấp bấm gửi báo giá hợp lệ"
                          >
                            Mô phỏng gửi báo giá
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {rfqs.length === 0 && (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">Chưa có RFQ nào được phát hành</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Khi Agent 1 phát hiện đơn hàng trễ có nguy cơ cao, Agent 2 sẽ tự động lọc nhà cung cấp dự phòng và sinh thư mời báo giá RFQ gửi đến đây.
            </p>
          </div>
        )}
      </div>

      {/* Modal: View Full RFQ Email */}
      {selectedRfq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {selectedRfq.id}
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-1.5">
                  Thư Yêu Cầu Báo Giá Khẩn Cấp (Soạn tự động bằng Gemini AI)
                </h4>
                <div className="text-xs text-slate-500 mt-0.5">
                  Gửi tới: <strong>{selectedRfq.backupSupplierName}</strong>
                </div>
              </div>
              <button
                onClick={() => setSelectedRfq(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Tiêu đề thư:</label>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 font-medium text-slate-900">
                  {selectedRfq.emailSubject}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Nội dung thư:</label>
                <div className="p-3 bg-slate-50 rounded border border-slate-200 whitespace-pre-line text-slate-700 leading-relaxed max-h-60 overflow-y-auto">
                  {selectedRfq.emailBody}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-0.5">Tóm tắt điều khoản:</label>
                <div className="p-2 bg-blue-50/60 rounded border border-blue-200 text-blue-900 font-medium">
                  {selectedRfq.termsSummary}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedRfq(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
