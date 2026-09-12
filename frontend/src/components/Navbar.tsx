import React, { useState } from "react";
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
  User,
  ChevronDown,
  Settings,
  ShieldCheck,
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    {
      id: "map",
      label: "Bản đồ Vận chuyển",
      badge: openIncidentsCount > 0 ? `${openIncidentsCount} rủi ro` : undefined,
      badgeColor: "bg-blue-600",
    },
    {
      id: "incidents",
      label: "Rủi ro & Sự cố",
      badge: openIncidentsCount > 0 ? openIncidentsCount : undefined,
      badgeColor: "bg-amber-600",
    },
    { id: "orders", label: "Đơn hàng (PO)" },
    { id: "suppliers", label: "Nhà cung cấp" },
    { id: "inventory", label: "Tồn kho" },
    {
      id: "approvals",
      label: "Duyệt (HITL)",
      badge: pendingApprovalCount > 0 ? pendingApprovalCount : undefined,
      badgeColor: "bg-red-600",
    },
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

  const userProfiles: Record<UserRole, {
    name: string;
    email: string;
    avatarInitials: string;
    gradient: string;
    department: string;
  }> = {
    procurement_officer: {
      name: "Nguyễn Văn Hoàng",
      email: "hoang.nguyen@bikesync.ai",
      avatarInitials: "VH",
      gradient: "from-blue-600 to-indigo-600",
      department: "Bộ phận Mua sắm & Vật tư",
    },
    supply_chain_manager: {
      name: "Lê Hoàng Nam",
      email: "nam.le@bikesync.ai",
      avatarInitials: "LN",
      gradient: "from-emerald-600 to-teal-600",
      department: "Ban Giám đốc Chuỗi Cung Ứng",
    },
    supplier: {
      name: "Trần Đức Phú",
      email: "phu.tran@supplier-vietnam.com",
      avatarInitials: "TP",
      gradient: "from-purple-600 to-pink-600",
      department: "Phòng Kinh doanh Đối tác",
    },
  };

  const currentUser = userProfiles[userRole];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner / Utility Bar */}
      <div className="px-4 py-2 bg-slate-900 text-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-white tracking-wide">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-black">
              <Bike className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">Resili chain</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[11px] text-emerald-400 font-mono border border-slate-700">
              Supply Chain MVP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <button
            id="btn-notification-bell"
            onClick={onOpenNotifications}
            className="relative p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Hộp thư thông báo & Escalation"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              id="btn-user-profile-avatar"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700/60 focus:outline-none"
            >
              <div className="relative">
                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr ${currentUser.gradient} flex items-center justify-center text-white text-xs font-bold shadow-xs border border-white/20`}>
                  {currentUser.avatarInitials}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-slate-900" title="Online" />
              </div>
              <div className="text-left hidden sm:block leading-tight">
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1">
                  {currentUser.name}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-[10px] text-slate-400 font-normal">
                  {roleLabels[userRole].title}
                </div>
              </div>
            </button>

            {/* Profile Dropdown Popover */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 text-slate-800 z-50 overflow-hidden animate-in fade-in duration-150">
                {/* Header */}
                <div className={`p-4 bg-gradient-to-br ${currentUser.gradient} text-white`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-xs border-2 border-white/30 flex items-center justify-center text-base font-bold text-white shadow-inner">
                      {currentUser.avatarInitials}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm leading-tight">{currentUser.name}</h4>
                      <p className="text-xs text-white/80 font-mono mt-0.5">{currentUser.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-medium">
                        {currentUser.department}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body details */}
                <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-600 mb-1">
                    <span>Trạng thái tài khoản:</span>
                    <span className="font-semibold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Quyền hạn:</span>
                    <span className="font-medium text-slate-900">{roleLabels[userRole].title}</span>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-1.5 space-y-0.5 text-xs font-medium">
                  <button
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    <span>Hồ sơ cá nhân</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onOpenConfig();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Cấu hình rủi ro & hệ thống</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onOpenNotifications();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <span>Phê duyệt & Hạn mức</span>
                  </button>
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-slate-100 bg-slate-50 text-[11px] text-center text-slate-400">
                  Resili chain System v2.4
                </div>
              </div>
            )}
          </div>
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

