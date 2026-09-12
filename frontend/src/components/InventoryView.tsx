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
            Bicycle Component Inventory Management (8 Key SKUs)
          </h3>
          <p className="text-xs text-slate-500">
            Track actual inventory against Safety Stock thresholds and weekly burn rates. You can edit stock levels to simulate shortage incidents for Agent 1 risk detection.
          </p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">SKU Code</th>
                <th className="py-3 px-3">Component Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Current Stock</th>
                <th className="py-3 px-3 text-right">Safety Stock</th>
                <th className="py-3 px-3 text-right">Weekly Burn Rate</th>
                <th className="py-3 px-3 text-center">Buffer Coverage</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
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
                      <div className="text-[10px] text-slate-400">Unit: {item.unit}</div>
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
                          {Number(item.currentStock).toLocaleString("en-US")} {item.unit}
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
                        `${Number(item.safetyStock).toLocaleString("en-US")} ${item.unit}`
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
                        ~{bufferWeeks} weeks
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {isUnderSafety ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Below Safety ({bufferUnits} {item.unit})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Optimal (+{bufferUnits})</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => saveEdit(item)}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                            title="Save"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingSku(null)}
                            className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Edit Inventory Numbers"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onNavigateToForecast(item.sku)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="View Agent 3 Demand Forecast"
                          >
                            <span>Forecast</span>
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
