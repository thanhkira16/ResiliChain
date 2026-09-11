namespace BikeSync.Application.Queries;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

public sealed record GetAtRiskShipmentsMapQuery(
    string? RiskLevel = null,            // "ALL" | "HIGH" | "MEDIUM" | "LOW"
    Guid? SupplierId = null,
    Guid? DestinationWarehouseId = null,
    DateTimeOffset? EtaFrom = null,
    DateTimeOffset? EtaTo = null,
    int Page = 1,
    int PageSize = 50
);

public sealed record AtRiskShipmentMapDto(
    Guid ShipmentId,
    Guid PurchaseOrderId,
    string PoNumber,
    Guid SupplierId,
    string SupplierName,
    string Sku,
    string SkuName,
    int Quantity,
    WarehouseDto DestinationWarehouse,
    DateTimeOffset PromisedDeliveryDate,
    DateTimeOffset ExpectedDeliveryDate,
    int DelayDays,
    decimal CurrentDelayRiskScore,       // Snapshot lấy từ F4
    string RiskLevel,                    // "HIGH" | "MEDIUM" | "LOW"
    RiskBreakdownDto RiskBreakdown,      // Tái dùng công thức mục 2.3 SRS (không tính lại)
    Guid? ActiveIncidentId,
    string? IncidentStatus,
    TrackingPointDto LatestTrackingPoint,
    IReadOnlyList<TrackingPointDto> RouteHistory,
    DateTimeOffset LastUpdatedAt
);

public sealed record WarehouseDto(
    Guid Id,
    string Name,
    string Address,
    decimal Latitude,
    decimal Longitude
);

public sealed record TrackingPointDto(
    Guid Id,
    decimal Latitude,
    decimal Longitude,
    string LocationName,
    DateTimeOffset RecordedAt,
    string Source,
    decimal? SpeedKmh,
    string? StatusNote
);

public sealed record RiskBreakdownDto(
    decimal LatenessFactor,              // [0, 1] min(1, số ngày trễ / lead_time_cam_kết)
    decimal SupplierReliabilityFactor,  // [0, 1] 1 - supplier_reliability
    decimal InventoryBufferFactor,      // [0, 1] 1 - (tồn_kho_hiện_tại / safety_stock)
    decimal W1,                         // 0.50
    decimal W2,                         // 0.25
    decimal W3,                         // 0.25
    int DelayDays,
    int CommittedLeadTimeDays,
    int CurrentStock,
    int SafetyStock,
    string FormulaExplanation
);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize
);

/// <summary>
/// Interface cho Query Service bên phía Read-Model (CQRS Read Side).
/// Đọc trực tiếp từ DB Projection (ShipmentTrackingPoint + F4 Incidents), không có side effects.
/// </summary>
public interface IAtRiskShipmentsMapQueryService
{
    Task<PagedResult<AtRiskShipmentMapDto>> ExecuteAsync(
        GetAtRiskShipmentsMapQuery query,
        CancellationToken cancellationToken = default);
}
