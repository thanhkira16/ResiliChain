import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AtRiskShipmentMapItem,
  Incident,
  PurchaseOrder,
  DestinationWarehouse,
  UserRole,
} from "../types";
import { StorageService } from "../services/storage";
import { RouteWeatherPanel } from "./RouteWeatherPanel";
import { RouteWeatherStop } from "../services/weatherService";
import { GlobalRouteWeatherMap } from "./GlobalRouteWeatherMap";
import { ShipmentDetailModal } from "./ShipmentDetailModal";
import { SupplyChainApi } from "../services/api";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Filter,
  Search,
  Radio,
  RefreshCw,
  X,
  Info,
} from "lucide-react";

interface ShipmentTrackingMapViewProps {
  userRole: UserRole;
  orders: PurchaseOrder[];
  incidents: Incident[];
  focusPoNumber?: string | null;
  onNavigateToIncidents?: () => void;
  onNavigateToPo?: (poNumber: string) => void;
}

export const ShipmentTrackingMapView: React.FC<ShipmentTrackingMapViewProps> = ({
  userRole: _userRole,
  orders,
  incidents,
  focusPoNumber,
  onNavigateToIncidents: _onNavigateToIncidents,
  onNavigateToPo: _onNavigateToPo,
}) => {
  const [shipments, setShipments] = useState<AtRiskShipmentMapItem[]>([]);
  const [warehouses, setWarehouses] = useState<DestinationWarehouse[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<AtRiskShipmentMapItem | null>(null);
  const [highlightedShipment, setHighlightedShipment] = useState<AtRiskShipmentMapItem | null>(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isReloading, setIsReloading] = useState<boolean>(false);

  const [lastWebhookMessage, setLastWebhookMessage] = useState<string | null>(null);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(false);
  const [routeWeatherStops, setRouteWeatherStops] = useState<RouteWeatherStop[]>([]);

  // Load projection data from StorageService (CQRS Read Model)
  const reloadData = async () => {
    setIsReloading(true);
    let data = StorageService.getAtRiskShipmentsMapData();
    try {
      const apiShipments = await SupplyChainApi.getAtRiskShipments();
      if (apiShipments.length > 0) {
        data = apiShipments;
      }
    } catch (error) {
      console.warn('Shipment tracking API is unavailable; using local demo data.', error);
    } finally {
      setIsReloading(false);
    }
    const whs = StorageService.getWarehouses();
    setShipments(data);
    setWarehouses(whs);

    if (selectedShipment) {
      const updated = data.find((s) => s.shipmentId === selectedShipment.shipmentId);
      if (updated) setSelectedShipment(updated);
    }
    if (highlightedShipment) {
      const updated = data.find((s) => s.shipmentId === highlightedShipment.shipmentId);
      if (updated) setHighlightedShipment(updated);
    }
  };

  useEffect(() => {
    void reloadData();

    // Listen to real-time updates via Server-Sent Events (SSE)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/shipments/stream");

      eventSource.onopen = () => {
        setIsLiveStreamActive(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "SHIPMENT_LOCATION_UPDATED") {
            const incoming = payload.event;
            // Record into storage with idempotency check
            StorageService.recordTrackingPoint({
              id: `TRK-${Date.now()}`,
              shipmentId: incoming.shipmentId,
              purchaseOrderId: incoming.purchaseOrderId,
              poNumber: incoming.poNumber,
              supplierId: incoming.supplierId,
              supplierName: incoming.supplierName || "",
              latitude: incoming.latitude,
              longitude: incoming.longitude,
              locationName: incoming.locationName,
              recordedAt: incoming.recordedAt,
              source: incoming.source,
              speedKmh: incoming.speedKmh,
              statusNote: incoming.statusNote,
            });

            reloadData();
            setLastWebhookMessage(
              `Cập nhật GPS: ${incoming.poNumber} tại ${incoming.locationName}`
            );
            setTimeout(() => setLastWebhookMessage(null), 5000);
          }
        } catch (e) {
          console.error("Error parsing SSE message:", e);
        }
      };

      eventSource.onerror = () => {
        setIsLiveStreamActive(false);
      };
    } catch {
      setIsLiveStreamActive(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((item) => {
      if (riskFilter !== "ALL" && item.riskLevel !== riskFilter) return false;
      if (supplierFilter !== "ALL" && item.supplierId !== supplierFilter) return false;
      if (warehouseFilter !== "ALL" && item.destinationWarehouse.id !== warehouseFilter)
        return false;
      if (
        searchTerm &&
        !item.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.sku.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.skuName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !item.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [shipments, riskFilter, supplierFilter, warehouseFilter, searchTerm]);

  const handleSelectShipmentOnMap = useCallback((shipment: AtRiskShipmentMapItem) => {
    setHighlightedShipment(shipment);
    setSelectedShipment(shipment);
  }, []);

  useEffect(() => {
    if (!focusPoNumber) return;
    const shipment = shipments.find((item) => item.poNumber === focusPoNumber);
    if (!shipment) return;
    setRiskFilter("ALL");
    setSupplierFilter("ALL");
    setWarehouseFilter("ALL");
    setSearchTerm("");
    setHighlightedShipment(shipment);
    setSelectedShipment(null);
  }, [focusPoNumber, shipments]);

  // Unique suppliers list for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, string>();
    shipments.forEach((s) => map.set(s.supplierId, s.supplierName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [shipments]);

  // Summary counts
  const highRiskCount = shipments.filter((s) => s.riskLevel === "HIGH").length;
  const mediumRiskCount = shipments.filter((s) => s.riskLevel === "MEDIUM").length;
  const lowRiskCount = shipments.filter((s) => s.riskLevel === "LOW").length;

  return (
    <div className="space-y-5">
      {/* Calm Operational Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/70">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Giám sát Vận chuyển Lô hàng
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Vị trí địa lý và tiến độ giao hàng xe điện theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-normal text-slate-600 bg-slate-100/90 border border-slate-200/60">
            <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreamActive ? "bg-emerald-500" : "bg-slate-400"}`} />
            <span>{isLiveStreamActive ? "Trực tuyến (SSE)" : "Sẵn sàng"}</span>
          </div>

          <button
            onClick={reloadData}
            disabled={isReloading}
            aria-label="Tải lại dữ liệu bản đồ"
            className="p-1.5 border border-slate-200/80 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
            title="Tải lại dữ liệu bản đồ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Live notification banner */}
      {lastWebhookMessage && (
        <div className="p-2.5 bg-emerald-950/95 text-emerald-100 border border-emerald-800/80 rounded-lg text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="text-emerald-100">{lastWebhookMessage}</span>
          </div>
          <button onClick={() => setLastWebhookMessage(null)} className="text-emerald-300 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metric summary grid: Restrained, Clickable Filter Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={riskFilter === "ALL"}
          onClick={() => setRiskFilter("ALL")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRiskFilter("ALL"); } }}
          className={`bg-white border rounded-xl p-4 space-y-1 transition-all cursor-pointer select-none ${
            riskFilter === "ALL" ? "border-slate-400 shadow-xs ring-1 ring-slate-400/20" : "border-slate-200/80 hover:border-slate-300"
          }`}
          title="Bấm để lọc: Tất cả lô hàng"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tổng lô hàng theo dõi</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {shipments.length}
            </span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
              Tất cả
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Đang lưu thông trên tuyến</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={riskFilter === "HIGH"}
          onClick={() => setRiskFilter("HIGH")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRiskFilter("HIGH"); } }}
          className={`bg-white border rounded-xl p-4 space-y-1 transition-all cursor-pointer select-none ${
            riskFilter === "HIGH" ? "border-rose-400 shadow-xs ring-1 ring-rose-400/20" : "border-slate-200/80 hover:border-slate-300"
          }`}
          title="Bấm để lọc: Rủi ro cao"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Rủi ro cao</span>
            <AlertTriangle className={`w-4 h-4 ${highRiskCount > 0 ? "text-rose-500" : "text-slate-400"}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {highRiskCount}
            </span>
            {highRiskCount > 0 ? (
              <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50 tabular-nums">
                PORS &gt; 70
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/50">
                0 vụ
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">Trễ hẹn nghiêm trọng</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={riskFilter === "MEDIUM"}
          onClick={() => setRiskFilter("MEDIUM")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRiskFilter("MEDIUM"); } }}
          className={`bg-white border rounded-xl p-4 space-y-1 transition-all cursor-pointer select-none ${
            riskFilter === "MEDIUM" ? "border-amber-400 shadow-xs ring-1 ring-amber-400/20" : "border-slate-200/80 hover:border-slate-300"
          }`}
          title="Bấm để lọc: Rủi ro trung bình"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Rủi ro trung bình</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {mediumRiskCount}
            </span>
            {mediumRiskCount > 0 ? (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 tabular-nums">
                40–69đ
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/50">
                0 vụ
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">Cần theo dõi sát</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-pressed={riskFilter === "LOW"}
          onClick={() => setRiskFilter("LOW")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRiskFilter("LOW"); } }}
          className={`bg-white border rounded-xl p-4 space-y-1 transition-all cursor-pointer select-none ${
            riskFilter === "LOW" ? "border-emerald-400 shadow-xs ring-1 ring-emerald-400/20" : "border-slate-200/80 hover:border-slate-300"
          }`}
          title="Bấm để lọc: Đúng tiến độ"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Đúng tiến độ</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
              {lowRiskCount}
            </span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/50">
              An toàn
            </span>
          </div>
          <div className="text-[11px] text-slate-400">Đúng lịch trình ETA</div>
        </div>
      </div>

      {/* Filter Toolbar: Calm and aligned */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 sm:p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search box with Clear button */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Tìm mã PO, SKU, NCC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Risk Level filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Mức rủi ro:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="ALL">Tất cả ({shipments.length})</option>
              <option value="HIGH">Rủi ro cao &gt;70 ({highRiskCount})</option>
              <option value="MEDIUM">Trung bình 40-69 ({mediumRiskCount})</option>
              <option value="LOW">An toàn &lt;40 ({lowRiskCount})</option>
            </select>
          </div>

          {/* Supplier filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">NCC:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800 max-w-[180px] truncate focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="ALL">Tất cả NCC</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Kho nhận:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="ALL">Tất cả kho nhận</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear filters shortcut if active */}
        {(riskFilter !== "ALL" || supplierFilter !== "ALL" || warehouseFilter !== "ALL" || searchTerm) && (
          <button
            onClick={() => {
              setRiskFilter("ALL");
              setSupplierFilter("ALL");
              setWarehouseFilter("ALL");
              setSearchTerm("");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
          >
            Đặt lại bộ lọc
          </button>
        )}
      </div>

      {/* Empty Filter State Feedback */}
      {filteredShipments.length === 0 && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <span>Không tìm thấy lô hàng nào khớp với điều kiện lọc.</span>
          <button
            onClick={() => {
              setRiskFilter("ALL");
              setSupplierFilter("ALL");
              setWarehouseFilter("ALL");
              setSearchTerm("");
            }}
            className="text-slate-900 font-medium underline hover:text-slate-700 cursor-pointer"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      )}

      {/* Map + Detail Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* MAP CANVAS CONTAINER */}
        <div className="lg:col-span-8 rounded-xl overflow-hidden shadow-2xs">
          <GlobalRouteWeatherMap
            shipments={filteredShipments}
            warehouses={warehouses}
            routeWeatherStops={routeWeatherStops}
            selectedShipment={highlightedShipment || selectedShipment}
            onSelectShipment={handleSelectShipmentOnMap}
          />
        </div>

        {/* SIDE DETAIL PANEL */}
        <div className="lg:col-span-4 space-y-4">
          <RouteWeatherPanel onWeatherChange={setRouteWeatherStops} />

          {/* Architectural Notes: Collapsible Disclosure */}
          <details className="group border border-slate-200/80 rounded-xl bg-slate-50/50 p-3.5 text-xs text-slate-600 transition-colors">
            <summary className="font-medium text-slate-700 cursor-pointer flex items-center justify-between select-none list-none">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 group-open:text-slate-700" />
                <span>Thông tin kỹ thuật & Idempotency</span>
              </span>
              <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-500 pt-2.5 border-t border-slate-200/60 mt-2">
              <li>
                <strong className="text-slate-700">Read-Only Projection (CQRS):</strong> Bản đồ chỉ chiếu dữ liệu đã được Agent giám sát tính toán, đảm bảo tính nhất quán.
              </li>
              <li>
                <strong className="text-slate-700">Idempotency DB:</strong> Ràng buộc khóa <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono text-[10px] text-slate-800">(ShipmentId, RecordedAt)</code> ngăn duplicate khi carrier gửi webhook trùng.
              </li>
              <li>
                <strong className="text-slate-700">Transactional Outbox:</strong> Event <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono text-[10px] text-slate-800">ShipmentLocationUpdated</code> lưu vào Outbox trước khi phát tán qua SSE / SignalR.
              </li>
            </ul>
          </details>
        </div>
      </div>

      <ShipmentDetailModal
        shipment={selectedShipment}
        order={orders.find((order) => order.poNumber === selectedShipment?.poNumber)}
        incident={incidents.find((incident) => incident.poNumber === selectedShipment?.poNumber)}
        onClose={() => setSelectedShipment(null)}
      />
    </div>
  );
};
