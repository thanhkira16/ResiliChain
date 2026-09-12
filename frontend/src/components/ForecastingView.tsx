import React, { useState, useEffect } from "react";
import {
  InventoryItem,
  SeasonalityConfig,
  ForecastResult,
  PurchaseOrder,
  UserRole,
} from "../types";
import { ForecastingAgent } from "../services/forecastingAgent";
import {
  TrendingUp,
  Sparkles,
  Calendar,
  Package,
  Layers,
  CheckCircle2,
  Sliders,
  Plus,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface ForecastingViewProps {
  inventory: InventoryItem[];
  demandHistory: Record<string, number[]>;
  seasonality: SeasonalityConfig[];
  orders: PurchaseOrder[];
  onUpdateSeasonality: (updated: SeasonalityConfig[]) => void;
  onCreatePoFromForecast: (sku: string, quantity: number) => void;
  userRole: UserRole;
  initialSku?: string;
  onBack: () => void;
}

export const ForecastingView: React.FC<ForecastingViewProps> = ({
  inventory,
  demandHistory,
  seasonality,
  orders,
  onUpdateSeasonality,
  onCreatePoFromForecast,
  userRole,
  initialSku,
  onBack,
}) => {
  const [selectedSku, setSelectedSku] = useState<string>(
    initialSku || inventory[0]?.sku || "SKU-FRM-01"
  );
  const [currentMonth, setCurrentMonth] = useState<number>(9); // September
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [isLoadingForecast, setIsLoadingForecast] = useState<boolean>(false);
  const [editingSeasonality, setEditingSeasonality] = useState<boolean>(false);
  const [tempSeasonality, setTempSeasonality] = useState<SeasonalityConfig[]>(seasonality);
  const [createdPoSuccess, setCreatedPoSuccess] = useState<string | null>(null);
  const [actualDemandInput, setActualDemandInput] = useState<number>(52);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const currentItem = inventory.find((i) => i.sku === selectedSku) || inventory[0];
  const history = demandHistory[selectedSku] || [40, 42, 45, 43, 46, 48, 50, 52, 49, 54, 53, 56];

  const handleFeedbackSubmit = () => {
    if (!forecastResult || actualDemandInput <= 0) return;
    const currentForecast = forecastResult.forecastWeeks[0]?.predictedDemand || Math.round(history[history.length - 1]);
    const updatedFeedback = ForecastingAgent.recordActualDemandFeedback(
      selectedSku,
      `T-0 (Hiện tại)`,
      currentForecast,
      actualDemandInput
    );
    setFeedbackSuccess(
      `Đã ghi nhận số liệu thực tế ${actualDemandInput} chiếc. Mô hình đã cập nhật MAPE: ${updatedFeedback.mape}%.`
    );
    loadForecast(selectedSku);
  };

  const loadForecast = async (sku: string) => {
    setIsLoadingForecast(true);
    setCreatedPoSuccess(null);
    try {
      const item = inventory.find((i) => i.sku === sku) || inventory[0];
      const hist = demandHistory[sku] || [40, 42, 45, 43, 46, 48, 50, 52, 49, 54, 53, 56];
      const res = await ForecastingAgent.generateFullForecastWithAI(
        item.sku,
        item.name,
        hist,
        item,
        seasonality,
        currentMonth,
        orders
      );
      setForecastResult(res);
    } catch (e) {
      console.error("Forecasting load failed", e);
    } finally {
      setIsLoadingForecast(false);
    }
  };

  useEffect(() => {
    loadForecast(selectedSku);
  }, [selectedSku, currentMonth]);

  const handleSaveSeasonality = () => {
    onUpdateSeasonality(tempSeasonality);
    setEditingSeasonality(false);
    loadForecast(selectedSku);
  };

  // Prepare chart data combining 12 weeks of historical data + 4 weeks of forecast
  const chartData = [
    ...history.map((val, idx) => ({
      week: `T-${12 - idx}`,
      actual: val,
      predicted: null as number | null,
      lowerBound: null as number | null,
      upperBound: null as number | null,
    })),
    ...(forecastResult?.forecastWeeks || []).map((fw) => ({
      week: fw.label,
      actual: null as number | null,
      predicted: fw.predictedDemand,
      lowerBound: fw.lowerBound,
      upperBound: fw.upperBound,
    })),
  ];

  // Feedback loop: Past forecast vs actual comparison data
  const feedbackData = history.slice(4).map((actualVal, idx) => {
    const pastPredicted = Math.round(
      (history[idx] + history[idx + 1] + history[idx + 2] + history[idx + 3]) / 4
    );
    return {
      week: `Tuần ${idx + 5}`,
      actual: actualVal,
      forecast: pastPredicted,
      error: Math.abs(actualVal - pastPredicted),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header & SKU Selector */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">
              AGENT 3 — Dự Báo Nhu Cầu & Tự Động Đề Xuất Mua Hàng (Demand Forecasting)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Agent 3 phân tích 12 tuần lịch sử bán hàng kết hợp hệ số mùa vụ ngoại sinh, dự báo 4 tuần tới kèm dải tin cậy Confidence Interval và tự động tính toán nhu cầu đặt hàng bù đắp tồn kho.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"><ArrowLeft className="h-3.5 w-3.5" />Quay lại</button>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Chọn linh kiện xe đạp:</span>
            <select
              id="select-forecast-sku"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-300 font-semibold text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              {inventory.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Tháng:</span>
            <select
              id="select-forecast-month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="py-1.5 px-2 rounded-lg border border-slate-200 font-medium text-xs text-slate-700"
            >
              {seasonality.map((s) => (
                <option key={s.month} value={s.month}>
                  {s.label} ({s.factor}x)
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-refresh-forecast"
            onClick={() => loadForecast(selectedSku)}
            disabled={isLoadingForecast}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50"
            title="Tính lại dự báo"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingForecast ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {createdPoSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {createdPoSuccess}
          </span>
          <button
            onClick={() => setCreatedPoSuccess(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Forecast Metrics & AI Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metrics summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-slate-500">{currentItem.sku}</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{currentItem.name}</h4>
              </div>
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
                MAPE: {forecastResult?.mape || 7.2}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Tồn kho hiện tại</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {currentItem.currentStock} {currentItem.unit}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Ngưỡng an toàn</span>
                <span className="text-base font-bold text-amber-700 mt-0.5 block">
                  {currentItem.safetyStock} {currentItem.unit}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Tiêu thụ tb/tuần</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {currentItem.weeklyBurnRate} {currentItem.unit}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block text-[11px]">Hệ số mùa vụ</span>
                <span className="text-base font-bold text-purple-700 mt-0.5 block">
                  {forecastResult?.seasonalityFactor || 1.0}x
                </span>
              </div>
            </div>

            {/* Procurement Order Recommendation Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-600" />
                  <span>Khuyến nghị đặt hàng (Agent 3):</span>
                </span>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                  {forecastResult?.suggestedOrderQuantity && forecastResult.suggestedOrderQuantity > 0
                    ? `Cần đặt: ${forecastResult.suggestedOrderQuantity} ${currentItem.unit}`
                    : "Đủ tồn kho"}
                </span>
              </div>

              <p className="text-[11px] text-amber-800 leading-relaxed">
                {forecastResult?.suggestedOrderQuantity && forecastResult.suggestedOrderQuantity > 0
                  ? `Tổng nhu cầu 4 tuần tới cộng ngưỡng an toàn vượt quá lượng tồn kho thực tế. Đề xuất phát hành PO bổ sung ${forecastResult.suggestedOrderQuantity} đơn vị ngay.`
                  : "Lượng hàng tồn kho hiện hữu đủ đảm bảo kế hoạch lắp ráp cho 4 tuần kế tiếp."}
              </p>

              {forecastResult?.suggestedOrderQuantity && forecastResult.suggestedOrderQuantity > 0 && (
                <button
                  id="btn-create-po-from-forecast"
                  onClick={() => {
                    onCreatePoFromForecast(
                      selectedSku,
                      forecastResult?.suggestedOrderQuantity || 50
                    );
                    setCreatedPoSuccess(
                      `Đã tạo thành công PO mới bổ sung ${forecastResult.suggestedOrderQuantity} ${currentItem.unit} cho SKU ${selectedSku}. Đơn đã được cập nhật vào tab Đơn hàng (PO).`
                    );
                  }}
                  className="w-full mt-2 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo PO bổ sung ({forecastResult.suggestedOrderQuantity} {currentItem.unit})</span>
                </button>
              )}
            </div>
          </div>

          {/* Seasonality Factors Config Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs text-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-600" />
                <span>Tín hiệu ngoại sinh: Hệ số mùa vụ</span>
              </div>
              <button
                onClick={() => setEditingSeasonality(!editingSeasonality)}
                className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
              >
                {editingSeasonality ? "Hủy" : "Chỉnh sửa"}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {tempSeasonality.map((s, idx) => (
                <div
                  key={s.month}
                  className={`p-2 rounded border ${
                    s.month === currentMonth
                      ? "bg-purple-50 border-purple-300 font-bold text-purple-900"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <div className="text-[10px] text-slate-500 mb-1">T{s.month}</div>
                  {editingSeasonality ? (
                    <input
                      type="number"
                      step="0.05"
                      value={s.factor}
                      onChange={(e) => {
                        const copy = [...tempSeasonality];
                        copy[idx].factor = Number(e.target.value);
                        setTempSeasonality(copy);
                      }}
                      className="w-full text-center p-0.5 border rounded text-xs"
                    />
                  ) : (
                    <span className="font-semibold">{s.factor}x</span>
                  )}
                </div>
              ))}
            </div>

            {editingSeasonality && (
              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSaveSeasonality}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold"
                >
                  Lưu hệ số mùa vụ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chart & AI Explanation */}
        <div className="lg:col-span-8 space-y-4">
          {/* AI Narrative Box */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50/80 via-indigo-50/40 to-slate-50 border border-purple-200 text-xs space-y-2">
            <div className="flex items-center gap-2 text-purple-900 font-bold">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Giải thích chuyên sâu từ Agent 3 (Gemini 3.8 Flash AI):</span>
            </div>

            <p className="text-slate-700 leading-relaxed font-medium">
              {forecastResult?.aiExplanation.explanation ||
                "Đang phân tích các yếu tố mùa vụ và lượng hàng tồn kho..."}
            </p>

            {forecastResult?.aiExplanation.keyFactors && (
              <div className="pt-2 border-t border-purple-200/50 flex flex-wrap gap-2">
                {forecastResult.aiExplanation.keyFactors.map((factor, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-white border border-purple-200 text-purple-900 text-[11px] font-medium shadow-2xs"
                  >
                    • {factor}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Chart with Confidence Interval Band */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Biểu Đồ Dự Báo Nhu Cầu Kèm Dải Tin Cậy 85% (Confidence Interval)
                </h4>
                <p className="text-xs text-slate-500">
                  Lịch sử 12 tuần thực tế vs Dự báo 4 tuần tới (Vùng biên trên/dưới)
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 bg-purple-200 rounded" />
                <span className="text-slate-600 text-[11px]">Dải biến động dự báo</span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />

                  {/* Confidence Interval Band */}
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    name="Dải biên trên"
                    stroke="none"
                    fill="#c084fc"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey="lowerBound"
                    name="Dải biên dưới"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                  />

                  {/* Historical Demand */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Thực tế bán ra (12 tuần)"
                    stroke="#0f172a"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#0f172a" }}
                  />

                  {/* Predicted Demand */}
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Dự báo (4 tuần tới)"
                    stroke="#9333ea"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: "#9333ea" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feedback Loop: Past Forecast vs Actual */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Vòng Lặp Phản Hồi: So Sánh Dự Báo Quá Khứ vs Thực Tế (Feedback Loop)
                </h4>
                <p className="text-xs text-slate-500">
                  Đo lường độ lệch để tự động hiệu chỉnh mô hình (Sai số MAPE hiện tại: {forecastResult?.mape}%)
                </p>
              </div>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feedbackData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Thực tế"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Dự báo trước đó"
                    stroke="#64748b"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Feedback Input (SRS §4 Feedback Loop) */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">
                  Nhập số liệu bán thực tế tuần này ({currentItem.sku}):
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={actualDemandInput}
                  onChange={(e) => setActualDemandInput(Number(e.target.value))}
                  className="w-20 p-1 text-center font-bold border border-slate-300 rounded text-xs"
                />
                <span className="text-slate-500">{currentItem.unit}</span>
                <button
                  onClick={handleFeedbackSubmit}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded text-xs transition-colors"
                >
                  Gửi dữ liệu thực tế (Retrain)
                </button>
              </div>

              {feedbackSuccess && (
                <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  {feedbackSuccess}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
