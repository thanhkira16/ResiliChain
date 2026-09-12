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
  userRole,
  onNavigate,
  onRunRiskScan,
  isScanning,
}) => {
  // 1. KPI: On-time delivery rate calculation
  const completedOrders = orders.filter((o) => o.status === "Hoàn thành");
  const onTimeCompleted = completedOrders.filter((o) => {
    const promised = new Date(o.promisedDeliveryDate).getTime();
    const actual = new Date(o.actualOrExpectedDeliveryDate).getTime();
    return actual <= promised;
  });
  const currentOnTimeRate =
    completedOrders.length > 0
      ? Math.round((onTimeCompleted.length / completedOrders.length) * 100)
      : 82;

  // On-time rate trend data by week
  const onTimeTrendData = [
    { week: "T1 (08/01)", onTimeRate: 91, target: 90 },
    { week: "T2 (08/08)", onTimeRate: 88, target: 90 },
    { week: "T3 (08/15)", onTimeRate: 85, target: 90 },
    { week: "T4 (08/22)", onTimeRate: 89, target: 90 },
    { week: "T5 (08/29)", onTimeRate: 82, target: 90 },
    { week: "T6 (Hiện tại)", onTimeRate: currentOnTimeRate, target: 90 },
  ];

  // 2. KPI: Incidents detected by week
  const incidentWeeklyData = [
    { week: "Tuần 34", count: 1, resolved: 1 },
    { week: "Tuần 35", count: 3, resolved: 2 },
    { week: "Tuần 36", count: 2, resolved: 2 },
    { week: "Tuần 37 (Hiện tại)", count: incidents.length, resolved: incidents.filter((i) => i.status === "Đã giải quyết").length },
  ];

  // 3. KPI: Agent Acceptance Rate (% approved without edit)
  const evaluatedProposals = proposals.filter(
    (p) => p.status === "Đã duyệt" || p.status === "Sửa & Duyệt"
  );
  const approvedAsIs = proposals.filter((p) => p.status === "Đã duyệt");
  const agentAcceptanceRate =
    evaluatedProposals.length > 0
      ? Math.round((approvedAsIs.length / evaluatedProposals.length) * 100)
      : 80;

  // 4. KPI: Estimated cost saved / avoided disruption
  let totalSavings = 0;
  proposals.forEach((p) => {
    if (p.status === "Đã duyệt" || p.status === "Sửa & Duyệt") {
      const selected = p.customAdjusted || p.rankings.find((r) => r.rank === p.selectedRank);
      if (selected && p.originalTotalCost > selected.totalCost) {
        totalSavings += p.originalTotalCost - selected.totalCost;
      }
    }
  });
  // Baseline demo savings if new session
  if (totalSavings === 0) totalSavings = 14850000;

  // 5. Critical inventory items (stock < safetyStock)
  const criticalStockItems = inventory.filter((i) => i.currentStock <= i.safetyStock);

  // Active incidents needing attention
  const openIncidents = incidents.filter((i) => i.status !== "Đã giải quyết" && i.status !== "Đã hủy");
  const pendingApprovals = proposals.filter((p) => p.status === "Chờ duyệt");

  return (
    <div className="space-y-6">
      {/* Top Banner if there are high risk alerts */}
      {openIncidents.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <span>Cảnh báo: Phát hiện {openIncidents.length} sự cố rủi ro chuỗi cung ứng cần can thiệp</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-200 text-amber-900 font-semibold">
                  Agent 1 Triggered
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Các đơn hàng linh kiện xe đạp trễ hạn đang đe dọa trực tiếp tới dây chuyền lắp ráp. Agent 2 đã chuẩn bị phương án dự phòng.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-view-map-quick"
              onClick={() => onNavigate("map")}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-xs"
            >
              <span>Bản đồ vận chuyển (FR-4.3)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-view-incidents-quick"
              onClick={() => onNavigate("incidents")}
              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Xem sự cố ({openIncidents.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {pendingApprovals.length > 0 && (
              <button
                id="btn-view-approvals-quick"
                onClick={() => onNavigate("approvals")}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
              >
                <span>Duyệt đề xuất ({pendingApprovals.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: On-time Delivery */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Tỷ lệ giao đúng hẹn</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{currentOnTimeRate}%</span>
            <span className="text-xs font-medium text-emerald-600">Mục tiêu: 90%</span>
          </div>
          <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                currentOnTimeRate >= 85 ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, currentOnTimeRate)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            {completedOrders.length} đơn hoàn thành / {orders.length} tổng PO
          </div>
        </div>

        {/* KPI 2: Incidents Detected */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Sự cố rủi ro mở</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{openIncidents.length}</span>
            <span className="text-xs text-slate-500 font-medium">/ {incidents.length} tổng cộng</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Quét tự động bởi Agent 1 theo ngưỡng rủi ro cấu hình
          </p>
        </div>

        {/* KPI 3: Forecast Accuracy (MAPE) */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Độ chính xác dự báo (MAPE)</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">92.8%</span>
            <span className="text-xs font-medium text-blue-600">Sai số: 7.2%</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Agent 3 kết hợp Moving Average + Hệ số mùa vụ
          </p>
        </div>

        {/* KPI 4: Agent Acceptance Rate */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Tỷ lệ đề xuất duyệt chuẩn</span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{agentAcceptanceRate}%</span>
            <span className="text-xs text-purple-600 font-medium">AI đúng chuẩn</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Đề xuất thay thế được duyệt mà không cần chỉnh sửa
          </p>
        </div>

        {/* KPI 5: Cost saved / protected */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Chi phí tối ưu / tiết kiệm</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900">
              {Number(totalSavings).toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-slate-500">VNĐ</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-3 font-medium">
            Nhờ đàm phán và đổi NCC kịp thời
          </p>
        </div>
      </div>

      {/* AI Agents Workflow Diagram (Visual Guide) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Quy Trình Hoạt Động Của Các AI Agent Trong Resili chain
            </h3>
          </div>
          <span className="text-xs text-slate-300 font-mono">
            Full-Stack Autonomous Supply Chain Workflow
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Step 1 */}
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-emerald-400">1. Risk Monitoring</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                Agent 1
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Quét PO mở định kỳ, tính toán <code className="text-emerald-300">delay_risk_score</code> dựa trên độ trễ, tồn kho an toàn & uy tín NCC. Tạo Incident khi &gt;70.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-blue-400">2. Sourcing & RFQ</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                Agent 2
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Lọc NCC dự phòng, tự động dùng Gemini AI soạn thảo RFQ tiếng Việt chuyên nghiệp, gửi deadline 24h & xếp hạng tối đa 3 phương án tốt nhất.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-amber-400">3. Human-In-The-Loop</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                HITL Approval
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Minh bạch Reasoning Trace. Phân quyền chặt chẽ: &lt;50 triệu (Procurement Officer), &ge;50 triệu (Supply Chain Manager). Cho phép sửa trước khi duyệt.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-purple-400">4. Demand Forecasting</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                Agent 3
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Dự báo 4 tuần tới kèm dải khoảng tin cậy (Confidence Interval) và hệ số mùa vụ. Tự động đề xuất số lượng đặt hàng bù đắp trước khi cạn tồn kho.
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: On-time Delivery Trend */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Xu Hướng Tỷ Lệ Giao Hàng Đúng Hẹn (On-Time Delivery Rate)
              </h4>
              <p className="text-xs text-slate-500">So sánh hiệu suất giao hàng thực tế với chỉ tiêu 90%</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              6 Tuần Gần Nhất
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={onTimeTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: any) => [`${value}%`]}
                  contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Line
                  type="monotone"
                  dataKey="onTimeRate"
                  name="Tỷ lệ thực tế"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#10b981" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Chỉ tiêu (90%)"
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Incidents Detected & Resolved */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Sự Cố Rủi Ro Chuỗi Cung Ứng Theo Tuần
              </h4>
              <p className="text-xs text-slate-500">Số lượng incident phát hiện bởi Agent 1 vs đã xử lý</p>
            </div>
            <button
              id="btn-scan-agent1-chart"
              onClick={onRunRiskScan}
              disabled={isScanning}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isScanning ? "Đang quét..." : "Quét lại"}</span>
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentWeeklyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="count" name="Sự cố phát hiện" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Đã giải quyết" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Two Column Section: Critical Inventory + Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Stock Alert Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-red-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Cảnh Báo Tồn Kho Dưới Ngưỡng An Toàn ({criticalStockItems.length} SKU)
              </h4>
            </div>
            <button
              onClick={() => onNavigate("inventory")}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-0.5"
            >
              <span>Xem tất cả</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {criticalStockItems.map((item) => {
              const bufferUnits = item.currentStock - item.safetyStock;
              const bufferWeeks = (item.currentStock / (item.weeklyBurnRate || 1)).toFixed(1);
              return (
                <div key={item.sku} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {item.sku}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Tiêu thụ: {item.weeklyBurnRate} {item.unit}/tuần • Đủ dùng ~{bufferWeeks} tuần
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-red-600">
                      {item.currentStock} / {item.safetyStock} {item.unit}
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-50 text-red-700 font-semibold border border-red-200">
                      Thiếu {Math.abs(bufferUnits)} {item.unit}
                    </span>
                  </div>
                </div>
              );
            })}

            {criticalStockItems.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                Toàn bộ linh kiện đều ở mức tồn kho an toàn.
              </div>
            )}
          </div>
        </div>

        {/* Pending HITL Approvals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900">
                Đề Xuất Chờ Phê Duyệt ({pendingApprovals.length})
              </h4>
            </div>
            <button
              onClick={() => onNavigate("approvals")}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-0.5"
            >
              <span>Vào phê duyệt</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingApprovals.map((prop) => {
              const best = prop.rankings[0];
              const isHigh = prop.totalValueVND >= 50000000;
              return (
                <div key={prop.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      <span>{prop.skuName}</span>
                      <span className="font-mono text-[10px] text-slate-500">({prop.poNumber})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Đề xuất sang: <strong className="text-slate-700">{best?.supplierName || "NCC dự phòng"}</strong> (Giao {best?.leadTimeDays} ngày)
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900">
                      {Number(prop.totalValueVND).toLocaleString("vi-VN")} VNĐ
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                        isHigh
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {isHigh ? "Cần Supply Chain Manager (≥50tr)" : "Procurement Officer (<50tr)"}
                    </span>
                  </div>
                </div>
              );
            })}

            {pendingApprovals.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                Không có đề xuất nào đang chờ duyệt.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
