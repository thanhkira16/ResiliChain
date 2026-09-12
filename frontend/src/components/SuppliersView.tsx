import React, { useState } from "react";
import { Supplier, InventoryItem, UserRole } from "../types";
import { initialSuppliers } from "../data/mockData";
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
} from "lucide-react";

interface SuppliersViewProps {
  suppliers: Supplier[];
  inventory: InventoryItem[];
  onUpdateSupplier: (supplier: Supplier) => void;
  onAddSupplier: (supplier: Supplier) => void;
  userRole: UserRole;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  inventory,
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

  const startEdit = (sup: Supplier) => {
    setEditingId(sup.id);
    setEditScore(sup.reliabilityScore);
    setEditLeadTime(sup.averageLeadTimeDays);
  };

  const saveEdit = (sup: Supplier) => {
    onUpdateSupplier({
      ...sup,
      reliabilityScore: Number(editScore),
      averageLeadTimeDays: Number(editLeadTime),
    });
    setEditingId(null);
  };

  const handleCreateNew = () => {
    if (!newSupplier.name) return;
    const newId = `SUP-0${suppliers.length + 1}`;
    const created: Supplier = {
      id: newId,
      name: newSupplier.name,
      contactPerson: newSupplier.contactPerson || "Đại diện kinh doanh",
      email: newSupplier.email || `sales@${newSupplier.name?.toLowerCase().replace(/\s+/g, "")}.vn`,
      phone: newSupplier.phone || "0900 000 000",
      providedSkus: newSupplier.providedSkus || ["SKU-FRM-01"],
      averageLeadTimeDays: Number(newSupplier.averageLeadTimeDays) || 7,
      historicalPrice: newSupplier.historicalPrice || { "SKU-FRM-01": 2400000 },
      reliabilityScore: Number(newSupplier.reliabilityScore) || 80,
      address: newSupplier.address || "Khu Công Nghiệp Tân Tạo, TP.HCM",
    };
    onAddSupplier(created);
    setIsAddingNew(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Danh Mục Nhà Cung Cấp Linh Kiện Xe Đạp ({suppliers.length} đối tác)
          </h3>
          <p className="text-xs text-slate-500">
            Quản lý năng lực cung ứng, điểm uy tín (0-100), lead time trung bình và giá lịch sử theo SKU. Điểm tin cậy được Agent 1 & Agent 2 sử dụng để tính rủi ro và xếp hạng báo giá.
          </p>
        </div>

        <button
          id="btn-add-supplier"
          onClick={() => setIsAddingNew(true)}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm nhà cung cấp</span>
        </button>
      </div>

      {/* New Supplier Modal / Accordion */}
      {isAddingNew && (
        <div className="bg-white p-5 rounded-xl border-2 border-emerald-500 shadow-md">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Đăng ký nhà cung cấp mới</span>
            </h4>
            <button
              onClick={() => setIsAddingNew(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-medium text-slate-700 block mb-1">Tên công ty / nhà máy *</label>
              <input
                type="text"
                placeholder="VD: Công ty TNHH Nhôm Đúc Nam Sài Gòn"
                value={newSupplier.name}
                onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">Người liên hệ & Số ĐT</label>
              <input
                type="text"
                placeholder="Nguyễn Văn A - 0909 123 456"
                value={newSupplier.contactPerson}
                onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">Email kinh doanh</label>
              <input
                type="email"
                placeholder="sales@supplier.com"
                value={newSupplier.email}
                onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">Lead time trung bình (ngày)</label>
              <input
                type="number"
                value={newSupplier.averageLeadTimeDays}
                onChange={(e) => setNewSupplier({ ...newSupplier, averageLeadTimeDays: Number(e.target.value) })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">Điểm tin cậy ban đầu (0 - 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={newSupplier.reliabilityScore}
                onChange={(e) => setNewSupplier({ ...newSupplier, reliabilityScore: Number(e.target.value) })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">Địa chỉ kho bãi / xưởng</label>
              <input
                type="text"
                placeholder="KCN VSIP Bình Dương..."
                value={newSupplier.address}
                onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs">
            <button
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 font-medium"
            >
              Hủy
            </button>
            <button
              onClick={handleCreateNew}
              disabled={!newSupplier.name}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              Lưu nhà cung cấp
            </button>
          </div>
        </div>
      )}

      {/* Supplier Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => {
          const isEditing = editingId === sup.id;

          return (
            <div
              key={sup.id}
              id={`supplier-card-${sup.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {sup.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{sup.name}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {sup.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {sup.phone}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editScore}
                          onChange={(e) => setEditScore(Number(e.target.value))}
                          className="w-16 p-1 border rounded text-xs text-center font-bold"
                        />
                        <button
                          onClick={() => saveEdit(sup)}
                          className="p-1 rounded bg-emerald-600 text-white"
                        >
                          <Save className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 rounded bg-slate-200 text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                            sup.reliabilityScore >= 85
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : sup.reliabilityScore >= 70
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          }`}
                        >
                          <Star className="w-3 h-3 fill-current" />
                          <span>{sup.reliabilityScore}/100</span>
                        </div>

                        <button
                          onClick={() => startEdit(sup)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Sửa điểm tin cậy & lead time"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 my-3 p-2.5 bg-slate-50 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Lead time trung bình</span>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editLeadTime}
                        onChange={(e) => setEditLeadTime(Number(e.target.value))}
                        className="w-16 p-0.5 border rounded text-xs"
                      />
                    ) : (
                      <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        {sup.averageLeadTimeDays} ngày
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Địa điểm kho / nhà máy</span>
                    <span className="font-medium text-slate-700 line-clamp-1 mt-0.5 flex items-center gap-1" title={sup.address}>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {sup.address}
                    </span>
                  </div>
                </div>

                {/* SKUs provided list */}
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span>Danh sách linh kiện cung ứng ({sup.providedSkus.length} SKU):</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {sup.providedSkus.map((sku) => {
                      const histPrice = sup.historicalPrice[sku];
                      return (
                        <div
                          key={sku}
                          className="px-2 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-800 flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="font-semibold">{getSkuName(sku)}</span>
                          {histPrice && (
                            <span className="font-mono text-emerald-700 font-medium text-[10px]">
                              {Number(histPrice).toLocaleString("vi-VN")}đ
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Transit Waypoints / Route to Destination */}
                {(() => {
                  const waypoints =
                    sup.transitWaypoints && sup.transitWaypoints.length > 0
                      ? sup.transitWaypoints
                      : initialSuppliers.find((s) => s.id === sup.id)?.transitWaypoints || [];

                  if (!waypoints || waypoints.length === 0) return null;

                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/80 rounded-lg p-2.5">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-emerald-700">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          Tuyến đường & Các trạm chính đi qua ({waypoints.length} chốt)
                        </span>
                      </div>

                      <div className="space-y-1.5 relative pl-3 border-l-2 border-emerald-300">
                        {waypoints.map((wp, idx) => (
                          <div key={idx} className="relative text-xs flex flex-col group">
                            <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                            <div className="flex items-baseline justify-between">
                              <span className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-mono">#{wp.orderIndex}</span>
                                {wp.locationName}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-slate-200 text-slate-700">
                                {wp.checkpointType === "OriginWarehouse"
                                  ? "Kho xuất"
                                  : wp.checkpointType === "DestinationWarehouse"
                                  ? "Kho nhận"
                                  : wp.checkpointType === "TollPlaza"
                                  ? "Trạm chốt"
                                  : "Trung chuyển"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {wp.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Người phụ trách: {sup.contactPerson}</span>
                <span className="text-slate-400">Resili chain Verified Supplier</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
