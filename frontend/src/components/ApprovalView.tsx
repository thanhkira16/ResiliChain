import React, { useState, useEffect } from "react";
import { SourcingProposal, UserRole } from "../types";
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Check,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
  XCircle,
} from "lucide-react";

interface ApprovalViewProps {
  proposals: SourcingProposal[];
  onApproveProposal: (
    proposalId: string,
    selectedRank: number,
    customData?: { unitPrice: number; leadTimeDays: number; notes: string }
  ) => { success: boolean; message: string };
  onRejectProposal: (proposalId: string, reason: string) => void;
  userRole: UserRole;
  activeIncidentId?: string | null;
  onBack: () => void;
}

const formatPriceDelta = (proposedPrice: number, basePrice: number) => {
  const delta = proposedPrice - basePrice;
  if (delta === 0) return { text: "Bằng giá ban đầu", type: "neutral" as const };
  const percent = Math.abs((delta / basePrice) * 100).toFixed(1);
  const formatted = Math.abs(delta).toLocaleString("vi-VN");
  if (delta < 0) {
    return {
      text: `Tiết kiệm ${formatted} đ (-${percent}%)`,
      type: "saving" as const,
    };
  }
  return {
    text: `Tăng ${formatted} đ (+${percent}%)`,
    type: "increase" as const,
  };
};

export const ApprovalView: React.FC<ApprovalViewProps> = ({
  proposals,
  onApproveProposal,
  onRejectProposal,
  userRole: _userRole,
  onBack,
}) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    proposals.find((p) => p.status === "Chờ duyệt")?.id || proposals[0]?.id || null
  );

  useEffect(() => {
    if ((!selectedProposalId || !proposals.some((p) => p.id === selectedProposalId)) && proposals.length > 0) {
      const pending = proposals.find((p) => p.status === "Chờ duyệt" || p.status === "Pending");
      setSelectedProposalId(pending ? pending.id : proposals[0].id);
    }
  }, [proposals, selectedProposalId]);

  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("Chi phí vượt dự phòng rủi ro");
  const [customRejectReason, setCustomRejectReason] = useState<string>("");
  const [expandedScoreRank, setExpandedScoreRank] = useState<number | null>(null);

  const currentProposal = proposals.find((p) => p.id === selectedProposalId) || proposals[0];

  const handleApprove = (rank: number) => {
    if (!currentProposal) return;
    const result = onApproveProposal(currentProposal.id, rank);
    if (result.success) {
      setActionAlert({ type: "success", text: result.message });
      setIsRejecting(false);
    } else {
      setActionAlert({ type: "error", text: result.message });
    }
  };

  const handleConfirmReject = () => {
    if (!currentProposal) return;
    const finalReason = rejectReason === "Khác" ? customRejectReason || "Không đạt tiêu chí" : rejectReason;
    onRejectProposal(currentProposal.id, finalReason);
    setIsRejecting(false);
    setActionAlert({
      type: "success",
      text: `Đã từ chối phương án thay thế cho đơn hàng ${currentProposal.poNumber}.`,
    });
  };

  if (!currentProposal) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center space-y-4 shadow-2xs">
        <CheckCircle2 className="w-8 h-8 text-emerald-600/80 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900">Không có đề xuất nào chờ duyệt</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Tất cả sự cố đã có phương án xử lý hoặc chưa phát sinh đề xuất mới từ mô hình tối ưu hóa nguồn cung.
        </p>
        <button
          onClick={onBack}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại Rủi ro & Sự cố</span>
        </button>
      </div>
    );
  }

  const isPending = currentProposal.status === "Chờ duyệt" || currentProposal.status === "Pending";
  const isApproved = currentProposal.status === "Đã duyệt";
  const isRejected = currentProposal.status === "Từ chối";

  return (
    <div className="space-y-6">
      {/* Calm Operational Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/70">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 mb-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Rủi ro & Sự cố</span>
          </button>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            Phê duyệt Phương án Nhà cung cấp Thay thế
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xem xét các phương án tối ưu hóa đa tiêu chí và quyết định phê duyệt 1-Click
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200/70 px-2.5 py-1 rounded-lg font-mono tabular-nums">
            {proposals.filter((p) => p.status === "Chờ duyệt" || p.status === "Pending").length} đề xuất chờ duyệt
          </span>
        </div>
      </div>

      {actionAlert && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-lg text-xs flex items-center justify-between border transition-all duration-150 ${
            actionAlert.type === "success"
              ? "bg-emerald-50/80 border-emerald-200/70 text-emerald-800"
              : "bg-rose-50/80 border-rose-200/70 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{actionAlert.text}</span>
          </div>
          <button
            onClick={() => setActionAlert(null)}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Proposals Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Danh sách đề xuất</span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">{proposals.length} PO</span>
          </div>

          <div className="space-y-2" role="tablist" aria-label="Danh sách đề xuất thay thế">
            {proposals.map((p) => {
              const isSelected = p.id === currentProposal.id;
              const pPending = p.status === "Chờ duyệt" || p.status === "Pending";
              const pApproved = p.status === "Đã duyệt";
              const pRejected = p.status === "Từ chối";

              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedProposalId(p.id);
                    setActionAlert(null);
                    setIsRejecting(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
                    isSelected
                      ? "bg-slate-50/90 border-slate-400 shadow-2xs ring-1 ring-slate-400/20"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {p.poNumber}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                        pPending
                          ? "bg-amber-50 text-amber-700 border-amber-200/60"
                          : pApproved
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                          : pRejected
                          ? "bg-slate-100 text-slate-600 border-slate-200/60"
                          : "bg-slate-100 text-slate-600 border-slate-200/60"
                      }`}
                    >
                      {p.status || "Chờ duyệt"}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800 truncate">
                    {p.skuName || p.sku}
                  </div>
                  <div className="text-[11px] flex items-center justify-between text-slate-400 pt-0.5">
                    <span>NCC cũ: {p.originalSupplierName}</span>
                    <span className="font-mono text-slate-500 tabular-nums">{p.rankings?.length || 0} phương án</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Proposals Top 1-3 Rankings */}
        <div className="lg:col-span-2 space-y-5">
          {/* Summary Box */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Đơn hàng {currentProposal.poNumber} — {currentProposal.skuName || currentProposal.sku}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Mã đề xuất: {currentProposal.id}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70 font-mono">
                  Tối ưu bởi PuLP MILP
                </span>
                {isPending && (
                  <button
                    onClick={() => setIsRejecting(!isRejecting)}
                    className="px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-rose-600 transition-colors border border-slate-200/70 hover:border-rose-200 hover:bg-rose-50/50 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                  >
                    {isRejecting ? "Đóng từ chối" : "Từ chối đề xuất"}
                  </button>
                )}
              </div>
            </div>

            {/* Rejection Form Box */}
            {isRejecting && isPending && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Xác nhận từ chối đề xuất thay thế này:
                  </span>
                  <button
                    onClick={() => setIsRejecting(false)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-500 block">Chọn lý do từ chối:</label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 cursor-pointer"
                  >
                    <option value="Chi phí vượt dự phòng rủi ro">Chi phí vượt dự phòng rủi ro</option>
                    <option value="Thời gian giao hàng (Lead time) quá dài">Thời gian giao hàng (Lead time) quá dài</option>
                    <option value="Rủi ro nhà cung ứng chưa được giảm thiểu">Rủi ro nhà cung ứng chưa được giảm thiểu</option>
                    <option value="Khác">Khác (nhập chi tiết bên dưới)...</option>
                  </select>

                  {rejectReason === "Khác" && (
                    <input
                      type="text"
                      placeholder="Nhập lý do từ chối cụ thể..."
                      value={customRejectReason}
                      onChange={(e) => setCustomRejectReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                    />
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmReject}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
                  >
                    Xác nhận từ chối
                  </button>
                </div>
              </div>
            )}

            {/* Status Notifications when not pending */}
            {isApproved && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Phương án đã được phê duyệt. Đơn hàng thay thế đã phát hành tự động.</span>
                </div>
                <span className="font-mono text-[11px] text-emerald-700 font-medium">Đã duyệt</span>
              </div>
            )}

            {isRejected && (
              <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    Đề xuất này đã bị từ chối
                    {currentProposal.decisionNotes ? `: ${currentProposal.decisionNotes}` : ""}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 font-medium">Đã từ chối</span>
              </div>
            )}

            {/* Baseline Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/70 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Nhà cung cấp gốc</span>
                <span className="font-medium text-slate-900 mt-0.5 block">{currentProposal.originalSupplierName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Đơn giá ban đầu</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                  {Number(currentProposal.originalUnitPrice).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Số lượng đặt</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                  {currentProposal.quantity.toLocaleString("vi-VN")} đơn vị
                </span>
              </div>
            </div>

            {/* AI Recommendation Quote */}
            {currentProposal.recommendation && (
              <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-slate-900 block text-xs">Nhận định phân tích AI:</span>
                  <p className="text-slate-600 leading-relaxed font-normal">{currentProposal.recommendation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Top 1-3 Rankings Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Phương án đối tác thay thế đề xuất ({currentProposal.rankings?.length || 0})</span>
              </h4>
              <span className="text-[11px] text-slate-400">Xếp hạng theo điểm số đa mục tiêu</span>
            </div>

            {currentProposal.rankings?.map((item, idx) => {
              const isTop1 = item.rank === 1;
              const priceDelta = formatPriceDelta(Number(item.unitPrice), Number(currentProposal.originalUnitPrice));
              const totalCost = Number(item.totalCost || item.unitPrice * currentProposal.quantity);
              const originalTotalCost = Number(currentProposal.originalUnitPrice) * currentProposal.quantity;
              const totalDelta = totalCost - originalTotalCost;

              return (
                <div
                  key={idx}
                  className={`bg-white border rounded-xl p-5 shadow-2xs space-y-4 transition-all ${
                    isTop1 ? "border-slate-300 ring-1 ring-slate-900/5" : "border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-md font-medium flex items-center justify-center text-xs font-mono tabular-nums ${
                          isTop1 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        #{item.rank}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-semibold text-slate-900">{item.supplierName}</h5>
                          {isTop1 && (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                              Khuyến nghị #1
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">Mã NCC: {item.supplierId}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Điểm tối ưu</div>
                      <div className="text-lg font-semibold font-mono tracking-tight text-slate-900 tabular-nums">
                        {item.score}<span className="text-xs text-slate-400 font-normal">/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Matrix with Price Delta Indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200/70 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Đơn giá đề xuất</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                        {Number(item.unitPrice).toLocaleString("vi-VN")} đ
                      </span>
                      <span
                        className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded mt-1 border ${
                          priceDelta.type === "saving"
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
                            : priceDelta.type === "increase"
                            ? "text-amber-700 bg-amber-50 border-amber-200/60"
                            : "text-slate-600 bg-slate-100 border-slate-200/60"
                        }`}
                      >
                        {priceDelta.text}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Thời gian giao (Lead time)</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                        {item.leadTimeDays} ngày
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                        Từ ngày chốt duyệt
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[11px]">Tổng giá trị đơn</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 block">
                        {totalCost.toLocaleString("vi-VN")} đ
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1 font-mono tabular-nums">
                        {totalDelta < 0
                          ? `Tiết kiệm ${(Math.abs(totalDelta)).toLocaleString("vi-VN")} đ`
                          : totalDelta > 0
                          ? `Chênh lệch +${totalDelta.toLocaleString("vi-VN")} đ`
                          : "Không chênh lệch"}
                      </span>
                    </div>
                  </div>

                  {/* Optional Score Breakdown & Reasoning Drawer */}
                  {(item.reasoning || item.scoreBreakdown) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedScoreRank(expandedScoreRank === item.rank ? null : item.rank)
                        }
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded py-0.5"
                      >
                        <span>Chi tiết đánh giá & trọng số</span>
                        {expandedScoreRank === item.rank ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {expandedScoreRank === item.rank && (
                        <div className="mt-2 bg-slate-50/90 border border-slate-200/70 p-3 rounded-lg text-xs space-y-2">
                          {item.reasoning && (
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                              {item.reasoning}
                            </p>
                          )}
                          {item.scoreBreakdown && (
                            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600 pt-1.5 border-t border-slate-200/60">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Đóng góp Giá</span>
                                <span className="font-semibold text-slate-800 tabular-nums">
                                  {item.scoreBreakdown.costScoreContribution?.toFixed(1) ?? "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Đóng góp Thời gian</span>
                                <span className="font-semibold text-slate-800 tabular-nums">
                                  {item.scoreBreakdown.timeScoreContribution?.toFixed(1) ?? "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Đóng góp Uy tín</span>
                                <span className="font-semibold text-slate-800 tabular-nums">
                                  {item.scoreBreakdown.reliabilityContribution?.toFixed(1) ?? "—"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pros & Cons: Calmer, Refined Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50/60 border border-slate-200/70 p-3 rounded-lg space-y-1.5">
                      <div className="font-medium text-slate-800 text-[11px] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Ưu điểm nổi bật</span>
                      </div>
                      <ul className="space-y-1 text-slate-600 text-[11px] pl-3">
                        {item.pros?.map((pro, pIdx) => (
                          <li key={pIdx} className="list-disc list-outside">
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-50/60 border border-slate-200/70 p-3 rounded-lg space-y-1.5">
                      <div className="font-medium text-slate-800 text-[11px] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>Cần lưu ý & rủi ro</span>
                      </div>
                      <ul className="space-y-1 text-slate-600 text-[11px] pl-3">
                        {item.cons?.map((con, cIdx) => (
                          <li key={cIdx} className="list-disc list-outside">
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Button: Quiet, Authoritative */}
                  {isPending && (
                    <div className="pt-1 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleApprove(item.rank)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 cursor-pointer ${
                          isTop1
                            ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] text-white"
                            : "bg-emerald-50 hover:bg-emerald-100/90 active:bg-emerald-200/80 text-emerald-900 border border-emerald-200"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Phê duyệt phương án #{item.rank} (1-Click)</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
