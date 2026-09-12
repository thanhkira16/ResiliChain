import { useEffect, useRef, useState } from "react";
import {
  Clock3,
  MapPin,
  Package,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import { AtRiskShipmentMapItem, Incident, PurchaseOrder } from "../types";

interface ShipmentDetailModalProps {
  shipment: AtRiskShipmentMapItem | null;
  order?: PurchaseOrder;
  incident?: Incident;
  onClose: () => void;
}

const riskStyle = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-orange-100 text-orange-800 border-orange-200",
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function ShipmentDetailModal({
  shipment,
  order,
  incident,
  onClose,
}: ShipmentDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [openSection, setOpenSection] = useState<"po" | "incident" | null>(null);

  useEffect(() => {
    if (!shipment) return;

    setOpenSection(null);
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shipment?.shipmentId, onClose]);

  if (!shipment) return null;

  const latest = shipment.latestTrackingPoint;
  const riskLabel = shipment.riskLevel === "HIGH" ? "High Risk" : shipment.riskLevel === "MEDIUM" ? "Caution" : "Normal";
  const formatDate = (value: string) => new Date(value).toLocaleString("en-US");
  const toggleSection = (section: "po" | "incident") => setOpenSection((current) => current === section ? null : section);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shipment-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="shipment-modal-title" className="text-lg font-bold text-slate-900">
                {shipment.poNumber}
              </h2>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${riskStyle[shipment.riskLevel]}`}>
                {riskLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{shipment.supplierName} · {shipment.carrierName}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close shipment details"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Package className="h-4 w-4 text-blue-600" />Order Information</h3>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-500">Component</dt><dd className="font-medium text-slate-800">{shipment.sku} - {shipment.skuName}</dd>
                <dt className="text-slate-500">Quantity</dt><dd className="font-medium text-slate-800">{shipment.quantity} {shipment.unit}</dd>
                <dt className="text-slate-500">Receiving Warehouse</dt><dd className="font-medium text-blue-700">{shipment.destinationWarehouse.name}</dd>
                <dt className="text-slate-500">Promised Date</dt><dd className="font-medium text-slate-800">{shipment.promisedDeliveryDate}</dd>
                <dt className="text-slate-500">Actual ETA</dt><dd className="font-medium text-slate-800">{shipment.expectedDeliveryDate}{shipment.delayDays > 0 ? ` (Delayed ${shipment.delayDays} days)` : ""}</dd>
              </dl>
            </section>

            <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><MapPin className="h-4 w-4 text-blue-600" />Latest GPS Location</h3>
              <p className="font-semibold text-slate-900">{latest.locationName}</p>
              <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-500">GPS Coordinates</dt><dd className="font-mono text-slate-700">{latest.latitude}, {latest.longitude}</dd>
                <dt className="text-slate-500">Recorded</dt><dd className="text-slate-700">{formatDate(latest.recordedAt)}</dd>
                <dt className="text-slate-500">Data Source</dt><dd className="text-slate-700">{latest.source}</dd>
              </dl>
              {latest.statusNote && <p className="mt-3 border-t border-blue-100 pt-3 text-sm italic text-slate-600">“{latest.statusNote}”</p>}
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldAlert className="h-4 w-4 text-amber-600" />Risk Breakdown</h3>
              <div className="flex items-center gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${shipment.riskLevel === "HIGH" ? "bg-red-100 text-red-700" : shipment.riskLevel === "MEDIUM" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>{shipment.currentDelayRiskScore}</span>
                <div><p className="font-semibold text-slate-900">Overall Risk Score / 100</p><p className="text-xs text-slate-500">Snapshot data · No recalculation in UI</p></div>
              </div>
              {shipment.riskBreakdown ? <p className="mt-3 text-sm text-slate-600">{shipment.riskBreakdown.formulaExplanation}</p> : <p className="mt-3 text-sm text-slate-500">Score read directly from risk monitoring snapshot record.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Truck className="h-4 w-4 text-blue-600" />Checkpoint History ({shipment.routeHistory.length})</h3>
              <ol className="space-y-2">
                {shipment.routeHistory.map((point, index) => (
                  <li key={point.id || `${point.recordedAt}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 p-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">{index + 1}</span>
                    <div className="min-w-0"><p className="font-medium text-slate-800">{point.locationName}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3 w-3" />{formatDate(point.recordedAt)} · {point.latitude}, {point.longitude}</p></div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        {openSection && (
          <section className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 md:mx-6 md:mb-6" aria-live="polite">
            {openSection === "po" ? (
              <>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Package className="h-4 w-4 text-blue-600" />Order File {shipment.poNumber}</h3>
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Shipment ID</dt><dd className="font-medium text-slate-800">{shipment.shipmentId}</dd></div>
                  <div><dt className="text-slate-500">Internal PO Code</dt><dd className="font-medium text-slate-800">{shipment.purchaseOrderId}</dd></div>
                  <div><dt className="text-slate-500">Supplier</dt><dd className="font-medium text-slate-800">{order?.supplierName || shipment.supplierName}</dd></div>
                  <div><dt className="text-slate-500">Tracking Number</dt><dd className="font-medium text-slate-800">{shipment.trackingNumber}</dd></div>
                  <div><dt className="text-slate-500">Order Date</dt><dd className="font-medium text-slate-800">{order?.orderDate || "Not synchronized"}</dd></div>
                  <div><dt className="text-slate-500">PO Status</dt><dd className="font-medium text-slate-800">{order?.status || "In Transit"}</dd></div>
                  <div><dt className="text-slate-500">Unit Price</dt><dd className="font-medium text-slate-800">{order ? `VND ${order.unitPrice.toLocaleString("en-US")}` : "Not synchronized"}</dd></div>
                  <div><dt className="text-slate-500">Total Amount</dt><dd className="font-medium text-slate-800">{order ? `VND ${order.totalAmount.toLocaleString("en-US")}` : "Not synchronized"}</dd></div>
                </dl>
                <div className="mt-3 border-t border-slate-200 pt-3 text-sm"><p className="font-medium text-slate-800">Actual / Expected Tracking</p><p className="mt-1 text-slate-600">{order?.actualOrExpectedDeliveryDate || shipment.expectedDeliveryDate} · {shipment.delayDays > 0 ? `Delayed ${shipment.delayDays} days compared to promise` : "On schedule"}</p>{order?.notes && <p className="mt-2 italic text-slate-500">PO Note: {order.notes}</p>}</div>
              </>
            ) : (
              <>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldAlert className="h-4 w-4 text-amber-600" />Risk Incident {incident?.id || shipment.incidentId ? `· ${incident?.id || shipment.incidentId}` : ""}</h3>
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Workflow State</dt><dd className="font-medium text-slate-800">{incident?.state || shipment.incidentState || "Incident not created"}</dd></div>
                  <div><dt className="text-slate-500">Processing Status</dt><dd className="font-medium text-slate-800">{incident?.status || "Monitoring"}</dd></div>
                  <div><dt className="text-slate-500">Snapshot Score</dt><dd className="font-medium text-slate-800">{incident?.delayRiskScore ?? shipment.currentDelayRiskScore} / 100</dd></div>
                  <div><dt className="text-slate-500">Trigger Threshold</dt><dd className="font-medium text-slate-800">{incident?.thresholdApplied ?? shipment.appliedThreshold} / 100</dd></div>
                  <div><dt className="text-slate-500">Detected At</dt><dd className="font-medium text-slate-800">{incident?.detectedAt || "Not synchronized"}</dd></div>
                  <div><dt className="text-slate-500">Agent 2 / RFQ</dt><dd className="font-medium text-slate-800">{incident ? (incident.agent2Triggered ? `${incident.rfqSentCount || 0} RFQs sent` : "Not triggered") : "No incident"}</dd></div>
                </dl>
                <p className="mt-3 text-sm text-slate-600">{incident?.summary || shipment.riskBreakdown?.formulaExplanation || "Read-only data from monitoring system; UI does not recalculate risk scores."}</p>
                {(incident?.riskBreakdown || shipment.riskBreakdown) && (() => {
                  const breakdown = incident?.riskBreakdown || shipment.riskBreakdown!;
                  return <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-amber-100 bg-white p-2"><p className="text-xs text-slate-500">1. Lateness ({breakdown.w1 * 100}%)</p><p className="mt-1 font-bold text-slate-800">{Math.round(breakdown.latenessFactor * 100)}% <span className="text-xs font-normal">({breakdown.delayDays} days / {breakdown.committedLeadTimeDays}d)</span></p></div><div className="rounded-lg border border-amber-100 bg-white p-2"><p className="text-xs text-slate-500">2. Supplier Risk ({breakdown.w2 * 100}%)</p><p className="mt-1 font-bold text-slate-800">{Math.round(breakdown.supplierReliabilityFactor * 100)}% <span className="text-xs font-normal">(reliability {Math.round((1 - breakdown.supplierReliabilityFactor) * 100)}/100)</span></p></div><div className="rounded-lg border border-amber-100 bg-white p-2"><p className="text-xs text-slate-500">3. Stock Shortage ({breakdown.w3 * 100}%)</p><p className="mt-1 font-bold text-slate-800">{Math.round(breakdown.inventoryBufferFactor * 100)}% <span className="text-xs font-normal">(stock {breakdown.currentStock}/{breakdown.safetyStock})</span></p></div></div>;
                })()}
              </>
            )}
          </section>
        )}

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">Close</button>
          <button type="button" onClick={() => toggleSection("incident")} aria-expanded={openSection === "incident"} className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"><ShieldAlert className="h-4 w-4" />View Incident</button>
          <button type="button" onClick={() => toggleSection("po")} aria-expanded={openSection === "po"} className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Package className="h-4 w-4" />Open PO Order</button>
        </footer>
      </section>
    </div>
  );
}
