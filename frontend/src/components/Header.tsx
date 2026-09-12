import React, { useState } from "react";
import { UserRole } from "../types";
import {
  Bell,
  ChevronDown,
  Settings,
  ShieldCheck,
  Building2,
  Zap,
} from "lucide-react";

interface HeaderProps {
  currentTab: string;
  userRole: UserRole | string;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenConfig: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  userRole,
  unreadCount,
  onOpenNotifications,
  onOpenConfig,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: "Command Operations Center", subtitle: "Supply chain risk monitoring & real-time PORS metrics" },
    map: { title: "3D Digital Twin Logistics Map", subtitle: "Real-time GPS shipment tracking & Open-Meteo route weather" },
    orders: { title: "Purchase Order (PO) Management", subtitle: "EV component purchase order directory" },
    suppliers: { title: "Supplier Directory & Ratings", subtitle: "Altman Z-Score evaluation, GDELT risk feeds & reliability scores" },
    inventory: { title: "Component Inventory Management", subtitle: "Safety stock monitoring & weekly consumption burn rate" },
    incidents: { title: "Risk & Incident Management", subtitle: "Automated delay detection & PuLP MILP solver trigger" },
    approvals: { title: "1-Click Approval Center (HITL)", subtitle: "Review & approve multi-criteria backup supplier proposals" },
    forecasting: { title: "Demand & Seasonality Forecasting", subtitle: "EV component material planning & Holt-Winters model" },
    audit: { title: "System Audit Logs", subtitle: "Operational history & 6 AI Agent execution records" },
  };

  const normalizedRole = String(userRole || "supply_chain_manager").toLowerCase();

  const userProfiles: Record<string, {
    name: string;
    email: string;
    avatarInitials: string;
    bgColor: string;
    title: string;
    department: string;
  }> = {
    procurement_officer: {
      name: "Henry Nguyen",
      email: "hoang.nguyen@resilichain.ai",
      avatarInitials: "HN",
      bgColor: "bg-blue-600",
      title: "Procurement Officer",
      department: "Procurement & Materials Dept",
    },
    supply_chain_manager: {
      name: "Leo Le",
      email: "nam.le@resilichain.ai",
      avatarInitials: "LL",
      bgColor: "bg-emerald-600",
      title: "Supply Chain Manager",
      department: "Supply Chain Executive Board",
    },
    procurement_manager: {
      name: "Leo Le",
      email: "nam.le@resilichain.ai",
      avatarInitials: "LL",
      bgColor: "bg-emerald-600",
      title: "Procurement Manager",
      department: "Supply Chain Executive Board",
    },
    supplier: {
      name: "David Tran",
      email: "phu.tran@supplier-ev.com",
      avatarInitials: "DT",
      bgColor: "bg-purple-600",
      title: "Supplier Partner",
      department: "Partner Sales Division",
    },
  };

  const currentInfo = pageTitles[currentTab] || { title: "ResiliChain EV", subtitle: "Autonomous Supply Chain Management System" };
  const currentUser = userProfiles[normalizedRole] || userProfiles["supply_chain_manager"];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm px-6 py-3.5 flex items-center justify-between gap-4">
      {/* Left Title */}
      <div>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          {currentInfo.title}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          {currentInfo.subtitle}
        </p>
      </div>

      {/* Right Controls & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Risk Threshold Config Button */}
        <button
          onClick={onOpenConfig}
          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200"
          title="Configure Risk Thresholds"
        >
          <Settings className="w-4 h-4 text-slate-600" />
        </button>

        {/* Notification Bell */}
        <button
          id="btn-notification-bell"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200"
          title="Risk Notifications & Telegram Dispatch"
        >
          <Bell className="w-4 h-4 text-amber-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            id="btn-user-profile-avatar"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-900 transition-all border border-slate-200 focus:outline-none"
          >
            <div className="relative">
              <div className={`w-8 h-8 rounded-full ${currentUser.bgColor} flex items-center justify-center text-white text-xs font-bold border border-slate-200`}>
                {currentUser.avatarInitials}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" title="Online" />
            </div>
            <div className="text-left hidden sm:block leading-tight">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                {currentUser.name}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {currentUser.title}
              </div>
            </div>
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-50 space-y-3">
              <div className="border-b border-slate-100 pb-3">
                <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{currentUser.email}</p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {currentUser.department}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Role:</span>
                  <span className="text-slate-900 font-bold">{currentUser.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>AI Agent Status:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" /> Live Sync
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
