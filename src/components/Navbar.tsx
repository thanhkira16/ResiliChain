import React from "react";
import { UserRole } from "../types";
import {
  Bike,
  ShieldAlert,
  Bell,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Sparkles,
  UserCheck,
  Play,
  Pause,
  Layers,
} from "lucide-react";

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenConfig: () => void;
  onRunRiskScan: () => void;
  onResetData: () => void;
  isScanning: boolean;
  autoScan: boolean;
  setAutoScan: (val: boolean) => void;
  activeSupplierId: string;
  setActiveSupplierId: (id: string) => void;
  suppliersList: Array<{ id: string; name: string }>;
  pendingApprovalCount: number;
  openIncidentsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  userRole,
  setUserRole,
  unreadCount,
  onOpenNotifications,
  onOpenConfig,
  onRunRiskScan,
  onResetData,
  isScanning,
  autoScan,
  setAutoScan,
  activeSupplierId,
  setActiveSupplierId,
  suppliersList,
  pendingApprovalCount,
  openIncidentsCount,
}) => {
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    {
      id: "map",
      label: "Bản đồ Vận chuyển",
      badge: openIncidentsCount > 0 ? `${openIncidentsCount} rủi ro` : undefined,
      badgeColor: "bg-blue-600",
    },
    { id: "orders", label: "Đơn hàng (PO)" },
    { id: "suppliers", label: "Nhà cung cấp" },
    { id: "inventory", label: "Tồn kho" },
    {
      id: "incidents",
      label: "Rủi ro & Sự cố",
      badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
      badgeColor: "bg-amber-600",
    },
    { id: "rfq", label: "RFQ & Báo giá" },
    {
      id: "approvals",
      label: "Duyệt (HITL)",
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
      badgeColor: "bg-red-600",
    },
    { id: "forecasting", label: "Dự báo nhu cầu" },
    { id: "audit", label: "Audit Log" },
    { id: "supplier_portal", label: "Cổng Nhà Cung Cấp" },
  ];

  const roleLabels: Record<UserRole, { title: string; subtitle: string; color: string }> = {
    procurement_officer: {
      title: "Procurement Officer",
      subtitle: "Duyệt đơn <50tr VNĐ",
      color: "bg-blue-50 text-blue-800 border-blue-200",
    },
    supply_chain_manager: {
      title: "Supply Chain Manager",
      subtitle: "Toàn quyền & duyệt ≥50tr VNĐ",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    supplier: {
      title: "Supplier (Đối tác)",
      subtitle: "Báo giá qua Self-Service",
      color: "bg-purple-50 text-purple-800 border-purple-200",
    },
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner / Utility Bar */}
      <div className="px-4 py-2 bg-slate-900 text-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-white tracking-wide">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
              <Bike className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">BikeSync AI</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-emerald-400 font-mono border border-slate-700">
              Supply Chain MVP
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden md:block" />

          <div className="hidden lg:flex items-center gap-2 text-slate-300">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Agent 1 (Risk) + Agent 2 (Sourcing) + Agent 3 (Forecasting)</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Risk Scanning trigger */}
          <button
            id="btn-run-risk-scan"
            onClick={onRunRiskScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50"
            title="Kích hoạt Agent 1 quét toàn bộ PO đang mở"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Đang quét..." : "Chạy quét rủi ro"}</span>
          </button>

          <button
            id="btn-toggle-autoscan"
            onClick={() => setAutoScan(!autoScan)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border ${
              autoScan
                ? "bg-slate-800 text-emerald-300 border-emerald-600/40"
                : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title="Bật/Tắt tự động quét rủi ro định kỳ 30 giây"
          >
            {autoScan ? <Pause className="w-3 h-3 text-emerald-400" /> : <Play className="w-3 h-3" />}
            <span className="hidden sm:inline">Quét 30s</span>
          </button>

          {/* Threshold config button */}
          <button
            id="btn-open-config"
            onClick={onOpenConfig}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Cấu hình ngưỡng rủi ro"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cấu hình</span>
          </button>

          {/* Reset Demo Data */}
          <button
            id="btn-reset-demo"
            onClick={onResetData}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Khôi phục dữ liệu mẫu gốc"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Reset mẫu</span>
          </button>

          {/* Notification Bell */}
          <button
            id="btn-notification-bell"
            onClick={onOpenNotifications}
            className="relative p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Hộp thư thông báo & Escalation"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Bar with Role Selector & Tabs */}
      <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none max-w-full">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-bold text-white rounded-full ${tab.badgeColor}`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Role Switcher */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {userRole === "supplier" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 hidden sm:inline">Giả lập NCC:</span>
              <select
                id="select-active-supplier"
                value={activeSupplierId}
                onChange={(e) => setActiveSupplierId(e.target.value)}
                className="text-xs bg-purple-50 text-purple-900 border border-purple-200 rounded px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                {suppliersList.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name.length > 28 ? sup.name.slice(0, 28) + "..." : sup.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Đang đóng vai
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {roleLabels[userRole].title}
              </div>
            </div>

            <div className="relative">
              <select
                id="select-user-role"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${roleLabels[userRole].color}`}
              >
                <option value="procurement_officer">1. Procurement Officer (&lt;50tr)</option>
                <option value="supply_chain_manager">2. Supply Chain Manager (≥50tr)</option>
                <option value="supplier">3. Supplier (Báo giá RFQ)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
