import React, { useState } from "react";
import { Supplier, InventoryItem, UserRole } from "../types";
import {
  Building2,
  Star,
  Clock,
  Package,
  Plus,
  Edit2,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  ShieldAlert,
} from "lucide-react";

interface SuppliersViewProps {
  suppliers: Supplier[];
  inventory: InventoryItem[];
  supplierRisks?: Array<{
    supplierId: string;
    supplierName: string;
    porsScore: number | string;
    riskLevel: string;
    statusLabel: string;
  }>;
  onUpdateSupplier: (supplier: Supplier) => void;
  onAddSupplier: (supplier: Supplier) => void;
  userRole: UserRole;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  inventory,
  supplierRisks = [],
  onUpdateSupplier,
  onAddSupplier,
  userRole,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(80);
  const [editLeadTime, setEditLeadTime] = useState<number>(7);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    providedSkus: [],
    averageLeadTimeDays: 7,
    reliabilityScore: 85,
    address: "",
    historicalPrice: {},
  });

  const getSkuName = (skuId: string) => {
    const item = inventory.find((i) => i.sku === skuId);
    return item ? item.name : skuId;
  };

  const getRiskInfo = (supplierId: string) => {
    return supplierRisks.find((r) => r.supplierId === supplierId);
  };

  const startEdit = (sup: Supplier) => {
    setEditingId(sup.id);
    setEditScore(sup.reliabilityScore);
    setEditLeadTime(sup.averageLeadTimeDays);
  };

  const saveEdit = (sup: Supplier) => {
    onUpdateSupplier({
      ...sup,
      reliabilityScore: editScore,
      averageLeadTimeDays: editLeadTime,
    });
    setEditingId(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.name) return;
    const created: Supplier = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      name: newSupplier.name || "New Supplier",
      contactPerson: newSupplier.contactPerson || "N/A",
      email: newSupplier.email || "contact@supplier.com",
      phone: newSupplier.phone || "0900 000 000",
      providedSkus: newSupplier.providedSkus || [],
      averageLeadTimeDays: Number(newSupplier.averageLeadTimeDays) || 7,
      historicalPrice: {},
      reliabilityScore: Number(newSupplier.reliabilityScore) || 85,
      address: newSupplier.address || "Vietnam Industrial Park",
    };
    onAddSupplier(created);
    setIsAddingNew(false);
    setNewSupplier({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      providedSkus: [],
      averageLeadTimeDays: 7,
      reliabilityScore: 85,
      address: "",
      historicalPrice: {},
    });
  };

  return (
    <div className="space-y-6">
      {/* Light Minimalist Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-slate-700" />
            EV Component Supplier Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage capacity profiles, historical reliability scores, financial risk assessments (Altman Z-Score) & news telemetry (GDELT).
          </p>
        </div>
        {userRole === "PROCUREMENT_MANAGER" && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        )}
      </div>

      {/* Add Supplier Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                Register New Supplier
              </h3>
              <button onClick={() => setIsAddingNew(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Partner Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vietnam Lithium Battery Corp"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                  value={newSupplier.name || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                    value={newSupplier.contactPerson || ""}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+84 903 123 456"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                    value={newSupplier.phone || ""}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Email</label>
                <input
                  type="email"
                  placeholder="contact@company.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                  value={newSupplier.email || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Average Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                    value={newSupplier.averageLeadTimeDays || 7}
                    onChange={(e) => setNewSupplier({ ...newSupplier, averageLeadTimeDays: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Reliability Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                    value={newSupplier.reliabilityScore || 85}
                    onChange={(e) => setNewSupplier({ ...newSupplier, reliabilityScore: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warehouse / Plant Address</label>
                <input
                  type="text"
                  placeholder="Song Than 2 Industrial Park, Binh Duong"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                  value={newSupplier.address || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {suppliers.map((sup) => {
          const isEditing = editingId === sup.id;
          const riskInfo = getRiskInfo(sup.id);
          const pors = riskInfo ? Number(riskInfo.porsScore) : null;

          return (
            <div
              key={sup.id}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-sm space-y-4 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {sup.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1">{sup.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {sup.address || "Address not specified"}
                  </p>
                </div>

                {userRole === "PROCUREMENT_MANAGER" && !isEditing && (
                  <button
                    onClick={() => startEdit(sup)}
                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Stat Chips */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                    <span>Reliability</span>
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editScore}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 text-slate-900 rounded px-2 py-0.5 mt-1 text-xs"
                    />
                  ) : (
                    <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                      {sup.reliabilityScore}/100
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                    <span>Lead Time</span>
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      value={editLeadTime}
                      onChange={(e) => setEditLeadTime(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 text-slate-900 rounded px-2 py-0.5 mt-1 text-xs"
                    />
                  ) : (
                    <div className="text-lg font-bold font-mono text-blue-600 mt-1">
                      {sup.averageLeadTimeDays} <span className="text-xs text-slate-500 font-normal">days</span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                    <span>PORS Risk</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="text-lg font-bold font-mono mt-1">
                    {pors !== null ? (
                      <span className={pors >= 70 ? "text-red-600" : pors >= 50 ? "text-amber-600" : "text-emerald-600"}>
                        {pors.toFixed(1)}/100
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-normal">Awaiting AI Scan</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Editing Controls */}
              {isEditing && (
                <div className="flex justify-end gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs border border-slate-200 rounded font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(sup)}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </button>
                </div>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{sup.email}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{sup.phone}</span>
                </div>
              </div>

              {/* Provided SKUs */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  Manufacturable EV Components ({sup.providedSkus.length} SKUs):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sup.providedSkus.map((sku) => {
                    const price = sup.historicalPrice?.[sku];
                    return (
                      <div
                        key={sku}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-1.5 text-slate-800"
                      >
                        <span className="font-mono font-bold text-slate-900">{sku}</span>
                        <span className="text-slate-500">({getSkuName(sku)})</span>
                        {price && (
                          <span className="font-mono text-emerald-700 font-bold text-[11px]">
                            VND {Number(price).toLocaleString("en-US")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
