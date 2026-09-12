import React, { useState } from "react";
import { UserRole } from "../types";
import {
  Bell,
  User,
  ChevronDown,
  Settings,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface HeaderProps {
  currentTab: string;
  userRole: UserRole;
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
    dashboard: { title: "Dashboard Tổng Quan", subtitle: "Giám sát hiệu suất chuỗi cung ứng & chỉ số KPI" },
    map: { title: "Bản đồ Vận chuyển Real-time", subtitle: "Theo dõi vị trí lô hàng GPS và giám sát rủi ro trễ tiến độ" },
    orders: { title: "Quản lý Đơn hàng (PO)", subtitle: "Danh sách đơn mua hàng linh kiện xe đạp" },
    suppliers: { title: "Danh mục Nhà cung cấp", subtitle: "Đánh giá uy tín, lead-time và đơn giá đối tác" },
    inventory: { title: "Quản lý Tồn kho Linh kiện", subtitle: "Theo dõi mức tồn kho an toàn & tốc độ tiêu thụ" },
    incidents: { title: "Quản lý Rủi ro & Sự cố", subtitle: "Tự động phát hiện chậm trễ & kích hoạt phương án thay thế" },
    approvals: { title: "Trung tâm Phê duyệt (HITL)", subtitle: "Xem xét & phê duyệt đề xuất chọn nhà cung cấp thay thế" },
  };

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

  const currentInfo = pageTitles[currentTab] || { title: "Resili chain", subtitle: "Hệ thống quản lý chuỗi cung ứng" };
  const currentUser = userProfiles[userRole];

  return (
    <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs px-6 py-3 flex items-center justify-between gap-4">
      {/* Left Title */}
      <div>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
          {currentInfo.title}
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          {currentInfo.subtitle}
        </p>
      </div>

      {/* Right Controls & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notification Bell */}
        <button
          id="btn-notification-bell"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          title="Hộp thư thông báo & Escalation"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            id="btn-user-profile-avatar"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-xl hover:bg-slate-100 text-slate-800 transition-all border border-slate-200 focus:outline-none shadow-2xs"
          >
            <div className="relative">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${currentUser.gradient} flex items-center justify-center text-white text-xs font-bold shadow-xs border border-white/40`}>
                {currentUser.avatarInitials}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" title="Online" />
            </div>
            <div className="text-left hidden sm:block leading-tight">
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                {currentUser.name}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <div className="text-[10px] text-slate-500 font-normal">
                {roleLabels[userRole].title}
              </div>
            </div>
          </button>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-800 z-50 overflow-hidden animate-in fade-in duration-150">
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left"
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Hồ sơ cá nhân</span>
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenConfig();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Cấu hình rủi ro & hệ thống</span>
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenNotifications();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left"
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
    </header>
  );
};
