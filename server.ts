import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Shared Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// Shipment Tracking Map & Real-time Stream (SRS FR-4.3)
// ----------------------------------------------------

// In-memory set for DB idempotency check simulation: Set of "shipmentId:recordedAt"
const recordedTrackingIndex = new Set<string>();

// Connected Real-time SSE Clients (Decoupled subscriber pattern)
const sseClients = new Set<express.Response>();

app.get("/api/shipments/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", message: "Real-time tracking stream active" })}\n\n`);

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// Webhook endpoint to receive carrier GPS tracking updates
app.post("/api/shipments/tracking-webhook", (req, res) => {
  const {
    shipmentId,
    purchaseOrderId,
    poNumber,
    supplierId,
    supplierName,
    latitude,
    longitude,
    locationName,
    recordedAt,
    source = "CarrierWebhook",
    speedKmh,
    statusNote,
    currentDelayRiskScore, // Snapshot from F4 - never recalculated
  } = req.body;

  if (!shipmentId || !recordedAt || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: "Missing required fields: shipmentId, recordedAt, latitude, longitude" });
  }

  // Idempotency check: unique constraint on (shipmentId, recordedAt)
  const compositeKey = `${shipmentId}:${recordedAt}`;
  if (recordedTrackingIndex.has(compositeKey)) {
    return res.json({
      success: true,
      isDuplicateSkipped: true,
      message: "Bản ghi vị trí đã tồn tại (Idempotent skip). Không tạo điểm trùng lặp.",
    });
  }

  recordedTrackingIndex.add(compositeKey);

  const newTrackingPoint = {
    id: `TRK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    shipmentId,
    purchaseOrderId,
    poNumber,
    supplierId,
    supplierName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    locationName: locationName || "Trạm kiểm soát trung chuyển",
    recordedAt,
    source,
    speedKmh: speedKmh ? Number(speedKmh) : undefined,
    statusNote,
    currentDelayRiskScore,
  };

  // Broadcast to all active SSE subscribers asynchronously (Outbox / Subscriber pattern)
  const payload = JSON.stringify({
    type: "SHIPMENT_LOCATION_UPDATED",
    event: {
      shipmentId,
      purchaseOrderId,
      poNumber,
      supplierId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      locationName: newTrackingPoint.locationName,
      recordedAt,
      source,
      speedKmh: newTrackingPoint.speedKmh,
      statusNote,
      currentDelayRiskScore,
    },
  });

  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }

  return res.json({
    success: true,
    isDuplicateSkipped: false,
    trackingPointId: newTrackingPoint.id,
    snapshotDelayRiskScore: currentDelayRiskScore,
    message: "Ghi nhận vị trí lô hàng thành công. Đã phát tán real-time qua subscriber.",
  });
});

// Read-only Query API for At-Risk Map
app.get("/api/shipments/at-risk-map", (req, res) => {
  const { riskLevel, supplierId, warehouseId, etaFrom, etaTo, page = "1", pageSize = "50" } = req.query;

  // Read-only query response structure (CQRS Query side)
  res.json({
    message: "Read-only projection for at-risk shipments map",
    filtersApplied: { riskLevel, supplierId, warehouseId, etaFrom, etaTo },
    page: Number(page),
    pageSize: Number(pageSize),
    status: "ok",
  });
});

// API 1: RFQ Generation
app.post("/api/ai/rfq", async (req, res) => {
  const {
    incidentId,
    poNumber,
    sku,
    skuName,
    quantity,
    targetDeliveryDate,
    backupSupplierName,
    notes,
  } = req.body;

  try {
    const ai = getGeminiAI();
    if (ai) {
      const prompt = `Bạn là AI Agent đàm phán & tìm nguồn cung (Sourcing & Negotiation Agent) của chuỗi cung ứng xe đạp BikeSync AI tại Việt Nam.
Hãy soạn thảo một thư yêu cầu báo giá khẩn (Request for Quotation - RFQ) chuyên nghiệp, lịch sự nhưng có tính cấp bách gửi đến nhà cung cấp dự phòng: ${backupSupplierName}.

Thông tin đơn hàng khẩn cấp:
- Mã sự cố điều phối: ${incidentId || "INC-AUTO"}
- Mã đơn hàng gốc tham chiếu: ${poNumber}
- Mã linh kiện (SKU): ${sku} - ${skuName}
- Số lượng yêu cầu: ${quantity} chiếc / bộ
- Ngày giao hàng cam kết mong muốn: ${targetDeliveryDate}
- Ghi chú kỹ thuật: ${notes || "Tiêu chuẩn chất lượng OEM xe đạp xuất khẩu, CO/CQ đầy đủ"}

Yêu cầu nội dung thư:
1. Tiêu đề email chuyên nghiệp rõ ràng.
2. Nội dung thư bằng tiếng Việt văn phong thương mại, nêu rõ lý do mở thầu khẩn, số lượng, quy cách, hạn chót báo giá (trong vòng 24h).
3. Nêu rõ tiêu chí chọn thầu: Giá cả hợp lý, tiến độ giao hàng nhanh, cam kết chất lượng.
4. Trả về kết quả JSON với format:
{
  "subject": "Tiêu đề email",
  "body": "Nội dung email đầy đủ chia đoạn rõ ràng",
  "termsSummary": "Tóm tắt các điều khoản chính yêu cầu"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "";
      const parsed = JSON.parse(text);
      return res.json({ success: true, data: parsed, isLiveAI: true });
    }
  } catch (error) {
    console.error("Gemini RFQ error, falling back to rule-based template:", error);
  }

  // Fallback high-quality template
  const fallbackSubject = `[BikeSync AI] Yêu cầu báo giá khẩn cấp (RFQ) linh kiện ${skuName} - PO Ref: ${poNumber}`;
  const fallbackBody = `Kính gửi Ban Giám đốc và Phòng Kinh doanh Quý đối tác ${backupSupplierName},

BikeSync AI - Bộ phận Mua sắm & Quản lý Chuỗi Cung Ứng Xe Đạp xin gửi lời chào trân trọng đến Quý công ty.

Do tiến độ sản xuất xe đạp theo đơn hàng xuất khẩu đang bước vào giai đoạn quyết định, chúng tôi mở gói thầu bổ sung khẩn cấp cho hạng mục linh kiện sau:

- Mã linh kiện (SKU): ${sku} (${skuName})
- Số lượng đặt hàng: ${Number(quantity).toLocaleString("vi-VN")} đơn vị
- Thời hạn giao hàng mong muốn: Trước ngày ${targetDeliveryDate}
- Tiêu chuẩn kỹ thuật: Đạt tiêu chuẩn kiểm định xuất khẩu, đầy đủ chứng chỉ nguồn gốc (CO/CQ).
- Mã tham chiếu nội bộ: ${incidentId || "INC-AUTO"} / ${poNumber}

Kính đề nghị Quý công ty phản hồi báo giá (đơn giá VNĐ, lead time cam kết và chính sách thanh toán/bảo hành) qua cổng tự phục vụ BikeSync Supplier Portal trước 17:00 ngày mai.

Rất mong nhận được sự hợp tác nhanh chóng từ Quý đối tác.

Trân trọng,
Bộ phận Mua sắm & Quản ứng Chuỗi Cung Ứng BikeSync AI`;

  return res.json({
    success: true,
    data: {
      subject: fallbackSubject,
      body: fallbackBody,
      termsSummary: `Giao ${Number(quantity).toLocaleString("vi-VN")} chiếc trước ${targetDeliveryDate}. Thanh toán T/T 30 ngày.`,
    },
    isLiveAI: false,
  });
});

// API 2: Analyze Quotes & Rank Supplier Proposals
app.post("/api/ai/analyze-proposals", async (req, res) => {
  const {
    incidentId,
    poNumber,
    sku,
    skuName,
    quantity,
    requiredDeliveryDate,
    originalSupplierName,
    originalUnitPrice,
    responses,
  } = req.body;

  if (!responses || !Array.isArray(responses) || responses.length === 0) {
    return res.status(400).json({ error: "No supplier responses provided" });
  }

  try {
    const ai = getGeminiAI();
    if (ai) {
      const prompt = `Bạn là AI Agent tối ưu hóa nguồn cung ứng (Sourcing Optimization Agent) của hệ thống BikeSync AI.
Sự cố phát hiện: Nhà cung cấp gốc (${originalSupplierName}) giao trễ đơn hàng ${poNumber} (${sku} - ${skuName}, số lượng ${quantity}).
Giá gốc ban đầu: ${Number(originalUnitPrice).toLocaleString("vi-VN")} VNĐ/đơn vị.
Hạn giao hàng bắt buộc: ${requiredDeliveryDate}.

Dưới đây là danh sách báo giá thực tế từ các nhà cung cấp dự phòng:
${JSON.stringify(responses, null, 2)}

Nhiệm vụ của bạn:
1. Đánh giá đa tiêu chí (Chi phí tổng thể, Thời gian giao hàng lead time, Độ tin cậy Reliability Score).
2. Xếp hạng tối đa 3 phương án tốt nhất (rank 1, 2, 3).
3. Mỗi phương án nêu rõ Ưu điểm (pros), Nhược điểm (cons), Điểm số tổng hợp (0-100), Lý do chọn.
4. Trình bày các phương án bị loại (hoặc xếp sau) và lý do từ chối cụ thể.
5. Soạn kết luận đề xuất (recommendation) súc tích để Trưởng phòng / Giám đốc phê duyệt.
6. LƯU Ý: Tuyệt đối tuân thủ nguyên tắc chỉ đề xuất (Recommendation), không tự động ký hợp đồng.

Trả về định dạng JSON thuần túy:
{
  "rankings": [
    {
      "rank": 1,
      "supplierId": "id",
      "supplierName": "Tên NCC",
      "unitPrice": 100000,
      "totalCost": 50000000,
      "leadTimeDays": 5,
      "pros": ["ưu điểm 1", "ưu điểm 2"],
      "cons": ["nhược điểm 1"],
      "score": 92,
      "reasoning": "Giải thích tại sao xếp hạng này"
    }
  ],
  "recommendation": "Đề xuất tóm tắt cho người phê duyệt",
  "rejectedOptionsAnalysis": [
    {
      "supplierName": "Tên NCC",
      "reason": "Lý do loại hoặc không ưu tiên"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "";
      const parsed = JSON.parse(text);
      return res.json({ success: true, data: parsed, isLiveAI: true });
    }
  } catch (error) {
    console.error("Gemini proposals analysis error, using algorithmic fallback:", error);
  }

  // Algorithmic fallback
  const scored = responses.map((r: any) => {
    const priceDiff = ((r.unitPrice - (originalUnitPrice || r.unitPrice)) / (originalUnitPrice || r.unitPrice)) * 100;
    // Score based on reliability (40%), price competitiveness (35%), lead time (25%)
    let score = (r.reliabilityScore || 80) * 0.4;
    score += Math.max(0, 100 - Math.max(0, priceDiff) * 3) * 0.35;
    score += Math.max(0, 100 - (r.proposedLeadTimeDays || 7) * 5) * 0.25;
    score = Math.min(99, Math.max(50, Math.round(score)));

    const pros: string[] = [];
    const cons: string[] = [];

    if (r.reliabilityScore >= 85) pros.push(`Độ tin cậy lịch sử cao (${r.reliabilityScore}/100)`);
    if (r.unitPrice <= (originalUnitPrice || r.unitPrice)) pros.push(`Đơn giá cạnh tranh, tiết kiệm ngân sách`);
    if (r.proposedLeadTimeDays <= 5) pros.push(`Giao hàng cực nhanh (${r.proposedLeadTimeDays} ngày)`);

    if (r.unitPrice > (originalUnitPrice || r.unitPrice)) cons.push(`Chi phí cao hơn ${Math.round(priceDiff)}% so với hợp đồng gốc`);
    if (r.proposedLeadTimeDays > 8) cons.push(`Thời gian giao hàng tương đối dài (${r.proposedLeadTimeDays} ngày)`);
    if (r.reliabilityScore < 75) cons.push(`Điểm uy tín nhà cung cấp ở mức trung bình (${r.reliabilityScore}/100)`);

    if (pros.length === 0) pros.push("Đáp ứng đầy đủ quy cách SKU yêu cầu");
    if (cons.length === 0) cons.push("Cần theo dõi sát cam kết chất lượng theo lô");

    return {
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      unitPrice: r.unitPrice,
      totalCost: r.unitPrice * quantity,
      leadTimeDays: r.proposedLeadTimeDays,
      pros,
      cons,
      score,
      reasoning: `Điểm đánh giá ${score}/100 dựa trên lead time ${r.proposedLeadTimeDays} ngày và mức giá ${Number(r.unitPrice).toLocaleString("vi-VN")} VNĐ.`,
    };
  });

  scored.sort((a: any, b: any) => b.score - a.score);

  const rankings = scored.slice(0, 3).map((item: any, idx: number) => ({
    ...item,
    rank: idx + 1,
  }));

  const rejectedOptionsAnalysis = scored.slice(3).map((item: any) => ({
    supplierName: item.supplierName,
    reason: `Điểm tổng hợp (${item.score}) thấp hơn top 3 do chênh lệch chi phí hoặc lead time kéo dài.`,
  }));

  const best = rankings[0];
  const recommendation = best
    ? `Kiến nghị lựa chọn ${best.supplierName} (Hạng 1 - Điểm ${best.score}/100) với tổng giá trị ${Number(best.totalCost).toLocaleString("vi-VN")} VNĐ, cam kết giao trong ${best.leadTimeDays} ngày để giải quyết dứt điểm sự cố ${incidentId || "thiếu linh kiện"}.`
    : "Chưa có đủ phương án thỏa mãn yêu cầu.";

  return res.json({
    success: true,
    data: {
      rankings,
      recommendation,
      rejectedOptionsAnalysis,
    },
    isLiveAI: false,
  });
});

// API 3: Demand Forecast Explanation
app.post("/api/ai/forecast-explanation", async (req, res) => {
  const {
    sku,
    skuName,
    currentStock,
    safetyStock,
    weeklyBurnRate,
    seasonalityFactor,
    forecastNextWeeks,
    suggestedOrderQuantity,
  } = req.body;

  try {
    const ai = getGeminiAI();
    if (ai) {
      const prompt = `Bạn là AI Agent dự báo nhu cầu (Demand Forecasting Agent) của BikeSync AI.
Hãy viết một bản phân tích ngắn gọn, súc tích (khoảng 3-4 câu) giải thích kết quả dự báo và đề xuất kế hoạch nhập hàng cho linh kiện xe đạp:

Dữ liệu đầu vào:
- Linh kiện: ${sku} - ${skuName}
- Tồn kho hiện tại: ${currentStock} đơn vị
- Ngưỡng an toàn (Safety stock): ${safetyStock} đơn vị
- Tốc độ tiêu thụ trung bình: ${weeklyBurnRate} đơn vị/tuần
- Hệ số mùa vụ áp dụng: ${seasonalityFactor}x
- Dự báo nhu cầu 4 tuần tới: ${forecastNextWeeks?.join(", ")} đơn vị/tuần
- Số lượng đề xuất đặt bổ sung: ${suggestedOrderQuantity} đơn vị

Yêu cầu trả về JSON:
{
  "explanation": "Đoạn giải thích súc tích bằng tiếng Việt về xu hướng nhu cầu và rủi ro hết hàng",
  "keyFactors": ["yếu tố 1", "yếu tố 2", "yếu tố 3"],
  "procurementRecommendation": "Hành động mua hàng cụ thể đề xuất cho Procurement Officer"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "";
      const parsed = JSON.parse(text);
      return res.json({ success: true, data: parsed, isLiveAI: true });
    }
  } catch (error) {
    console.error("Gemini forecast explanation error:", error);
  }

  // Fallback explanation
  const explanation = `Nhu cầu đối với ${skuName} (${sku}) dự kiến sẽ tăng trong các tuần tới do bước vào mùa cao điểm lắp ráp (hệ số mùa vụ ${seasonalityFactor}x). Với tốc độ tiêu thụ hiện tại ${weeklyBurnRate} chiếc/tuần, lượng tồn kho ${currentStock} chiếc sẽ chạm ngưỡng an toàn (${safetyStock} chiếc) trong khoảng ${Math.max(1, Math.round((currentStock - safetyStock) / (weeklyBurnRate * seasonalityFactor)))} tuần tới nếu không bổ sung kịp thời.`;

  return res.json({
    success: true,
    data: {
      explanation,
      keyFactors: [
        `Hệ số mùa vụ xe đạp hè-thu tăng ${Math.round((seasonalityFactor - 1) * 100)}%`,
        `Tốc độ tiêu thụ cơ sở: ${weeklyBurnRate} bộ/tuần`,
        `Độ trễ an toàn tồn kho hiện tại chỉ còn ${Math.max(1, Math.round(currentStock / weeklyBurnRate))} tuần`,
      ],
      procurementRecommendation: suggestedOrderQuantity > 0
        ? `Lập PO bổ sung ngay ${suggestedOrderQuantity} đơn vị để duy trì buffer 30 ngày an toàn.`
        : "Lượng tồn kho hiện tại đủ đáp ứng, tiếp tục giám sát trong chu kỳ tuần tiếp theo.",
    },
    isLiveAI: false,
  });
});

// Setup Vite dev server or serve production build
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BikeSync AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
