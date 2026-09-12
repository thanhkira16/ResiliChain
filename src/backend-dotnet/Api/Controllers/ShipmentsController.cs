namespace BikeSync.Api.Controllers;

using System;
using System.Threading;
using System.Threading.Tasks;
using BikeSync.Application.Commands;
using BikeSync.Application.Queries;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ShipmentsController : ControllerBase
{
    private readonly RecordShipmentTrackingCommandHandler _commandHandler;
    private readonly IAtRiskShipmentsMapQueryService _queryService;

    public ShipmentsController(
        RecordShipmentTrackingCommandHandler commandHandler,
        IAtRiskShipmentsMapQueryService queryService)
    {
        _commandHandler = commandHandler ?? throw new ArgumentNullException(nameof(commandHandler));
        _queryService = queryService ?? throw new ArgumentNullException(nameof(queryService));
    }

    /// <summary>
    /// Webhook tiếp nhận dữ liệu định vị lô hàng từ Carrier hoặc cập nhật thủ công.
    /// Có cơ chế Idempotency chống trùng lặp tại tầng DB.
    /// </summary>
    [HttpPost("tracking-webhook")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ReceiveTrackingWebhook(
        [FromBody] RecordShipmentTrackingCommand command,
        CancellationToken cancellationToken)
    {
        if (command == null)
            return BadRequest(new { message = "Dữ liệu payload không hợp lệ." });

        var result = await _commandHandler.Handle(command, cancellationToken);

        return Ok(new
        {
            success = result.Success,
            isDuplicateSkipped = result.IsDuplicateSkipped,
            trackingPointId = result.TrackingPointId,
            snapshotDelayRiskScore = result.SnapshotDelayRiskScore,
            message = result.Message
        });
    }

    /// <summary>
    /// Query API đọc danh sách các lô hàng đang mở có rủi ro trễ hạn vượt ngưỡng (Read-Only Projection).
    /// Tuyệt đối không tính toán lại delay_risk_score; đọc snapshot từ F4.
    /// </summary>
    [HttpGet("at-risk-map")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAtRiskShipmentsMap(
        [FromQuery] string? riskLevel,
        [FromQuery] Guid? supplierId,
        [FromQuery] Guid? destinationWarehouseId,
        [FromQuery] DateTimeOffset? etaFrom,
        [FromQuery] DateTimeOffset? etaTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = new GetAtRiskShipmentsMapQuery(
            RiskLevel: riskLevel,
            SupplierId: supplierId,
            DestinationWarehouseId: destinationWarehouseId,
            EtaFrom: etaFrom,
            EtaTo: etaTo,
            Page: Math.Max(1, page),
            PageSize: Math.Clamp(pageSize, 1, 100)
        );

        var result = await _queryService.ExecuteAsync(query, cancellationToken);
        return Ok(result);
    }
}
