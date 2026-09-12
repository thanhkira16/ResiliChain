import React, { useState } from "react";
import { PurchaseOrder, POStatus, UserRole } from "../types";
import {
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Save,
  X,
  ShieldAlert,
  ArrowUpDown,
  Plus,
  MapPinned,
  FileText,
  DollarSign,
  Package,
} from "lucide-react";

interface OrdersViewProps {
  orders: PurchaseOrder[];
  onUpdateOrder: (updated: PurchaseOrder) => void;
  onRunRiskScan: () => void;
  isScanning: boolean;
  userRole: UserRole;
  onNavigateToIncident?: (poNumber: string) => void;
  onViewOnMap?: (poNumber: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  onUpdateOrder,
  onRunRiskScan,
  isScanning,
  userRole,
  onNavigateToIncident,
  onViewOnMap,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingPoId, setEditingPoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    actualOrExpectedDeliveryDate: string;
    status: POStatus;
    notes: string;
  }>({
    actualOrExpectedDeliveryDate: "",
    status: "Đang xử lý",
    notes: "",
  });

  const startEdit = (po: PurchaseOrder) => {
    setEditingPoId(po.id);
    setEditForm({
      actualOrExpectedDeliveryDate: po.actualOrExpectedDeliveryDate,
      status: po.status,
      notes: po.notes || "",
    });
  };

  const saveEdit = (po: PurchaseOrder) => {
    onUpdateOrder({
      ...po,
      actualOrExpectedDeliveryDate: editForm.actualOrExpectedDeliveryDate,
      status: editForm.status,
      notes: editForm.notes,
    });
    setEditingPoId(null);
  };

  const filteredOrders = orders.filter((po) => {
    const matchesSearch =
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-2xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-cyan-400" />
            Quản Lý Đơn Hàng Mua Linh Kiện (Purchase Orders)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý các POs thương mại, tiến độ cam kết giao vận, điểm rủi ro trễ hẹn AI Engine và lịch sử cập nhật.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm theo PO, Supplier, SKU..."
              className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Đang xử lý">Đang xử lý</option>
            <option value="Đang giao">Đang giao</option>
            <option value="Trễ hẹn">Trễ hẹn</option>
            <option value="Hoàn thành">Hoàn thành</option>
          </select>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-400" />
            Danh Sách Đơn Hàng POs ({filteredOrders.length} Đơn)
          </h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-white">Không Tìm Thấy Đơn Hàng Phù Hợp</p>
            <p className="text-xs">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Mã PO</th>
                  <th className="p-3.5">Nhà Cung Cấp</th>
                  <th className="p-3.5">Linh Kiện SKU</th>
                  <th className="p-3.5">Số Lượng & Đơn Giá</th>
                  <th className="p-3.5">Tổng Tiền</th>
                  <th className="p-3.5">Cam Kết / Dự Kiến</th>
                  <th className="p-3.5">Điểm Rủi Ro AI</th>
                  <th className="p-3.5">Trạng Thái</th>
                  <th className="p-3.5 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {filteredOrders.map((po) => {
                  const isEditing = editingPoId === po.id;
                  const riskScore = po.currentRiskScore;
                  const isHighRisk = riskScore !== undefined && riskScore >= 65;

                  return (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-cyan-400">{po.poNumber}</td>
                      <td className="p-3.5 font-semibold text-white">{po.supplierName}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-white">{po.skuName || po.sku}</div>
                        <div className="font-mono text-[10px] text-slate-500">{po.sku}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-white">{po.quantity} đơn vị</div>
                        <div className="font-mono text-[10px] text-emerald-400">
                          {Number(po.unitPrice).toLocaleString("vi-VN")}đ/cái
                        </div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">
                        {Number(po.totalAmount || po.quantity * po.unitPrice).toLocaleString("vi-VN")}đ
                      </td>
                      <td className="p-3.5 space-y-0.5">
                        <div className="text-[11px] text-slate-400">
                          Cam kết: <span className="font-mono text-slate-300">{po.promisedDeliveryDate}</span>
                        </div>
                        <div className="text-[11px] text-amber-300 font-semibold">
                          Dự kiến: <span className="font-mono">{po.actualOrExpectedDeliveryDate}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        {riskScore !== undefined ? (
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              isHighRisk
                                ? "bg-red-950 text-red-400 border border-red-800"
                                : riskScore >= 35
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            {riskScore.toFixed(1)}/100
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Chưa quét</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            po.status === "Hoàn thành"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : po.status === "Trễ hẹn"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-cyan-950 text-cyan-400 border border-cyan-800"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {onViewOnMap && (
                          <button
                            onClick={() => onViewOnMap(po.poNumber)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg transition-all"
                            title="Xem bản đồ 3D"
                          >
                            <MapPinned className="w-4 h-4" />
                          </button>
                        )}
                        {isHighRisk && onNavigateToIncident && (
                          <button
                            onClick={() => onNavigateToIncident(po.poNumber)}
                            className="p-1.5 bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 rounded-lg transition-all"
                            title="Xem sự cố"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        )}
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
