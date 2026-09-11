namespace BikeSync.Infrastructure.Realtime;

using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BikeSync.Domain.Events;
using BikeSync.Infrastructure.Persistence.Outbox;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

/// <summary>
/// SignalR Hub phục vụ đẩy tọa độ tracking theo thời gian thực cho client đang xem Shipment Tracking Map.
/// </summary>
public class ShipmentTrackingHub : Hub
{
    public const string GroupName = "AtRiskShipmentsMap";

    public async Task JoinAtRiskMapGroup()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName);
    }

    public async Task LeaveAtRiskMapGroup()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName);
    }
}

/// <summary>
/// Background Service đọc Outbox định kỳ (hoặc qua CDC/Listen) và đẩy Domain Event qua SignalR.
/// Đảm bảo F4 và API ghi webhook không bị coupling đồng bộ với SignalR Hub.
/// </summary>
public class OutboxEventDispatcherBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IHubContext<ShipmentTrackingHub> _hubContext;
    private readonly ILogger<OutboxEventDispatcherBackgroundService> _logger;

    public OutboxEventDispatcherBackgroundService(
        IServiceProvider serviceProvider,
        IHubContext<ShipmentTrackingHub> hubContext,
        ILogger<OutboxEventDispatcherBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OutboxEventDispatcherBackgroundService đã khởi động.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<DbContext>();

                var pendingMessages = await dbContext.Set<OutboxMessage>()
                    .Where(m => m.ProcessedAt == null)
                    .OrderBy(m => m.CreatedAt)
                    .Take(20)
                    .ToListAsync(stoppingToken);

                foreach (var msg in pendingMessages)
                {
                    if (msg.EventType == nameof(ShipmentLocationUpdated))
                    {
                        var eventData = JsonSerializer.Deserialize<ShipmentLocationUpdated>(msg.PayloadJson);
                        if (eventData != null)
                        {
                            // Đẩy sự kiện qua SignalR tới toàn bộ client trong group AtRiskShipmentsMap
                            await _hubContext.Clients
                                .Group(ShipmentTrackingHub.GroupName)
                                .SendAsync("ReceiveShipmentLocationUpdated", eventData, stoppingToken);

                            _logger.LogDebug(
                                "[SIGNALR_DISPATCHED] Đã đẩy sự kiện ShipmentLocationUpdated cho ShipmentId {ShipmentId}.",
                                eventData.ShipmentId);
                        }
                    }

                    msg.MarkProcessed();
                }

                if (pendingMessages.Count > 0)
                {
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Lỗi khi xử lý Outbox messages trong OutboxEventDispatcher.");
            }

            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }
}
