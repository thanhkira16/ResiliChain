import { useEffect, useRef, useState } from "react";
import { BoundingSphere, Cartesian3, Color, Ion, LabelStyle, PolylineDashMaterialProperty, ScreenSpaceEventHandler, ScreenSpaceEventType, Terrain, Viewer } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { AtRiskShipmentMapItem, DestinationWarehouse } from "../types";
import { RouteWeatherStop, weatherSeverityStyle } from "../services/weatherService";

interface GlobalRouteWeatherMapProps {
  shipments: AtRiskShipmentMapItem[];
  warehouses: DestinationWarehouse[];
  routeWeatherStops: RouteWeatherStop[];
  selectedShipment: AtRiskShipmentMapItem | null;
  onSelectShipment: (shipment: AtRiskShipmentMapItem) => void;
}

const shipmentColor = (shipment: AtRiskShipmentMapItem) => shipment.riskLevel === "HIGH" ? Color.fromCssColorString("#ef4444") : shipment.riskLevel === "MEDIUM" ? Color.fromCssColorString("#f97316") : Color.fromCssColorString("#10b981");
const positionsFrom = (points: Array<{ latitude: number; longitude: number }>) => points.map((point) => Cartesian3.fromDegrees(point.longitude, point.latitude));

export function GlobalRouteWeatherMap({ shipments, warehouses, routeWeatherStops, selectedShipment, onSelectShipment }: GlobalRouteWeatherMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const shipmentLookupRef = useRef(new Map<string, AtRiskShipmentMapItem>());
  const [error, setError] = useState<string | null>(null);
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;

  useEffect(() => {
    if (!containerRef.current || !token) return;
    Ion.defaultAccessToken = token;
    let viewer: Viewer;
    try {
      viewer = new Viewer(containerRef.current, {
        terrain: Terrain.fromWorldTerrain(), animation: false, baseLayerPicker: false, fullscreenButton: true,
        geocoder: false, homeButton: true, infoBox: false, navigationHelpButton: false,
        sceneModePicker: true, selectionIndicator: false, timeline: false, shouldAnimate: false,
      });
      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = true;
      viewer.camera.setView({ destination: Cartesian3.fromDegrees(108, 18, 22_000_000) });
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: { position: Cartesian3 }) => {
        const picked = viewer.scene.pick(movement.position);
        const id = typeof picked?.id?.id === "string" ? picked.id.id : "";
        const shipment = shipmentLookupRef.current.get(id);
        if (shipment) onSelectShipment(shipment);
      }, ScreenSpaceEventType.LEFT_CLICK);
      return () => { handler.destroy(); viewer.destroy(); viewerRef.current = null; };
    } catch {
      setError("Không thể khởi tạo bản đồ Cesium. Vui lòng kiểm tra token Cesium ion.");
    }
  }, [onSelectShipment, token]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.entities.removeAll();
    shipmentLookupRef.current = new Map(
      shipments.flatMap((shipment) => [
        [`shipment-${shipment.shipmentId}`, shipment],
        [`route-${shipment.shipmentId}`, shipment],
      ]),
    );
    shipments.forEach((shipment) => {
      const color = shipmentColor(shipment);
      const route = positionsFrom([...shipment.routeHistory, shipment.destinationWarehouse]);
      const isSelected = selectedShipment?.shipmentId === shipment.shipmentId;
      if (route.length > 1) viewer.entities.add({ id: `route-${shipment.shipmentId}`, polyline: { positions: route, width: isSelected ? 7 : 3, material: color.withAlpha(isSelected ? 1 : 0.42), clampToGround: true } });
      const latest = shipment.latestTrackingPoint;
      viewer.entities.add({ id: `shipment-${shipment.shipmentId}`, position: Cartesian3.fromDegrees(latest.longitude, latest.latitude), point: { color, outlineColor: Color.WHITE, outlineWidth: 3, pixelSize: selectedShipment?.shipmentId === shipment.shipmentId ? 15 : 12, heightReference: 1 }, label: { text: `${shipment.poNumber} · ${shipment.currentDelayRiskScore}đ`, font: "600 12px sans-serif", style: LabelStyle.FILL_AND_OUTLINE, fillColor: Color.WHITE, outlineColor: Color.fromCssColorString("#0f172a"), outlineWidth: 4, pixelOffset: new Cartesian3(0, -26, 0), showBackground: true, backgroundColor: Color.fromCssColorString("#0f172a").withAlpha(0.82) } });
    });
    warehouses.forEach((warehouse) => viewer.entities.add({ id: `warehouse-${warehouse.id}`, position: Cartesian3.fromDegrees(warehouse.longitude, warehouse.latitude), point: { color: Color.fromCssColorString("#6366f1"), outlineColor: Color.WHITE, outlineWidth: 2, pixelSize: 10 }, label: { text: warehouse.name, font: "600 11px sans-serif", fillColor: Color.fromCssColorString("#312e81"), pixelOffset: new Cartesian3(0, 18, 0), showBackground: true, backgroundColor: Color.WHITE.withAlpha(0.9) } }));
    const weatherPositions = positionsFrom(routeWeatherStops.map((stop) => stop.location));
    if (weatherPositions.length > 1) viewer.entities.add({ id: "weather-route", polyline: { positions: weatherPositions, width: 3, material: new PolylineDashMaterialProperty({ color: Color.fromCssColorString("#334155"), dashLength: 14 }), clampToGround: true } });
    routeWeatherStops.forEach((stop, index) => {
      const style = weatherSeverityStyle[stop.severity];
      viewer.entities.add({ id: `weather-${index}`, position: Cartesian3.fromDegrees(stop.location.longitude, stop.location.latitude), point: { color: Color.fromCssColorString(style.color), outlineColor: Color.WHITE, outlineWidth: 3, pixelSize: 14 }, label: { text: `${index + 1}. ${stop.location.name} · ${stop.severityLabel}`, font: "600 11px sans-serif", fillColor: Color.WHITE, outlineColor: Color.fromCssColorString("#0f172a"), outlineWidth: 3, style: LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cartesian3(0, -25, 0) } });
    });
    const selectedRoute = selectedShipment ? positionsFrom([...selectedShipment.routeHistory, selectedShipment.destinationWarehouse]) : weatherPositions;
    if (selectedRoute.length > 1) viewer.camera.flyToBoundingSphere(BoundingSphere.fromPoints(selectedRoute), { duration: 1.2, offset: { heading: 0, pitch: -0.85, range: 0 } });
  }, [shipments, warehouses, routeWeatherStops, selectedShipment]);

  return <section className="relative h-[620px] overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-lg" aria-label="Bản đồ địa cầu Cesium theo dõi lô hàng và thời tiết tuyến đường">
    <div ref={containerRef} className="h-full w-full" />
    {!token && <div role="alert" className="absolute inset-4 z-10 grid place-items-center rounded-lg bg-white p-6 text-center text-sm text-slate-700 shadow"><div><p className="font-semibold text-slate-900">Chưa cấu hình Cesium ion</p><p className="mt-1">Thêm VITE_CESIUM_ION_TOKEN vào frontend/.env để hiển thị bản đồ 3D.</p></div></div>}
    {error && <div role="alert" className="absolute inset-4 z-10 grid place-items-center rounded-lg bg-white p-6 text-center text-sm text-red-700 shadow">{error}</div>}
    <div className="pointer-events-none absolute left-3 top-3 z-[1] rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur"><div className="font-semibold text-slate-900">Bản đồ địa cầu 3D · Cesium ion</div><div className="mt-0.5 text-[11px] text-slate-500">Kéo để xoay, cuộn để phóng to. Chọn điểm hoặc tuyến lô hàng để xem chi tiết.</div></div>
    <div className="pointer-events-none absolute bottom-3 left-3 z-[1] space-y-1 rounded-lg border border-slate-300 bg-white/95 p-2.5 text-[11px] text-slate-700 shadow-sm backdrop-blur"><div className="font-semibold text-slate-900">Thời tiết tuyến đường</div><div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Đỏ · Nguy hiểm</div><div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />Cam · Thời tiết xấu</div><div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Vàng · Cần theo dõi</div><div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Xanh · Ổn định</div></div>
  </section>;
}
