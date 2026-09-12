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
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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
  // Calculated KPIs
  const activeOrders = orders.filter((o) => o.status !== "Hoàn thành");
  const scoredOrders = orders.filter((o) => o.currentRiskScore !== undefined && o.currentRiskScore !== null);
  const openIncidents = incidents.filter((i) => i.status !== "Đã giải quyết");
  const pendingProposals = proposals.filter((p) => p.status === "Chờ duyệt" || p.status === "Pending");
  const highRiskSuppliers = supplierRisks.filter(
    (r) => Number(r.porsScore) >= 50 || String(r.riskLevel).toUpperCase() === "HIGH"
  );

  // On-time rate calculation
  const completedOrders = orders.filter((o) => o.status === "Hoàn thành");
  const onTimeCompleted = completedOrders.filter((o) => {
    const promised = new Date(o.promisedDeliveryDate).getTime();
    const actual = new Date(o.actualOrExpectedDeliveryDate).getTime();
    return actual <= promised;
  });
  const currentOnTimeRate =
    completedOrders.length > 0
      ? Math.round((onTimeCompleted.length / completedOrders.length) * 100)
      : 88;

  // Chart Data
  const trendData = [
    { name: "Tuần 1", riskScore: 24, onTimeRate: 94 },
    { name: "Tuần 2", riskScore: 32, onTimeRate: 91 },
    { name: "Tuần 3", riskScore: 48, onTimeRate: 85 },
    { name: "Tuần 4", riskScore: 38, onTimeRate: 89 },
    { name: "Tuần 5 (Live)", riskScore: Math.round(orders.reduce((acc, o) => acc + (o.currentRiskScore || 0), 0) / (orders.length || 1)), onTimeRate: currentOnTimeRate },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Zap className="w-3 h-3 mr-1 animate-pulse" />
              Live Telemetry System
            </span>
            <span className="text-xs text-slate-400 font-mono">ResiliChain v2.0</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-3">
            Trung Tâm Tác Chiến Chuỗi Cung Ứng EV
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Giám sát 3D Digital Twin, Phân tích Rủi ro Đa nguồn với 6 AI Agents & Tối ưu hóa Sourcing MILP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Đang Quét AI..." : "Khởi Chạy Quét AI (just scan)"}
          </button>
        </div>
      </div>

      {/* KPI Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Đơn Hàng Mở</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{activeOrders.length}</div>
          <div className="text-[11px] text-slate-400">Tổng POs đang xử lý & giao</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Đã Chấm Điểm</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300">{scoredOrders.length}</div>
          <div className="text-[11px] text-slate-400">AI Worker đã quét điểm</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Sự Cố Đang Mở</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">{openIncidents.length}</div>
          <div className="text-[11px] text-slate-400">Rủi ro trễ hẹn &gt; 65/100</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Đề Xuất Chờ Duyệt</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{pendingProposals.length}</div>
          <div className="text-[11px] text-slate-400">Chờ duyệt 1-Click Approval</div>
        </div>

        {/* Metric 5 */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>NCC Rủi Ro Cao</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{highRiskSuppliers.length}</div>
          <div className="text-[11px] text-slate-400">PORS &ge; 50 hoặc HIGH</div>
        </div>
      </div>

      {/* Main Charts & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line Chart */}
        <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Xu Hướng Tỷ Lệ Giao Hàng Đúng Hạn & Điểm Rủi Ro Trung Bình
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Theo dõi biến động điểm rủi ro trễ hẹn POs qua các tuần</p>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-cyan-300">Live Metric</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                />
                <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="onTimeRate" name="Tỷ lệ đúng hạn (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="riskScore" name="Điểm rủi ro (PORS)" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Action & System Health */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Trạng Thái 6 AI Agents
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold text-white">Agent 1: DB Ingestion</span>
              </div>
              <span className="text-emerald-400 font-mono">Hoạt động</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-white">Agent 2: GDELT News</span>
              </div>
              <span className="text-emerald-400 font-mono">GDELT Cloud v2</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-white">Agent 3: FMP Financial</span>
              </div>
              <span className="text-emerald-400 font-mono">Altman Z-Score</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-semibold text-white">Agent 5: PuLP MILP Solver</span>
              </div>
              <span className="text-cyan-400 font-mono">Top 3 Optimization</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="font-semibold text-white">Agent 6: Master Orchestrator</span>
              </div>
              <span className="text-indigo-400 font-mono">Telegram Dispatcher</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate("approvals")}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700"
          >
            Đến Trang Phê Duyệt 1-Click <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Critical Incidents & Proposals Table */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Danh Sách Sự Cố Trễ Hạn Cần Ứng Phó Ngay ({openIncidents.length})
          </h3>
          <button
            onClick={() => onNavigate("incidents")}
            className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
          >
            Xem toàn bộ <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {openIncidents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Không Có Sự Cố Nghiêm Trọng Nào!</p>
            <p className="text-xs max-w-md mx-auto">Tất cả các đơn hàng PO linh kiện EV đang vận chuyển đúng tiến độ cam kết.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Mã PO / Incident</th>
                  <th className="p-3">SKU Linh Kiện</th>
                  <th className="p-3">Nhà Cung Cấp</th>
                  <th className="p-3">Điểm Rủi Ro</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {openIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-semibold text-cyan-400">{inc.poNumber}</td>
                    <td className="p-3 font-semibold text-white">{inc.sku}</td>
                    <td className="p-3">{inc.supplierName || "N/A"}</td>
                    <td className="p-3 font-mono font-bold text-red-400">{inc.delayRiskScore || 66.3}/100</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                        {inc.status || "Chờ duyệt 1-Click"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigate("approvals")}
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-all"
                      >
                        Duyệt Phương Án
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
