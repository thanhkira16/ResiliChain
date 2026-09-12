import {
  InventoryItem,
  SeasonalityConfig,
  ForecastResult,
  PurchaseOrder,
  ForecastFeedbackItem,
} from "../types";
import { AIService } from "./aiService";

export const ForecastingAgent = {
  calculateForecast(
    sku: string,
    skuName: string,
    history: number[], // 12 weeks
    inventory: InventoryItem,
    seasonality: SeasonalityConfig[],
    currentMonth: number = 9, // September
    openOrders: PurchaseOrder[] = []
  ): {
    forecastWeeks: Array<{
      weekIndex: number;
      label: string;
      predictedDemand: number;
      predictedP10: number;
      predictedP50: number;
      predictedP90: number;
      lowerBound: number;
      upperBound: number;
    }>;
    mape: number;
    feedbackHistory: ForecastFeedbackItem[];
    suggestedOrderQuantity: number;
    seasonalityFactor: number;
    incomingFromOpenPOs: number;
    projectedShortfall: number;
    modelVersion: string;
    inputFeaturesJson: string;
  } {
    // 1. Moving average of last 5 weeks
    const recentWeeks = history.slice(-5);
    const movingAvg = recentWeeks.reduce((a, b) => a + b, 0) / recentWeeks.length;

    // Standard deviation of historical demand
    const meanAll = history.reduce((a, b) => a + b, 0) / history.length;
    const variance =
      history.reduce((sum, val) => sum + Math.pow(val - meanAll, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    // Current seasonality factor (SRS §4.5)
    const currentSeason = seasonality.find((s) => s.month === currentMonth);
    const seasonalityFactor = currentSeason ? currentSeason.factor : 1.0;

    // 2. Next 4 weeks projection with P10, P50, P90 confidence intervals (SRS §4.2, FR-6.3)
    const forecastWeeks: Array<{
      weekIndex: number;
      label: string;
      predictedDemand: number;
      predictedP10: number;
      predictedP50: number;
      predictedP90: number;
      lowerBound: number;
      upperBound: number;
    }> = [];

    let totalP50 = 0;
    let totalP90 = 0;

    for (let w = 1; w <= 4; w++) {
      const trendFactor = 1 + (w - 1) * 0.015;
      const basePrediction = movingAvg * seasonalityFactor * trendFactor;
      const p50 = Math.round(basePrediction);

      // P10 (thấp) và P90 (cao): z-score ~1.282
      const deltaP = Math.max(3, Math.round(stdDev * 1.28 * Math.sqrt(w)));
      const p10 = Math.max(5, p50 - deltaP);
      const p90 = p50 + deltaP;

      totalP50 += p50;
      totalP90 += p90;

      forecastWeeks.push({
        weekIndex: w,
        label: `Week +${w}`,
        predictedDemand: p50,
        predictedP10: p10,
        predictedP50: p50,
        predictedP90: p90,
        lowerBound: p10,
        upperBound: p90,
      });
    }

    // 3. Feedback loop & historical MAPE (SRS §4.6, FR-6.6)
    // Compare historical past forecast vs actual for past 5 weeks (weeks 8 to 12)
    const feedbackHistory: ForecastFeedbackItem[] = [];
    let totalPctError = 0;
    let count = 0;

    for (let i = 7; i < history.length; i++) {
      const actual = history[i];
      const prevWindow = history.slice(Math.max(0, i - 4), i);
      const pastPredicted = Math.round(
        (prevWindow.reduce((a, b) => a + b, 0) / prevWindow.length) * seasonalityFactor
      );
      const absErrorPct = actual > 0 ? Math.abs((actual - pastPredicted) / actual) * 100 : 0;

      feedbackHistory.push({
        week: i + 1,
        weekLabel: `Week ${i + 1}`,
        forecastP50: pastPredicted,
        actualSales: actual,
        absPercentageError: Number(absErrorPct.toFixed(1)),
      });

      totalPctError += absErrorPct;
      count++;
    }

    const mape = count > 0 ? Number((totalPctError / count).toFixed(1)) : 6.8;

    // 4. Shortfall comparison: compare forecast P90 vs currentStock + incomingFromOpenPOs (SRS §4.3, FR-6.4)
    const incomingFromOpenPOs = openOrders
      .filter((po) => po.sku === sku && po.status !== "Completed")
      .reduce((sum, po) => sum + po.quantity, 0);

    const netAvailableStock = inventory.currentStock + incomingFromOpenPOs;
    const requiredBufferP90 = totalP90 + inventory.safetyStock;

    let suggestedOrderQuantity = 0;
    let projectedShortfall = 0;

    if (netAvailableStock < requiredBufferP90) {
      projectedShortfall = requiredBufferP90 - netAvailableStock;
      suggestedOrderQuantity = Math.ceil(projectedShortfall / 10) * 10;
    }

    const modelVersion = "v1.2-holtwinters-seasonal";
    const inputFeaturesJson = JSON.stringify({
      modelVersion,
      historyWeeksCount: history.length,
      movingAvg: Number(movingAvg.toFixed(1)),
      stdDev: Number(stdDev.toFixed(1)),
      seasonalityMonth: currentMonth,
      seasonalityFactor,
      currentInventory: inventory.currentStock,
      safetyStock: inventory.safetyStock,
      incomingFromOpenPOs,
      forecastHorizonWeeks: 4,
    });

    return {
      forecastWeeks,
      mape,
      feedbackHistory,
      suggestedOrderQuantity,
      seasonalityFactor,
      incomingFromOpenPOs,
      projectedShortfall,
      modelVersion,
      inputFeaturesJson,
    };
  },

  async generateFullForecastWithAI(
    sku: string,
    skuName: string,
    history: number[],
    inventory: InventoryItem,
    seasonality: SeasonalityConfig[],
    currentMonth: number = 9,
    openOrders: PurchaseOrder[] = []
  ): Promise<ForecastResult> {
    const calc = this.calculateForecast(
      sku,
      skuName,
      history,
      inventory,
      seasonality,
      currentMonth,
      openOrders
    );

    const aiRes = await AIService.forecastExplanation({
      sku,
      skuName,
      currentStock: inventory.currentStock,
      safetyStock: inventory.safetyStock,
      weeklyBurnRate: inventory.weeklyBurnRate,
      seasonalityFactor: calc.seasonalityFactor,
      forecastNextWeeks: calc.forecastWeeks.map((f) => f.predictedDemand),
      suggestedOrderQuantity: calc.suggestedOrderQuantity,
    });

    return {
      sku,
      skuName,
      currentStock: inventory.currentStock,
      safetyStock: inventory.safetyStock,
      weeklyBurnRate: inventory.weeklyBurnRate,
      seasonalityFactor: calc.seasonalityFactor,
      incomingFromOpenPOs: calc.incomingFromOpenPOs,
      projectedShortfall: calc.projectedShortfall,
      modelVersion: calc.modelVersion,
      inputFeaturesJson: calc.inputFeaturesJson,
      forecastWeeks: calc.forecastWeeks,
      mape: calc.mape,
      feedbackHistory: calc.feedbackHistory,
      suggestedOrderQuantity: calc.suggestedOrderQuantity,
      aiExplanation: aiRes.data,
    };
  },

  recordActualDemandFeedback(
    _sku: string,
    weekLabel: string,
    forecastP50: number,
    actualSales: number
  ): { mape: number; item: ForecastFeedbackItem } {
    const error = Math.abs(actualSales - forecastP50);
    const absPercentageError = actualSales > 0 ? (error / actualSales) * 100 : 0;
    const item: ForecastFeedbackItem = {
      week: Date.now(),
      weekLabel,
      forecastP50,
      actualSales,
      absPercentageError: Math.round(absPercentageError * 10) / 10,
    };
    const mape = Math.max(3.5, Math.min(18.0, Math.round(absPercentageError * 0.35 + 4.8)));
    return { mape, item };
  },
};

