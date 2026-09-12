import React, { useState } from "react";
import { SourcingProposal, UserRole, PurchaseOrder, Incident } from "../types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Edit3,
  DollarSign,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
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

export const ApprovalView: React.FC<ApprovalViewProps> = ({
  proposals,
  onApproveProposal,
  onRejectProposal,
  userRole,
  activeIncidentId,
  onBack,
}) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    proposals.find((p) => p.status === "Chờ duyệt")?.id || proposals[0]?.id || null
  );

  const [chosenRank, setChosenRank] = useState<number>(1);
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customLeadTime, setCustomLeadTime] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState<boolean>(false);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const currentProposal =
    proposals.find((p) => p.id === selectedProposalId) || proposals[0];

  const handleSelectProposal = (p: SourcingProposal) => {
    setSelectedProposalId(p.id);
    setChosenRank(p.selectedRank || 1);
    setIsCustomizing(false);
    setActionAlert(null);

    const top1 = p.rankings[0];
    if (top1) {
      setCustomPrice(top1.unitPrice);
      setCustomLeadTime(top1.leadTimeDays);
      setCustomNotes("");
    }
  };

  const handleApprove = () => {
    if (!currentProposal) return;

    const result = onApproveProposal(
      currentProposal.id,
      chosenRank,
      isCustomizing
        ? {
            unitPrice: customPrice,
            leadTimeDays: customLeadTime,
            notes: customNotes,
          }
        : undefined
    );

    if (result.success) {
      setActionAlert({ type: "success", text: result.message });
      setIsCustomizing(false);
    } else {
      setActionAlert({ type: "error", text: result.message });
    }
  };

  const handleRejectConfirm = () => {
    if (!currentProposal) return;
    if (!rejectReason.trim()) {
      setActionAlert({ type: "error", text: "Vui lòng nhập lý do từ chối đề xuất." });
      return;
    }
    onRejectProposal(currentProposal.id, rejectReason);
    setIsRejectDialogOpen(false);
    setRejectReason("");
    setActionAlert({
      type: "success",
      text: `Đã từ chối đề xuất ${currentProposal.id} và cập nhật Incident.`,
    });
  };

  const isHighValue = (currentProposal?.totalValueVND || 0) >= 50000000;
  const canApproveRole =
    userRole === "supply_chain_manager" || (!isHighValue && userRole === "procurement_officer");

  return (
    <div className="space-y-4">
      {/* Top Banner & Instructions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">
              HUMAN-IN-THE-LOOP (HITL) — Phê Duyệt Phương Án Thay Thế Nhà Cung Cấp
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Agent 2 chỉ đề xuất, con người toàn quyền quyết định. Hệ thống phân quyền chặt chẽ: Procurement Officer duyệt đề xuất &lt;50 triệu VNĐ; đề xuất &ge;50 triệu VNĐ yêu cầu quyền Supply Chain Manager.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"><ArrowLeft className="h-3.5 w-3.5" />Quay lại</button>
          <span className="text-xs text-slate-600 font-medium">Vai trò hiện tại:</span>
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
              userRole === "supply_chain_manager"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : userRole === "procurement_officer"
                ? "bg-blue-50 text-blue-800 border-blue-300"
                : "bg-purple-50 text-purple-800 border-purple-300"
            }`}
          >
            {userRole === "supply_chain_manager"
              ? "Supply Chain Manager (Toàn quyền)"
              : userRole === "procurement_officer"
              ? "Procurement Officer (<50tr VNĐ)"
              : "Supplier (Chỉ xem)"}
          </span>
        </div>
      </div>

      {actionAlert && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            actionAlert.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <span>{actionAlert.text}</span>
          <button
            onClick={() => setActionAlert(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Approval Workspace */}
      {proposals.length > 0 && currentProposal ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Proposals Selector */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
              Hàng đợi đề xuất ({proposals.length})
            </div>

            <div className="space-y-2">
              {proposals.map((prop) => {
                const isSelected = prop.id === currentProposal.id;
                const isPending = prop.status === "Chờ duyệt";
                const isHigh = prop.totalValueVND >= 50000000;

                return (
                  <button
                    key={prop.id}
                    id={`proposal-item-${prop.id}`}
                    onClick={() => handleSelectProposal(prop)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold">{prop.id}</span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                          prop.status === "Đã duyệt"
                            ? isSelected
                              ? "bg-emerald-800 text-emerald-200 border-emerald-700"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : prop.status === "Từ chối"
                            ? isSelected
                              ? "bg-red-800 text-red-200 border-red-700"
                              : "bg-red-50 text-red-700 border-red-200"
                            : isSelected
                            ? "bg-amber-600 text-white border-amber-500"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {prop.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold line-clamp-1">{prop.skuName}</div>
                    <div className={`text-[11px] mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      Thay thế PO {prop.poNumber} • SL: {prop.quantity} chiếc
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-700/20 flex items-center justify-between text-xs">
                      <span className="font-bold">
                        {Number(prop.totalValueVND).toLocaleString("vi-VN")} đ
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          isHigh
                            ? isSelected
                              ? "bg-purple-900 text-purple-200"
                              : "bg-purple-100 text-purple-800"
                            : isSelected
                            ? "bg-blue-900 text-blue-200"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {isHigh ? "≥50tr (Manager)" : "<50tr (Officer)"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed HITL Evaluation */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            {/* Proposal Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                    {currentProposal.id}
                  </span>
                  <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {currentProposal.correlationId}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      currentProposal.status === "Đã duyệt"
                        ? "bg-emerald-100 text-emerald-800"
                        : currentProposal.status === "Từ chối"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {currentProposal.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-2">
                  Đề xuất giải pháp sự cố cho đơn hàng {currentProposal.poNumber} — {currentProposal.skuName}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  NCC trễ hẹn ban đầu: <strong>{currentProposal.originalSupplierName}</strong> (Đơn giá cũ: {Number(currentProposal.originalUnitPrice).toLocaleString("vi-VN")} đ)
                </p>
              </div>

              {/* Total contract value card */}
              <div className="text-right p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Tổng giá trị hợp đồng</div>
                <div className="text-lg font-black text-slate-900">
                  {Number(currentProposal.totalValueVND).toLocaleString("vi-VN")} VNĐ
                </div>
                <div
                  className={`text-[10px] font-bold mt-0.5 ${
                    isHighValue ? "text-purple-700" : "text-blue-700"
                  }`}
                >
                  {isHighValue
                    ? "Yêu cầu Giám đốc chuỗi cung ứng duyệt (≥50tr)"
                    : "Cán bộ mua sắm đủ thẩm quyền (<50tr)"}
                </div>
              </div>
            </div>

            {/* AI Reasoning Trace */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Giải trình của Agent 2 (AI Reasoning Trace):</span>
              </div>
              <p className="text-slate-700 leading-relaxed font-medium">
                {currentProposal.recommendation}
              </p>
              {currentProposal.rejectedOptionsAnalysis && currentProposal.rejectedOptionsAnalysis.length > 0 && (
                <div className="pt-2 border-t border-blue-200/50 text-[11px] text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800">Lý do loại các phương án khác:</span>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {currentProposal.rejectedOptionsAnalysis.map((rej, idx) => (
                      <li key={idx}>
                        <strong>{rej.supplierName}</strong>: {rej.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Top 3 Alternative Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Bảng xếp hạng phương án thay thế (Tối đa 3 lựa chọn)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Chọn radio để duyệt phương án mong muốn
                </span>
              </div>

              <div className="space-y-2.5">
                {currentProposal.rankings.map((opt) => {
                  const isSelected = chosenRank === opt.rank;
                  const priceDiff = opt.totalCost - currentProposal.originalTotalCost;

                  return (
                    <div
                      key={opt.rank}
                      id={`option-rank-${opt.rank}`}
                      onClick={() => {
                        if (currentProposal.status === "Chờ duyệt") {
                          setChosenRank(opt.rank);
                          setCustomPrice(opt.unitPrice);
                          setCustomLeadTime(opt.leadTimeDays);
                        }
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-500"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selectedRank"
                            checked={isSelected}
                            onChange={() => {
                              setChosenRank(opt.rank);
                              setCustomPrice(opt.unitPrice);
                              setCustomLeadTime(opt.leadTimeDays);
                            }}
                            disabled={currentProposal.status !== "Chờ duyệt"}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  opt.rank === 1
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 text-slate-800"
                                }`}
                              >
                                #{opt.rank} {opt.rank === 1 ? "Khuyến nghị của AI" : ""}
                              </span>
                              <h5 className="text-sm font-bold text-slate-900">{opt.supplierName}</h5>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                              <span>Lead time: <strong className="text-slate-800">{opt.leadTimeDays} ngày</strong></span>
                              <span>•</span>
                              <span>Điểm tổng hợp: <strong className="text-emerald-700">{opt.score}/100</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Price & Difference */}
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">
                            {Number(opt.totalCost).toLocaleString("vi-VN")} đ
                          </div>
                          <div className="text-[11px] text-slate-500">
                            ({Number(opt.unitPrice).toLocaleString("vi-VN")} đ/chiếc)
                          </div>
                          <div
                            className={`text-[10px] font-bold mt-0.5 ${
                              priceDiff > 0 ? "text-amber-700" : "text-emerald-700"
                            }`}
                          >
                            {priceDiff > 0
                              ? `+${Number(priceDiff).toLocaleString("vi-VN")} đ so với đơn gốc`
                              : priceDiff < 0
                              ? `${Number(priceDiff).toLocaleString("vi-VN")} đ (Tiết kiệm hơn)`
                              : "Bằng giá đơn gốc"}
                          </div>
                        </div>
                      </div>

                      {/* Pros & Cons */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                        <div className="space-y-1">
                          <span className="font-semibold text-emerald-700 text-[11px]">Ưu điểm (Pros):</span>
                          <ul className="space-y-0.5 text-slate-600">
                            {opt.pros.map((p, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-1">
                          <span className="font-semibold text-amber-700 text-[11px]">Nhược điểm / Lưu ý (Cons):</span>
                          <ul className="space-y-0.5 text-slate-600">
                            {opt.cons.map((c, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-amber-500 font-bold">!</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* AI Reasoning for this option */}
                      <p className="mt-2.5 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded">
                        &quot;{opt.reasoning}&quot;
                      </p>

                      {/* SRS §3.3 Ranking Score Breakdown Pills */}
                      {opt.scoreBreakdown && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="font-semibold text-slate-500">Cấu thành điểm (§3.3):</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono border border-blue-100">
                            Giá (w1={opt.scoreBreakdown.w1}): +{Math.round(opt.scoreBreakdown.costScoreContribution * 100)}đ
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono border border-emerald-100">
                            Thời gian (w2={opt.scoreBreakdown.w2}): +{Math.round(opt.scoreBreakdown.timeScoreContribution * 100)}đ
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono border border-purple-100">
                            Uy tín NCC (w3={opt.scoreBreakdown.w3}): +{Math.round(opt.scoreBreakdown.reliabilityContribution * 100)}đ
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Customization Drawer (Sửa trước khi duyệt) */}
            {currentProposal.status === "Chờ duyệt" && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span>Tùy chỉnh thông số đơn hàng trước khi duyệt</span>
                  </div>
                  <button
                    onClick={() => setIsCustomizing(!isCustomizing)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    {isCustomizing ? "Thu gọn tùy chỉnh" : "Mở form điều chỉnh"}
                  </button>
                </div>

                {isCustomizing && (
                  <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-medium text-slate-700 block mb-1">
                        Đơn giá đàm phán lại (VNĐ/chiếc):
                      </label>
                      <input
                        type="number"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(Number(e.target.value))}
                        className="w-full p-2 border border-slate-200 rounded bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-slate-700 block mb-1">
                        Lead time cam kết mới (ngày):
                      </label>
                      <input
                        type="number"
                        value={customLeadTime}
                        onChange={(e) => setCustomLeadTime(Number(e.target.value))}
                        className="w-full p-2 border border-slate-200 rounded bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-slate-700 block mb-1">
                        Ghi chú phê duyệt đặc biệt:
                      </label>
                      <input
                        type="text"
                        placeholder="VD: Đã thương lượng giảm 5% cước..."
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approval / Rejection Action Panel */}
            {currentProposal.status === "Chờ duyệt" ? (
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {!canApproveRole ? (
                    <span className="text-red-600 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Giá trị đơn hàng &ge;50 triệu VNĐ. Vui lòng chuyển vai trò thành Supply Chain Manager để duyệt!
                    </span>
                  ) : (
                    <span>
                      Xác nhận duyệt phương án #{chosenRank} cho NCC{" "}
                      <strong>{currentProposal.rankings.find((r) => r.rank === chosenRank)?.supplierName}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="btn-reject-proposal"
                    onClick={() => setIsRejectDialogOpen(true)}
                    className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Từ chối đề xuất</span>
                  </button>

                  <button
                    id="btn-approve-proposal"
                    onClick={handleApprove}
                    disabled={!canApproveRole}
                    className={`px-5 py-2 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm ${
                      canApproveRole
                        ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                        : "bg-slate-300 cursor-not-allowed opacity-70"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isCustomizing ? "Sửa & Phê duyệt" : "Phê duyệt phương án"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Đề xuất đã được xử lý bởi <strong>{currentProposal.reviewedByRole || "Supply Chain Manager"}</strong> lúc {currentProposal.reviewedAt}
                  </span>
                </div>
                <span className="font-bold text-slate-900">Trạng thái: {currentProposal.status}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">Không có đề xuất nào cần duyệt</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Khi Agent 2 hoàn tất nhận báo giá và chạy phân tích AI, đề xuất sẽ xuất hiện tại đây để cán bộ mua sắm hoặc giám đốc thẩm định.
          </p>
        </div>
      )}

      {/* Reject Modal Dialog */}
      {isRejectDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>Từ chối đề xuất thay thế {currentProposal?.id}</span>
            </h4>
            <p className="text-xs text-slate-600">
              Vui lòng cung cấp lý do từ chối để lưu vết vào Audit Log và thông báo cho Agent 2:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="VD: Giá quá cao so với ngân sách cho phép, chờ đàm phán thêm với NCC gốc..."
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs h-24 focus:outline-none focus:ring-1 focus:ring-red-400"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsRejectDialogOpen(false)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
