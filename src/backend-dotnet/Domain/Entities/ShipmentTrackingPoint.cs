namespace BikeSync.Domain.Entities;

using System;

/// <summary>
/// Entity lưu trữ lịch sử điểm định vị của lô hàng (Shipment tracking checkpoint).
/// Dữ liệu thu thập từ Webhook của hãng vận tải (Carrier) hoặc cập nhật thủ công từ bộ phận Logistics.
/// </summary>
public class ShipmentTrackingPoint
{
    public Guid Id { get; private set; }

    /// <summary>
    /// Định danh lô hàng trong hệ thống vận tải.
    /// </summary>
    public Guid ShipmentId { get; private set; }

    /// <summary>
    /// Mã đơn hàng PO liên kết.
    /// </summary>
    public Guid PurchaseOrderId { get; private set; }

    /// <summary>
    /// Nhà cung ứng phụ trách đơn hàng.
    /// </summary>
    public Guid SupplierId { get; private set; }

    /// <summary>
    /// Vĩ độ GPS (WGS84).
    /// </summary>
    public decimal Latitude { get; private set; }

    /// <summary>
    /// Kinh độ GPS (WGS84).
    /// </summary>
    public decimal Longitude { get; private set; }

    /// <summary>
    /// Thời điểm thiết bị GPS/Carrier ghi nhận vị trí này.
    /// Ràng buộc duy nhất (ShipmentId + RecordedAt) được áp dụng tại tầng CSDL để đảm bảo Idempotency.
    /// </summary>
    public DateTimeOffset RecordedAt { get; private set; }

    /// <summary>
    /// Nguồn gốc bản ghi: "CarrierWebhook" hoặc "ManualUpdate".
    /// </summary>
    public string Source { get; private set; }

    /// <summary>
    /// Tên vị trí địa lý / trạm kiểm soát (ví dụ: "Cảng Đình Vũ, Hải Phòng", "Trạm thu phí Nội Bài").
    /// </summary>
    public string LocationName { get; private set; }

    /// <summary>
    /// Vận tốc di chuyển (km/h) nếu có.
    /// </summary>
    public decimal? SpeedKmh { get; private set; }

    /// <summary>
    /// Ghi chú trạng thái từ carrier (ví dụ: "Ách tắc thông quan", "Đang lưu kho trung chuyển").
    /// </summary>
    public string? StatusNote { get; private set; }

    /// <summary>
    /// Thời điểm bản ghi được ghi nhận vào hệ thống BikeSync AI.
    /// </summary>
    public DateTimeOffset CreatedAt { get; private set; }

    // EF Core Constructor
    private ShipmentTrackingPoint() { }

    public ShipmentTrackingPoint(
        Guid shipmentId,
        Guid purchaseOrderId,
        Guid supplierId,
        decimal latitude,
        decimal longitude,
        DateTimeOffset recordedAt,
        string source,
        string locationName,
        decimal? speedKmh = null,
        string? statusNote = null)
    {
        if (latitude < -90m || latitude > 90m)
            throw new ArgumentOutOfRangeException(nameof(latitude), "Latitude phải nằm trong khoảng [-90, 90].");

        if (longitude < -180m || longitude > 180m)
            throw new ArgumentOutOfRangeException(nameof(longitude), "Longitude phải nằm trong khoảng [-180, 180].");

        Id = Guid.NewGuid();
        ShipmentId = shipmentId;
        PurchaseOrderId = purchaseOrderId;
        SupplierId = supplierId;
        Latitude = latitude;
        Longitude = longitude;
        RecordedAt = recordedAt;
        Source = source ?? "CarrierWebhook";
        LocationName = locationName ?? string.Empty;
        SpeedKmh = speedKmh;
        StatusNote = statusNote;
        CreatedAt = DateTimeOffset.UtcNow;
    }
}
