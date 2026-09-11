namespace BikeSync.Application.Commands;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BikeSync.Domain.Entities;
using BikeSync.Domain.Events;
using BikeSync.Infrastructure.Persistence.Outbox;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

public sealed record RecordShipmentTrackingCommand(
    Guid ShipmentId,
    Guid PurchaseOrderId,
    Guid SupplierId,
    decimal Latitude,
    decimal Longitude,
    DateTimeOffset RecordedAt,
    string Source,          // "CarrierWebhook" | "ManualUpdate"
    string LocationName,
    decimal? SpeedKmh = null,
    string? StatusNote = null
);

public sealed record RecordShipmentTrackingResult(
    bool Success,
    bool IsDuplicateSkipped,
    Guid? TrackingPointId,
    decimal? SnapshotDelayRiskScore,
    string Message
);

/// <summary>
/// Interface trừu tượng DbContext chứa DbSet cần thiết cho Command Handler.
/// </summary>
public interface IBikeSyncDbContext
{
    DbSet<ShipmentTrackingPoint> ShipmentTrackingPoints { get; }
    DbSet<OutboxMessage> OutboxMessages { get; }

    /// <summary>
    /// Đọc snapshot điểm rủi ro gần nhất do Agent F4 (Risk Monitoring) đã tính và lưu trữ.
    /// TUYỆT ĐỐI KHÔNG TÍNH LẠI DELAY RISK SCORE TẠI ĐÂY.
    /// </summary>
    Task<decimal?> GetF4LatestRiskScoreSnapshotAsync(Guid purchaseOrderId, CancellationToken cancellationToken);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Command Handler ghi nhận tracking point mới từ Carrier Webhook hoặc cập nhật thủ công.
/// Đảm bảo tính Idempotency và tuân thủ Outbox Pattern.
/// </summary>
public class RecordShipmentTrackingCommandHandler
{
    private readonly IBikeSyncDbContext _dbContext;
    private readonly ILogger<RecordShipmentTrackingCommandHandler> _logger;

    public RecordShipmentTrackingCommandHandler(
        IBikeSyncDbContext dbContext,
        ILogger<RecordShipmentTrackingCommandHandler> logger)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<RecordShipmentTrackingResult> Handle(
        RecordShipmentTrackingCommand command,
        CancellationToken cancellationToken = default)
    {
        // -------------------------------------------------------------------------------------
        // 1. KIỂM TRA IDEMPOTENCY CẤP ỨNG DỤNG (Trước khi chạm ràng buộc CSDL)
        // Nếu đã tồn tại bản ghi cùng ShipmentId và RecordedAt -> bỏ qua an toàn (Idempotent success)
        // -------------------------------------------------------------------------------------
        var isExisting = await _dbContext.ShipmentTrackingPoints
            .AnyAsync(p => p.ShipmentId == command.ShipmentId && p.RecordedAt == command.RecordedAt, cancellationToken);

        if (isExisting)
        {
            _logger.LogInformation(
                "[IDEMPOTENT_SKIP] Đã nhận bản ghi tracking cho ShipmentId {ShipmentId} tại thời điểm {RecordedAt}. Bỏ qua trùng lặp.",
                command.ShipmentId, command.RecordedAt);

            return new RecordShipmentTrackingResult(
                Success: true,
                IsDuplicateSkipped: true,
                TrackingPointId: null,
                SnapshotDelayRiskScore: null,
                Message: "Bản ghi vị trí đã tồn tại trong hệ thống. Bỏ qua ghi đè (Idempotent)."
            );
        }

        // -------------------------------------------------------------------------------------
        // 2. TRUY VẤN SNAPSHOT TỪ AGENT F4 (TUYỆT ĐỐI KHÔNG TÍNH TOÁN LẠI)
        // Map chỉ là read-model chiếu dữ liệu đã được F4 đánh giá và lưu trữ.
        // -------------------------------------------------------------------------------------
        var snapshotRiskScore = await _dbContext.GetF4LatestRiskScoreSnapshotAsync(command.PurchaseOrderId, cancellationToken);

        // 3. Khởi tạo Entity
        var trackingPoint = new ShipmentTrackingPoint(
            shipmentId: command.ShipmentId,
            purchaseOrderId: command.PurchaseOrderId,
            supplierId: command.SupplierId,
            latitude: command.Latitude,
            longitude: command.Longitude,
            recordedAt: command.RecordedAt,
            source: command.Source,
            locationName: command.LocationName,
            speedKmh: command.SpeedKmh,
            statusNote: command.StatusNote
        );

        _dbContext.ShipmentTrackingPoints.Add(trackingPoint);

        // -------------------------------------------------------------------------------------
        // 4. TRANSACTIONAL OUTBOX PATTERN
        // Đưa Domain Event vào bảng Outbox cùng transaction để Subscriber đẩy ra SignalR/WebSocket.
        // Tuyệt đối không gọi WebSocket/SignalR trực tiếp trong luồng ghi CSDL này.
        // -------------------------------------------------------------------------------------
        var domainEvent = new ShipmentLocationUpdated(
            ShipmentId: command.ShipmentId,
            PurchaseOrderId: command.PurchaseOrderId,
            SupplierId: command.SupplierId,
            Latitude: command.Latitude,
            Longitude: command.Longitude,
            RecordedAt: command.RecordedAt,
            Source: command.Source,
            CurrentDelayRiskScore: snapshotRiskScore
        );

        var outboxMessage = new OutboxMessage(
            eventType: nameof(ShipmentLocationUpdated),
            payloadJson: JsonSerializer.Serialize(domainEvent)
        );

        _dbContext.OutboxMessages.Add(outboxMessage);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "[TRACKING_RECORDED] Đã lưu vị trí mới cho ShipmentId {ShipmentId} (Lat: {Lat}, Lng: {Lng}). Event đã đưa vào Outbox.",
                command.ShipmentId, command.Latitude, command.Longitude);

            return new RecordShipmentTrackingResult(
                Success: true,
                IsDuplicateSkipped: false,
                TrackingPointId: trackingPoint.Id,
                SnapshotDelayRiskScore: snapshotRiskScore,
                Message: "Ghi nhận vị trí lô hàng thành công."
            );
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UX_ShipmentTrackingPoints_ShipmentId_RecordedAt") == true)
        {
            // Bảo vệ tầng 2: Database Unique Constraint bắt được race-condition gửi đồng thời
            _logger.LogWarning(
                "[DB_UNIQUE_VIOLATION] Bắt được race-condition trùng lặp từ DB constraint cho ShipmentId {ShipmentId}, RecordedAt {RecordedAt}.",
                command.ShipmentId, command.RecordedAt);

            return new RecordShipmentTrackingResult(
                Success: true,
                IsDuplicateSkipped: true,
                TrackingPointId: null,
                SnapshotDelayRiskScore: snapshotRiskScore,
                Message: "Bản ghi trùng lặp được phát hiện và xử lý bởi ràng buộc Unique Constraint tại DB."
            );
        }
    }
}
