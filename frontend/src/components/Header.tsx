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
    dashboard: { title: "Trung Tâm Tác Chiến", subtitle: "Giám sát hiệu suất chuỗi cung ứng & chỉ số PORS real-time" },
    map: { title: "Bản Đồ 3D Digital Twin", subtitle: "Theo dõi vị trí lô hàng GPS và thời tiết tuyến Open-Meteo" },
    orders: { title: "Quản Lý Đơn Hàng (PO)", subtitle: "Danh sách đơn mua hàng linh kiện xe điện EV" },
    suppliers: { title: "Danh Mục Nhà Cung Cấp", subtitle: "Đánh giá Altman Z-Score, tin tức GDELT & điểm uy tín" },
    inventory: { title: "Quản Lý Tồn Kho Linh Kiện", subtitle: "Theo dõi mức tồn kho an toàn & tốc độ tiêu thụ" },
    incidents: { title: "Quản Lý Rủi Ro & Sự Cố", subtitle: "Tự động phát hiện chậm trễ & kích hoạt PuLP MILP Solver" },
    approvals: { title: "Trung Tâm Phê Duyệt 1-Click", subtitle: "Xem xét & phê duyệt đề xuất nhà cung cấp thay thế" },
    forecasting: { title: "Dự Báo Nhu Cầu & Mùa Vụ", subtitle: "Mô hình lập kế hoạch vật tư linh kiện EV" },
    audit: { title: "Nhật Ký Hệ Thống (Audit Log)", subtitle: "Lịch sử thao tác & nhật ký vận hành 6 AI Agents" },
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
      name: "Nguyễn Văn Hoàng",
      email: "hoang.nguyen@resilichain.ai",
      avatarInitials: "VH",
      bgColor: "bg-blue-600",
      title: "Procurement Officer",
      department: "Bộ phận Mua sắm & Vật tư",
    },
    supply_chain_manager: {
      name: "Lê Hoàng Nam",
      email: "nam.le@resilichain.ai",
      avatarInitials: "LN",
      bgColor: "bg-emerald-600",
      title: "Supply Chain Manager",
      department: "Ban Giám đốc Chuỗi Cung Ứng",
    },
    procurement_manager: {
      name: "Lê Hoàng Nam",
      email: "nam.le@resilichain.ai",
      avatarInitials: "LN",
      bgColor: "bg-emerald-600",
      title: "Procurement Manager",
      department: "Ban Giám đốc Chuỗi Cung Ứng",
    },
    supplier: {
      name: "Trần Đức Phú",
      email: "phu.tran@supplier-ev.com",
      avatarInitials: "TP",
      bgColor: "bg-purple-600",
      title: "Supplier (Đối tác)",
      department: "Phòng Kinh doanh Đối tác",
    },
  };

  const currentInfo = pageTitles[currentTab] || { title: "ResiliChain EV", subtitle: "Hệ thống quản lý tự chủ chuỗi cung ứng" };
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
          title="Cấu hình ngưỡng rủi ro"
        >
          <Settings className="w-4 h-4 text-slate-600" />
        </button>

        {/* Notification Bell */}
        <button
          id="btn-notification-bell"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors border border-slate-200"
          title="Thông báo rủi ro & Telegram Dispatch"
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
                  <span>Quyền Hạn:</span>
                  <span className="text-slate-900 font-bold">{currentUser.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Trạng Thái AI:</span>
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
