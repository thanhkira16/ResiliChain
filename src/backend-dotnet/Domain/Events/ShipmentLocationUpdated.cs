namespace BikeSync.Domain.Events;

using System;

public interface IDomainEvent
{
    Guid EventId => Guid.NewGuid();
    DateTimeOffset OccurredOn => DateTimeOffset.UtcNow;
}

/// <summary>
/// Domain Event phát sinh khi có điểm định vị mới của lô hàng.
/// Đảm bảo snapshot CurrentDelayRiskScore được lấy trực tiếp từ Agent F4 mà không tính lại.
/// </summary>
public sealed record ShipmentLocationUpdated(
    Guid ShipmentId,
    Guid PurchaseOrderId,
    Guid SupplierId,
    decimal Latitude,
    decimal Longitude,
    DateTimeOffset RecordedAt,
    string Source,                  // "CarrierWebhook" | "ManualUpdate"
    decimal? CurrentDelayRiskScore // snapshot tại thời điểm này, lấy từ F4, không tính lại
) : IDomainEvent;
