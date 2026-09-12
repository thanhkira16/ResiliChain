import {
  Incident,
  PurchaseOrder,
  Supplier,
  RFQItem,
  SupplierQuoteResponse,
  SourcingProposal,
  AuditLogEntry,
  AppNotification,
} from "../types";
import { AIService } from "./aiService";

export const SourcingAgent = {
  // 1. Find alternative backup suppliers
  findBackupSuppliers(
    sku: string,
    currentSupplierId: string,
    allSuppliers: Supplier[]
  ): Supplier[] {
    const candidates = allSuppliers.filter(
      (s) => s.id !== currentSupplierId && s.providedSkus.includes(sku)
    );

    // Sort by weighted reliability (60%) and shorter lead time (40%)
    return candidates.sort((a, b) => {
      const scoreA = a.reliabilityScore * 0.6 + (30 - a.averageLeadTimeDays) * 2;
      const scoreB = b.reliabilityScore * 0.6 + (30 - b.averageLeadTimeDays) * 2;
      return scoreB - scoreA;
    });
  },

  // 2. Generate and dispatch RFQs to top backup suppliers
  async generateAndSendRfqs(
    incident: Incident,
    po: PurchaseOrder,
    backupSuppliers: Supplier[]
  ): Promise<{ rfqs: RFQItem[]; logs: AuditLogEntry[]; notifs: AppNotification[] }> {
    const topBackups = backupSuppliers.slice(0, 3);
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const rfqs: RFQItem[] = [];
    const logs: AuditLogEntry[] = [];
    const notifs: AppNotification[] = [];

    // Calculate target delivery date needed to avoid assembly line stop
    const targetDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    for (let i = 0; i < topBackups.length; i++) {
      const supplier = topBackups[i];
      const rfqId = `RFQ-${incident.id.replace("INC-", "")}-${i + 1}`;

      const aiDraft = await AIService.draftRfq({
        incidentId: incident.id,
        poNumber: po.poNumber,
        sku: po.sku,
        skuName: po.skuName,
        quantity: po.quantity,
        targetDeliveryDate: targetDate,
        originalSupplierName: po.supplierName,
        backupSupplierName: supplier.name,
        historicalPrice: supplier.historicalPrice[po.sku] || po.unitPrice,
        notes: `Đơn hàng khẩn bù đắp trễ hẹn từ đối tác ${po.supplierName}. Tiêu chuẩn kiểm định OEM xe đạp xuất khẩu.`,
      });

      const rfqItem: RFQItem = {
        id: rfqId,
        incidentId: incident.id,
        correlationId: incident.correlationId,
        poNumber: po.poNumber,
        sku: po.sku,
        skuName: po.skuName,
        quantity: po.quantity,
        targetDeliveryDate: targetDate,
        backupSupplierId: supplier.id,
        backupSupplierName: supplier.name,
        emailSubject: aiDraft.data.subject,
        emailBody: aiDraft.data.body,
        termsSummary: aiDraft.data.termsSummary,
        sentAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        deadline,
        status: "Đã gửi",
      };

      rfqs.push(rfqItem);

      logs.push({
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        correlationId: incident.correlationId,
        agent: "Agent 2 (Negotiation & Sourcing)",
        action: "SEND_RFQ_TO_SUPPLIER",
        poNumber: po.poNumber,
        supplierName: supplier.name,
        sku: po.sku,
        inputSummary: `Gửi RFQ ${rfqId} cho NCC dự phòng: ${supplier.name} (Độ tin cậy: ${supplier.reliabilityScore}/100, Lead time chuẩn: ${supplier.averageLeadTimeDays} ngày).`,
        outputReasoning: `Nội dung thư RFQ soạn tự động bằng ${aiDraft.isLiveAI ? "Gemini 3.8 Flash AI" : "Mẫu thương mại chuẩn"}. Hạn chót phản hồi: 24h.`,
        metadata: { isLiveAI: aiDraft.isLiveAI },
      });
    }

    notifs.push({
      id: `NOTIF-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      title: `Agent 2 đã phát lệnh ${rfqs.length} RFQ khẩn cấp`,
      message: `Đã gửi yêu cầu báo giá cho ${topBackups.map((s) => s.name).join(", ")} để bù đắp đơn trễ ${po.poNumber}.`,
      type: "info",
      isRead: false,
      correlationId: incident.correlationId,
      linkTab: "rfq",
      incidentId: incident.id,
    });

    return { rfqs, logs, notifs };
  },

  // 3. Analyze responses and produce Human-In-The-Loop Proposal
  async evaluateAndCreateProposal(
    incident: Incident,
    po: PurchaseOrder,
    rfqs: RFQItem[]
  ): Promise<{ proposal: SourcingProposal; log: AuditLogEntry; notif: AppNotification }> {
    const validQuotes: Array<{
      supplierId: string;
      supplierName: string;
      unitPrice: number;
      proposedLeadTimeDays: number;
      proposedDeliveryDate: string;
      reliabilityScore: number;
      notes: string;
    }> = [];

    rfqs.forEach((r) => {
      if (r.response) {
        validQuotes.push({
          supplierId: r.response.supplierId,
          supplierName: r.response.supplierName,
          unitPrice: r.response.unitPrice,
          proposedLeadTimeDays: r.response.proposedLeadTimeDays,
          proposedDeliveryDate: r.response.proposedDeliveryDate,
          reliabilityScore: r.response.reliabilityScore,
          notes: r.response.notes,
        });
      }
    });

    if (validQuotes.length === 0) {
      throw new Error("Chưa có báo giá nào từ nhà cung cấp để phân tích");
    }

    // Exact Ranking Policy formula (SRS §3.3)
    // option_score = w1 * (1 - normalized_cost) + w2 * (1 - normalized_lead_time) + w3 * supplier_reliability_score
    const costs = validQuotes.map((q) => q.unitPrice * po.quantity);
    const leadTimes = validQuotes.map((q) => q.proposedLeadTimeDays);

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const costSpread = maxCost - minCost || 1;

    const minLead = Math.min(...leadTimes);
    const maxLead = Math.max(...leadTimes);
    const leadSpread = maxLead - minLead || 1;

    // Adaptive weights based on urgency (delay_risk_score from F4)
    // Critical (>= 80): prioritize delivery speed (w2 = 0.55, w1 = 0.25, w3 = 0.20)
    // Moderate (< 80): balanced cost and time (w1 = 0.45, w2 = 0.35, w3 = 0.20)
    const isCritical = incident.delayRiskScore >= 80;
    const w1 = isCritical ? 0.25 : 0.45; // Trọng số chi phí
    const w2 = isCritical ? 0.55 : 0.35; // Trọng số thời gian
    const w3 = 0.2; // Trọng số uy tín NCC

    const scoredQuotes = validQuotes.map((q) => {
      const totalCost = q.unitPrice * po.quantity;
      const normalizedCost = maxCost === minCost ? 0 : (totalCost - minCost) / costSpread;
      const normalizedLeadTime = maxLead === minLead ? 0 : (q.proposedLeadTimeDays - minLead) / leadSpread;
      const supplierReliabilityScore = Math.max(0, Math.min(1, q.reliabilityScore / 100));

      const costScoreContribution = w1 * (1 - normalizedCost);
      const timeScoreContribution = w2 * (1 - normalizedLeadTime);
      const reliabilityContribution = w3 * supplierReliabilityScore;

      const rawComposite = (costScoreContribution + timeScoreContribution + reliabilityContribution) * 100;
      const finalScore = Math.round(Math.min(99, Math.max(20, rawComposite)));

      const pros: string[] = [];
      const cons: string[] = [];

      if (q.proposedLeadTimeDays <= minLead) {
        pros.push(`Lead time ngắn nhất (${q.proposedLeadTimeDays} ngày, giao ngày ${q.proposedDeliveryDate})`);
      } else {
        cons.push(`Lead time dài hơn đối thủ tốt nhất (+${q.proposedLeadTimeDays - minLead} ngày)`);
      }

      if (q.reliabilityScore >= 85) {
        pros.push(`Điểm tin cậy NCC cao (${q.reliabilityScore}/100)`);
      } else if (q.reliabilityScore < 75) {
        cons.push(`Điểm uy tín ở mức trung bình (${q.reliabilityScore}/100)`);
      }

      if (totalCost <= minCost) {
        pros.push(`Tổng chi phí thấp nhất (${Number(totalCost).toLocaleString("vi-VN")} VNĐ)`);
      } else {
        const diffPct = Math.round(((totalCost - minCost) / minCost) * 100);
        cons.push(`Chi phí cao hơn ${diffPct}% so với phương án rẻ nhất`);
      }

      return {
        supplierId: q.supplierId,
        supplierName: q.supplierName,
        unitPrice: q.unitPrice,
        totalCost,
        leadTimeDays: q.proposedLeadTimeDays,
        pros,
        cons,
        score: finalScore,
        scoreBreakdown: {
          normalizedCost: Number(normalizedCost.toFixed(2)),
          normalizedLeadTime: Number(normalizedLeadTime.toFixed(2)),
          supplierReliabilityScore: Number(supplierReliabilityScore.toFixed(2)),
          w1,
          w2,
          w3,
          costScoreContribution: Number(costScoreContribution.toFixed(3)),
          timeScoreContribution: Number(timeScoreContribution.toFixed(3)),
          reliabilityContribution: Number(reliabilityContribution.toFixed(3)),
        },
        reasoning: `Công thức §3.3 [${isCritical ? "Khẩn cấp" : "Tiêu chuẩn"}]: Điểm = (${w1}×${(1 - normalizedCost).toFixed(2)}) + (${w2}×${(1 - normalizedLeadTime).toFixed(2)}) + (${w3}×${supplierReliabilityScore.toFixed(2)}) = ${(rawComposite / 100).toFixed(2)} → ${finalScore}/100.`,
      };
    });

    // Sort descending by composite score
    scoredQuotes.sort((a, b) => b.score - a.score);
    const rankings = scoredQuotes.slice(0, 3).map((r, idx) => ({
      ...r,
      rank: idx + 1,
    }));

    // Generate AI context or fallback
    let recommendation = "";
    let rejectedOptionsAnalysis: Array<{ supplierName: string; reason: string }> = [];

    try {
      const aiAnalysis = await AIService.analyzeProposals({
        incidentId: incident.id,
        poNumber: po.poNumber,
        sku: po.sku,
        skuName: po.skuName,
        quantity: po.quantity,
        requiredDeliveryDate: rfqs[0]?.targetDeliveryDate || "2026-09-15",
        originalSupplierName: po.supplierName,
        originalUnitPrice: po.unitPrice,
        responses: validQuotes,
      });
      recommendation = aiAnalysis.data.recommendation;
      rejectedOptionsAnalysis = aiAnalysis.data.rejectedOptionsAnalysis || [];
    } catch {
      recommendation = `Kiến nghị chọn ${rankings[0]?.supplierName} (Rank #1 - Điểm ${rankings[0]?.score}/100) vì tối ưu tốt nhất theo tiêu chí ${isCritical ? "thời gian giao hàng khẩn cấp" : "cân bằng chi phí và tiến độ"}.`;
      rejectedOptionsAnalysis = rankings.slice(1).map((r) => ({
        supplierName: r.supplierName,
        reason: `Điểm tổng hợp ${r.score}/100 thấp hơn phương án số 1 (${r.cons.join(", ") || "lead time dài hơn"}).`,
      }));
    }

    const proposalId = `PROP-${incident.id.replace("INC-", "")}-${Math.floor(100 + Math.random() * 900)}`;
    const bestOption = rankings[0];
    const totalValueVND = bestOption ? bestOption.totalCost : po.totalAmount;

    const proposal: SourcingProposal = {
      id: proposalId,
      incidentId: incident.id,
      correlationId: incident.correlationId,
      poNumber: po.poNumber,
      sku: po.sku,
      skuName: po.skuName,
      quantity: po.quantity,
      originalSupplierName: po.supplierName,
      originalUnitPrice: po.unitPrice,
      originalTotalCost: po.totalAmount,
      rankings,
      selectedRank: 1,
      recommendation:
        recommendation ||
        `Đề xuất chọn ${bestOption?.supplierName} (Rank #1) đạt ${bestOption?.score}/100 điểm tổng hợp.`,
      rejectedOptionsAnalysis: rejectedOptionsAnalysis.length > 0 ? rejectedOptionsAnalysis : [
        {
          supplierName: rankings[1]?.supplierName || "Phương án 2",
          reason: "Điểm xếp hạng tổng hợp thấp hơn phương án số 1.",
        },
      ],
      status: "Chờ duyệt",
      totalValueVND,
      createdAt: new Date().toISOString().replace("T", " ").substring(0, 19),
    };

    const isHighValue = totalValueVND >= 50000000;

    const log: AuditLogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      correlationId: incident.correlationId,
      agent: "Agent 2 (Negotiation & Sourcing)",
      action: "PROPOSE_ALTERNATIVE_SOURCING",
      poNumber: po.poNumber,
      supplierName: bestOption?.supplierName,
      sku: po.sku,
      inputSummary: `Áp dụng Ranking Policy (§3.3) cho ${validQuotes.length} báo giá (Rủi ro F4: ${incident.delayRiskScore}/100). Giá trị: ${Number(totalValueVND).toLocaleString("vi-VN")} VNĐ.`,
      outputReasoning: `Xếp hạng #1: ${bestOption?.supplierName} (${bestOption?.score}/100) với trọng số [Giá w1=${w1}, Thời gian w2=${w2}, Uy tín w3=${w3}]. Chuyển trạng thái incident -> PENDING_APPROVAL.`,
      metadata: {
        isHighValue,
        totalValueVND,
        isCritical,
        weights: { w1, w2, w3 },
      },
    };

    const notif: AppNotification = {
      id: `NOTIF-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      title: isHighValue
        ? "Đề xuất tài chính cần duyệt (≥50 triệu VNĐ)"
        : "Đề xuất mua hàng thay thế (<50 triệu VNĐ)",
      message: `Agent 2 đề xuất chuyển PO ${po.poNumber} sang ${bestOption?.supplierName || "NCC dự phòng"} (${Number(totalValueVND).toLocaleString("vi-VN")} VNĐ). Vui lòng vào màn hình Phê duyệt để xác nhận.`,
      type: isHighValue ? "escalation" : "warning",
      isRead: false,
      correlationId: incident.correlationId,
      linkTab: "approvals",
      proposalId: proposal.id,
      incidentId: incident.id,
    };

    return { proposal, log, notif };
  },
};
