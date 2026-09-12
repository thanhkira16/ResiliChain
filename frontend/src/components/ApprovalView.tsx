import React, { useState } from "react";
import { SourcingProposal, UserRole } from "../types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  DollarSign,
  Clock,
  ArrowRight,
  TrendingUp,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Zap,
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
  onBack,
}) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    proposals.find((p) => p.status === "Chờ duyệt")?.id || proposals[0]?.id || null
  );

  const [chosenRank, setChosenRank] = useState<number>(1);
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const currentProposal = proposals.find((p) => p.id === selectedProposalId) || proposals[0];

  const handleApprove = (rank: number) => {
    if (!currentProposal) return;
    const result = onApproveProposal(currentProposal.id, rank);
    if (result.success) {
      setActionAlert({ type: "success", text: result.message });
    } else {
      setActionAlert({ type: "error", text: result.message });
    }
  };

  if (!currentProposal) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-2xl">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Không Có Đề Xuất Nào Chờ Duyệt</h3>
        <p className="text-sm text-slate-400">Tất cả sự cố đã được giải quyết hoặc chưa có đề xuất mới được sinh từ PuLP MILP Solver.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-xs inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Quay Lại Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-2xl">
        <div>
          <button onClick={onBack} className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay Lại Bảng Tác Chiến
          </button>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Bảng Duyệt Phương Án Thay Thế 1-Click (PuLP MILP + GPT-4o)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Đánh giá Top 1, Top 2, Top 3 nhà cung ứng thay thế tối ưu hóa đa tiêu chí và quyết định phê duyệt 1-Click.
          </p>
        </div>
      </div>

      {actionAlert && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 border ${
            actionAlert.type === "success"
              ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
              : "bg-red-950/80 border-red-800 text-red-300"
          }`}
        >
          {actionAlert.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{actionAlert.text}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Proposals Selector List */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Danh Sách Đề Xuất AI</h3>
          <div className="space-y-2">
            {proposals.map((p) => {
              const isSelected = p.id === currentProposal.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProposalId(p.id);
                    setActionAlert(null);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2 ${
                    isSelected
                      ? "bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400">{p.poNumber}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === "Đã duyệt"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                      }`}
                    >
                      {p.status || "Chờ duyệt"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate">{p.skuName || p.sku}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>NCC cũ: {p.originalSupplierName}</span>
                    <span className="font-mono text-cyan-300 font-bold">{p.rankings?.length || 0} Đối tác</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Detailed Proposal Card & Top 1-3 Rankings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Box */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400">{currentProposal.id}</span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Đơn Hàng {currentProposal.poNumber} — SKU: {currentProposal.skuName || currentProposal.sku}
                </h3>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                PuLP MILP Solved
              </span>
            </div>

            {/* Original Order Baseline Details */}
            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Nhà Cung Cấp Gốc</span>
                <span className="font-semibold text-white">{currentProposal.originalSupplierName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Đơn Giá Ban Đầu</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Number(currentProposal.originalUnitPrice).toLocaleString("vi-VN")}đ
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Số Lượng Đặt</span>
                <span className="font-mono font-bold text-cyan-300">{currentProposal.quantity} đơn vị</span>
              </div>
            </div>

            {/* AI Recommendation Quote */}
            {currentProposal.recommendation && (
              <div className="p-4 bg-cyan-950/40 border border-cyan-800/80 rounded-xl text-xs text-cyan-200 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300 block mb-1">Đề Xuất Kiến Nghị Từ AI Engine (GPT-4o Reasoning):</span>
                  <p>{currentProposal.recommendation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Top 1-3 Rankings Cards */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Bảng Xếp Hạng Đối Tác Thay Thế Tối Ưu Tốt Nhất (Top 1 - 3):
            </h4>

            {currentProposal.rankings?.map((item, idx) => {
              const isSelectedRank = chosenRank === item.rank;

              return (
                <div
                  key={idx}
                  className={`bg-slate-900/80 backdrop-blur-xl border rounded-2xl p-6 shadow-xl space-y-4 transition-all ${
                    item.rank === 1
                      ? "border-amber-500/80 shadow-amber-500/5 bg-slate-900/90"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-sm font-mono ${
                          item.rank === 1
                            ? "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950"
                            : "bg-slate-800 text-white"
                        }`}
                      >
                        #{item.rank}
                      </span>
                      <div>
                        <h4 className="text-base font-bold text-white">{item.supplierName}</h4>
                        <span className="text-xs text-slate-400 font-mono">Mã NCC: {item.supplierId}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">Điểm Tối Ưu Score</div>
                      <div className="text-xl font-bold font-mono text-cyan-400">{item.score}/100</div>
                    </div>
                  </div>

                  {/* Financial & Lead time Matrix */}
                  <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block">Đơn Giá Đề Xuất</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {Number(item.unitPrice).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Thời Gian Giao (LeadTime)</span>
                      <span className="font-mono font-bold text-cyan-300 text-sm">{item.leadTimeDays} ngày</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tổng Giá Trị Đơn</span>
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        {Number(item.totalCost || item.unitPrice * currentProposal.quantity).toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  </div>

                  {/* Pros & Cons Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Pros */}
                    <div className="bg-emerald-950/30 border border-emerald-800/50 p-3.5 rounded-xl space-y-1.5">
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" /> Ưu Điểm Nổi Bật:
                      </div>
                      <ul className="space-y-1 text-slate-300">
                        {item.pros?.map((pro, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Cons */}
                    <div className="bg-red-950/30 border border-red-800/50 p-3.5 rounded-xl space-y-1.5">
                      <div className="font-bold text-red-400 flex items-center gap-1.5">
                        <ThumbsDown className="w-3.5 h-3.5" /> Nhược Điểm & Rủi Ro:
                      </div>
                      <ul className="space-y-1 text-slate-300">
                        {item.cons?.map((con, cIdx) => (
                          <li key={cIdx} className="flex items-start gap-1.5">
                            <span className="text-red-400 font-bold">•</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Reasoning Text */}
                  {item.reasoning && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                      &quot;{item.reasoning}&quot;
                    </p>
                  )}

                  {/* 1-Click Action Button */}
                  {userRole === "PROCUREMENT_MANAGER" && currentProposal.status !== "Đã duyệt" && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleApprove(item.rank)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                          item.rank === 1
                            ? "bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 shadow-amber-500/20"
                            : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Phê Duyệt Phương Án Top #{item.rank} (1-Click Approve)
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
