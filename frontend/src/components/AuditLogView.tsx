import React, { useState } from "react";
import { AuditLogEntry, UserRole } from "../types";
import {
  FileText,
  Search,
  Filter,
  ShieldCheck,
  Bot,
  User,
  ArrowRight,
  Clock,
  Code,
  Tag,
  Sparkles,
} from "lucide-react";

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  userRole: UserRole;
  filterCorrelationId?: string | null;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  logs,
  userRole,
  filterCorrelationId: initialCorrelationId,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string>(
    initialCorrelationId || "all"
  );
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Extract unique correlation IDs
  const correlationIds = Array.from(new Set(logs.map((l) => l.correlationId))).filter(
    Boolean
  );

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.inputSummary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.outputReasoning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.poNumber && log.poNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.supplierName && log.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAgent = agentFilter === "all" || log.agent.includes(agentFilter);
    const matchesCorr =
      selectedCorrelationId === "all" || log.correlationId === selectedCorrelationId;

    return matchesSearch && matchesAgent && matchesCorr;
  });

  const getAgentBadge = (agent: string) => {
    if (agent.includes("Agent 1")) {
      return "bg-amber-100 text-amber-900 border-amber-300";
    }
    if (agent.includes("Agent 2")) {
      return "bg-blue-100 text-blue-900 border-blue-300";
    }
    if (agent.includes("Agent 3")) {
      return "bg-purple-100 text-purple-900 border-purple-300";
    }
    return "bg-emerald-100 text-emerald-900 border-emerald-300";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-800" />
            <h3 className="text-base font-bold text-slate-900">
              AUDIT LOG & TRANSPARENCY — Nhật Ký Hành Động & Truy Vết Chuỗi Quyết Định
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mọi hành động của AI Agent và quyết định phê duyệt của con người đều được gán nhãn Correlation ID để truy vết minh bạch end-to-end từ lúc phát hiện trễ đến khi giải quyết.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600">
          Tổng số bản ghi: <span className="text-slate-900 font-bold">{logs.length} sự kiện</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-audit"
            type="text"
            placeholder="Tìm theo PO, nhà cung cấp, nội dung suy luận hoặc hành động..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">Tác nhân:</span>
            <select
              id="select-audit-agent"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-slate-200 font-medium text-slate-800 bg-white"
            >
              <option value="all">Tất cả Agent & Con người</option>
              <option value="Agent 1">Agent 1 (Risk)</option>
              <option value="Agent 2">Agent 2 (Sourcing)</option>
              <option value="Agent 3">Agent 3 (Forecasting)</option>
              <option value="Human">Con người (HITL)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">Correlation ID:</span>
            <select
              id="select-audit-correlation"
              value={selectedCorrelationId}
              onChange={(e) => setSelectedCorrelationId(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-slate-200 font-mono text-xs text-slate-800 bg-white max-w-[200px]"
            >
              <option value="all">Tất cả chuỗi ({correlationIds.length})</option>
              {correlationIds.map((cid) => (
                <option key={cid} value={cid}>
                  {cid}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-3">Tác nhân</th>
                <th className="py-3 px-3">Hành động (Action)</th>
                <th className="py-3 px-3">Correlation ID</th>
                <th className="py-3 px-3">Đầu vào (Input)</th>
                <th className="py-3 px-3">Suy luận & Kết quả (Output / Reasoning)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;

                return (
                  <tr
                    key={log.id}
                    id={`audit-row-${log.id}`}
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getAgentBadge(
                          log.agent
                        )}`}
                      >
                        {log.agent}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-mono font-semibold text-slate-900 text-[11px]">
                      {log.action}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {log.correlationId}
                      </span>
                    </td>

                    <td className="py-3 px-3 max-w-[240px]">
                      <div className="text-slate-800 line-clamp-2" title={log.inputSummary}>
                        {log.inputSummary}
                      </div>
                      {log.poNumber && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          PO: {log.poNumber} {log.sku ? `• SKU: ${log.sku}` : ""}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 max-w-[340px]">
                      <div className="text-slate-700 font-medium line-clamp-2" title={log.outputReasoning}>
                        {log.outputReasoning}
                      </div>
                      {log.metadata?.isLiveAI && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 mt-0.5">
                          <Sparkles className="w-3 h-3" />
                          <span>Generated by Gemini 3.8 Flash</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Không có bản ghi nhật ký nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
