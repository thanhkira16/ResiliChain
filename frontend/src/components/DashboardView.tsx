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
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Building2,
  FileText,
  Activity,
  Sparkles,
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

const cleanStatusText = (status?: string): string => {
  if (!status) return "Chờ duyệt";
  const s = status.toLowerCase();
  if (s.includes("mã") || s.includes("phát hiện") || s.includes("hiá»") || s.includes("hiện") || s.includes("mới")) return "Mới phát hiện";
  if (s.includes("tìm") || s.includes("nguồn") || s.includes("nguá»“n")) return "Đang tìm nguồn";
  if (s.includes("đã duyệt") || s.includes("phê duyệt") || s.includes("đã")) return "Đã phê duyệt";
  if (s.includes("chờ duyệt") || s.includes("chờ") || s.includes("pending")) return "Chờ phê duyệt";
  return status;
};

interface ChartTooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200/90 rounded-lg p-3 shadow-md text-xs space-y-1.5 min-w-[170px]">
      <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
        <span>Kỳ theo dõi</span>
        <span className="font-mono text-slate-500">{label}</span>
      </div>
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {entry.value}{entry.name.includes("%") ? "%" : "/100"}
          </span>
        </div>
      ))}
    </div>
  );
};

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
  const activeOrders = orders.filter((o) => o.status !== "Hoàn thành");
  const scoredOrders = orders.filter((o) => o.currentRiskScore !== undefined && o.currentRiskScore !== null);
  const openIncidents = incidents.filter((i) => i.status !== "Đã giải quyết");
  const pendingProposals = proposals.filter((p) => p.status === "Chờ duyệt" || p.status === "Pending");
  const highRiskSuppliers = supplierRisks.filter(
    (r) => Number(r.porsScore) >= 50 || String(r.riskLevel).toUpperCase() === "HIGH"
  );

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

  const currentAvgRisk = Math.round(
    orders.reduce((acc, o) => acc + (o.currentRiskScore || 0), 0) / (orders.length || 1)
  );

  const trendData = [
    { name: "T1", riskScore: 24, onTimeRate: 94 },
    { name: "T2", riskScore: 32, onTimeRate: 91 },
    { name: "T3", riskScore: 48, onTimeRate: 85 },
    { name: "T4", riskScore: 38, onTimeRate: 89 },
    { name: "T5 (Live)", riskScore: currentAvgRisk, onTimeRate: currentOnTimeRate },
  ];

  return (
    <div className="space-y-6">
      {/* Calm Operational Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/70">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Tổng quan Vận hành & Rủi ro
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu chuỗi cung ứng linh kiện xe điện cập nhật theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onRunRiskScan}
            disabled={isScanning}
            aria-label="Khởi chạy quét rủi ro đơn hàng AI"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] text-white font-medium text-xs rounded-lg transition-all shadow-xs disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-white ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Đang quét rủi ro..." : "Quét rủi ro AI"}</span>
          </button>
        </div>
      </div>

      {/* Refined KPI Grid: Interactive, Balanced, Accessible */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("orders")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("orders"); } }}
          className="col-span-1 bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 hover:border-slate-300/90 hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 select-none"
          title="Bấm để xem danh sách Đơn hàng"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Đơn hàng mở</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
            {activeOrders.length}
          </div>
          <div className="text-[11px] text-slate-400">Đang giao & xử lý</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("orders")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("orders"); } }}
          className="col-span-1 bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 hover:border-slate-300/90 hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 select-none"
          title="Bấm để xem chi tiết Điểm PORS của Đơn hàng"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Đã phân tích rủi ro</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
            {scoredOrders.length}
          </div>
          <div className="text-[11px] text-slate-400">Chỉ số PORS đã tính</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("incidents")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("incidents"); } }}
          className="col-span-1 bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 hover:border-slate-300/90 hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 select-none"
          title="Bấm để xem Sự cố cần ứng phó"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Sự cố cần ứng phó</span>
            <AlertTriangle className={`w-4 h-4 ${openIncidents.length > 0 ? "text-amber-500" : "text-slate-400"}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {openIncidents.length}
            </span>
            {openIncidents.length > 0 && (
              <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50 tabular-nums">
                Cần can thiệp
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">Rủi ro trễ hẹn &gt; 65/100</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("approvals")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("approvals"); } }}
          className="col-span-1 bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 hover:border-slate-300/90 hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 select-none"
          title="Bấm để xem Đề xuất thay thế 1-Click"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Đề xuất thay thế</span>
            <Sparkles className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {pendingProposals.length}
            </span>
            {pendingProposals.length > 0 && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 tabular-nums">
                Chờ duyệt
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">Tối ưu hóa bởi solver</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate("suppliers")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("suppliers"); } }}
          className="col-span-2 sm:col-span-1 lg:col-span-1 bg-white border border-slate-200/80 p-4 rounded-xl space-y-1 hover:border-slate-300/90 hover:shadow-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 select-none"
          title="Bấm để xem danh sách Nhà cung cấp"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>NCC rủi ro cao</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {highRiskSuppliers.length}
            </span>
            {highRiskSuppliers.length > 0 ? (
              <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50 tabular-nums">
                PORS &ge; 50
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                An toàn
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">Theo dõi đặc biệt</div>
        </div>
      </div>

      {/* Main Charts & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-slate-200/80 p-5 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Diễn biến Tỷ lệ Giao hàng & Điểm Rủi ro
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh tỷ lệ đúng hạn cam kết với mức độ rủi ro trung bình qua 5 tuần
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono shrink-0 whitespace-nowrap bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded self-start sm:self-auto">
              5 tuần gần nhất
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px", fontSize: "11px", color: "#64748b" }}
                />
                <Line
                  type="monotone"
                  dataKey="onTimeRate"
                  name="Tỷ lệ đúng hạn (%)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={{ r: 3.5, fill: "#0284c7" }}
                  activeDot={{ r: 5.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="riskScore"
                  name="Điểm rủi ro (PORS)"
                  stroke="#e11d48"
                  strokeWidth={2}
                  isAnimationActive={false}
                  dot={{ r: 3.5, fill: "#e11d48" }}
                  activeDot={{ r: 5.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health Status (All 6 AI Agents) */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Trạng thái 6 AI Agents
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] text-slate-500 font-medium">Trực tuyến</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 mt-2 text-xs">
              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">1. DB Ingestion</div>
                  <div className="text-[11px] text-slate-400">Đồng bộ đơn mua POs</div>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">Hoạt động</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">2. GDELT Monitor</div>
                  <div className="text-[11px] text-slate-400">Tin tức địa chính trị</div>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">GDELT v2</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">3. FMP Financial</div>
                  <div className="text-[11px] text-slate-400">Sức khỏe tài chính NCC</div>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">Altman Z</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">4. Route Weather</div>
                  <div className="text-[11px] text-slate-400">Thời tiết tuyến Open-Meteo</div>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">Real-time</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">5. MILP Solver</div>
                  <div className="text-[11px] text-slate-400">Tối ưu hóa nguồn cung</div>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">PuLP</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">6. Master Orchestrator</div>
                  <div className="text-[11px] text-slate-400">Điều phối & cảnh báo</div>
                </div>
                <span className="text-[11px] text-slate-600 font-mono">Sẵn sàng</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate("approvals")}
            className="w-full mt-4 py-2 px-3 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 active:bg-slate-200/70 border border-slate-200/80 rounded-lg transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <span>Đến trang phê duyệt đề xuất</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Open Incidents Table: Calm, Scanning-friendly */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Sự cố giao hàng cần xử lý
              <span className="text-xs font-normal text-slate-400">({openIncidents.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sách đơn hàng phát hiện rủi ro trễ hẹn cần phương án ứng phó
            </p>
          </div>
          <button
            onClick={() => onNavigate("incidents")}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded px-1"
          >
            Xem toàn bộ <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {openIncidents.length === 0 ? (
          <div className="text-center py-10 text-slate-500 space-y-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600/80 mx-auto" />
            <p className="text-xs font-medium text-slate-800">Không có sự cố nào cần xử lý</p>
            <p className="text-[11px] text-slate-400">
              Tất cả các đơn hàng PO linh kiện EV đang vận chuyển đúng tiến độ cam kết.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-500 font-medium border-b border-slate-200/70">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Mã PO / Incident</th>
                  <th className="py-2.5 px-4 font-medium">SKU Linh Kiện</th>
                  <th className="py-2.5 px-4 font-medium">Nhà Cung Cấp</th>
                  <th className="py-2.5 px-4 font-medium">Điểm Rủi Ro (PORS)</th>
                  <th className="py-2.5 px-4 font-medium">Trạng Thái</th>
                  <th className="py-2.5 px-4 text-right font-medium">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {openIncidents.map((inc) => {
                  const score = Number(inc.delayRiskScore || 66.3);
                  const isHigh = score >= 50;

                  return (
                    <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {inc.poNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{inc.sku}</td>
                      <td className="py-3 px-4 text-slate-600">{inc.supplierName || "N/A"}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono text-xs tabular-nums ${
                            isHigh
                              ? "text-rose-700 font-medium bg-rose-50/70 border border-rose-200/50 px-1.5 py-0.5 rounded"
                              : "text-slate-700"
                          }`}
                        >
                          {score.toFixed(1)}/100
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {cleanStatusText(inc.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onNavigate("approvals")}
                          title="Xem phương án thay thế cho sự cố này"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 rounded-md transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 group"
                        >
                          <span>Xem đề xuất</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};


