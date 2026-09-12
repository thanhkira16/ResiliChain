import React, { useState } from "react";
import { Supplier, InventoryItem, UserRole } from "../types";
import {
  Building2,
  Star,
  Clock,
  DollarSign,
  Package,
  Plus,
  Edit2,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  Activity,
  AlertTriangle,
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
    altmanZScore?: number;
    ssiNews?: number;
    ssiFin?: number;
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
      name: newSupplier.name || "Nhà cung cấp mới",
      contactPerson: newSupplier.contactPerson || "N/A",
      email: newSupplier.email || "contact@supplier.com",
      phone: newSupplier.phone || "0900 000 000",
      providedSkus: newSupplier.providedSkus || [],
      averageLeadTimeDays: Number(newSupplier.averageLeadTimeDays) || 7,
      historicalPrice: {},
      reliabilityScore: Number(newSupplier.reliabilityScore) || 85,
      address: newSupplier.address || "KCN Việt Nam",
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Building2 className="w-7 h-7 text-cyan-400" />
            Danh Mục Nhà Cung Cấp Linh Kiện EV
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Quản trị hồ sơ năng lực, điểm uy tín lịch sử, đánh giá rủi ro tài chính (Altman Z-Score) & tin tức truyền thông (GDELT).
          </p>
        </div>
        {userRole === "PROCUREMENT_MANAGER" && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Thêm Nhà Cung Cấp
          </button>
        )}
      </div>

      {/* Add Supplier Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Khai Báo Nhà Cung Cấp Mới
              </h3>
              <button onClick={() => setIsAddingNew(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tên Doanh Nghiệp / Đối Tác</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Công ty Cổ phần Pin Lithium Việt Nam"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                  value={newSupplier.name || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Người Liên Hệ</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                    value={newSupplier.contactPerson || ""}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    placeholder="0903 123 456"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                    value={newSupplier.phone || ""}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Công Ty</label>
                <input
                  type="email"
                  placeholder="contact@company.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                  value={newSupplier.email || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Time Trung Bình (Ngày)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                    value={newSupplier.averageLeadTimeDays || 7}
                    onChange={(e) => setNewSupplier({ ...newSupplier, averageLeadTimeDays: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Điểm Uy Tín Ban Đầu (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                    value={newSupplier.reliabilityScore || 85}
                    onChange={(e) => setNewSupplier({ ...newSupplier, reliabilityScore: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Địa Chỉ Kho / Nhà Máy</label>
                <input
                  type="text"
                  placeholder="KCN Sóng Thần 2, Bình Dương"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                  value={newSupplier.address || ""}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl font-medium"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl"
                >
                  Lưu Nhà Cung Cấp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {suppliers.map((sup) => {
          const isEditing = editingId === sup.id;
          const riskInfo = getRiskInfo(sup.id);
          const pors = riskInfo ? Number(riskInfo.porsScore) : null;
          const riskLevel = riskInfo ? riskInfo.riskLevel : null;

          return (
            <div
              key={sup.id}
              className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl space-y-5 transition-all"
            >
              {/* Top Header Card */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                      {sup.id}
                    </span>
                    <h3 className="text-lg font-bold text-white line-clamp-1">{sup.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {sup.address || "Chưa cập nhật địa chỉ"}
                  </p>
                </div>

                {userRole === "PROCUREMENT_MANAGER" && !isEditing && (
                  <button
                    onClick={() => startEdit(sup)}
                    className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
                    title="Chỉnh sửa điểm uy tín"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status & Risk Badges Row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Reliability Score */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Độ Uy Tín Lịch Sử</span>
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editScore}
                      onChange={(e) => setEditScore(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 mt-1 text-sm"
                    />
                  ) : (
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {sup.reliabilityScore}/100
                    </div>
                  )}
                </div>

                {/* Lead Time */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Lead Time Trung Bình</span>
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      value={editLeadTime}
                      onChange={(e) => setEditLeadTime(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 mt-1 text-sm"
                    />
                  ) : (
                    <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                      {sup.averageLeadTimeDays} <span className="text-xs text-slate-400 font-normal">ngày</span>
                    </div>
                  )}
                </div>

                {/* PORS Score */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Chỉ Số Rủi Ro PORS</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <div className="text-xl font-bold font-mono mt-1">
                    {pors !== null ? (
                      <span
                        className={
                          pors >= 70
                            ? "text-red-400"
                            : pors >= 50
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {pors.toFixed(1)}/100
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs font-normal">Chờ quét AI</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Editing Controls */}
              {isEditing && (
                <div className="flex justify-end gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => saveEdit(sup)}
                    className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Lưu Thay Đổi
                  </button>
                </div>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{sup.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{sup.phone}</span>
                </div>
              </div>

              {/* Provided SKUs */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  Linh Kiện EV Khả Năng Giao Hàng ({sup.providedSkus.length} SKU):
                </div>
                <div className="flex flex-wrap gap-2">
                  {sup.providedSkus.map((sku) => {
                    const price = sup.historicalPrice?.[sku];
                    return (
                      <div
                        key={sku}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center gap-2 text-slate-200"
                      >
                        <span className="font-mono font-semibold text-cyan-300">{sku}</span>
                        <span className="text-slate-400">({getSkuName(sku)})</span>
                        {price && (
                          <span className="font-mono text-emerald-400 font-bold text-[11px]">
                            {Number(price).toLocaleString("vi-VN")}đ
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Waypoints Timeline */}
              {sup.transitWaypoints && sup.transitWaypoints.length > 0 && (
                <div className="border-t border-slate-800/80 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    Tuyến Đường Giao Hận & Các Trạm Kiểm Soát ({sup.transitWaypoints.length} trạm):
                  </div>
                  <div className="space-y-1.5 relative pl-4 border-l border-slate-700">
                    {sup.transitWaypoints.map((wp, idx) => (
                      <div key={idx} className="relative text-xs">
                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold text-white">
                            #{wp.orderIndex} {wp.locationName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {wp.checkpointType}
                          </span>
                        </div>
                        {wp.description && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{wp.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
