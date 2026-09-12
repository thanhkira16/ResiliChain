namespace BikeSync.Infrastructure.Persistence.Outbox;

using System;

/// <summary>
/// Bảng Outbox lưu trữ Domain Event trong cùng Database Transaction với thay đổi nghiệp vụ.
/// Đảm bảo At-Least-Once Delivery và giải phóng kết nối đồng bộ trực tiếp tới Message Broker/SignalR.
/// </summary>
public class OutboxMessage
{
    public Guid Id { get; private set; }
    public string EventType { get; private set; }
    public string PayloadJson { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? ProcessedAt { get; private set; }
    public string? ErrorMessage { get; private set; }
    public int RetryCount { get; private set; }

    private OutboxMessage() { }

    public OutboxMessage(string eventType, string payloadJson)
    {
        Id = Guid.NewGuid();
        EventType = eventType;
        PayloadJson = payloadJson;
        CreatedAt = DateTimeOffset.UtcNow;
        RetryCount = 0;
    }

    public void MarkProcessed()
    {
        ProcessedAt = DateTimeOffset.UtcNow;
        ErrorMessage = null;
    }

    public void MarkFailed(string error)
    {
        ErrorMessage = error;
        RetryCount++;
    }
}
