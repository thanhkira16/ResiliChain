import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { AtRiskShipmentMapItem, DestinationWarehouse } from "../types";
import { RouteWeatherStop, weatherSeverityStyle } from "../services/weatherService";

interface GlobalRouteWeatherMapProps {
  shipments: AtRiskShipmentMapItem[];
  warehouses: DestinationWarehouse[];
  routeWeatherStops: RouteWeatherStop[];
  selectedShipment: AtRiskShipmentMapItem | null;
  onSelectShipment: (shipment: AtRiskShipmentMapItem) => void;
}

const positionOf = (latitude: number, longitude: number): LatLngTuple => [latitude, longitude];

function FocusRoute({ stops }: { stops: RouteWeatherStop[] }) {
  const map = useMap();
  const routeKey = stops.map((stop) => `${stop.location.latitude},${stop.location.longitude}`).join("|");

  useEffect(() => {
    const positions = stops.map((stop) => positionOf(stop.location.latitude, stop.location.longitude));
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [48, 48], maxZoom: 5 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 5);
    }
  }, [map, routeKey]);

  return null;
}

const shipmentColor = (shipment: AtRiskShipmentMapItem) =>
  shipment.riskLevel === "HIGH" ? "#ef4444" : shipment.riskLevel === "MEDIUM" ? "#f59e0b" : "#10b981";

export function GlobalRouteWeatherMap({
  shipments,
  warehouses,
  routeWeatherStops,
  selectedShipment,
  onSelectShipment,
}: GlobalRouteWeatherMapProps) {
  const weatherRoute = useMemo(
    () => routeWeatherStops.map((stop) => positionOf(stop.location.latitude, stop.location.longitude)),
    [routeWeatherStops]
  );

  return (
    <section className="relative h-[620px] overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-lg" aria-label="Bản đồ thế giới theo dõi lô hàng và thời tiết tuyến đường">
      <MapContainer center={[18, 0]} zoom={2} minZoom={2} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FocusRoute stops={routeWeatherStops} />

        {shipments.map((shipment) => {
          const points = [...shipment.routeHistory, {
            latitude: shipment.destinationWarehouse.latitude,
            longitude: shipment.destinationWarehouse.longitude,
          }].map((point) => positionOf(point.latitude, point.longitude));
          const color = shipmentColor(shipment);
          return (
            <Polyline key={`shipment-route-${shipment.shipmentId}`} positions={points} pathOptions={{ color, weight: selectedShipment?.shipmentId === shipment.shipmentId ? 4 : 2, opacity: 0.65 }} />
          );
        })}

        {weatherRoute.length > 1 && <Polyline positions={weatherRoute} pathOptions={{ color: "#334155", weight: 3, dashArray: "8 8", opacity: 0.9 }} />}

        {warehouses.map((warehouse) => (
          <CircleMarker key={warehouse.id} center={positionOf(warehouse.latitude, warehouse.longitude)} radius={8} pathOptions={{ color: "#312e81", fillColor: "#6366f1", fillOpacity: 0.95, weight: 2 }}>
            <Tooltip direction="top" offset={[0, -8]}>{warehouse.name}</Tooltip>
          </CircleMarker>
        ))}

        {shipments.map((shipment) => {
          const latest = shipment.latestTrackingPoint;
          const color = shipmentColor(shipment);
          return (
            <CircleMarker
              key={shipment.shipmentId}
              center={positionOf(latest.latitude, latest.longitude)}
              radius={selectedShipment?.shipmentId === shipment.shipmentId ? 10 : 8}
              pathOptions={{ color: "#ffffff", fillColor: color, fillOpacity: 1, weight: 2 }}
              eventHandlers={{ click: () => onSelectShipment(shipment) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <strong>{shipment.poNumber}</strong><br />
                Rủi ro giao hàng: {shipment.currentDelayRiskScore}/100
              </Tooltip>
            </CircleMarker>
          );
        })}

        {routeWeatherStops.map((stop, index) => {
          const style = weatherSeverityStyle[stop.severity];
          return (
            <CircleMarker
              key={`weather-${stop.location.latitude}-${stop.location.longitude}`}
              center={positionOf(stop.location.latitude, stop.location.longitude)}
              radius={11}
              pathOptions={{ color: "#ffffff", fillColor: style.color, fillOpacity: 1, weight: 3 }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.98}>
                <strong>{index + 1}. {stop.location.name} — {stop.severityLabel}</strong><br />
                {stop.condition}, {stop.temperatureC}°C · Gió {stop.windSpeedKmh} km/h · Mưa {stop.precipitationMm} mm
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
        <div className="font-semibold text-slate-900">Bản đồ thế giới · OpenStreetMap</div>
        <div className="mt-0.5 text-[11px] text-slate-500">Kéo để di chuyển, cuộn để phóng to. Tuyến thời tiết tự căn khung sau khi tải.</div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-slate-300 bg-white/95 p-2.5 text-[11px] text-slate-700 shadow-sm backdrop-blur space-y-1">
        <div className="font-semibold text-slate-900">Thời tiết tuyến đường</div>
        <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Đỏ · Nguy hiểm</div>
        <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />Cam · Thời tiết xấu</div>
        <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Vàng · Cần theo dõi</div>
        <div><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />Xanh · Ổn định</div>
      </div>
    </section>
  );
}
