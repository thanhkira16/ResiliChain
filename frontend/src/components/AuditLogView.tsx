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
              AUDIT LOG & TRANSPARENCY — Action Logging & Decision Chain Traceability
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            All AI Agent actions and human approval decisions are tagged with a Correlation ID for transparent end-to-end auditability from delay detection to resolution.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600">
          Total Log Entries: <span className="text-slate-900 font-bold">{logs.length} events</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-audit"
            type="text"
            placeholder="Search by PO, supplier, reasoning text, or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">Agent:</span>
            <select
              id="select-audit-agent"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-slate-200 font-medium text-slate-800 bg-white"
            >
              <option value="all">All Agents & Humans</option>
              <option value="Agent 1">Agent 1 (Risk Monitoring)</option>
              <option value="Agent 2">Agent 2 (Negotiation & Sourcing)</option>
              <option value="Agent 3">Agent 3 (Demand Forecasting)</option>
              <option value="Human">Human (HITL)</option>
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
              <option value="all">All Chains ({correlationIds.length})</option>
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
                <th className="py-3 px-3.5 whitespace-nowrap">Timestamp</th>
                <th className="py-3 px-3">Agent / User</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Correlation ID</th>
                <th className="py-3 px-3">Input Summary</th>
                <th className="py-3 px-3">Reasoning / Output</th>
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
                    No matching audit log entries found.
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
