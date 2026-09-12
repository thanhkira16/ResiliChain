import React from "react";
import {
  PurchaseOrder,
  Incident,
  SourcingProposal,
  InventoryItem,
  Supplier,
  UserRole,
} from "../types";
import {
  ShieldAlert,
  Clock,
  TrendingUp,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Layers,
  ArrowRight,
  Package,
  Activity,
  RefreshCw,
  Zap,
  Building2,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface DashboardViewProps {
  orders: PurchaseOrder[];
  incidents: Incident[];
  proposals: SourcingProposal[];
  inventory: InventoryItem[];
  suppliers: Supplier[];
  supplierRisks?: Array<{
    supplierId: string;
    supplierName: string;
    porsScore: number | string;
    riskLevel: string;
    statusLabel: string;
  }>;
  userRole: UserRole;
  onNavigate: (tab: string) => void;
  onRunRiskScan: () => void;
  isScanning: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  incidents,
  proposals,
  inventory,
  suppliers,
  supplierRisks = [],
  userRole,
  onNavigate,
  onRunRiskScan,
  isScanning,
}) => {
  const activeOrders = orders.filter((o) => o.status !== "Completed");
  const urgentOrders = orders.filter(
    (o) => o.status === "Delayed" || o.status === "In Transit"
  );
  const scoredOrders = orders.filter((o) => o.currentRiskScore !== undefined && o.currentRiskScore !== null);
  const openIncidents = incidents.filter((i) => i.status !== "Resolved");
  const pendingProposals = proposals.filter((p) => p.status === "Pending Approval" || p.status === "Pending");
  const highRiskSuppliers = supplierRisks.filter(
    (r) => Number(r.porsScore) >= 50 || String(r.riskLevel).toUpperCase() === "HIGH"
  );

  const completedOrders = orders.filter((o) => o.status === "Completed");
  const onTimeCompleted = completedOrders.filter((o) => {
    const promised = new Date(o.promisedDeliveryDate).getTime();
    const actual = new Date(o.actualOrExpectedDeliveryDate).getTime();
    return actual <= promised;
  });
  const currentOnTimeRate =
    completedOrders.length > 0
      ? Math.round((onTimeCompleted.length / completedOrders.length) * 100)
      : 88;

  const trendData = [
    { name: "Week 1", riskScore: 24, onTimeRate: 94 },
    { name: "Week 2", riskScore: 32, onTimeRate: 91 },
    { name: "Week 3", riskScore: 48, onTimeRate: 85 },
    { name: "Week 4", riskScore: 38, onTimeRate: 89 },
    { name: "Week 5 (Live)", riskScore: Math.round(orders.reduce((acc, o) => acc + (o.currentRiskScore || 0), 0) / (orders.length || 1)), onTimeRate: currentOnTimeRate },
  ];

  return (
    <div className="space-y-6">
      {/* Light Minimalist Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <Zap className="w-3 h-3 mr-1 text-slate-900" />
              Live Telemetry System
            </span>
            <span className="text-xs text-slate-500 font-mono">ResiliChain v2.0</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2 flex items-center gap-3">
            EV Supply Chain Command Operations Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            3D Digital Twin Monitoring, Multi-source Risk Analytics with 6 AI Agents & MILP Sourcing Optimization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning AI..." : "Trigger AI Risk Scan"}
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Open Orders</span>
            <FileText className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{activeOrders.length}</div>
          <div className="text-[11px] text-slate-500">POs processing & in transit</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Scanned POs</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600">{scoredOrders.length}</div>
          <div className="text-[11px] text-slate-500">Evaluated by AI Worker</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600">{openIncidents.length}</div>
          <div className="text-[11px] text-slate-500">Delay risk score &gt; 65/100</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Pending Approvals</span>
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600">{pendingProposals.length}</div>
          <div className="text-[11px] text-slate-500">Awaiting 1-Click approval</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>High Risk Suppliers</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{highRiskSuppliers.length}</div>
          <div className="text-[11px] text-slate-500">PORS &ge; 50 or HIGH</div>
        </div>
      </div>

      {/* Main Charts & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-700" />
                On-Time Delivery Rate & Average Risk Score Trends
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Tracking weekly PO delay risk fluctuations across batches</p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">Live Metric</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "8px", color: "#0f172a" }} />
                <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "11px" }} />
                <Line type="monotone" dataKey="onTimeRate" name="On-Time Rate (%)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="riskScore" name="Risk Score (PORS)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-4 h-4 text-slate-700" />
            6 AI Agents System Health
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Agent 1: DB Ingestion</span>
              <span className="text-emerald-700 font-mono font-semibold">Active</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Agent 2: GDELT News</span>
              <span className="text-emerald-700 font-mono font-semibold">GDELT v2</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Agent 3: FMP Financial</span>
              <span className="text-emerald-700 font-mono font-semibold">Altman Z-Score</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Agent 5: PuLP MILP Solver</span>
              <span className="text-blue-700 font-mono font-semibold">Top 3 Optimization</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-900">Agent 6: Master Orchestrator</span>
              <span className="text-indigo-700 font-mono font-semibold">Telegram Alert</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate("approvals")}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            Go to 1-Click Approvals <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Open Incidents Table */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Urgent Delivery Delay Incidents Requiring Action ({openIncidents.length})
          </h3>
          <button onClick={() => onNavigate("incidents")} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">
            View All <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {openIncidents.length === 0 ? (
          <div className="text-center py-8 text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-900">No Critical Incidents Detected!</p>
            <p className="text-[11px]">All EV component purchase orders are moving according to promised schedules.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">PO / Incident ID</th>
                  <th className="p-3">Component SKU</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Risk Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {openIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">{inc.poNumber}</td>
                    <td className="p-3 font-semibold text-slate-900">{inc.sku}</td>
                    <td className="p-3">{inc.supplierName || "N/A"}</td>
                    <td className="p-3 font-mono font-bold text-red-600">{inc.delayRiskScore || 66.3}/100</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        {inc.status || "Pending Approval"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigate("approvals")}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs transition-colors"
                      >
                        Approve Proposal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
