export interface RfqDraftPayload {
  incidentId: string;
  poNumber: string;
  sku: string;
  skuName: string;
  quantity: number;
  targetDeliveryDate: string;
  originalSupplierName: string;
  backupSupplierName: string;
  historicalPrice?: number;
  notes?: string;
}

export interface RfqDraftResult {
  subject: string;
  body: string;
  termsSummary: string;
}

export interface AnalyzeQuotesPayload {
  incidentId: string;
  poNumber: string;
  sku: string;
  skuName: string;
  quantity: number;
  requiredDeliveryDate: string;
  originalSupplierName: string;
  originalUnitPrice: number;
  responses: Array<{
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    proposedLeadTimeDays: number;
    proposedDeliveryDate: string;
    reliabilityScore: number;
    notes: string;
  }>;
}

export interface AnalyzeQuotesResult {
  rankings: Array<{
    rank: number;
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    totalCost: number;
    leadTimeDays: number;
    pros: string[];
    cons: string[];
    score: number;
    reasoning: string;
  }>;
  recommendation: string;
  rejectedOptionsAnalysis: Array<{
    supplierName: string;
    reason: string;
  }>;
}

export interface ForecastExplanationPayload {
  sku: string;
  skuName: string;
  currentStock: number;
  safetyStock: number;
  weeklyBurnRate: number;
  seasonalityFactor: number;
  forecastNextWeeks: number[];
  suggestedOrderQuantity: number;
}

export interface ForecastExplanationResult {
  explanation: string;
  keyFactors: string[];
  procurementRecommendation: string;
}

export const AIService = {
  async draftRfq(payload: RfqDraftPayload): Promise<{ data: RfqDraftResult; isLiveAI: boolean }> {
    try {
      const res = await fetch("/api/ai/rfq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { data: json.data, isLiveAI: Boolean(json.isLiveAI) };
    } catch (e) {
      console.warn("API /api/ai/rfq call failed, using client fallback:", e);
      return {
        data: {
          subject: `[Resili chain] Urgent Request for Quotation (RFQ) - ${payload.skuName} (PO: ${payload.poNumber})`,
          body: `Dear Management and Sales Team at ${payload.backupSupplierName},\n\nThe Procurement Department at Resili chain hereby submits an urgent Request for Quotation (RFQ) for component batch ${payload.skuName} (${payload.sku}) in the quantity of ${Number(payload.quantity).toLocaleString("en-US")} units.\n\nProposed target delivery date: Prior to ${payload.targetDeliveryDate}.\n\nPlease update your unit price quote and lead time proposal on the Resili chain Supplier Portal within 24 hours.\n\nBest regards,\nResili chain Procurement Team`,
          termsSummary: `Deliver ${payload.quantity} units prior to ${payload.targetDeliveryDate}. Payment T/T 30 days post-acceptance inspection.`,
        },
        isLiveAI: false,
      };
    }
  },

  async analyzeProposals(payload: AnalyzeQuotesPayload): Promise<{ data: AnalyzeQuotesResult; isLiveAI: boolean }> {
    try {
      const res = await fetch("/api/ai/analyze-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { data: json.data, isLiveAI: Boolean(json.isLiveAI) };
    } catch (e) {
      console.warn("API /api/ai/analyze-proposals failed, using algorithmic fallback:", e);
      // Fallback rankings
      const scored = payload.responses.map((r, idx) => ({
        rank: idx + 1,
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        unitPrice: r.unitPrice,
        totalCost: r.unitPrice * payload.quantity,
        leadTimeDays: r.proposedLeadTimeDays,
        pros: [
          `Lead time of ${r.proposedLeadTimeDays} days`,
          `Supplier reliability score of ${r.reliabilityScore}/100`,
        ],
        cons: [
          r.unitPrice > payload.originalUnitPrice
            ? `Unit price ${Math.round(((r.unitPrice - payload.originalUnitPrice) / payload.originalUnitPrice) * 100)}% higher than original contract`
            : "Requires stringent incoming quality inspection",
        ],
        score: Math.min(98, Math.max(60, r.reliabilityScore - (r.proposedLeadTimeDays > 7 ? 10 : 0))),
        reasoning: `Supplier meets requested delivery date of ${r.proposedDeliveryDate} with a reliability score of ${r.reliabilityScore}%.`,
      }));

      scored.sort((a, b) => b.score - a.score);
      const rankings = scored.slice(0, 3).map((item, idx) => ({ ...item, rank: idx + 1 }));

      return {
        data: {
          rankings,
          recommendation: `Recommend selecting ${rankings[0]?.supplierName || "Option #1"} to mitigate delivery delay promptly.`,
          rejectedOptionsAnalysis: scored.slice(3).map((item) => ({
            supplierName: item.supplierName,
            reason: `Overall score (${item.score}) ranked lower than top 3 proposed options.`,
          })),
        },
        isLiveAI: false,
      };
    }
  },

  async forecastExplanation(payload: ForecastExplanationPayload): Promise<{ data: ForecastExplanationResult; isLiveAI: boolean }> {
    try {
      const res = await fetch("/api/ai/forecast-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { data: json.data, isLiveAI: Boolean(json.isLiveAI) };
    } catch (e) {
      console.warn("API /api/ai/forecast-explanation failed, using fallback:", e);
      return {
        data: {
          explanation: `Demand for ${payload.skuName} (${payload.sku}) is projected to increase over upcoming weeks with a seasonality factor of ${payload.seasonalityFactor}x. Current stock of ${payload.currentStock} units is approaching the safety threshold of ${payload.safetyStock} units.`,
          keyFactors: [
            `Average weekly burn rate: ${payload.weeklyBurnRate} units/week`,
            `Bicycle seasonality index: ${payload.seasonalityFactor}x`,
            `Effective inventory covers approximately ${Math.max(1, Math.round(payload.currentStock / (payload.weeklyBurnRate || 1)))} weeks of production`,
          ],
          procurementRecommendation: payload.suggestedOrderQuantity > 0
            ? `Recommended to issue a PO for ${payload.suggestedOrderQuantity} additional units within this week.`
            : "Current stock level and active incoming POs are sufficient. Maintain standard monitoring cycle.",
        },
        isLiveAI: false,
      };
    }
  },
};
