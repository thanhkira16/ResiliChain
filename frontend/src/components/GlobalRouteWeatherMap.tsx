import { useEffect, useRef, useState } from "react";
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
  ImageryLayer,
  Ion,
  LabelStyle,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { RotateCcw } from "lucide-react";
import { AtRiskShipmentMapItem, DestinationWarehouse } from "../types";
import { RouteWeatherStop, weatherSeverityStyle } from "../services/weatherService";

interface GlobalRouteWeatherMapProps {
  shipments: AtRiskShipmentMapItem[];
  warehouses: DestinationWarehouse[];
  routeWeatherStops: RouteWeatherStop[];
  selectedShipment: AtRiskShipmentMapItem | null;
  onSelectShipment: (shipment: AtRiskShipmentMapItem) => void;
}

const shipmentColor = (shipment: AtRiskShipmentMapItem) => {
  const risk = String(shipment.riskLevel || "").toUpperCase();
  const score = shipment.currentDelayRiskScore ?? 0;
  if (risk === "HIGH" || score >= 65) {
    return Color.fromCssColorString("#ef4444"); // Red
  }
  if (risk === "MEDIUM" || score >= 35) {
    return Color.fromCssColorString("#f97316"); // Orange
  }
  return Color.fromCssColorString("#10b981"); // Emerald
};

type GeoPoint = { latitude: number; longitude: number };

const positionsFrom = (points: GeoPoint[]) => {
  if (!Array.isArray(points)) return [];
  return points
    .filter((p) => p && typeof p.latitude === "number" && typeof p.longitude === "number" && !isNaN(p.latitude) && !isNaN(p.longitude))
    .map((point) => Cartesian3.fromDegrees(point.longitude, point.latitude, 500));
};

export function GlobalRouteWeatherMap({
  shipments = [],
  warehouses = [],
  routeWeatherStops = [],
  selectedShipment,
  onSelectShipment,
}: GlobalRouteWeatherMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const shipmentLookupRef = useRef(new Map<string, AtRiskShipmentMapItem>());
  const [error, setError] = useState<string | null>(null);
  const [viewerReady, setViewerReady] = useState(false);

  // Keep the latest click handler in a ref so an inline parent callback never
  // forces the Viewer (and its WebGL context) to be torn down and rebuilt.
  const onSelectShipmentRef = useRef(onSelectShipment);
  useEffect(() => {
    onSelectShipmentRef.current = onSelectShipment;
  }, [onSelectShipment]);

  const token = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined) || "";

  // 1. Initialize Cesium Viewer once with high-performance CartoDB Voyager tiles
  useEffect(() => {
    if (!containerRef.current) return;

    if (token) {
      Ion.defaultAccessToken = token;
    }

    let viewer: Viewer;
    try {
      // High-performance, serene ESRI Light Gray Canvas tiles (clean, CORS-enabled, no watermark)
      const imageryProvider = new UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 16,
        credit: "Esri, HERE, Garmin, © OpenStreetMap contributors",
      });

      viewer = new Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        shouldAnimate: true,
        baseLayer: new ImageryLayer(imageryProvider),
      });

      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = false; // Disable heavy 3D lighting

      // Position initial camera over Vietnam / Southeast Asia supply chain routes
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(108.2, 16.0, 1800000),
      });

      // Handle Left Click for Entity Selection
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: Cartesian2 }) => {
        const picked = viewer.scene.pick(movement.position);
        const id = typeof picked?.id?.id === "string" ? picked.id.id : "";
        const shipment = shipmentLookupRef.current.get(id);
        if (shipment) {
          onSelectShipmentRef.current?.(shipment);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

      setViewerReady(true);

      return () => {
        setViewerReady(false);
        handler.destroy();
        if (!viewer.isDestroyed()) {
          viewer.destroy();
        }
        viewerRef.current = null;
      };
    } catch (err) {
      console.error("Cesium initialization error:", err);
      setError("Không thể khởi tạo bản đồ Cesium 3D. Vui lòng thử lại.");
    }
  }, [token]);

  // 2. Render Entities (Shipments, Routes, Warehouses, Weather Stops)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    try {
      viewer.entities.removeAll();
      const safeShipments = Array.isArray(shipments) ? shipments : [];
      const safeWarehouses = Array.isArray(warehouses) ? warehouses : [];
      const safeStops = Array.isArray(routeWeatherStops) ? routeWeatherStops : [];

      shipmentLookupRef.current = new Map(
        safeShipments.flatMap((shipment) => [
          [`shipment-${shipment.shipmentId}`, shipment],
          [`route-${shipment.shipmentId}`, shipment],
        ])
      );

      // Render Destination Warehouses
      safeWarehouses.forEach((wh) => {
        if (!wh || typeof wh.latitude !== "number" || typeof wh.longitude !== "number" || isNaN(wh.latitude) || isNaN(wh.longitude)) return;
        viewer.entities.add({
          id: `warehouse-${wh.id}`,
          position: Cartesian3.fromDegrees(wh.longitude, wh.latitude, 1000),
          point: {
            color: Color.fromCssColorString("#6366f1"),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            pixelSize: 12,
          },
          label: {
            text: `🏭 ${wh.name}`,
            font: "bold 11px sans-serif",
            fillColor: Color.fromCssColorString("#0f172a"),
            showBackground: true,
            backgroundColor: Color.WHITE.withAlpha(0.95),
            pixelOffset: new Cartesian2(0, 18),
          },
        });
      });

      // Render Active Shipments & Route Polylines
      safeShipments.forEach((shipment) => {
        if (!shipment) return;
        const isSelected = selectedShipment?.shipmentId === shipment.shipmentId;
        const color = shipmentColor(shipment);

        const trackingPoints = shipment.routeHistory || [];
        const destination = shipment.destinationWarehouse;
        // Only coordinates matter downstream, so keep this a plain lat/lng list
        // instead of fabricating a partial ShipmentTrackingPoint.
        const fullPoints: GeoPoint[] = trackingPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
        if (destination && typeof destination.latitude === "number" && typeof destination.longitude === "number" && !isNaN(destination.latitude) && !isNaN(destination.longitude) && !fullPoints.some((p) => p.latitude === destination.latitude && p.longitude === destination.longitude)) {
          fullPoints.push({ latitude: destination.latitude, longitude: destination.longitude });
        }

        const routePositions = positionsFrom(fullPoints);

        // Polyline Route Line
        if (routePositions.length > 1) {
          viewer.entities.add({
            id: `route-${shipment.shipmentId}`,
            polyline: {
              positions: routePositions,
              width: isSelected ? 6 : 3,
              material: isSelected ? color : color.withAlpha(0.6),
            },
          });
        }

        // Latest GPS Position Pin Marker
        const latest = shipment.latestTrackingPoint || trackingPoints[trackingPoints.length - 1];
        if (latest && typeof latest.latitude === "number" && typeof latest.longitude === "number" && !isNaN(latest.latitude) && !isNaN(latest.longitude)) {
          const score = typeof shipment.currentDelayRiskScore === "number" ? shipment.currentDelayRiskScore : 0;
          const riskLabel = shipment.riskLevel || "NORMAL";
          viewer.entities.add({
            id: `shipment-${shipment.shipmentId}`,
            position: Cartesian3.fromDegrees(latest.longitude, latest.latitude, 2000),
            point: {
              color: color,
              outlineColor: Color.WHITE,
              outlineWidth: 3,
              pixelSize: isSelected ? 16 : 12,
            },
            label: {
              text: `${shipment.poNumber || 'PO'} · ${score.toFixed(1)}đ (${riskLabel})`,
              font: "bold 12px sans-serif",
              fillColor: Color.WHITE,
              style: LabelStyle.FILL_AND_OUTLINE,
              outlineColor: Color.fromCssColorString("#0f172a"),
              outlineWidth: 3,
              showBackground: true,
              backgroundColor: Color.fromCssColorString("#0f172a").withAlpha(0.9),
              pixelOffset: new Cartesian2(0, -28),
            },
          });
        }
      });

      // Render Route Weather Stops
      safeStops.forEach((stop, index) => {
        if (!stop?.location || typeof stop.location.latitude !== "number" || typeof stop.location.longitude !== "number" || isNaN(stop.location.latitude) || isNaN(stop.location.longitude)) return;
        const style = weatherSeverityStyle[stop.severity] || weatherSeverityStyle.GOOD;
        viewer.entities.add({
          id: `weather-${index}`,
          position: Cartesian3.fromDegrees(stop.location.longitude, stop.location.latitude, 1500),
          point: {
            color: Color.fromCssColorString(style.color),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            pixelSize: 10,
          },
          label: {
            text: `🌩️ ${stop.location.name} · ${stop.severityLabel || 'Thời tiết'}`,
            font: "bold 11px sans-serif",
            fillColor: Color.WHITE,
            showBackground: true,
            backgroundColor: Color.fromCssColorString("#0f172a").withAlpha(0.85),
            pixelOffset: new Cartesian2(0, -22),
          },
        });
      });

      // Camera Focus on Selected Shipment
      if (selectedShipment) {
        const points: GeoPoint[] = (selectedShipment.routeHistory || []).map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
        const dest = selectedShipment.destinationWarehouse;
        if (dest) points.push({ latitude: dest.latitude, longitude: dest.longitude });
        const positions = positionsFrom(points);
        if (positions.length > 0) {
          const sphere = BoundingSphere.fromPoints(positions);
          const flyRange = Math.max(sphere.radius * 2.5, 350000);
          viewer.camera.flyToBoundingSphere(sphere, {
            duration: 1.2,
            offset: { heading: 0, pitch: -0.85, range: flyRange },
          });
        }
      }
    } catch (err) {
      console.error("Error rendering Cesium entities:", err);
    }
  }, [viewerReady, shipments, warehouses, routeWeatherStops, selectedShipment]);

  const handleResetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(108.2, 16.0, 1800000),
      duration: 1.0,
    });
  };

  return (
    <section className="relative h-[620px] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-900 shadow-2xs">
      <div ref={containerRef} className="h-full w-full" />

      {error && (
        <div role="alert" className="absolute inset-4 z-10 grid place-items-center rounded-xl bg-white p-6 text-center text-sm text-rose-700 shadow-lg">
          {error}
        </div>
      )}

      {/* Floating Status Bar: Quiet, Understated */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow-xs backdrop-blur-sm">
        <div>
          <div className="font-semibold text-slate-800">Không gian 3D Digital Twin</div>
          <div className="text-[10px] text-slate-400">Cuộn để zoom · Kéo để xoay · Bấm pin để xem chi tiết</div>
        </div>
        <button
          onClick={handleResetCamera}
          className="ml-1 p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
          title="Đặt lại góc nhìn toàn cảnh"
          aria-label="Đặt lại góc nhìn toàn cảnh"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend: Quiet and clear */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 space-y-1 rounded-lg border border-slate-200/80 bg-white/90 p-2.5 text-[11px] text-slate-700 shadow-xs backdrop-blur-sm">
        <div className="font-medium text-slate-800 mb-1">Mức độ rủi ro (PORS)</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500" />Rủi ro cao (&ge; 65đ)</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />Cảnh báo (&ge; 35đ)</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />An toàn (&lt; 35đ)</div>
      </div>
    </section>
  );
};
