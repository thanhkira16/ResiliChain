import React from "react";
import { Incident, PurchaseOrder, UserRole } from "../types";
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Sliders,
  ExternalLink,
} from "lucide-react";

interface IncidentsViewProps {
  incidents: Incident[];
  onTriggerAgent2: (incident: Incident) => void;
  onNavigateToRfq: (incidentId: string) => void;
  onNavigateToApprovals: (incidentId: string) => void;
  onOpenConfig: () => void;
  onRunRiskScan: () => void;
  isScanning: boolean;
  userRole: UserRole;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onTriggerAgent2,
  onNavigateToRfq,
  onNavigateToApprovals,
  onOpenConfig,
  onRunRiskScan,
  isScanning,
  userRole,
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">
              AGENT 1 — Giám Sát Rủi Ro & Quản Lý Sự Cố (Risk Monitoring)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Agent 1 tự động quét tất cả đơn hàng PO mở, tính toán <code className="bg-slate-100 px-1 py-0.5 rounded text-amber-900 font-mono">delay_risk_score</code> dựa trên độ trễ cam kết, điểm tin cậy NCC và buffer an toàn tồn kho. Khi vượt ngưỡng (&gt;70), tự động sinh Incident và kích hoạt Agent 2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-scan-agent1-incidents"
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Đang quét PO..." : "Chạy kiểm tra rủi ro"}</span>
          </button>

          <button
            id="btn-config-threshold-incidents"
            onClick={onOpenConfig}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Cấu hình ngưỡng</span>
          </button>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {incidents.map((inc) => {
          const isResolved = inc.status === "Đã giải quyết";
          const isPendingApproval = inc.status === "Chờ duyệt";

          return (
            <div
              key={inc.id}
              id={`incident-card-${inc.id}`}
              className={`p-5 rounded-xl border transition-all ${
                isResolved
                  ? "bg-slate-50/70 border-slate-200"
                  : inc.delayRiskScore >= 80
                  ? "bg-white border-red-300 shadow-sm"
                  : "bg-white border-amber-300 shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      {inc.id}
                    </span>
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded" title="Correlation ID xuyên suốt luồng xử lý">
                      {inc.correlationId}
                    </span>
                    {inc.state && (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {inc.state}
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        inc.status === "Đã giải quyết"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : inc.status === "Chờ duyệt"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-2">
                    <span>Đơn hàng {inc.poNumber} — Linh kiện: {inc.skuName} ({inc.sku})</span>
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Nhà cung cấp hiện tại: <strong>{inc.supplierName}</strong> • Trễ hẹn:{" "}
                    <span className="font-bold text-red-600">{inc.delayDays} ngày</span>
                  </p>
                </div>

                {/* Delay Risk Score Meter */}
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-slate-500 font-medium">Delay Risk Score</div>
                  <div className="flex items-baseline justify-end gap-1">
                    <span
                      className={`text-2xl font-black ${
                        inc.delayRiskScore >= 80
                          ? "text-red-600"
                          : inc.delayRiskScore >= 70
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {inc.delayRiskScore}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">/100</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Ngưỡng kích hoạt: {inc.thresholdApplied}/100
                  </div>
                </div>
              </div>

              {/* Summary message */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed my-3">
                <span className="font-semibold text-slate-900">Phân tích rủi ro Agent 1: </span>
                {inc.summary}
              </div>

              {/* SRS §2.5 Risk Breakdown Explanation Panel */}
              {inc.riskBreakdown && (
                <div className="my-3 p-3 bg-amber-50/60 rounded-lg border border-amber-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Giải thích điểm rủi ro (SRS §2.5 Explainability):
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-amber-800">
                      {inc.riskBreakdown.formulaExplanation}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="p-2 bg-white rounded border border-amber-100">
                      <div className="text-[11px] text-slate-500 font-medium">1. Yếu tố Trễ hạn ({inc.riskBreakdown.w1 * 100}%)</div>
                      <div className="font-bold text-slate-800 text-xs mt-0.5">
                        {Math.round(inc.riskBreakdown.latenessFactor * 100)}%
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({inc.riskBreakdown.delayDays} ngày / {inc.riskBreakdown.committedLeadTimeDays}d lead time)
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-white rounded border border-amber-100">
                      <div className="text-[11px] text-slate-500 font-medium">2. Rủi ro NCC ({inc.riskBreakdown.w2 * 100}%)</div>
                      <div className="font-bold text-slate-800 text-xs mt-0.5">
                        {Math.round(inc.riskBreakdown.supplierReliabilityFactor * 100)}%
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          (1 - Uy tín {Math.round((1 - inc.riskBreakdown.supplierReliabilityFactor) * 100)}/100)
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-white rounded border border-amber-100">
                      <div className="text-[11px] text-slate-500 font-medium">3. Thiếu hụt kho ({inc.riskBreakdown.w3 * 100}%)</div>
                      <div className="font-bold text-slate-800 text-xs mt-0.5">
                        {Math.round(inc.riskBreakdown.inventoryBufferFactor * 100)}%
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          (Tồn {inc.riskBreakdown.currentStock} / An toàn {inc.riskBreakdown.safetyStock})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Phát hiện lúc: {inc.detectedAt}</span>
                  {inc.resolvedAt && <span>• Xong lúc: {inc.resolvedAt}</span>}
                </div>

                <div className="flex items-center gap-2">
                  {!inc.agent2Triggered ? (
                    <button
                      id={`btn-trigger-agent2-${inc.id}`}
                      onClick={() => onTriggerAgent2(inc)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Kích hoạt Agent 2 tìm nguồn thay thế</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onNavigateToRfq(inc.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors flex items-center gap-1"
                      >
                        <span>Xem RFQ đã gửi</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </button>

                      <button
                        onClick={() => onNavigateToApprovals(inc.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>Xem đề xuất HITL</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {incidents.length === 0 && (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-800">Không có sự cố rủi ro nào</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Agent 1 đang giám sát liên tục. Bạn có thể nhấn &quot;Chạy kiểm tra rủi ro&quot; hoặc cập nhật ngày giao thực tế trong tab Đơn hàng để mô phỏng sự cố trễ hẹn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
