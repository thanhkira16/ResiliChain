import React, { useState } from "react";
import { InventoryItem, UserRole } from "../types";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Edit2,
  Save,
  X,
  Plus,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

interface InventoryViewProps {
  inventory: InventoryItem[];
  onUpdateItem: (item: InventoryItem) => void;
  onNavigateToForecast: (sku: string) => void;
  userRole: UserRole;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  onUpdateItem,
  onNavigateToForecast,
  userRole,
}) => {
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    currentStock: number;
    safetyStock: number;
    weeklyBurnRate: number;
  }>({
    currentStock: 0,
    safetyStock: 0,
    weeklyBurnRate: 0,
  });

  const startEdit = (item: InventoryItem) => {
    setEditingSku(item.sku);
    setEditForm({
      currentStock: item.currentStock,
      safetyStock: item.safetyStock,
      weeklyBurnRate: item.weeklyBurnRate,
    });
  };

  const saveEdit = (item: InventoryItem) => {
    onUpdateItem({
      ...item,
      currentStock: Number(editForm.currentStock),
      safetyStock: Number(editForm.safetyStock),
      weeklyBurnRate: Number(editForm.weeklyBurnRate),
    });
    setEditingSku(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Quản Lý Tồn Kho Linh Kiện Xe Đạp (8 SKU Trọng Yếu)
          </h3>
          <p className="text-xs text-slate-500">
            Theo dõi tồn kho thực tế so với ngưỡng an toàn (Safety Stock) và tốc độ tiêu hao/tuần (Burn Rate). Bạn có thể chỉnh tồn kho để giả lập sự cố thiếu hụt cho Agent 1 phát hiện.
          </p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Mã SKU</th>
                <th className="py-3 px-3">Tên linh kiện xe đạp</th>
                <th className="py-3 px-3">Phân loại</th>
                <th className="py-3 px-3 text-right">Tồn kho hiện tại</th>
                <th className="py-3 px-3 text-right">Ngưỡng an toàn</th>
                <th className="py-3 px-3 text-right">Tiêu hao / tuần</th>
                <th className="py-3 px-3 text-center">Độ an toàn (Tuần)</th>
                <th className="py-3 px-3 text-center">Tình trạng</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {inventory.map((item) => {
                const isEditing = editingSku === item.sku;
                const bufferUnits = item.currentStock - item.safetyStock;
                const bufferWeeks = (item.currentStock / (item.weeklyBurnRate || 1)).toFixed(1);
                const isUnderSafety = item.currentStock <= item.safetyStock;
                const isCritical = item.currentStock < item.safetyStock * 0.6;

                return (
                  <tr
                    key={item.sku}
                    id={`inventory-row-${item.sku}`}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isUnderSafety ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                      {item.sku}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400">Đơn vị tính: {item.unit}</div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.currentStock}
                          onChange={(e) =>
                            setEditForm({ ...editForm, currentStock: Number(e.target.value) })
                          }
                          className="w-20 p-1 border rounded text-right text-xs"
                        />
                      ) : (
                        <span
                          className={`font-bold text-sm ${
                            isUnderSafety ? "text-red-600" : "text-slate-900"
                          }`}
                        >
                          {Number(item.currentStock).toLocaleString("vi-VN")} {item.unit}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.safetyStock}
                          onChange={(e) =>
                            setEditForm({ ...editForm, safetyStock: Number(e.target.value) })
                          }
                          className="w-20 p-1 border rounded text-right text-xs"
                        />
                      ) : (
                        `${Number(item.safetyStock).toLocaleString("vi-VN")} ${item.unit}`
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.weeklyBurnRate}
                          onChange={(e) =>
                            setEditForm({ ...editForm, weeklyBurnRate: Number(e.target.value) })
                          }
                          className="w-20 p-1 border rounded text-right text-xs"
                        />
                      ) : (
                        `${item.weeklyBurnRate} ${item.unit}/w`
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isCritical
                            ? "bg-red-100 text-red-800"
                            : isUnderSafety
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        ~{bufferWeeks} tuần
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {isUnderSafety ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Dưới Safety ({bufferUnits} {item.unit})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>An toàn (+{bufferUnits})</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => saveEdit(item)}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                            title="Lưu"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingSku(null)}
                            className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                            title="Hủy"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Chỉnh sửa số liệu tồn kho"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onNavigateToForecast(item.sku)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="Xem dự báo nhu cầu Agent 3"
                          >
                            <span>Dự báo</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
