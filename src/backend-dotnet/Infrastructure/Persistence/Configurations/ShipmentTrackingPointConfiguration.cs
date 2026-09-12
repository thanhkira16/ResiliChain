namespace BikeSync.Infrastructure.Persistence.Configurations;

using BikeSync.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

/// <summary>
/// Cấu hình EF Core Fluent API cho ShipmentTrackingPoint.
/// Đảm bảo tính toàn vẹn dữ liệu và tính Idempotency bắt buộc ở tầng DB.
/// </summary>
public class ShipmentTrackingPointConfiguration : IEntityTypeConfiguration<ShipmentTrackingPoint>
{
    public void Configure(EntityTypeBuilder<ShipmentTrackingPoint> builder)
    {
        builder.ToTable("ShipmentTrackingPoints", "logistics");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.ShipmentId)
            .IsRequired();

        builder.Property(x => x.PurchaseOrderId)
            .IsRequired();

        builder.Property(x => x.SupplierId)
            .IsRequired();

        // Định dạng độ chính xác cao cho tọa độ GPS WGS84
        builder.Property(x => x.Latitude)
            .HasPrecision(9, 6)
            .IsRequired();

        builder.Property(x => x.Longitude)
            .HasPrecision(9, 6)
            .IsRequired();

        builder.Property(x => x.RecordedAt)
            .IsRequired();

        builder.Property(x => x.Source)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.LocationName)
            .HasMaxLength(250)
            .IsRequired();

        builder.Property(x => x.SpeedKmh)
            .HasPrecision(5, 2);

        builder.Property(x => x.StatusNote)
            .HasMaxLength(500);

        builder.Property(x => x.CreatedAt)
            .IsRequired();

        // -----------------------------------------------------------------------------------------
        // RÀNG BUỘC DUY NHẤT (UNIQUE CONSTRAINT) CHO TÍNH TOÀN VẸN VÀ IDEMPOTENCY:
        // Đảm bảo không thể chèn 2 bản ghi có cùng (ShipmentId, RecordedAt).
        // Khi Carrier Webhook gửi trùng gói tin (at-least-once delivery), DB sẽ kích hoạt
        // Unique Constraint Violation (hoặc ON CONFLICT DO NOTHING), ngăn trùng lặp điểm trên tuyến đường.
        // -----------------------------------------------------------------------------------------
        builder.HasIndex(x => new { x.ShipmentId, x.RecordedAt })
            .IsUnique()
            .HasDatabaseName("UX_ShipmentTrackingPoints_ShipmentId_RecordedAt");

        // Index phụ phục vụ truy vấn tối ưu hóa (Query Side / Projection)
        builder.HasIndex(x => new { x.PurchaseOrderId, x.RecordedAt })
            .HasDatabaseName("IX_ShipmentTrackingPoints_PurchaseOrderId_RecordedAt");
    }
}
