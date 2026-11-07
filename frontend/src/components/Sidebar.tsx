import React from "react";
import { UserRole } from "../types";
import {
  LayoutDashboard,
  Map,
  ShoppingBag,
  Truck,
  Boxes,
  ShieldAlert,
  FileCheck,
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userRole: UserRole;
  pendingApprovalCount: number;
  openIncidentsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  pendingApprovalCount,
  openIncidentsCount,
}) => {
  const tabs = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "map",
      label: "Bản đồ Vận chuyển",
      icon: Map,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : undefined,
      badgeStyle: "bg-slate-100 text-slate-700 border border-slate-200",
      badgeAriaLabel: `${openIncidentsCount} sự cố vận chuyển`,
    },
    {
      id: "incidents",
      label: "Rủi ro & Sự cố",
      icon: ShieldAlert,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : undefined,
      badgeStyle: "bg-amber-50 text-amber-800 border border-amber-200",
      badgeAriaLabel: `${openIncidentsCount} sự cố rủi ro đang mở`,
    },
    {
      id: "orders",
      label: "Đơn hàng (PO)",
      icon: ShoppingBag,
    },
    {
      id: "suppliers",
      label: "Nhà cung cấp",
      icon: Truck,
    },
    {
      id: "inventory",
      label: "Tồn kho",
      icon: Boxes,
    },
    {
      id: "approvals",
      label: "Duyệt (HITL)",
      icon: FileCheck,
      badge: pendingApprovalCount > 0 ? `${pendingApprovalCount}` : undefined,
      badgeStyle: "bg-rose-50 text-rose-800 border border-rose-200",
      badgeAriaLabel: `${pendingApprovalCount} đề xuất chờ duyệt`,
    },
  ];

  return (
    <aside
      aria-label="Điều hướng chính"
      className="w-16 md:w-64 bg-white text-slate-700 border-r border-slate-200 flex flex-col shrink-0 min-h-screen sticky top-0 h-screen select-none z-20 shadow-xs"
    >
      {/* Brand Header - height matches top header for continuous horizontal divider */}
      <div className="h-[74px] px-3 md:px-4 border-b border-slate-200 flex items-center justify-center md:justify-start shrink-0 bg-white">
        {/* Full brand logo on expanded sidebar */}
        <div className="hidden md:flex items-center">
          <img
            src="/resilichain-logo.png"
            alt="ResiliChain Logo"
            className="h-9 w-auto object-contain select-none"
          />
        </div>
        {/* Standalone mark on collapsed sidebar */}
        <div className="md:hidden flex items-center justify-center">
          <img
            src="/resilichain-icon.png"
            alt="ResiliChain Mark"
            className="w-8 h-8 object-contain select-none"
          />
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3 px-2 md:px-3 scrollbar-thin scrollbar-thumb-slate-200">
        <nav className="space-y-1" aria-label="Các trang ứng dụng">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`sidebar-tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                title={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={`relative w-full flex items-center justify-center md:justify-between px-2.5 md:px-3 py-2 rounded-lg text-xs font-medium transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200/70 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-emerald-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="hidden md:inline truncate">{tab.label}</span>
                </div>

                {tab.badge ? (
                  <>
                    <span
                      className={`hidden md:inline-block px-1.5 py-0.5 text-[11px] rounded-md font-medium tabular-nums shrink-0 ml-2 ${tab.badgeStyle}`}
                      aria-label={tab.badgeAriaLabel}
                    >
                      {tab.badge}
                    </span>
                    <span
                      className={`md:hidden absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                        tab.id === "incidents"
                          ? "bg-amber-500"
                          : tab.id === "approvals"
                          ? "bg-rose-500"
                          : "bg-slate-400"
                      }`}
                      aria-label={tab.badgeAriaLabel}
                    />
                  </>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer info */}
      <div className="h-12 px-3 md:px-4 border-t border-slate-200 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-center md:justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="hidden md:inline text-slate-600 truncate">
            ResiliChain Engine v2.4
          </span>
        </div>
        <span className="hidden md:inline text-[10px] text-slate-400 tabular-nums">
          Online
        </span>
      </div>
    </aside>
  );
};
