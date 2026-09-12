import React from "react";
import { UserRole } from "../types";
import {
  Bike,
  LayoutDashboard,
  Map,
  ShoppingBag,
  Truck,
  Boxes,
  ShieldAlert,
  FileCheck,
  ChevronRight,
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
      label: "Shipment Tracking Map",
      icon: Map,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : undefined,
      badgeColor: "bg-blue-500 text-white",
    },
    {
      id: "incidents",
      label: "Risks & Incidents",
      icon: ShieldAlert,
      badge: openIncidentsCount > 0 ? `${openIncidentsCount}` : undefined,
      badgeColor: "bg-amber-500 text-white animate-pulse",
    },
    {
      id: "orders",
      label: "Purchase Orders (PO)",
      icon: ShoppingBag,
    },
    {
      id: "suppliers",
      label: "Suppliers",
      icon: Truck,
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: Boxes,
    },
    {
      id: "approvals",
      label: "Approvals (HITL)",
      icon: FileCheck,
      badge: pendingApprovalCount > 0 ? `${pendingApprovalCount}` : undefined,
      badgeColor: "bg-red-500 text-white font-bold",
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col shrink-0 min-h-screen sticky top-0 h-screen select-none shadow-xl z-20">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md font-black shrink-0">
          <Bike className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-white">Resili chain</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase font-semibold">
            Supply Chain MVP
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        <div>
          <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Supply Chain Management
          </div>
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`sidebar-tab-${tab.id}`}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    />
                    <span>{tab.label}</span>
                  </div>

                  {tab.badge ? (
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-bold shadow-xs ${tab.badgeColor}`}
                    >
                      {tab.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-200 opacity-80" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-300">Resili chain Engine v2.4</span>
        </div>
      </div>
    </aside>
  );
};
