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

  const getStatusBadge = (status: POStatus) => {
    switch (status) {
      case "Hoàn thành":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Đang giao":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Trễ hẹn":
        return "bg-red-50 text-red-700 border-red-200 animate-pulse";
      case "Đang xử lý":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Quản Lý Đơn Mua Hàng (Purchase Orders - PO)
          </h3>
          <p className="text-xs text-slate-500">
            Theo dõi tiến độ giao hàng, mô phỏng cập nhật tracking ngày giao thực tế để kích hoạt Agent 1 phát hiện rủi ro.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-scan-orders"
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isScanning ? "Đang quét..." : "Quét rủi ro các PO"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-po"
            type="text"
            placeholder="Tìm theo mã PO, nhà cung cấp, linh kiện SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Trạng thái:</span>
          <select
            id="select-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none"
          >
            <option value="all">Tất cả ({orders.length})</option>
            <option value="Trễ hẹn">Trễ hẹn ({orders.filter((o) => o.status === "Trễ hẹn").length})</option>
            <option value="Đang giao">Đang giao ({orders.filter((o) => o.status === "Đang giao").length})</option>
            <option value="Đang xử lý">Đang xử lý ({orders.filter((o) => o.status === "Đang xử lý").length})</option>
            <option value="Hoàn thành">Hoàn thành ({orders.filter((o) => o.status === "Hoàn thành").length})</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-3.5">Mã PO</th>
                <th className="py-3 px-3">Linh kiện & SKU</th>
                <th className="py-3 px-3">Nhà cung cấp</th>
                <th className="py-3 px-3 text-right">Số lượng</th>
                <th className="py-3 px-3 text-right">Tổng giá trị</th>
                <th className="py-3 px-3">Ngày cam kết</th>
                <th className="py-3 px-3">Tracking thực tế / dự kiến</th>
                <th className="py-3 px-3 text-center">Rủi ro</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.map((po) => {
                const isEditing = editingPoId === po.id;
                const promisedTime = new Date(po.promisedDeliveryDate).getTime();
                const actualTime = new Date(po.actualOrExpectedDeliveryDate).getTime();
                const delayDays = Math.max(0, Math.round((actualTime - promisedTime) / (1000 * 60 * 60 * 24)));
                const isLate = delayDays > 0 && po.status !== "Hoàn thành";

                return (
                  <tr
                    key={po.id}
                    id={`po-row-${po.poNumber}`}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isLate ? "bg-red-50/30" : ""
                    }`}
                  >
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                      {po.poNumber}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{po.skuName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{po.sku}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 line-clamp-1 max-w-[200px]" title={po.supplierName}>
                        {po.supplierName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {po.supplierId}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-medium">
                      {Number(po.quantity).toLocaleString("vi-VN")}
                    </td>

                    <td className="py-3 px-3 text-right font-semibold text-slate-900">
                      {Number(po.totalAmount).toLocaleString("vi-VN")} VNĐ
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                      {po.promisedDeliveryDate}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={editForm.actualOrExpectedDeliveryDate}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                actualOrExpectedDeliveryDate: e.target.value,
                              })
                            }
                            className="px-1.5 py-0.5 border rounded text-xs"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{po.actualOrExpectedDeliveryDate}</span>
                          {delayDays > 0 && po.status !== "Hoàn thành" && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-red-100 text-red-700 font-bold">
                              +{delayDays}d
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          (po.currentRiskScore || 0) >= 70
                            ? "bg-red-100 text-red-800"
                            : (po.currentRiskScore || 0) >= 40
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {po.currentRiskScore || 0}/100
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {isEditing ? (
                        <select
                          value={editForm.status}
                          onChange={(e) =>
                            setEditForm({ ...editForm, status: e.target.value as POStatus })
                          }
                          className="text-xs p-1 border rounded"
                        >
                          <option value="Đang xử lý">Đang xử lý</option>
                          <option value="Đang giao">Đang giao</option>
                          <option value="Trễ hẹn">Trễ hẹn</option>
                          <option value="Hoàn thành">Hoàn thành</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(
                            po.status
                          )}`}
                        >
                          {po.status}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {onViewOnMap && <button onClick={() => onViewOnMap(po.poNumber)} className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium inline-flex items-center gap-1 transition-colors" title={`Xem tuyến ${po.poNumber} trên bản đồ`}><MapPinned className="w-3 h-3" /><span>Xem map</span></button>}
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Không tìm thấy đơn đặt hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
