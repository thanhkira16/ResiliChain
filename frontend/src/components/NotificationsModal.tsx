import React from "react";
import { AppNotification } from "../types";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  ArrowRight,
  X,
  Clock,
  Trash2,
} from "lucide-react";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
  onNavigateToTab: (tab: string, contextId?: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onClearAll,
  onNavigateToTab,
}) => {
  if (!isOpen) return null;

  const getIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "escalation":
        return <ShieldAlert className="w-4 h-4 text-purple-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "info":
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBg = (type: AppNotification["type"], isRead: boolean) => {
    if (isRead) return "bg-white border-slate-200 text-slate-600";
    switch (type) {
      case "escalation":
        return "bg-purple-50/80 border-purple-300 text-purple-900";
      case "warning":
        return "bg-amber-50/80 border-amber-300 text-amber-900";
      case "success":
        return "bg-emerald-50/80 border-emerald-300 text-emerald-900";
      case "info":
      default:
        return "bg-blue-50/80 border-blue-300 text-blue-900";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-800" />
            <h3 className="text-sm font-bold text-slate-900">
              Thông Báo & Cảnh Báo Chuỗi Cung Ứng
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClearAll}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              title="Xóa tất cả"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
          {notifications.map((notif) => {
            return (
              <div
                key={notif.id}
                onClick={() => {
                  onMarkAsRead(notif.id);
                  if (notif.linkTab) {
                    onNavigateToTab(notif.linkTab, notif.proposalId || notif.incidentId);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all hover:shadow-xs ${getBg(
                  notif.type,
                  notif.isRead
                )}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 font-bold">
                    {getIcon(notif.type)}
                    <span>{notif.title}</span>
                  </div>
                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  )}
                </div>

                <p className="text-[11px] leading-relaxed mt-1 text-slate-700">
                  {notif.message}
                </p>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {notif.timestamp}
                  </span>

                  {notif.linkTab && (
                    <span className="font-semibold text-slate-900 flex items-center gap-1 hover:underline">
                      <span>Mở màn hình</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {notifications.length === 0 && (
            <div className="py-16 text-center text-xs text-slate-400">
              Không có thông báo nào.
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Thông báo được đồng bộ tự động từ Agent 1, Agent 2 & Vòng lặp HITL
        </div>
      </div>
    </div>
  );
};
