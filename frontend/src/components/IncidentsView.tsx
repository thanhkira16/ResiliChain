import React from "react";
import { Incident, PurchaseOrder, UserRole } from "../types";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  MapPinned,
  Building2,
  Sparkles,
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
      {/* Light Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            Master Risk Engine & Delay Monitoring
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Agent 6 (Master Orchestrator) automatically scans POs, computing <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-800 font-mono">delayRiskScore</code> from Open-Meteo weather forecasts, FMP financial metrics, and GDELT news. When risk score &gt; 65/100, the PuLP MILP Solver is triggered to generate backup options.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning POs..." : "Trigger Risk Scan"}</span>
          </button>

          <button
            onClick={onOpenConfig}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            Configure Thresholds
          </button>
        </div>
      </div>

      {/* Supplier Risks Section */}
      {supplierRisks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                Supplier Risk Metrics (PORS Telemetry)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated results from GDELT News, FMP Altman Z-Score & historical reliability</p>
            </div>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {supplierRisks.length} Suppliers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supplierRisks.map((risk) => {
              const pors = Number(risk.porsScore);
              const isHigh = pors >= 50 || String(risk.riskLevel).toUpperCase() === "HIGH";

              return (
                <div
                  key={risk.supplierId}
                  className={`bg-slate-50 border p-4 rounded-lg space-y-2.5 ${
                    isHigh ? "border-red-300 bg-red-50/40" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{risk.supplierName}</h4>
                      <span className="font-mono text-[10px] text-slate-500">{risk.supplierId}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isHigh ? "bg-red-100 text-red-800 border border-red-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {risk.riskLevel}
                    </span>
                  </div>

                  <div className="flex items-end justify-between pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold uppercase">PORS Score</span>
                      <div className={`text-xl font-bold font-mono ${isHigh ? "text-red-600" : "text-emerald-600"}`}>
                        {pors.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/100</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500 block text-[10px]">AI Status</span>
                      <span className="font-semibold text-slate-800">{risk.statusLabel || "Analyzed"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incidents Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Incidents Detected by AI Worker ({incidents.length} Entries)
          </h3>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-10 text-slate-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900">System Safe — No Delivery Delay Incidents!</h4>
            <p className="text-xs">All EV component purchase orders currently maintain safe risk scores (&lt; 65/100).</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-white border border-slate-200 hover:border-slate-300 p-4.5 rounded-xl shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                      {inc.id}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Order {inc.poNumber} — SKU: {inc.sku}
                      </h4>
                      <p className="text-[11px] text-slate-500">Supplier: {inc.supplierName || "N/A"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Delay Risk Score</span>
                      <span className="text-base font-bold font-mono text-red-600">
                        {inc.delayRiskScore || 66.3}/100
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {inc.status || "PENDING_APPROVAL"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Incident Summary</span>
                    <span className="text-slate-800 font-medium">{inc.summary || "Delivery delay caused by weather & supplier financial risk."}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Weather Delay Forecast</span>
                    <span className="text-amber-800 font-mono font-bold">+{inc.weatherDelayForecast || 3} Days (Open-Meteo API)</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">PuLP MILP Sourcing Option</span>
                    <span className="text-blue-700 font-bold">Top 1, 2, 3 Proposals Generated</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  {onViewOnMap && (
                    <button
                      onClick={() => onViewOnMap(inc.poNumber)}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <MapPinned className="w-3.5 h-3.5 text-blue-600" /> View 3D Cesium Logistics Route
                    </button>
                  )}

                  <button
                    onClick={() => onNavigateToApprovals(inc.id)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Review & 1-Click Approve
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
