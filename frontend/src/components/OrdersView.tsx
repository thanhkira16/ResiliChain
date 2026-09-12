import React, { useState } from "react";
import { PurchaseOrder, POStatus, UserRole } from "../types";
import {
  Search,
  FileText,
  Package,
  MapPinned,
  ShieldAlert,
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
      {/* Light Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-slate-700" />
            Purchase Order (PO) Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage commercial purchase orders, delivery commitments, AI Engine risk scores, and tracking history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by PO, Supplier, SKU..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 w-60"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Processing">Processing</option>
            <option value="In Transit">In Transit</option>
            <option value="Delayed">Delayed</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-700" />
            Purchase Orders List ({filteredOrders.length} Orders)
          </h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-10 text-slate-500 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-900">No Matching Purchase Orders Found</p>
            <p className="text-[11px]">Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Component SKU</th>
                  <th className="p-3">Quantity & Unit Price</th>
                  <th className="p-3">Total Amount</th>
                  <th className="p-3">Promised / Expected</th>
                  <th className="p-3">AI Risk Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOrders.map((po) => {
                  const riskScore = po.currentRiskScore;
                  const isHighRisk = riskScore !== undefined && riskScore >= 65;

                  return (
                    <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-600">{po.poNumber}</td>
                      <td className="p-3 font-semibold text-slate-900">{po.supplierName}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{po.skuName || po.sku}</div>
                        <div className="font-mono text-[10px] text-slate-400">{po.sku}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900">{po.quantity} units</div>
                        <div className="font-mono text-[10px] text-emerald-700">
                          {Number(po.unitPrice).toLocaleString("en-US")} VND/unit
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-700">
                        {Number(po.totalAmount || po.quantity * po.unitPrice).toLocaleString("en-US")} VND
                      </td>
                      <td className="p-3 space-y-0.5">
                        <div className="text-[11px] text-slate-500">
                          Promised: <span className="font-mono text-slate-700">{po.promisedDeliveryDate}</span>
                        </div>
                        <div className="text-[11px] text-amber-700 font-semibold">
                          Expected: <span className="font-mono">{po.actualOrExpectedDeliveryDate}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {riskScore !== undefined ? (
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              isHighRisk
                                ? "bg-red-100 text-red-800 border border-red-200"
                                : riskScore >= 35
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {riskScore.toFixed(1)}/100
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Not scanned</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            po.status === "Completed"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : po.status === "Delayed"
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {onViewOnMap && (
                          <button
                            onClick={() => onViewOnMap(po.poNumber)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                            title="View 3D Map"
                          >
                            <MapPinned className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isHighRisk && onNavigateToIncident && (
                          <button
                            onClick={() => onNavigateToIncident(po.poNumber)}
                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 rounded transition-colors"
                            title="View Incident"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
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
