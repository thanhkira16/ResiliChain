import React, { useState, useEffect, useMemo } from "react";
import {
  AtRiskShipmentMapItem,
  ShipmentTrackingPoint,
  DestinationWarehouse,
  UserRole,
} from "../types";
import { StorageService } from "../services/storage";
import {
  MapPin,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  Filter,
  Search,
  Radio,
  RefreshCw,
  ShieldAlert,
  Layers,
  ChevronRight,
  X,
  Compass,
  ArrowUpRight,
  Info,
  Maximize2,
  Zap,
} from "lucide-react";

interface ShipmentTrackingMapViewProps {
  userRole: UserRole;
  onNavigateToIncidents?: () => void;
  onNavigateToPo?: (poNumber: string) => void;
}

export const ShipmentTrackingMapView: React.FC<ShipmentTrackingMapViewProps> = ({
  userRole: _userRole,
  onNavigateToIncidents,
  onNavigateToPo,
}) => {
  const [shipments, setShipments] = useState<AtRiskShipmentMapItem[]>([]);
  const [warehouses, setWarehouses] = useState<DestinationWarehouse[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<AtRiskShipmentMapItem | null>(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Map viewport & projection state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [activeRegion, setActiveRegion] = useState<"ALL" | "NORTH" | "CENTRAL" | "SOUTH">("ALL");
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState<boolean>(false);
  const [lastWebhookMessage, setLastWebhookMessage] = useState<string | null>(null);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(false);

  // Load projection data from StorageService (CQRS Read Model)
  const reloadData = () => {
    const data = StorageService.getAtRiskShipmentsMapData();
    const whs = StorageService.getWarehouses();
    setShipments(data);
    setWarehouses(whs);

    if (selectedShipment) {
      const updated = data.find((s) => s.shipmentId === selectedShipment.shipmentId);
      if (updated) setSelectedShipment(updated);
    }
  };

  useEffect(() => {
    reloadData();

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
              `⚡ Nhận vị trí real-time: ${incoming.poNumber} tại ${incoming.locationName}`
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

  // Geographic projection helper (Converts Vietnam Lat/Lng to SVG [x, y] coordinates)
  // Latitude bounds: ~9.5°N (Cà Mau) -> ~22.5°N (Hà Giang/Lạng Sơn)
  // Longitude bounds: ~103.5°E -> ~109.5°E
  const projectGeoToSvg = (lat: number, lng: number): { x: number; y: number } => {
    const minLat = 9.5;
    const maxLat = 22.8;
    const minLng = 103.0;
    const maxLng = 109.8;

    const svgWidth = 800;
    const svgHeight = 900;

    // Normalizing
    const normX = (lng - minLng) / (maxLng - minLng);
    // Invert Y because latitude goes North (+) but SVG Y goes down (+)
    const normY = 1 - (lat - minLat) / (maxLat - minLat);

    return {
      x: Math.round(normX * svgWidth),
      y: Math.round(normY * svgHeight),
    };
  };

  // Simulate Carrier Webhook GPS Ping
  const handleSimulateCarrierPing = async (simulateDuplicate = false) => {
    if (shipments.length === 0) return;
    setIsSimulatingWebhook(true);

    // Pick an at-risk shipment
    const target = selectedShipment || shipments.find((s) => s.riskLevel === "HIGH") || shipments[0];

    const currentPoint = target.latestTrackingPoint;
    const recordedAt = simulateDuplicate
      ? currentPoint.recordedAt // Duplicate timestamp to test idempotency!
      : new Date().toISOString();

    // Small GPS step forward towards destination warehouse
    const dest = target.destinationWarehouse;
    const latDelta = (dest.latitude - currentPoint.latitude) * 0.15;
    const lngDelta = (dest.longitude - currentPoint.longitude) * 0.15;

    const newLat = simulateDuplicate
      ? currentPoint.latitude
      : Math.round((currentPoint.latitude + latDelta) * 10000) / 10000;
    const newLng = simulateDuplicate
      ? currentPoint.longitude
      : Math.round((currentPoint.longitude + lngDelta) * 10000) / 10000;

    try {
      const response = await fetch("/api/shipments/tracking-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipmentId: target.shipmentId,
          purchaseOrderId: target.purchaseOrderId,
          poNumber: target.poNumber,
          supplierId: target.supplierId,
          supplierName: target.supplierName,
          latitude: newLat,
          longitude: newLng,
          locationName: simulateDuplicate
            ? currentPoint.locationName
            : `Trạm kiểm soát km${Math.floor(Math.random() * 80 + 20)} hướng về ${dest.name}`,
          recordedAt,
          source: "CarrierWebhook",
          speedKmh: Math.floor(Math.random() * 30 + 40),
          statusNote: simulateDuplicate
            ? "Mô phỏng gửi trùng gói tin (At-least-once delivery retry)"
            : `Đang di chuyển đúng hành trình, cách ${dest.name} ${(Math.random() * 15 + 10).toFixed(1)} km`,
          currentDelayRiskScore: target.currentDelayRiskScore, // Snapshot from F4 - never recalculated
        }),
      });

      const result = await response.json();

      if (result.isDuplicateSkipped) {
        setLastWebhookMessage(
          `🛡️ [IDEMPOTENT THÀNH CÔNG] Webhook gửi trùng (${target.poNumber} @ ${recordedAt.substring(11, 19)}). DB đã chặn tạo điểm trùng lặp!`
        );
      } else {
        setLastWebhookMessage(
          `📍 [WEBHOOK GHI NHẬN] Đã cập nhật GPS mới cho ${target.poNumber} (${newLat}, ${newLng}) và phát tán real-time!`
        );
        reloadData();
      }
    } catch {
      // Fallback local simulation if offline
      const localResult = StorageService.recordTrackingPoint({
        id: `TRK-SIM-${Date.now()}`,
        shipmentId: target.shipmentId,
        purchaseOrderId: target.purchaseOrderId,
        poNumber: target.poNumber,
        supplierId: target.supplierId,
        supplierName: target.supplierName,
        latitude: newLat,
        longitude: newLng,
        locationName: `Trạm vệ tinh giao lộ (${dest.name})`,
        recordedAt,
        source: "CarrierWebhook",
        speedKmh: 48,
        statusNote: "Cập nhật vệ tinh thời gian thực qua Webhook",
      });

      if (localResult.isDuplicateSkipped) {
        setLastWebhookMessage(
          `🛡️ [IDEMPOTENCY LOCAL] Ràng buộc khóa duy nhất đã ngăn chặn bản ghi trùng!`
        );
      } else {
        setLastWebhookMessage(`📍 Đã mô phỏng GPS mới cho ${target.poNumber}!`);
        reloadData();
      }
    } finally {
      setIsSimulatingWebhook(false);
      setTimeout(() => setLastWebhookMessage(null), 6000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              HITL Console · FR-4.3
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{isLiveStreamActive ? "Real-time Live Stream (SSE/SignalR)" : "Ready"}</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            Bản đồ Giám sát Vận chuyển Lô hàng (Shipment Tracking Map)
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl">
            Hiển thị trực quan vị trí địa lý của các lô hàng đang mở có rủi ro trễ hẹn (liên kết với
            sự cố Agent F4 đã phát hiện). Điểm số và cấu thành rủi ro được chiếu trực tiếp từ snapshot
            của F4 (SRS §2.3) mà <strong>tuyệt đối không tính lại</strong>.
          </p>
        </div>

        {/* Action Controls & Simulator */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSimulateCarrierPing(false)}
            disabled={isSimulatingWebhook}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
            title="Gửi dữ liệu GPS mới từ hãng vận tải qua Webhook"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Mô phỏng Webhook GPS</span>
          </button>

          <button
            onClick={() => handleSimulateCarrierPing(true)}
            disabled={isSimulatingWebhook}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-slate-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            title="Thử nghiệm gửi trùng gói tin Webhook để kiểm chứng Idempotency DB"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span>Test Idempotency Trùng</span>
          </button>

          <button
            onClick={reloadData}
            className="p-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors"
            title="Tải lại dữ liệu bản đồ"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live notification banner */}
      {lastWebhookMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <Radio className="w-4 h-4 text-blue-600 animate-spin" />
            <span>{lastWebhookMessage}</span>
          </div>
          <button onClick={() => setLastWebhookMessage(null)} className="text-blue-600 hover:text-blue-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Lô hàng đang theo dõi
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{shipments.length}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-3 shadow-2xs flex items-center justify-between bg-red-50/30">
          <div>
            <div className="text-[11px] font-medium text-red-600 uppercase tracking-wider">
              Rủi ro cao (Đỏ &gt;70)
            </div>
            <div className="text-lg font-bold text-red-700 mt-0.5">{highRiskCount}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-lg p-3 shadow-2xs flex items-center justify-between bg-amber-50/30">
          <div>
            <div className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
              Rủi ro vừa (Vàng 40-69)
            </div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{mediumRiskCount}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-lg p-3 shadow-2xs flex items-center justify-between bg-emerald-50/30">
          <div>
            <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
              Bình thường (Xanh &lt;40)
            </div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{lowRiskCount}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Tìm mã PO, SKU, Nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Risk Level filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">Mức rủi ro:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800"
            >
              <option value="ALL">Tất cả ({shipments.length})</option>
              <option value="HIGH">Rủi ro cao &gt;70 ({highRiskCount})</option>
              <option value="MEDIUM">Trung bình 40-69 ({mediumRiskCount})</option>
              <option value="LOW">An toàn &lt;40 ({lowRiskCount})</option>
            </select>
          </div>

          {/* Supplier filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">NCC:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800 max-w-[200px] truncate"
            >
              <option value="ALL">Tất cả nhà cung ứng</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Warehouse filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Kho đích:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-xs text-slate-800"
            >
              <option value="ALL">Tất cả kho nhận hàng</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Region Quick Zoom Buttons */}
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50">
          <span className="text-[11px] font-medium text-slate-500 px-1">Khu vực:</span>
          {(["ALL", "NORTH", "CENTRAL", "SOUTH"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                activeRegion === r
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {r === "ALL" && "Toàn quốc"}
              {r === "NORTH" && "Miền Bắc"}
              {r === "CENTRAL" && "Miền Trung"}
              {r === "SOUTH" && "Miền Nam"}
            </button>
          ))}
        </div>
      </div>

      {/* Map + Detail Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* MAP CANVAS CONTAINER */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg relative min-h-[580px] flex flex-col">
          {/* Map Top Bar overlay */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700 text-xs text-slate-200 flex items-center gap-2 shadow-md">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold">Bản đồ Hành lang Cung ứng Việt Nam</span>
              <span className="text-slate-400 text-[11px]">WGS-84 Projection</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg p-0.5 text-xs text-slate-300">
              <button
                onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
                className="px-2 py-1 hover:bg-slate-800 rounded font-bold text-slate-200"
                title="Phóng to"
              >
                +
              </button>
              <span className="px-1 text-[11px] font-mono text-slate-400">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.15))}
                className="px-2 py-1 hover:bg-slate-800 rounded font-bold text-slate-200"
                title="Thu nhỏ"
              >
                -
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-1.5 py-1 hover:bg-slate-800 rounded text-[10px] text-slate-400"
                title="Reset zoom"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Map Legend Overlay */}
          <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 space-y-1.5 shadow-md">
            <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-blue-400" />
              <span>Ký hiệu rủi ro (F4 Delay Score)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-xs shadow-red-500 animate-pulse"></span>
              <span>Rủi ro cao (&ge; 70 điểm) - Trễ nghiêm trọng</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs shadow-amber-400"></span>
              <span>Rủi ro trung bình (40 - 69 điểm)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>An toàn (&lt; 40 điểm) - Đúng lộ trình</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-slate-400">
              <Building2 className="w-3 h-3 text-indigo-400" />
              <span>Kho đích / Nhà máy lắp ráp xe đạp</span>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="w-full h-full flex-1 flex items-center justify-center p-4 overflow-hidden">
            <svg
              viewBox="0 0 800 900"
              className="w-full h-auto max-h-[680px] transition-transform duration-300 ease-out"
              style={{
                transform: `scale(${zoomLevel}) ${
                  activeRegion === "NORTH"
                    ? "translate(0, 18%)"
                    : activeRegion === "CENTRAL"
                    ? "translate(-5%, -5%)"
                    : activeRegion === "SOUTH"
                    ? "translate(0, -22%)"
                    : "translate(0, 0)"
                }`,
              }}
            >
              {/* Subtle Grid Lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
                <linearGradient id="routeGradientRed" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="routeGradientAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="routeGradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              <rect width="800" height="900" fill="#020617" />
              <rect width="800" height="900" fill="url(#grid)" />

              {/* Vietnam Coastline & Major Transport Corridors (Stylized Geographic Vector) */}
              <g id="vietnam-geography" stroke="#334155" fill="#0f172a" strokeWidth="1.2">
                {/* Northern Region (Hà Nội, Hải Phòng, Bắc Ninh, Quảng Ninh) */}
                <path
                  d="M 320 80 Q 420 70, 480 110 L 520 150 Q 560 180, 490 220 L 410 240 Q 360 260, 380 320 L 330 300 Q 280 230, 260 170 Z"
                  fill="#111827"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                {/* Central Corridor (Thanh Hóa, Đà Nẵng, Quy Nhơn) */}
                <path
                  d="M 380 320 Q 430 380, 470 460 Q 520 540, 560 620 L 530 650 Q 480 580, 420 500 L 370 400 Z"
                  fill="#111827"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                {/* Southern Region (TP.HCM, Bình Dương, Đồng Nai, Cần Thơ, Cà Mau) */}
                <path
                  d="M 530 650 Q 570 700, 550 780 Q 510 840, 430 870 L 380 840 Q 350 780, 420 740 Q 480 700, 530 650 Z"
                  fill="#111827"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
              </g>

              {/* National Highway 1A & Expressways (Key Transit Arteries) */}
              <g id="transport-arteries" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" opacity="0.35">
                {/* QL1A Spine */}
                <path d="M 410 170 Q 440 310, 480 470 Q 540 640, 500 780" fill="none" />
                {/* Hanoi - Hai Phong Expressway */}
                <path d="M 380 170 L 465 185" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
                {/* Phap Van - Cau Gie - Ninh Binh */}
                <path d="M 380 170 L 390 230" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
                {/* Trung Luong Expressway */}
                <path d="M 480 775 L 430 810" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
              </g>

              {/* ROUTE POLYLINES (Connecting checkpoints for each shipment) */}
              {filteredShipments.map((shipment) => {
                if (!shipment.routeHistory || shipment.routeHistory.length === 0) return null;

                const points = shipment.routeHistory.map((pt) =>
                  projectGeoToSvg(pt.latitude, pt.longitude)
                );
                const destPoint = projectGeoToSvg(
                  shipment.destinationWarehouse.latitude,
                  shipment.destinationWarehouse.longitude
                );

                const isSelected = selectedShipment?.shipmentId === shipment.shipmentId;
                const strokeColor =
                  shipment.riskLevel === "HIGH"
                    ? "#ef4444"
                    : shipment.riskLevel === "MEDIUM"
                    ? "#f59e0b"
                    : "#10b981";

                const pathData = points
                  .map((p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
                  .join(" ");

                const toDestPath = `M ${points[points.length - 1].x} ${
                  points[points.length - 1].y
                } L ${destPoint.x} ${destPoint.y}`;

                return (
                  <g key={`route-${shipment.shipmentId}`}>
                    {/* Traveled History Polyline */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3.5 : 2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={isSelected ? 0.95 : 0.55}
                    />

                    {/* Projected Remaining Path to Warehouse (Dashed) */}
                    <path
                      d={toDestPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                      strokeDasharray="4,4"
                      opacity={isSelected ? 0.75 : 0.3}
                    />

                    {/* Route checkpoints dots */}
                    {points.map((pt, pIdx) => (
                      <circle
                        key={`pt-${shipment.shipmentId}-${pIdx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={pIdx === points.length - 1 ? 4 : 2}
                        fill={strokeColor}
                        opacity={0.8}
                      />
                    ))}
                  </g>
                );
              })}

              {/* DESTINATION WAREHOUSE MARKERS */}
              {warehouses.map((wh) => {
                const pos = projectGeoToSvg(wh.latitude, wh.longitude);
                return (
                  <g
                    key={wh.id}
                    className="cursor-pointer group"
                    transform={`translate(${pos.x}, ${pos.y})`}
                  >
                    {/* Warehouse Halo */}
                    <circle r="14" fill="#312e81" fillOpacity="0.4" stroke="#818cf8" strokeWidth="1.5" />
                    <rect
                      x="-7"
                      y="-7"
                      width="14"
                      height="14"
                      rx="2"
                      fill="#4f46e5"
                      stroke="#c7d2fe"
                      strokeWidth="1"
                    />

                    {/* Label */}
                    <text
                      x="16"
                      y="4"
                      fill="#e0e7ff"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="system-ui"
                      className="pointer-events-none drop-shadow-md"
                    >
                      {wh.name}
                    </text>
                  </g>
                );
              })}

              {/* AT-RISK SHIPMENT MARKERS */}
              {filteredShipments.map((shipment) => {
                const latest = shipment.latestTrackingPoint;
                const pos = projectGeoToSvg(latest.latitude, latest.longitude);
                const isSelected = selectedShipment?.shipmentId === shipment.shipmentId;

                const colorBg =
                  shipment.riskLevel === "HIGH"
                    ? "#ef4444"
                    : shipment.riskLevel === "MEDIUM"
                    ? "#f59e0b"
                    : "#10b981";

                return (
                  <g
                    key={shipment.shipmentId}
                    onClick={() => setSelectedShipment(shipment)}
                    className="cursor-pointer transition-transform hover:scale-110"
                    transform={`translate(${pos.x}, ${pos.y})`}
                  >
                    {/* Pulsing ring for high risk */}
                    {shipment.riskLevel === "HIGH" && (
                      <circle
                        r="20"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        opacity="0.75"
                        className="animate-ping"
                      />
                    )}

                    {/* Outer Selection Highlight */}
                    {isSelected && (
                      <circle r="18" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="3,3" />
                    )}

                    {/* Main Marker Pin */}
                    <circle
                      r={isSelected ? "11" : "9"}
                      fill={colorBg}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="drop-shadow-lg"
                    />

                    {/* Mini Truck Icon Representation */}
                    <circle r="3" fill="#ffffff" />

                    {/* Floating Info Pill above marker */}
                    <g transform="translate(0, -16)">
                      <rect
                        x="-38"
                        y="-14"
                        width="76"
                        height="16"
                        rx="4"
                        fill="#0f172a"
                        fillOpacity="0.92"
                        stroke={colorBg}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-3"
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize="9"
                        fontWeight="600"
                        fontFamily="monospace"
                      >
                        {shipment.poNumber} · {shipment.currentDelayRiskScore}đ
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* SIDE DETAIL PANEL */}
        <div className="lg:col-span-4 space-y-4">
          {selectedShipment ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5 animate-fadeIn">
              {/* Header with PO and Risk Score */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      {selectedShipment.poNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        selectedShipment.riskLevel === "HIGH"
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : selectedShipment.riskLevel === "MEDIUM"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {selectedShipment.riskLevel === "HIGH" && "Rủi ro Cao"}
                      {selectedShipment.riskLevel === "MEDIUM" && "Rủi ro Vừa"}
                      {selectedShipment.riskLevel === "LOW" && "Bình thường"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedShipment.supplierName}</p>
                </div>

                <button
                  onClick={() => setSelectedShipment(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SKU & Destination info */}
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-2 border border-slate-200/70">
                <div className="flex justify-between">
                  <span className="text-slate-500">Linh kiện (SKU):</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {selectedShipment.sku} - {selectedShipment.skuName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedShipment.quantity.toLocaleString("vi-VN")} {selectedShipment.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kho nhận hàng:</span>
                  <span className="font-semibold text-indigo-700">
                    {selectedShipment.destinationWarehouse.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hạn cam kết (Promised):</span>
                  <span className="font-mono text-slate-700">
                    {selectedShipment.promisedDeliveryDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dự kiến thực tế (ETA):</span>
                  <span
                    className={`font-mono font-semibold ${
                      selectedShipment.delayDays > 0 ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {selectedShipment.expectedDeliveryDate} (Trễ {selectedShipment.delayDays} ngày)
                  </span>
                </div>
              </div>

              {/* Latest Checkpoint Section */}
              <div>
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Vị trí GPS mới nhất (Latest Checkpoint)</span>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-xs space-y-2">
                  <div className="font-medium text-blue-950">
                    {selectedShipment.latestTrackingPoint.locationName}
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Tọa độ GPS:</span>
                    <span className="font-mono font-medium">
                      {selectedShipment.latestTrackingPoint.latitude},{" "}
                      {selectedShipment.latestTrackingPoint.longitude}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Thời gian ghi nhận:</span>
                    <span className="font-mono">
                      {new Date(selectedShipment.latestTrackingPoint.recordedAt).toLocaleString(
                        "vi-VN"
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Nguồn dữ liệu:</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                      {selectedShipment.latestTrackingPoint.source}
                    </span>
                  </div>
                  {selectedShipment.latestTrackingPoint.statusNote && (
                    <div className="pt-2 border-t border-blue-200/60 text-[11px] text-slate-700 italic">
                      &ldquo;{selectedShipment.latestTrackingPoint.statusNote}&rdquo;
                    </div>
                  )}
                  <div className="pt-1 text-[11px] text-slate-500 flex justify-between">
                    <span>Hãng vận tải:</span>
                    <span className="font-medium text-slate-700">{selectedShipment.carrierName}</span>
                  </div>
                </div>
              </div>

              {/* EXACT SRS 2.3 RISK BREAKDOWN CARD (Snapshot from F4 - Never recalculated) */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span>Cấu thành Rủi ro F4 (SRS §2.3)</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono border border-slate-200">
                    Snapshot F4 · Không tính lại
                  </span>
                </div>

                <div className="p-3 bg-slate-900 text-slate-100 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Điểm rủi ro tổng thể:</span>
                    <span
                      className={`text-base font-black ${
                        selectedShipment.currentDelayRiskScore >= 70
                          ? "text-red-400"
                          : selectedShipment.currentDelayRiskScore >= 40
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {selectedShipment.currentDelayRiskScore} / 100
                    </span>
                  </div>

                  {/* Formula Preview */}
                  <div className="bg-slate-800/80 p-2 rounded text-[11px] font-mono text-slate-300 border border-slate-700/60">
                    score = w1*lateness + w2*(1-rel) + w3*buffer
                  </div>

                  {/* Breakdown Meters */}
                  {selectedShipment.riskBreakdown ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                          <span>1. Độ trễ giao hàng (w1=0.50):</span>
                          <span className="font-mono text-amber-300">
                            {selectedShipment.riskBreakdown.latenessFactor} (
                            {selectedShipment.riskBreakdown.delayDays}d /{" "}
                            {selectedShipment.riskBreakdown.committedLeadTimeDays}d)
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                selectedShipment.riskBreakdown.latenessFactor * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                          <span>2. Điểm tin cậy NCC (w2=0.25):</span>
                          <span className="font-mono text-blue-300">
                            {selectedShipment.riskBreakdown.supplierReliabilityFactor}
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-400 h-full rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                selectedShipment.riskBreakdown.supplierReliabilityFactor * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                          <span>3. Buffer tồn kho an toàn (w3=0.25):</span>
                          <span className="font-mono text-red-300">
                            {selectedShipment.riskBreakdown.inventoryBufferFactor} (Kho:{" "}
                            {selectedShipment.riskBreakdown.currentStock} / An toàn:{" "}
                            {selectedShipment.riskBreakdown.safetyStock})
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-red-400 h-full rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                selectedShipment.riskBreakdown.inventoryBufferFactor * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Điểm số được đọc trực tiếp từ bản ghi F4 AgentRun snapshot.
                    </p>
                  )}
                </div>
              </div>

              {/* Route checkpoints history */}
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Lịch sử các trạm đã qua ({selectedShipment.routeHistory.length})</span>
                  <span className="text-[10px] text-slate-400 font-mono">Đoạn đường GPS</span>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-[11px]">
                  {selectedShipment.routeHistory.map((pt, idx) => (
                    <div
                      key={pt.id || idx}
                      className="flex items-start gap-2 p-1.5 rounded bg-slate-50 border border-slate-200/50"
                    >
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{pt.locationName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(pt.recordedAt).toLocaleTimeString("vi-VN")} · {pt.latitude},{" "}
                          {pt.longitude}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="pt-2 flex items-center gap-2">
                {selectedShipment.incidentId && onNavigateToIncidents && (
                  <button
                    onClick={onNavigateToIncidents}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <span>Xem sự cố F4</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {onNavigateToPo && (
                  <button
                    onClick={() => onNavigateToPo(selectedShipment.poNumber)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 px-3 border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    <span>Mở đơn hàng PO</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Chọn một lô hàng trên bản đồ</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Bấm vào marker định vị màu đỏ/vàng/xanh để mở panel chi tiết, xem lộ trình di
                chuyển và bảng phân rã công thức điểm rủi ro SRS §2.3.
              </p>

              {/* Quick Select from At-Risk list */}
              <div className="pt-3 border-t border-slate-100 text-left space-y-2">
                <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                  Lô hàng có nguy cơ cao nhất:
                </div>
                {shipments
                  .filter((s) => s.riskLevel === "HIGH")
                  .slice(0, 3)
                  .map((item) => (
                    <div
                      key={item.shipmentId}
                      onClick={() => setSelectedShipment(item)}
                      className="p-2 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 cursor-pointer flex items-center justify-between transition-colors text-xs"
                    >
                      <div>
                        <div className="font-bold text-red-900">{item.poNumber}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                          {item.skuName}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold text-xs">
                        {item.currentDelayRiskScore}đ
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Architectural Notes Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-600">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Ràng buộc Kiến trúc & Idempotency</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>
                <strong>Read-Only Projection (CQRS):</strong> Bản đồ chỉ chiếu dữ liệu đã được Agent
                F4 tính toán. Không có logic tính toán rủi ro mới tại giao diện.
              </li>
              <li>
                <strong>Idempotency DB:</strong> Ràng buộc duy nhất{" "}
                <code className="bg-slate-200 px-1 rounded font-mono text-[10px]">
                  (ShipmentId, RecordedAt)
                </code>{" "}
                ngăn chặn duplicate points khi carrier gửi webhook trùng.
              </li>
              <li>
                <strong>Transactional Outbox:</strong> Khi ghi tracking mới, event{" "}
                <code className="bg-slate-200 px-1 rounded font-mono text-[10px]">
                  ShipmentLocationUpdated
                </code>{" "}
                được lưu vào Outbox trước khi phát tán qua WebSocket / SignalR.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
