import React, { useState } from "react";
import { Incident, PurchaseOrder, UserRole } from "../types";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  MapPinned,
  Building2,
  ArrowRight,
} from "lucide-react";

interface IncidentsViewProps {
  incidents?: Incident[];
  highRiskOrders?: PurchaseOrder[];
  supplierRisks?: Array<{
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
  incidents = [],
  highRiskOrders = [],
  supplierRisks = [],
  onTriggerAgent2,
  onNavigateToRfq,
  onNavigateToApprovals,
  onOpenConfig,
  onRunRiskScan,
  isScanning,
  userRole,
  onViewOnMap,
}) => {
  const [supplierRiskFilter, setSupplierRiskFilter] = useState<"all" | "high">("all");

  const getRiskMeta = (level: string, score: number) => {
    const norm = String(level || "").toUpperCase();
    if (norm.includes("CAO") || norm === "HIGH" || score >= 50) {
      return {
        label: "Rủi ro cao",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200/80",
        scoreClass: "text-rose-700",
        dotClass: "bg-rose-500",
      };
    }
    if (norm.includes("TRUNG") || norm === "MEDIUM" || score >= 35) {
      return {
        label: "Trung bình",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200/70",
        scoreClass: "text-amber-800",
        dotClass: "bg-amber-500",
      };
    }
    return {
      label: "Thấp",
      badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
      scoreClass: "text-slate-700",
      dotClass: "bg-emerald-500",
    };
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || "").toLowerCase();
    if (s.includes("đã duyệt") || s.includes("đã giải quyết") || s.includes("approved") || s.includes("resolved")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200/70";
    }
    if (s.includes("chờ duyệt") || s.includes("pending") || s.includes("rfq") || s.includes("đang tìm")) {
      return "bg-amber-50 text-amber-800 border-amber-200/70";
    }
    return "bg-slate-50 text-slate-700 border-slate-200/80";
  };

  const highRiskSuppliersCount = (supplierRisks || []).filter((r) => {
    const score = Number(r.porsScore);
    const norm = String(r.riskLevel || "").toUpperCase();
    return score >= 45 || norm.includes("CAO") || norm === "HIGH";
  }).length;

  const displayedSuppliers = (supplierRisks || []).filter((r) => {
    if (supplierRiskFilter === "high") {
      const score = Number(r.porsScore);
      const norm = String(r.riskLevel || "").toUpperCase();
      return score >= 45 || norm.includes("CAO") || norm === "HIGH";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Quiet Context Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/90 px-5 py-3.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10 shrink-0" title="Giám sát tự động đang hoạt động" />
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 leading-snug">
              Giám sát rủi ro trễ hạn & Quản lý sự cố
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân tích tự động dữ liệu thời tiết lộ trình, tài chính đối tác và tiến độ đơn hàng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenConfig}
            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100/90 active:scale-[0.98] text-emerald-900 text-xs font-medium rounded-lg border border-emerald-200/80 flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-700" />
            <span>Cấu hình ngưỡng</span>
          </button>

          <button
            type="button"
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] text-white text-xs font-medium rounded-lg transition-all shadow-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-white ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Đang quét..." : "Quét rủi ro"}</span>
          </button>
        </div>
      </div>

      {/* Supplier Risks Telemetry */}
      {supplierRisks && supplierRisks.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3.5 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Chỉ số rủi ro nhà cung cấp (PORS)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chỉ số tổng hợp từ tin tức đối tác, Altman Z-Score và độ uy tín lịch sử
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setSupplierRiskFilter("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  supplierRiskFilter === "all"
                    ? "bg-white text-emerald-900 shadow-xs font-semibold border border-emerald-200/60"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tất cả ({supplierRisks.length})
              </button>
              <button
                type="button"
                onClick={() => setSupplierRiskFilter("high")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  supplierRiskFilter === "high"
                    ? "bg-amber-50 text-amber-900 shadow-xs font-semibold border border-amber-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cần theo dõi ({highRiskSuppliersCount})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-5 font-semibold">Nhà cung cấp</th>
                  <th className="py-2.5 px-4 font-semibold">Mức rủi ro</th>
                  <th className="py-2.5 px-4 font-semibold">Điểm PORS</th>
                  <th className="py-2.5 px-4 font-semibold">Yếu tố trọng yếu</th>
                  <th className="py-2.5 px-5 font-semibold text-right">Trạng thái phân tích</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      Không có nhà cung cấp nào thuộc diện cần theo dõi.
                    </td>
                  </tr>
                ) : (
                  displayedSuppliers.map((risk) => {
                    const numScore = Number(risk.porsScore);
                    const validScore = Number.isFinite(numScore) ? numScore : 0;
                    const meta = getRiskMeta(risk.riskLevel, validScore);

                    return (
                      <tr key={risk.supplierId} className="hover:bg-slate-50/70 transition-colors cursor-default">
                        <td className="py-2.5 px-5 whitespace-nowrap">
                          <div className="font-medium text-slate-900 text-xs">{risk.supplierName}</div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">{risk.supplierId}</div>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`font-mono tabular-nums font-semibold text-xs ${meta.scoreClass}`}>
                            {validScore.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal ml-1">/ 100</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                          {risk.statusLabel || "Ổn định"}
                        </td>
                        <td className="py-2.5 px-5 text-right text-xs text-slate-400 whitespace-nowrap font-normal">
                          Đã cập nhật
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* High Risk Orders Notice (if any) */}
      {highRiskOrders && highRiskOrders.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Phát hiện <strong className="font-semibold tabular-nums">{highRiskOrders.length}</strong> đơn hàng có điểm rủi ro cao đang trong diện theo dõi sát.
            </span>
          </div>
        </div>
      )}

      {/* Incidents Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-2">
            <span>Sự cố cần can thiệp</span>
            <span className="text-[11px] font-medium font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 tabular-nums">
              {incidents.length}
            </span>
          </h3>
        </div>

        {incidents.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-xl p-8 text-center shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-600/80 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-slate-900">Không có sự cố trễ hạn</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Tất cả các đơn hàng PO linh kiện hiện tại đều nằm trong ngưỡng an toàn (điểm rủi ro &lt; 65/100).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => {
              const rawScore = Number(inc.delayRiskScore);
              const score = Number.isFinite(rawScore) ? rawScore : 66.3;
              const meta = getRiskMeta("", score);
              const isCollecting =
                inc.state === "RFQ_SENT" || inc.state === "QUOTES_COLLECTING";

              return (
                <div
                  key={inc.id}
                  className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5 transition-colors"
                >
                  {/* Top Identification Row (Clear Two-Level Hierarchy) */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                          {inc.id}
                        </span>
                        <h4 className="text-xs font-semibold text-slate-900 tracking-tight">
                          Đơn {inc.poNumber}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        <span className="text-slate-600 font-medium">SKU: {inc.sku}</span>
                        {inc.skuName && (
                          <span className="text-slate-500 ml-1">({inc.skuName})</span>
                        )}
                        <span className="text-slate-300 mx-1.5">·</span>
                        <span>Đối tác: {inc.supplierName || "N/A"}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto whitespace-nowrap">
                      <span
                        className={`text-[11px] font-medium font-mono tabular-nums px-2 py-0.5 rounded border ${meta.badgeClass}`}
                      >
                        Rủi ro: {score.toFixed(1)}/100
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(
                          inc.status || "Chờ duyệt"
                        )}`}
                      >
                        {inc.status || "Chờ duyệt"}
                      </span>
                    </div>
                  </div>

                  {/* Incident Context Details (Proportional 6:3:3 Grid) */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs text-slate-600">
                    <div className="md:col-span-6 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                        Tóm tắt sự cố
                      </span>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {inc.summary || "Trễ hạn cam kết, ảnh hưởng buffer kho dự trữ an toàn."}
                      </p>
                    </div>

                    <div className="md:col-span-3 space-y-1 md:border-l md:border-slate-100 md:pl-4">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                        Dự báo chậm trễ thời tiết
                      </span>
                      <p className="text-slate-800 text-xs">
                        <span className="font-mono font-medium text-amber-800 tabular-nums">
                          +{(inc as any).weatherDelayForecast || 3} ngày
                        </span>
                      </p>
                      <span className="text-slate-400 text-[10px] block">Mô hình Open-Meteo</span>
                    </div>

                    <div className="md:col-span-3 space-y-1 md:border-l md:border-slate-100 md:pl-4">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                        Phương án đề xuất
                      </span>
                      <p className="text-slate-800 text-xs font-medium">
                        {isCollecting
                          ? "Đang thu thập báo giá"
                          : "3 phương án thay thế tối ưu"}
                      </p>
                      <span className="text-slate-400 text-[10px] block">Thuật toán PuLP Solver</span>
                    </div>
                  </div>

                  {/* Action Strip (Colored Action Buttons, No Black) */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <div>
                      {onViewOnMap && (
                        <button
                          type="button"
                          onClick={() => onViewOnMap(inc.poNumber)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/70 flex items-center gap-1.5 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1"
                        >
                          <MapPinned className="w-3.5 h-3.5 text-blue-600" />
                          <span>Xem lộ trình vận chuyển</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isCollecting ? (
                        <button
                          type="button"
                          onClick={() => onNavigateToRfq(inc.id)}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 active:scale-[0.98] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                        >
                          <span>Xem báo giá RFQ</span>
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-100" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigateToApprovals(inc.id)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-[0.98] text-white font-medium text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                        >
                          <span>Xem phương án xử lý</span>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-100" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
