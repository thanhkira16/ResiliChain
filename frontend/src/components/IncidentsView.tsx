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
  MapPinned,
  Building2,
  Activity,
  Zap,
} from "lucide-react";

interface IncidentsViewProps {
  incidents: Incident[];
  highRiskOrders: PurchaseOrder[];
  supplierRisks: Array<{
    supplierId: string;
    supplierName: string;
    porsScore: number | string;
    riskLevel: string;
    statusLabel: string;
  }>;
  onTriggerAgent2: (incident: Incident) => void;
  onNavigateToRfq: (incidentId: string) => void;
  onNavigateToApprovals: (incidentId: string) => void;
  onOpenConfig: () => void;
  onRunRiskScan: () => void;
  isScanning: boolean;
  userRole: UserRole;
  onViewOnMap?: (poNumber: string) => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  highRiskOrders,
  supplierRisks,
  onTriggerAgent2,
  onNavigateToRfq,
  onNavigateToApprovals,
  onOpenConfig,
  onRunRiskScan,
  isScanning,
  userRole,
  onViewOnMap,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-2xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-red-400" />
            Giám Sát Rủi Ro Trễ Hạn & Quản Lý Sự Cố (Master Risk Engine)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Agent 6 (Master Orchestrator) tự động quét POs, tính toán <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">delayRiskScore</code> từ thời tiết Open-Meteo, tài chính FMP và tin tức GDELT. Khi rủi ro &gt; 65/100, hệ thống tự động kích hoạt PuLP MILP Solver sinh phương án thay thế.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Đang Quét POs..." : "Quét Rủi Ro Ngay (just scan)"}</span>
          </button>

          <button
            onClick={onOpenConfig}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            Cấu Hình Ngưỡng
          </button>
        </div>
      </div>

      {/* Supplier PORS Risk Telemetry Cards */}
      {supplierRisks.length > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />
                Phân Tích Chỉ Số Rủi Ro Nhà Cung Cấp (PORS Score Telemetry)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Kết quả tổng hợp từ GDELT News, FMP Altman Z-Score & Điểm uy tín lịch sử</p>
            </div>
            <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-slate-950 text-cyan-400 border border-slate-800">
              {supplierRisks.length} Nhà Cung Cấp
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplierRisks.map((risk) => {
              const pors = Number(risk.porsScore);
              const isHigh = pors >= 50 || String(risk.riskLevel).toUpperCase() === "HIGH";

              return (
                <div
                  key={risk.supplierId}
                  className={`bg-slate-950/80 border p-4 rounded-xl space-y-3 ${
                    isHigh ? "border-red-800/80 shadow-lg shadow-red-950/40" : "border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{risk.supplierName}</h4>
                      <span className="font-mono text-[10px] text-cyan-400">{risk.supplierId}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isHigh ? "bg-red-950 text-red-400 border border-red-800" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      }`}
                    >
                      {risk.riskLevel}
                    </span>
                  </div>

                  <div className="flex items-end justify-between pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Điểm PORS Score</span>
                      <div className={`text-2xl font-bold font-mono ${isHigh ? "text-red-400" : "text-emerald-400"}`}>
                        {pors.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/100</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500 block text-[10px]">Trạng thái AI</span>
                      <span className="font-semibold text-slate-300">{risk.statusLabel || "Đã phân tích"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incidents Main Table */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Danh Sách Sự Cố Phát Hiện Bởi AI Worker ({incidents.length} Bản Ghi)
          </h3>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Hệ Thống An Toàn — Không Có Sự Cố Trễ Hạn!</h4>
            <p className="text-xs max-w-md mx-auto">Tất cả các đơn hàng PO linh kiện EV hiện tại đều ở mức điểm rủi ro an toàn (&lt; 65/100).</p>
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-xl space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-red-950 text-red-400 border border-red-800">
                      {inc.id}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Đơn Hàng {inc.poNumber} — SKU: {inc.sku}
                      </h4>
                      <p className="text-xs text-slate-400">Nhà Cung Cấp: {inc.supplierName || "N/A"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Delay Risk Score</span>
                      <span className="text-lg font-bold font-mono text-red-400">
                        {inc.delayRiskScore || 66.3}/100
                      </span>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800">
                      {inc.status || "PENDING_APPROVAL"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Tóm Tắt Sự Cố</span>
                    <span className="text-slate-300 font-medium">{inc.summary || "Trễ hạn giao hàng do thời tiết & rủi ro tài chính NCC."}</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Dự Báo Trễ Thời Tiết</span>
                    <span className="text-amber-300 font-mono font-bold">+{inc.weatherDelayForecast || 3} Ngày (Open-Meteo API)</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Phương Án Thay Thế PuLP MILP</span>
                    <span className="text-cyan-400 font-bold">Đã sinh Top 1, 2, 3 Proposals</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  {onViewOnMap && (
                    <button
                      onClick={() => onViewOnMap(inc.poNumber)}
                      className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1.5"
                    >
                      <MapPinned className="w-4 h-4 text-cyan-400" /> Xem Tuyến Vận Vận Trên Bản Đồ 3D Cesium
                    </button>
                  )}

                  <button
                    onClick={() => onNavigateToApprovals(inc.id)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    <Sparkles className="w-4 h-4" /> Xem & Duyệt Phương Án 1-Click
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
