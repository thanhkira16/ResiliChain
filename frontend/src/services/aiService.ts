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
          subject: `[Resili chain] Yêu cầu báo giá khẩn cấp (RFQ) - ${payload.skuName} (PO: ${payload.poNumber})`,
          body: `Kính gửi Ban Giám đốc và Phòng Kinh doanh Quý đối tác ${payload.backupSupplierName},\n\nBộ phận Mua sắm Resili chain gửi yêu cầu báo giá khẩn cấp cho gói linh kiện ${payload.skuName} (${payload.sku}) số lượng ${Number(payload.quantity).toLocaleString("vi-VN")} chiếc.\n\nThời hạn giao hàng đề xuất: Trước ${payload.targetDeliveryDate}.\n\nKính đề nghị Quý công ty cập nhật phản hồi đơn giá và lead time trên Resili chain Supplier Portal trong vòng 24 giờ.\n\nTrân trọng cảm ơn!`,
          termsSummary: `Giao ${payload.quantity} chiếc trước ngày ${payload.targetDeliveryDate}. Thanh toán T/T 30 ngày sau nghiệm thu.`,
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
          `Thời gian giao hàng ${r.proposedLeadTimeDays} ngày`,
          `Điểm uy tín nhà cung cấp ${r.reliabilityScore}/100`,
        ],
        cons: [
          r.unitPrice > payload.originalUnitPrice
            ? `Đơn giá cao hơn ${Math.round(((r.unitPrice - payload.originalUnitPrice) / payload.originalUnitPrice) * 100)}% so với ban đầu`
            : "Cần nghiệm thu chất lượng kỹ càng",
        ],
        score: Math.min(98, Math.max(60, r.reliabilityScore - (r.proposedLeadTimeDays > 7 ? 10 : 0))),
        reasoning: `Nhà cung cấp đáp ứng tiến độ giao ${r.proposedDeliveryDate} với độ tin cậy ${r.reliabilityScore}%.`,
      }));

      scored.sort((a, b) => b.score - a.score);
      const rankings = scored.slice(0, 3).map((item, idx) => ({ ...item, rank: idx + 1 }));

      return {
        data: {
          rankings,
          recommendation: `Kiến nghị chọn ${rankings[0]?.supplierName || "phương án số 1"} để giải quyết trễ hạn kịp thời.`,
          rejectedOptionsAnalysis: scored.slice(3).map((item) => ({
            supplierName: item.supplierName,
            reason: `Điểm đánh giá (${item.score}) thấp hơn top 3 đề xuất.`,
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
          explanation: `Nhu cầu đối với ${payload.skuName} (${payload.sku}) dự kiến sẽ tăng trong các tuần tới với hệ số mùa vụ ${payload.seasonalityFactor}x. Tồn kho hiện tại ${payload.currentStock} đơn vị sắp chạm ngưỡng an toàn ${payload.safetyStock} đơn vị.`,
          keyFactors: [
            `Tốc độ tiêu thụ trung bình: ${payload.weeklyBurnRate} đơn vị/tuần`,
            `Hệ số mùa vụ xe đạp: ${payload.seasonalityFactor}x`,
            `Lượng tồn kho thực tế chỉ còn tương đương ${Math.max(1, Math.round(payload.currentStock / (payload.weeklyBurnRate || 1)))} tuần sản xuất`,
          ],
          procurementRecommendation: payload.suggestedOrderQuantity > 0
            ? `Cần tạo PO bổ sung ${payload.suggestedOrderQuantity} đơn vị ngay trong tuần này.`
            : "Lượng tồn kho hiện tại và đơn đang giao đủ an toàn, tiếp tục theo dõi chu kỳ kế tiếp.",
        },
        isLiveAI: false,
      };
    }
  },
};
