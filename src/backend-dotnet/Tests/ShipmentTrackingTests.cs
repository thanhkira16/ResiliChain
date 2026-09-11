namespace BikeSync.Tests;

using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BikeSync.Application.Commands;
using BikeSync.Domain.Entities;
using BikeSync.Domain.Events;
using BikeSync.Infrastructure.Persistence.Configurations;
using BikeSync.Infrastructure.Persistence.Outbox;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

/// <summary>
/// Test DbContext giả lập in-memory SQLite để kiểm thử ràng buộc Unique Constraint thật của DB.
/// </summary>
public class TestBikeSyncDbContext : DbContext, IBikeSyncDbContext
{
    public DbSet<ShipmentTrackingPoint> ShipmentTrackingPoints { get; set; } = null!;
    public DbSet<OutboxMessage> OutboxMessages { get; set; } = null!;

    public decimal? MockF4LatestRiskScore { get; set; } = 82.50m;
    public int F4QueryCallCount { get; private set; } = 0;

    public TestBikeSyncDbContext(DbContextOptions<TestBikeSyncDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new ShipmentTrackingPointConfiguration());

        modelBuilder.Entity<OutboxMessage>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.EventType).IsRequired();
            b.Property(x => x.PayloadJson).IsRequired();
        });
    }

    public Task<decimal?> GetF4LatestRiskScoreSnapshotAsync(Guid purchaseOrderId, CancellationToken cancellationToken)
    {
        F4QueryCallCount++;
        // Trả về snapshot nguyên vẹn do Agent F4 đã ghi nhận từ trước
        return Task.FromResult(MockF4LatestRiskScore);
    }
}

public class ShipmentTrackingTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly TestBikeSyncDbContext _dbContext;
    private readonly RecordShipmentTrackingCommandHandler _handler;

    public ShipmentTrackingTests()
    {
        // Sử dụng SQLite In-Memory Connection mở liên tục để kiểm tra ràng buộc Unique Index thật
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<TestBikeSyncDbContext>()
            .UseSqlite(_connection)
            .Options;

        _dbContext = new TestBikeSyncDbContext(options);
        _dbContext.Database.EnsureCreated();

        _handler = new RecordShipmentTrackingCommandHandler(
            _dbContext,
            NullLogger<RecordShipmentTrackingCommandHandler>.Instance
        );
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task GivenDuplicateCarrierWebhook_WhenRecordedTwice_ThenDBConstraintPreventsDuplicatePoints()
    {
        // ARRANGE: Tạo payload tracking từ Webhook của Carrier
        var shipmentId = Guid.NewGuid();
        var poId = Guid.NewGuid();
        var supplierId = Guid.NewGuid();
        var recordedAt = DateTimeOffset.Parse("2026-09-11T10:30:00+07:00");

        var command = new RecordShipmentTrackingCommand(
            ShipmentId: shipmentId,
            PurchaseOrderId: poId,
            SupplierId: supplierId,
            Latitude: 20.8350m,
            Longitude: 106.7450m,
            RecordedAt: recordedAt,
            Source: "CarrierWebhook",
            LocationName: "Cảng Đình Vũ, Hải Phòng",
            SpeedKmh: 24.5m,
            StatusNote: "Ách tắc bến bãi container"
        );

        // ACT 1: Gửi lần thứ nhất
        var firstResult = await _handler.Handle(command, CancellationToken.None);

        // ACT 2: Carrier gửi lại lần thứ hai (At-least-once delivery / Network retry)
        var secondResult = await _handler.Handle(command, CancellationToken.None);

        // ASSERT:
        // 1. Lần đầu thành công và tạo bản ghi mới
        Assert.True(firstResult.Success);
        Assert.False(firstResult.IsDuplicateSkipped);
        Assert.NotNull(firstResult.TrackingPointId);

        // 2. Lần thứ hai được nhận diện là bản ghi trùng lặp (Idempotent Skip)
        Assert.True(secondResult.Success);
        Assert.True(secondResult.IsDuplicateSkipped);
        Assert.Null(secondResult.TrackingPointId);

        // 3. Kiểm tra trong DB chỉ tồn tại DUY NHẤT 1 bản ghi tracking cho shipment tại timestamp này
        var totalPointsInDb = await _dbContext.ShipmentTrackingPoints
            .CountAsync(p => p.ShipmentId == shipmentId && p.RecordedAt == recordedAt);

        Assert.Equal(1, totalPointsInDb);

        // 4. Kiểm tra Outbox chỉ phát ra 1 Domain Event duy nhất (không spam event trùng lặp)
        var totalOutboxEvents = await _dbContext.OutboxMessages.CountAsync();
        Assert.Equal(1, totalOutboxEvents);
    }

    [Fact]
    public async Task GivenTrackingUpdate_WhenHandling_ThenRiskScoreIsReadFromF4SnapshotAndNeverRecalculated()
    {
        // ARRANGE: F4 đã tính điểm rủi ro là 82.50
        const decimal expectedF4Score = 82.50m;
        _dbContext.MockF4LatestRiskScore = expectedF4Score;

        var command = new RecordShipmentTrackingCommand(
            ShipmentId: Guid.NewGuid(),
            PurchaseOrderId: Guid.NewGuid(),
            SupplierId: Guid.NewGuid(),
            Latitude: 21.1861m,
            Longitude: 106.1264m,
            RecordedAt: DateTimeOffset.UtcNow,
            Source: "CarrierWebhook",
            LocationName: "KCN Quế Võ, Bắc Ninh"
        );

        // ACT
        var result = await _handler.Handle(command, CancellationToken.None);

        // ASSERT:
        Assert.True(result.Success);
        Assert.Equal(expectedF4Score, result.SnapshotDelayRiskScore);

        // Kiểm tra F4 Snapshot được gọi đúng 1 lần để lấy giá trị có sẵn
        Assert.Equal(1, _dbContext.F4QueryCallCount);

        // Kiểm tra Domain Event trong Outbox chứa đúng snapshot điểm từ F4 mà không bị can thiệp/tính lại
        var outboxMsg = await _dbContext.OutboxMessages.SingleAsync();
        var domainEvent = JsonSerializer.Deserialize<ShipmentLocationUpdated>(outboxMsg.PayloadJson);

        Assert.NotNull(domainEvent);
        Assert.Equal(expectedF4Score, domainEvent!.CurrentDelayRiskScore);
    }
}
