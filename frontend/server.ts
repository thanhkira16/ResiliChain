import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { getWeather, WeatherRequestError } from "./src/services/weatherGraph.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

// Weather Agent: a LangGraph workflow backed by the public Open-Meteo APIs.
app.post("/api/ai/weather", async (req, res) => {
  try {
    const data = await getWeather(req.body ?? {});
    return res.json({ success: true, data });
  } catch (error) {
    const knownError = error instanceof WeatherRequestError;
    if (!knownError) console.error("Weather agent error:", error);
    return res.status(knownError ? error.statusCode : 500).json({
      success: false,
      error: knownError ? error.message : "An error occurred while fetching weather data.",
    });
  }
});

// Route weather uses the same LangGraph workflow for every requested city.
// Individual failures are retained so one miss does not discard the whole route.
app.post("/api/ai/weather/route", async (req, res) => {
  const requestedCities = req.body?.cities;
  const cities: string[] = Array.isArray(requestedCities)
    ? [...new Set(requestedCities.filter((city): city is string => typeof city === "string").map((city) => city.trim()).filter(Boolean))]
    : [];

  if (cities.length < 2 || cities.length > 10 || cities.some((city) => city.length > 100)) {
    return res.status(400).json({ success: false, error: "Please provide between 2 and 10 valid city names." });
  }

  const data = await Promise.all(cities.map(async (city) => {
    try {
      return { city, data: await getWeather({ city }) };
    } catch (error) {
      const message = error instanceof WeatherRequestError ? error.message : "Unable to retrieve weather data.";
      return { city, error: message };
    }
  }));

  return res.json({ success: true, data });
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
      const prompt = `You are the AI Sourcing & Negotiation Agent of Resili chain.
Draft a professional, polite, yet urgent Request for Quotation (RFQ) letter to the backup supplier: ${backupSupplierName}.

Urgent order details:
- Incident Correlation ID: ${incidentId || "INC-AUTO"}
- Reference Original PO Number: ${poNumber}
- Component SKU: ${sku} - ${skuName}
- Required Quantity: ${quantity} units / sets
- Target Delivery Date: ${targetDeliveryDate}
- Technical Notes: ${notes || "Export-grade OEM bicycle quality standard, full CO/CQ documentation required"}

Requirements:
1. Clear, professional email subject line in English.
2. Email body written in professional business English explaining the emergency sourcing reason, quantity, specifications, and a 24-hour quotation deadline.
3. Explicit criteria: Reasonable pricing, accelerated lead time, quality assurance.
4. Return pure JSON:
{
  "subject": "Email Subject",
  "body": "Full body text with clear paragraph breaks",
  "termsSummary": "Summary of key terms"
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
  const fallbackSubject = `[Resili chain] Urgent Request for Quotation (RFQ) for ${skuName} - PO Ref: ${poNumber}`;
  const fallbackBody = `Dear Management and Sales Team at ${backupSupplierName},

Resili chain Procurement & Supply Chain Management hereby sends warm greetings.

Due to critical production schedules for export orders entering a decisive phase, we are opening an urgent supplementary sourcing package for the following component:

- SKU Code: ${sku} (${skuName})
- Order Quantity: ${Number(quantity).toLocaleString("en-US")} units
- Target Delivery Date: Prior to ${targetDeliveryDate}
- Quality Specification: Export certification standards, full CO/CQ documentation required.
- Internal Incident Reference: ${incidentId || "INC-AUTO"} / ${poNumber}

Kindly submit your quotation (unit price in VND, committed lead time, and payment/warranty terms) via the Resili chain Supplier Portal before 17:00 tomorrow.

We look forward to a swift and productive collaboration.

Best regards,
Resili chain Procurement & Supply Chain Team`;

  return res.json({
    success: true,
    data: {
      subject: fallbackSubject,
      body: fallbackBody,
      termsSummary: `Deliver ${Number(quantity).toLocaleString("en-US")} units before ${targetDeliveryDate}. Payment T/T 30 days.`,
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
      const prompt = `You are the AI Sourcing Optimization Agent of the Resili chain system.
Detected Incident: Primary supplier (${originalSupplierName}) delayed order ${poNumber} (${sku} - ${skuName}, quantity ${quantity}).
Original Contract Unit Price: ${Number(originalUnitPrice).toLocaleString("en-US")} VND/unit.
Required Delivery Deadline: ${requiredDeliveryDate}.

Supplier Responses:
${JSON.stringify(responses, null, 2)}

Your Tasks:
1. Conduct multi-criteria analysis (Total Cost, Lead Time, Reliability Score).
2. Rank up to 3 best options (rank 1, 2, 3).
3. Provide pros, cons, composite score (0-100), and reasoning for each rank.
4. List rejected options with clear rejection rationale.
5. Provide a concise executive summary recommendation for manager approval.
6. NOTE: Adhere strictly to human-in-the-loop (HITL) principles: Recommend only, do not auto-execute contracts.

Return pure JSON format:
{
  "rankings": [
    {
      "rank": 1,
      "supplierId": "id",
      "supplierName": "Supplier Name",
      "unitPrice": 100000,
      "totalCost": 50000000,
      "leadTimeDays": 5,
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1"],
      "score": 92,
      "reasoning": "Explanation for ranking"
    }
  ],
  "recommendation": "Executive summary recommendation",
  "rejectedOptionsAnalysis": [
    {
      "supplierName": "Supplier Name",
      "reason": "Rejection reason"
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

    if (r.reliabilityScore >= 85) pros.push(`High historical reliability score (${r.reliabilityScore}/100)`);
    if (r.unitPrice <= (originalUnitPrice || r.unitPrice)) pros.push(`Competitive pricing within budget baseline`);
    if (r.proposedLeadTimeDays <= 5) pros.push(`Rapid delivery lead time (${r.proposedLeadTimeDays} days)`);

    if (r.unitPrice > (originalUnitPrice || r.unitPrice)) cons.push(`Unit price ${Math.round(priceDiff)}% higher than original contract`);
    if (r.proposedLeadTimeDays > 8) cons.push(`Relatively long delivery lead time (${r.proposedLeadTimeDays} days)`);
    if (r.reliabilityScore < 75) cons.push(`Supplier reliability score is moderate (${r.reliabilityScore}/100)`);

    if (pros.length === 0) pros.push("Fully meets requested SKU specifications");
    if (cons.length === 0) cons.push("Requires close tracking of batch quality assurance");

    return {
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      unitPrice: r.unitPrice,
      totalCost: r.unitPrice * quantity,
      leadTimeDays: r.proposedLeadTimeDays,
      pros,
      cons,
      score,
      reasoning: `Score of ${score}/100 based on lead time of ${r.proposedLeadTimeDays} days and unit price of ${Number(r.unitPrice).toLocaleString("en-US")} VND.`,
    };
  });

  scored.sort((a: any, b: any) => b.score - a.score);

  const rankings = scored.slice(0, 3).map((item: any, idx: number) => ({
    ...item,
    rank: idx + 1,
  }));

  const rejectedOptionsAnalysis = scored.slice(3).map((item: any) => ({
    supplierName: item.supplierName,
    reason: `Composite score (${item.score}) lower than top 3 due to price variance or extended lead time.`,
  }));

  const best = rankings[0];
  const recommendation = best
    ? `Recommend selecting ${best.supplierName} (Rank #1 - Score ${best.score}/100) with total value of ${Number(best.totalCost).toLocaleString("en-US")} VND, committed lead time of ${best.leadTimeDays} days to resolve incident ${incidentId || "supply shortage"}.`
    : "Insufficient viable supplier proposals.";

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
      const prompt = `You are the AI Demand Forecasting Agent of Resili chain.
Write a concise, high-level executive summary (3-4 sentences) explaining the forecast results and replenishment recommendation for the component:

Input Data:
- Component: ${sku} - ${skuName}
- Current Stock: ${currentStock} units
- Safety Stock Threshold: ${safetyStock} units
- Average Weekly Burn Rate: ${weeklyBurnRate} units/week
- Applied Seasonality Factor: ${seasonalityFactor}x
- 4-Week Demand Forecast: ${forecastNextWeeks?.join(", ")} units/week
- Suggested Reorder Quantity: ${suggestedOrderQuantity} units

Return JSON:
{
  "explanation": "Concise summary in English regarding demand trends and stockout risks",
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "procurementRecommendation": "Specific actionable recommendation for the Procurement Officer"
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
  const explanation = `Demand for ${skuName} (${sku}) is projected to rise in coming weeks due to peak assembly season (seasonality factor ${seasonalityFactor}x). At the current burn rate of ${weeklyBurnRate} units/week, current stock of ${currentStock} units will hit safety threshold (${safetyStock} units) in approximately ${Math.max(1, Math.round((currentStock - safetyStock) / (weeklyBurnRate * seasonalityFactor)))} weeks if not replenished.`;

  return res.json({
    success: true,
    data: {
      explanation,
      keyFactors: [
        `Peak season demand multiplier: +${Math.round((seasonalityFactor - 1) * 100)}%`,
        `Baseline burn rate: ${weeklyBurnRate} units/week`,
        `Effective inventory buffer remaining: ~${Math.max(1, Math.round(currentStock / weeklyBurnRate))} weeks`,
      ],
      procurementRecommendation: suggestedOrderQuantity > 0
        ? `Issue a PO for ${suggestedOrderQuantity} units immediately to maintain a 30-day safety buffer.`
        : "Current inventory levels are sufficient. Continue standard weekly monitoring cycle.",
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
    console.log(`Resili chain Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
