import React, { useState, useEffect, useCallback } from "react";
import {
  PurchaseOrder,
  Supplier,
  InventoryItem,
  Incident,
  RFQItem,
  SourcingProposal,
  RiskThresholdConfig,
  SeasonalityConfig,
  AuditLogEntry,
  AppNotification,
  UserRole,
} from "./types";
import { StorageService } from "./services/storage";
import { calculatePoRisk, generateCorrelationId } from "./services/riskAgent";
import { SourcingAgent } from "./services/sourcingAgent";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DashboardView } from "./components/DashboardView";
import { OrdersView } from "./components/OrdersView";
import { SuppliersView } from "./components/SuppliersView";
import { InventoryView } from "./components/InventoryView";
import { IncidentsView } from "./components/IncidentsView";
import { RfqView } from "./components/RfqView";
import { ApprovalView } from "./components/ApprovalView";
import { ForecastingView } from "./components/ForecastingView";
import { AuditLogView } from "./components/AuditLogView";
import { SupplierPortalView } from "./components/SupplierPortalView";
import { ShipmentTrackingMapView } from "./components/ShipmentTrackingMapView";
import { NotificationsModal } from "./components/NotificationsModal";
import { RiskConfigModal } from "./components/RiskConfigModal";
import { SupplyChainApi } from "./services/api";
import { LogisticsChatModal } from "./components/LogisticsChatModal";

const TAB_PATHS: Record<string, string> = { dashboard: '/', orders: '/don-hang', suppliers: '/nha-cung-cap', inventory: '/ton-kho', incidents: '/rui-ro', rfq: '/rfq', approvals: '/phe-duyet', forecasting: '/du-bao', audit: '/audit', map: '/ban-do', supplier_portal: '/doi-tac' };
const tabFromPath = () => Object.entries(TAB_PATHS).find(([, path]) => path === window.location.pathname)?.[0] || 'dashboard';



export default function App() {
  // 1. Core State
  const [userRole, setUserRole] = useState<UserRole>(StorageService.getUserRole());
  const [currentTab, setCurrentTab] = useState<string>(tabFromPath);
  const [orders, setOrders] = useState<PurchaseOrder[]>(StorageService.getOrders());
  const [suppliers, setSuppliers] = useState<Supplier[]>(StorageService.getSuppliers());
  const [inventory, setInventory] = useState<InventoryItem[]>(StorageService.getInventory());
  const [incidents, setIncidents] = useState<Incident[]>(StorageService.getIncidents());
  const [rfqs, setRfqs] = useState<RFQItem[]>(StorageService.getRfqs());
  const [proposals, setProposals] = useState<SourcingProposal[]>(StorageService.getProposals());
  const [thresholds, setThresholds] = useState<RiskThresholdConfig>(StorageService.getThresholds());
  const [seasonality, setSeasonality] = useState<SeasonalityConfig[]>(StorageService.getSeasonality());
  const [demandHistory, setDemandHistory] = useState<Record<string, number[]>>(StorageService.getDemandHistory());
  const [logs, setLogs] = useState<AuditLogEntry[]>(StorageService.getLogs());
  const [notifications, setNotifications] = useState<AppNotification[]>(StorageService.getNotifications());
  const [chatIncidentId, setChatIncidentId] = useState<string | null>(null);
  const [supplierRisks, setSupplierRisks] = useState<Array<{ supplierId: string; supplierName: string; porsScore: number | string; riskLevel: string; statusLabel: string }>>([]);

  useEffect(() => {
    const onPopState = () => setCurrentTab(tabFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => { void SupplyChainApi.syncHighRiskOrders().catch(console.error); }, []);
  useEffect(() => { void SupplyChainApi.getSupplierRiskAnalysis().then(setSupplierRisks).catch(console.error); }, []);
  useEffect(() => { const path = TAB_PATHS[currentTab] || '/'; if (window.location.pathname !== path) window.history.pushState({}, '', path); }, [currentTab]);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/partner-confirmation\/([^/]+)\/(on-time|delayed)$/);
    if (match) {
      void SupplyChainApi.confirmPartnerDelivery(match[1], match[2] as 'on-time' | 'delayed').then((result) => {
        if (result.redirectTo) { window.location.href = `/?incidentId=${result.redirectTo.split('/')[2]?.split('?')[0]}&delayConfirmed=true`; }
        else { alert('Đã ghi nhận xác nhận vẫn đúng hẹn.'); window.history.replaceState({}, '', '/'); }
      }).catch(() => alert('Liên kết xác nhận không hợp lệ hoặc đã hết hạn.'));
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const incidentId = params.get('incidentId');
    if (params.get('delayConfirmed') === 'true' && incidentId && window.confirm('Đối tác đã xác nhận trễ hẹn. Bạn có muốn trao đổi thêm với logistics không?')) setChatIncidentId(incidentId);
  }, []);

  // Hydrate persisted supply-chain data. Local mock data remains the fallback for a fresh database.
  useEffect(() => {
    let mounted = true;
    const replaceWhenAvailable = <T,>(items: T[], setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      if (mounted && items.length > 0) setter(items);
    };
    Promise.all([
      SupplyChainApi.getSuppliers(), SupplyChainApi.getInventory(), SupplyChainApi.getPurchaseOrders(),
      SupplyChainApi.getIncidents(), SupplyChainApi.getProposals(),
    ])
      .then(([apiSuppliers, apiInventory, apiOrders, apiIncidents, apiProposals]) => {
        replaceWhenAvailable(apiSuppliers, setSuppliers);
        replaceWhenAvailable(apiInventory, setInventory);
        replaceWhenAvailable(apiOrders, setOrders);
        replaceWhenAvailable(apiIncidents, setIncidents);
        replaceWhenAvailable(apiProposals, setProposals);
      })
      .catch((error) => console.warn('Supply-chain API is unavailable; using local demo data.', error));
    return () => { mounted = false; };
  }, []);

  // Hydrate persisted supply-chain data. Local mock data remains the fallback for a fresh database.
  useEffect(() => {
    let mounted = true;
    const replaceWhenAvailable = <T,>(items: T[], setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      if (mounted && items.length > 0) setter(items);
    };
    Promise.all([
      SupplyChainApi.getSuppliers(), SupplyChainApi.getInventory(), SupplyChainApi.getPurchaseOrders(),
      SupplyChainApi.getIncidents(), SupplyChainApi.getProposals(),
    ])
      .then(([apiSuppliers, apiInventory, apiOrders, apiIncidents, apiProposals]) => {
        replaceWhenAvailable(apiSuppliers, setSuppliers);
        replaceWhenAvailable(apiInventory, setInventory);
        replaceWhenAvailable(apiOrders, setOrders);
        replaceWhenAvailable(apiIncidents, setIncidents);
        replaceWhenAvailable(apiProposals, setProposals);
      })
      .catch((error) => console.warn('Supply-chain API is unavailable; using local demo data.', error));
    return () => { mounted = false; };
  }, []);

  // UI State
  const [activeSupplierId, setActiveSupplierId] = useState<string>(suppliers[0]?.id || "SUP-01");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [autoScan, setAutoScan] = useState<boolean>(true);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isEvaluatingQuote, setIsEvaluatingQuote] = useState<boolean>(false);
  const [filterCorrelationId, setFilterCorrelationId] = useState<string | null>(null);
  const [forecastTargetSku, setForecastTargetSku] = useState<string | undefined>(undefined);
  const [mapFocusPoNumber, setMapFocusPoNumber] = useState<string | null>(null);

  const openShipmentOnMap = (poNumber: string) => {
    setMapFocusPoNumber(poNumber);
    setCurrentTab("map");
  };

  // Sync role to storage
  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    StorageService.saveUserRole(role);
  };

  // Helper: Append Audit Log
  const addAuditLog = useCallback((entry: Omit<AuditLogEntry, "id" | "timestamp">) => {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    };
    setLogs((prev) => {
      const updated = [newLog, ...prev];
      StorageService.saveLogs(updated);
      return updated;
    });
  }, []);

  // Helper: Add Notification
  const addNotification = useCallback((notif: Omit<AppNotification, "id" | "timestamp" | "isRead">) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      isRead: false,
    };
    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      StorageService.saveNotifications(updated);
      return updated;
    });
  }, []);

  // Agent 2 Trigger Helper
  const triggerAgent2ForIncident = useCallback(
    async (incident: Incident, po: PurchaseOrder) => {
      const backups = SourcingAgent.findBackupSuppliers(po.sku, po.supplierId, suppliers);
      if (backups.length === 0) {
        addAuditLog({
          correlationId: incident.correlationId,
          agent: "Agent 2 (Negotiation & Sourcing)",
          action: "NO_BACKUP_SUPPLIER_FOUND",
          poNumber: po.poNumber,
          sku: po.sku,
          inputSummary: `Tìm nhà cung cấp dự phòng cho SKU ${po.sku}.`,
          outputReasoning: `Không tìm thấy NCC nào khác cung cấp SKU này ngoài ${po.supplierName}. Cần mở rộng danh bạ nhà cung ứng.`,
        });
        return;
      }

      const { rfqs: newRfqs, logs: newLogs, notifs: newNotifs } =
        await SourcingAgent.generateAndSendRfqs(incident, po, backups);

      setRfqs((prev) => {
        const updated = [...newRfqs, ...prev];
        StorageService.saveRfqs(updated);
        return updated;
      });

      // Update incident status
      setIncidents((prev) => {
        const updated = prev.map((inc) =>
          inc.id === incident.id
            ? {
                ...inc,
                agent2Triggered: true,
                state: "RFQ_SENT" as const,
                status: "Đang tìm NCC thay thế" as const,
                rfqSentCount: newRfqs.length,
              }
            : inc
        );
        StorageService.saveIncidents(updated);
        return updated;
      });

      // Append logs
      setLogs((prev) => {
        const updated = [...newLogs, ...prev];
        StorageService.saveLogs(updated);
        return updated;
      });

      // Append notifications
      setNotifications((prev) => {
        const updated = [...newNotifs, ...prev];
        StorageService.saveNotifications(updated);
        return updated;
      });
    },
    [suppliers, addAuditLog]
  );

  // AGENT 1: Scan all open orders and detect risks
  const runRiskScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const updatedOrders = [...orders];
      const newIncidents: Incident[] = [];

      for (let i = 0; i < updatedOrders.length; i++) {
        const po = updatedOrders[i];
        if (po.status === "Hoàn thành") continue;
        if (po.riskScoreSource === "MANUAL") continue;

        const supplier = suppliers.find((s) => s.id === po.supplierId);
        const item = inventory.find((inv) => inv.sku === po.sku);
        const risk = calculatePoRisk(po, supplier, item, thresholds);

        po.currentRiskScore = risk.delayRiskScore;

        if (risk.isTriggered) {
          // Check if active incident already exists for this PO
          const existingIncident = incidents.find(
            (inc) => inc.poNumber === po.poNumber && inc.status !== "Đã giải quyết" && inc.status !== "Đã hủy"
          );

          if (!existingIncident) {
            const corrId = generateCorrelationId(po.poNumber);
            const incId = `INC-2026-${Math.floor(100 + Math.random() * 900)}`;

            const incident: Incident = {
              id: incId,
              correlationId: corrId,
              poNumber: po.poNumber,
              supplierId: po.supplierId,
              supplierName: po.supplierName,
              sku: po.sku,
              skuName: po.skuName,
              delayDays: risk.delayDays,
              delayRiskScore: risk.delayRiskScore,
              thresholdApplied: risk.appliedThreshold,
              state: "DETECTED",
              status: "Mới phát hiện",
              detectedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
              summary: `PO ${po.poNumber} giao bởi ${po.supplierName} trễ ${risk.delayDays} ngày. Buffer tồn kho hiện còn ${risk.bufferDays} ngày. Nguy cơ làm dừng dây chuyền lắp ráp xe đạp.`,
              agent2Triggered: false,
              riskBreakdown: risk.breakdown,
              riskBreakdownJson: risk.riskBreakdownJson,
            };

            newIncidents.push(incident);

            StorageService.recordAgentRun({
              id: `RUN-A1-${Date.now()}`,
              agentType: "RiskMonitoring",
              correlationId: corrId,
              status: "COMPLETED",
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              resultPayloadJson: JSON.stringify({
                delayRiskScore: risk.delayRiskScore,
                appliedThreshold: risk.appliedThreshold,
              }),
            });

            StorageService.appendPoRiskHistory(po.poNumber, {
              timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
              score: risk.delayRiskScore,
              delayDays: risk.delayDays,
              breakdown: risk.breakdown,
            });

            // Audit log
            addAuditLog({
              correlationId: corrId,
              agent: "Agent 1 (Risk Monitoring)",
              action: "DETECT_SUPPLY_CHAIN_RISK",
              poNumber: po.poNumber,
              supplierName: po.supplierName,
              sku: po.sku,
              inputSummary: `Quét PO ${po.poNumber}: Trễ ${risk.delayDays} ngày so với cam kết ${po.promisedDeliveryDate}. Buffer kho: ${risk.bufferDays} ngày.`,
              outputReasoning: `Tính toán delay_risk_score = ${risk.delayRiskScore}/100 (vượt ngưỡng quy định ${risk.appliedThreshold}). Tự động sinh sự cố ${incId}.`,
            });

            // Notification
            addNotification({
              title: `Phát hiện rủi ro cao: ${po.poNumber} (${risk.delayRiskScore}/100)`,
              message: `Đơn hàng linh kiện ${po.skuName} bị trễ ${risk.delayDays} ngày từ đối tác ${po.supplierName}.`,
              type: "warning",
              correlationId: corrId,
              linkTab: "incidents",
              incidentId: incId,
            });

            // Auto trigger Agent 2 if configured
            if (thresholds.autoTriggerAgent2) {
              await triggerAgent2ForIncident(incident, po);
            }
          }
        }
      }

      setOrders(updatedOrders);
      StorageService.saveOrders(updatedOrders);
      void Promise.all(updatedOrders.map((order) => SupplyChainApi.updatePurchaseOrder(order.id, order))).catch(console.error);

      if (newIncidents.length > 0) {
        setIncidents((prev) => {
          const updated = [...newIncidents, ...prev];
          StorageService.saveIncidents(updated);
          return updated;
        });
      }
      void Promise.all(newIncidents.map(async (incident) => {
        await SupplyChainApi.saveIncident(incident);
        const po = updatedOrders.find((order) => order.poNumber === incident.poNumber);
        if (po) await SupplyChainApi.evaluateRiskAlert({ incidentId: incident.id, purchaseOrderId: po.id, riskScore: incident.delayRiskScore });
      })).catch(console.error);
    } finally {
      setIsScanning(false);
    }
  }, [orders, suppliers, inventory, thresholds, incidents, addAuditLog, addNotification, triggerAgent2ForIncident]);

  // Periodic Auto-Scan (30s)
  useEffect(() => {
    if (!autoScan) return;
    const timer = setInterval(() => {
      runRiskScan();
    }, 30000);
    return () => clearInterval(timer);
  }, [autoScan, runRiskScan]);

  // Handle PO updates (Simulate tracking)
  const handleUpdateOrder = (updated: PurchaseOrder) => {
    const nextOrders = orders.map((o) => (o.id === updated.id ? updated : o));
    setOrders(nextOrders);
    StorageService.saveOrders(nextOrders);
    void SupplyChainApi.updatePurchaseOrder(updated.id, updated).catch((error) => {
      console.error('Unable to persist purchase order update', error);
    });

    addAuditLog({
      correlationId: `MANUAL-PO-${updated.poNumber}`,
      agent: "Human (Procurement)",
      action: "UPDATE_PO_TRACKING",
      poNumber: updated.poNumber,
      supplierName: updated.supplierName,
      sku: updated.sku,
      inputSummary: `Cập nhật ngày giao dự kiến/thực tế: ${updated.actualOrExpectedDeliveryDate}, trạng thái: ${updated.status}.`,
      outputReasoning: "Người dùng mô phỏng thông tin tracking nhà cung cấp để kiểm tra phản ứng của hệ thống.",
    });

    // Run risk scan after order update to immediately capture delay
    setTimeout(() => {
      runRiskScan();
    }, 150);
  };

  // Handle Supplier quote submission
  const handleSubmitQuote = (
    rfqId: string,
    quote: {
      unitPrice: number;
      proposedLeadTimeDays: number;
      proposedDeliveryDate: string;
      notes: string;
    }
  ) => {
    const targetRfq = rfqs.find((r) => r.id === rfqId);
    if (!targetRfq) return;

    const supplier = suppliers.find((s) => s.id === targetRfq.backupSupplierId);
    const reliabilityScore = supplier ? supplier.reliabilityScore : 85;

    const updatedRfqs = rfqs.map((r) => {
      if (r.id === rfqId) {
        return {
          ...r,
          status: "Đã phản hồi" as const,
          response: {
            rfqId,
            supplierId: r.backupSupplierId,
            supplierName: r.backupSupplierName,
            unitPrice: quote.unitPrice,
            totalCost: quote.unitPrice * r.quantity,
            proposedLeadTimeDays: quote.proposedLeadTimeDays,
            proposedDeliveryDate: quote.proposedDeliveryDate,
            reliabilityScore,
            notes: quote.notes,
            submittedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
          },
        };
      }
      return r;
    });

    setRfqs(updatedRfqs);
    StorageService.saveRfqs(updatedRfqs);

    // Update Incident State Machine (§3.2)
    setIncidents((prev) => {
      const updated = prev.map((inc) => {
        if (inc.id === targetRfq.incidentId) {
          const relatedRfqs = updatedRfqs.filter((r) => r.incidentId === inc.id);
          const allResponded = relatedRfqs.length > 0 && relatedRfqs.every((r) => r.response);
          return {
            ...inc,
            state: allResponded ? ("QUOTES_READY_FOR_REVIEW" as const) : ("QUOTES_COLLECTING" as const),
            status: allResponded ? ("Sẵn sàng duyệt" as const) : ("Đang thu thập báo giá" as const),
          };
        }
        return inc;
      });
      StorageService.saveIncidents(updated);
      return updated;
    });

    addAuditLog({
      correlationId: targetRfq.correlationId,
      agent: "Supplier (Self-Service)",
      action: "SUBMIT_FORMAL_QUOTE",
      poNumber: targetRfq.poNumber,
      supplierName: targetRfq.backupSupplierName,
      sku: targetRfq.sku,
      inputSummary: `Báo giá RFQ ${rfqId}: Đơn giá ${Number(quote.unitPrice).toLocaleString("vi-VN")} đ/chiếc, Lead time ${quote.proposedLeadTimeDays} ngày.`,
      outputReasoning: `Nhà cung cấp đối tác ${targetRfq.backupSupplierName} hoàn tất phản hồi qua Supplier Portal. Dữ liệu sẵn sàng để Agent 2 phân tích.`,
    });

    addNotification({
      title: `Nhận báo giá mới: ${targetRfq.backupSupplierName}`,
      message: `Đối tác đã gửi báo giá cho gói ${targetRfq.skuName} (${Number(quote.unitPrice * targetRfq.quantity).toLocaleString("vi-VN")} đ).`,
      type: "info",
      correlationId: targetRfq.correlationId,
      linkTab: "rfq",
      incidentId: targetRfq.incidentId,
    });
  };

  // Simulate instant quote response from supplier
  const handleSimulateQuoteResponse = (rfqId: string) => {
    const rfq = rfqs.find((r) => r.id === rfqId);
    if (!rfq) return;

    const supplier = suppliers.find((s) => s.id === rfq.backupSupplierId);
    const basePrice = supplier?.historicalPrice[rfq.sku] || 2400000;
    // Slight variation
    const unitPrice = Math.round(basePrice * (0.97 + Math.random() * 0.08));
    const leadTime = supplier ? supplier.averageLeadTimeDays : 6;
    const now = new Date();
    const deliveryDate = new Date(now.getTime() + leadTime * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    handleSubmitQuote(rfqId, {
      unitPrice,
      proposedLeadTimeDays: leadTime,
      proposedDeliveryDate: deliveryDate,
      notes: "Cam kết ưu tiên dây chuyền sản xuất khẩn, chứng chỉ CO/CQ chuẩn Nhật Bản.",
    });
  };

  // Run AI Evaluation on quotes
  const handleRunAiEvaluation = async (incidentId: string) => {
    setIsEvaluatingQuote(true);
    try {
      const incident = incidents.find((i) => i.id === incidentId);
      if (!incident) return;
      const po = orders.find((o) => o.poNumber === incident.poNumber);
      if (!po) return;

      const incidentRfqs = rfqs.filter((r) => r.incidentId === incidentId && r.response);
      if (incidentRfqs.length === 0) {
        alert("Chưa có báo giá nào được gửi từ các nhà cung cấp!");
        return;
      }

      const { proposal, log, notif } = await SourcingAgent.evaluateAndCreateProposal(
        incident,
        po,
        incidentRfqs
      );

      // Save proposal
      setProposals((prev) => {
        const filtered = prev.filter((p) => p.incidentId !== incidentId);
        const updated = [proposal, ...filtered];
        StorageService.saveProposals(updated);
        return updated;
      });
      void SupplyChainApi.saveProposal(proposal).catch(console.error);

      // Update incident
      setIncidents((prev) => {
        const updated = prev.map((inc) =>
          inc.id === incidentId
            ? { ...inc, state: "PENDING_APPROVAL" as const, status: "Chờ duyệt" as const }
            : inc
        );
        StorageService.saveIncidents(updated);
        return updated;
      });
      void SupplyChainApi.updateIncident(incidentId, { state: "PENDING_APPROVAL" as const, status: "Chờ duyệt" as const }).catch(console.error);

      // Append log & notification
      setLogs((prev) => {
        const updated = [log, ...prev];
        StorageService.saveLogs(updated);
        return updated;
      });

      setNotifications((prev) => {
        const updated = [notif, ...prev];
        StorageService.saveNotifications(updated);
        return updated;
      });

      // Navigate to Approvals view
      setCurrentTab("approvals");
    } catch (e: any) {
      alert(`Lỗi phân tích báo giá: ${e.message}`);
    } finally {
      setIsEvaluatingQuote(false);
    }
  };

  // HITL: Approve proposal
  const handleApproveProposal = (
    proposalId: string,
    selectedRank: number,
    customData?: { unitPrice: number; leadTimeDays: number; notes: string }
  ) => {
    const prop = proposals.find((p) => p.id === proposalId);
    if (!prop) return { success: false, message: "Không tìm thấy đề xuất." };

    const selectedOption = prop.rankings.find((r) => r.rank === selectedRank);
    if (!selectedOption) return { success: false, message: "Phương án không hợp lệ." };

    const finalUnitPrice = customData ? customData.unitPrice : selectedOption.unitPrice;
    const finalLeadTime = customData ? customData.leadTimeDays : selectedOption.leadTimeDays;
    const finalTotalCost = finalUnitPrice * prop.quantity;

    // Check Role Authority
    if (finalTotalCost >= 50000000 && userRole === "procurement_officer") {
      // Create Escalation notification
      addNotification({
        title: "Yêu cầu Escalation duyệt đơn hàng ≥50 triệu VNĐ",
        message: `Đơn hàng ${Number(finalTotalCost).toLocaleString("vi-VN")} VNĐ vượt hạn mức của Procurement Officer (<50tr). Đã gửi cảnh báo escalated tới Supply Chain Manager.`,
        type: "escalation",
        correlationId: prop.correlationId,
        linkTab: "approvals",
        proposalId: prop.id,
      });

      return {
        success: false,
        message: `Thẩm quyền không hợp lệ: Đơn giá trị ${Number(finalTotalCost).toLocaleString("vi-VN")} VNĐ (≥50 triệu VNĐ). Vui lòng chuyển vai trò thành Supply Chain Manager để phê duyệt!`,
      };
    }

    // Process Approval
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    const newPoNumber = `PO-2026-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Update proposal status
    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return {
          ...p,
          selectedRank,
          status: customData ? ("Sửa & Duyệt" as const) : ("Đã duyệt" as const),
          reviewedByRole: userRole,
          reviewedAt: nowStr,
          customAdjusted: customData
            ? {
                unitPrice: customData.unitPrice,
                leadTimeDays: customData.leadTimeDays,
                totalCost: finalTotalCost,
                notes: customData.notes,
              }
            : undefined,
        };
      }
      return p;
    });
    setProposals(updatedProposals);
    StorageService.saveProposals(updatedProposals);
    const approvedProposal = updatedProposals.find((item) => item.id === proposalId);
    if (approvedProposal) void SupplyChainApi.updateProposal(proposalId, approvedProposal).catch(console.error);

    // 2. Mark old PO as cancelled / replaced
    const updatedOrders = orders.map((o) => {
      if (o.poNumber === prop.poNumber) {
        return {
          ...o,
          status: "Hoàn thành" as const,
          notes: `Đã hủy & thay thế bởi đơn khẩn ${newPoNumber} (NCC ${selectedOption.supplierName})`,
        };
      }
      return o;
    });

    // 3. Create NEW PO for replacement supplier
    const deliveryDate = new Date(Date.now() + finalLeadTime * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: newPoNumber,
      supplierId: selectedOption.supplierId,
      supplierName: selectedOption.supplierName,
      sku: prop.sku,
      skuName: prop.skuName,
      quantity: prop.quantity,
      unitPrice: finalUnitPrice,
      totalAmount: finalTotalCost,
      orderDate: new Date().toISOString().split("T")[0],
      promisedDeliveryDate: deliveryDate,
      actualOrExpectedDeliveryDate: deliveryDate,
      status: "Đang giao",
      notes: `Tạo tự động từ đề xuất ${prop.id} giải quyết trễ hạn đơn ${prop.poNumber}.`,
      currentRiskScore: 12,
    };

    const finalOrders = [newPo, ...updatedOrders];
    setOrders(finalOrders);
    StorageService.saveOrders(finalOrders);
    const replacedOrder = updatedOrders.find((item) => item.poNumber === prop.poNumber);
    if (replacedOrder) void SupplyChainApi.updatePurchaseOrder(replacedOrder.id, replacedOrder).catch(console.error);
    void SupplyChainApi.createPurchaseOrder(newPo).catch(console.error);

    // 4. Update Incident to Resolved
    const updatedIncidents = incidents.map((inc) => {
      if (inc.id === prop.incidentId) {
        return {
          ...inc,
          state: "PO_AMENDED" as const,
          status: "Đã giải quyết" as const,
          resolvedAt: nowStr,
        };
      }
      return inc;
    });
    setIncidents(updatedIncidents);
    StorageService.saveIncidents(updatedIncidents);
    const resolvedIncident = updatedIncidents.find((item) => item.id === prop.incidentId);
    if (resolvedIncident) void SupplyChainApi.updateIncident(resolvedIncident.id, resolvedIncident).catch(console.error);

    // 5. Audit Log
    addAuditLog({
      correlationId: prop.correlationId,
      agent: `Human (${userRole === "supply_chain_manager" ? "Supply Chain Manager" : "Procurement Officer"})`,
      action: customData ? "APPROVE_WITH_ADJUSTMENTS" : "APPROVE_RECOMMENDED_PROPOSAL",
      poNumber: prop.poNumber,
      supplierName: selectedOption.supplierName,
      sku: prop.sku,
      inputSummary: `Duyệt phương án #${selectedRank}: NCC ${selectedOption.supplierName}, Đơn giá: ${Number(finalUnitPrice).toLocaleString("vi-VN")} đ, Lead time: ${finalLeadTime} ngày.`,
      outputReasoning: `Phê duyệt thành công. Hủy đơn trễ ${prop.poNumber}, tự động khởi tạo đơn mua hàng mới ${newPoNumber} với giá trị ${Number(finalTotalCost).toLocaleString("vi-VN")} VNĐ. Sự cố ${prop.incidentId} đánh dấu Đã giải quyết.`,
      metadata: { newPoNumber, totalCost: finalTotalCost },
    });

    // 6. Notification
    addNotification({
      title: `Đã phê duyệt đề xuất ${prop.id}`,
      message: `Đơn hàng mới ${newPoNumber} đã được phát hành cho ${selectedOption.supplierName}. Sự cố đã xử lý xong.`,
      type: "success",
      correlationId: prop.correlationId,
      linkTab: "orders",
    });

    return {
      success: true,
      message: `Phê duyệt thành công! Đã phát hành đơn hàng thay thế ${newPoNumber} cho nhà cung cấp ${selectedOption.supplierName}.`,
    };
  };

  // HITL: Reject proposal
  const handleRejectProposal = (proposalId: string, reason: string) => {
    const prop = proposals.find((p) => p.id === proposalId);
    if (!prop) return;

    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const updatedProposals = proposals.map((p) => {
      if (p.id === proposalId) {
        return {
          ...p,
          status: "Từ chối" as const,
          reviewedByRole: userRole,
          reviewedAt: nowStr,
          rejectionReason: reason,
        };
      }
      return p;
    });
    setProposals(updatedProposals);
    StorageService.saveProposals(updatedProposals);
    const rejectedProposal = updatedProposals.find((item) => item.id === proposalId);
    if (rejectedProposal) void SupplyChainApi.updateProposal(proposalId, rejectedProposal).catch(console.error);

    // Update Incident State Machine (§3.2)
    const updatedIncidents = incidents.map((inc) => {
      if (inc.id === prop.incidentId) {
        return {
          ...inc,
          state: "MANUAL_HANDLING" as const,
          status: "Từ chối" as const,
        };
      }
      return inc;
    });
    setIncidents(updatedIncidents);
    StorageService.saveIncidents(updatedIncidents);
    const manualIncident = updatedIncidents.find((item) => item.id === prop.incidentId);
    if (manualIncident) void SupplyChainApi.updateIncident(manualIncident.id, manualIncident).catch(console.error);

    addAuditLog({
      correlationId: prop.correlationId,
      agent: `Human (${userRole})`,
      action: "REJECT_SOURCING_PROPOSAL",
      poNumber: prop.poNumber,
      sku: prop.sku,
      inputSummary: `Từ chối đề xuất ${prop.id}. Lý do: ${reason}`,
      outputReasoning: "Người dùng không đồng thuận với các phương án đề xuất của Agent 2.",
    });

    addNotification({
      title: `Đã từ chối đề xuất ${prop.id}`,
      message: `Lý do: "${reason}". Cần đàm phán thêm hoặc rà soát giải pháp khác.`,
      type: "warning",
      correlationId: prop.correlationId,
      linkTab: "approvals",
    });
  };

  // Agent 3: Create PO from Demand Forecast Recommendation
  const handleCreatePoFromForecast = (sku: string, quantity: number) => {
    const item = inventory.find((i) => i.sku === sku);
    const candidateSuppliers = suppliers.filter((s) => s.providedSkus.includes(sku));
    const targetSupplier = candidateSuppliers[0] || suppliers[0];
    const unitPrice = targetSupplier?.historicalPrice[sku] || item?.estimatedUnitPrice || 2400000;
    const totalAmount = unitPrice * quantity;

    const newPoNumber = `PO-2026-${Math.floor(100 + Math.random() * 900)}`;
    const nowStr = new Date().toISOString().split("T")[0];
    const deliveryDate = new Date(Date.now() + (targetSupplier?.averageLeadTimeDays || 7) * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const newPo: PurchaseOrder = {
      id: `po-${Date.now()}`,
      poNumber: newPoNumber,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      sku,
      skuName: item?.name || sku,
      quantity,
      unitPrice,
      totalAmount,
      orderDate: nowStr,
      promisedDeliveryDate: deliveryDate,
      actualOrExpectedDeliveryDate: deliveryDate,
      status: "Đang xử lý",
      notes: `Đơn hàng tự động sinh theo khuyến nghị của Agent 3 (Dự báo nhu cầu 4 tuần tới).`,
      currentRiskScore: 10,
    };

    const nextOrders = [newPo, ...orders];
    setOrders(nextOrders);
    StorageService.saveOrders(nextOrders);
    void SupplyChainApi.createPurchaseOrder(newPo).catch(console.error);

    addAuditLog({
      correlationId: `FORECAST-${sku}-${Date.now()}`,
      agent: "Agent 3 (Demand Forecasting)",
      action: "AUTO_TRIGGER_PROCUREMENT_PO",
      poNumber: newPoNumber,
      supplierName: targetSupplier.name,
      sku,
      inputSummary: `Dự báo nhu cầu 4 tuần vượt tồn kho khả dụng. Khuyến nghị đặt bổ sung ${quantity} ${item?.unit || "chiếc"}.`,
      outputReasoning: `Khởi tạo thành công đơn PO ${newPoNumber} gửi đối tác ${targetSupplier.name} (Lead time ${targetSupplier.averageLeadTimeDays} ngày, giá trị ${Number(totalAmount).toLocaleString("vi-VN")} đ).`,
    });

    addNotification({
      title: `Tạo đơn PO mới từ dự báo: ${newPoNumber}`,
      message: `Đã đặt bổ sung ${quantity} ${item?.unit} ${item?.name} để phòng ngừa cạn tồn kho an toàn.`,
      type: "success",
      linkTab: "orders",
    });
  };

  // Reset all mock data
  const handleResetData = () => {
    if (confirm("Khôi phục toàn bộ dữ liệu về trạng thái mẫu ban đầu?")) {
      StorageService.resetAll();
      setOrders(StorageService.getOrders());
      setSuppliers(StorageService.getSuppliers());
      setInventory(StorageService.getInventory());
      setIncidents(StorageService.getIncidents());
      setRfqs(StorageService.getRfqs());
      setProposals(StorageService.getProposals());
      setThresholds(StorageService.getThresholds());
      setSeasonality(StorageService.getSeasonality());
      setDemandHistory(StorageService.getDemandHistory());
      setLogs(StorageService.getLogs());
      setNotifications(StorageService.getNotifications());
      alert("Đã khôi phục dữ liệu mẫu ban đầu thành công!");
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const pendingApprovalCount = proposals.filter((p) => p.status === "Chờ duyệt").length;
  const openIncidentsCount = incidents.filter(
    (i) => i.status !== "Đã giải quyết" && i.status !== "Đã hủy"
  ).length;

  return (<>
    {chatIncidentId && <LogisticsChatModal incidentId={chatIncidentId} onClose={() => setChatIncidentId(null)} />}
    <div className="min-h-screen bg-slate-100 text-slate-900 flex font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        userRole={userRole}
        pendingApprovalCount={pendingApprovalCount}
        openIncidentsCount={openIncidentsCount}
      />

      {/* Main Right Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          userRole={userRole}
          unreadCount={unreadCount}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenConfig={() => setIsConfigOpen(true)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {currentTab === "dashboard" && (
          <DashboardView
            orders={orders}
            incidents={incidents}
            proposals={proposals}
            inventory={inventory}
            suppliers={suppliers}
            userRole={userRole}
            onNavigate={(tab) => setCurrentTab(tab)}
            onRunRiskScan={runRiskScan}
            isScanning={isScanning}
          />
        )}

        {currentTab === "map" && (
          <ShipmentTrackingMapView
            userRole={userRole}
            orders={orders}
            incidents={incidents}
            focusPoNumber={mapFocusPoNumber}
            onNavigateToIncidents={() => setCurrentTab("incidents")}
            onNavigateToPo={(poNumber) => {
              setCurrentTab("orders");
            }}
          />
        )}

        {currentTab === "orders" && (
          <OrdersView
            orders={orders}
            onUpdateOrder={handleUpdateOrder}
            onRunRiskScan={runRiskScan}
            isScanning={isScanning}
            userRole={userRole}
            onViewOnMap={openShipmentOnMap}
          />
        )}

        {currentTab === "suppliers" && (
          <SuppliersView
            suppliers={suppliers}
            inventory={inventory}
            onUpdateSupplier={(sup) => {
              const updated = suppliers.map((s) => (s.id === sup.id ? sup : s));
              setSuppliers(updated);
              StorageService.saveSuppliers(updated);
            }}
            onAddSupplier={(sup) => {
              const updated = [sup, ...suppliers];
              setSuppliers(updated);
              StorageService.saveSuppliers(updated);
            }}
            userRole={userRole}
          />
        )}

        {currentTab === "inventory" && (
          <InventoryView
            inventory={inventory}
            onUpdateItem={(item) => {
              const updated = inventory.map((i) => (i.sku === item.sku ? item : i));
              setInventory(updated);
              StorageService.saveInventory(updated);
              // re-scan risks when inventory changes
              runRiskScan();
            }}
            onNavigateToForecast={(sku) => {
              setForecastTargetSku(sku);
              setCurrentTab("forecasting");
            }}
            userRole={userRole}
          />
        )}

        {currentTab === "incidents" && (
          <IncidentsView
            incidents={incidents}
            highRiskOrders={orders.filter((order) => Number(order.currentRiskScore) >= 60 && !incidents.some((incident) => incident.poNumber === order.poNumber))}
            supplierRisks={supplierRisks}
            onTriggerAgent2={async (inc) => {
              const po = orders.find((o) => o.poNumber === inc.poNumber);
              if (po) await triggerAgent2ForIncident(inc, po);
            }}
            onNavigateToRfq={(incidentId) => setCurrentTab("rfq")}
            onNavigateToApprovals={(incidentId) => setCurrentTab("approvals")}
            onOpenConfig={() => setIsConfigOpen(true)}
            onRunRiskScan={runRiskScan}
            isScanning={isScanning}
            userRole={userRole}
            onViewOnMap={openShipmentOnMap}
          />
        )}

        {currentTab === "rfq" && (
          <RfqView
            rfqs={rfqs}
            incidents={incidents}
            orders={orders}
            suppliers={suppliers}
            onSimulateQuoteResponse={handleSimulateQuoteResponse}
            onRunAiEvaluation={handleRunAiEvaluation}
            isEvaluating={isEvaluatingQuote}
            userRole={userRole}
            onNavigateToApprovals={() => setCurrentTab("approvals")}
            onBack={() => setCurrentTab("incidents")}
          />
        )}

        {currentTab === "approvals" && (
          <ApprovalView
            proposals={proposals}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            userRole={userRole}
            onBack={() => setCurrentTab("incidents")}
          />
        )}

        {currentTab === "forecasting" && (
          <ForecastingView
            inventory={inventory}
            demandHistory={demandHistory}
            seasonality={seasonality}
            orders={orders}
            onUpdateSeasonality={(upd) => {
              setSeasonality(upd);
              StorageService.saveSeasonality(upd);
            }}
            onCreatePoFromForecast={handleCreatePoFromForecast}
            userRole={userRole}
            initialSku={forecastTargetSku}
            onBack={() => setCurrentTab("inventory")}
          />
        )}

        {currentTab === "audit" && (
          <AuditLogView
            logs={logs}
            userRole={userRole}
            filterCorrelationId={filterCorrelationId}
          />
        )}

        {currentTab === "supplier_portal" && (
          <SupplierPortalView
            rfqs={rfqs}
            suppliers={suppliers}
            activeSupplierId={activeSupplierId}
            setActiveSupplierId={setActiveSupplierId}
            onSubmitQuote={handleSubmitQuote}
            userRole={userRole}
          />
        )}
      </main>

      {/* Notifications Drawer */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={(id) => {
          const updated = notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
          setNotifications(updated);
          StorageService.saveNotifications(updated);
        }}
        onClearAll={() => {
          setNotifications([]);
          StorageService.saveNotifications([]);
        }}
        onNavigateToTab={(tab, contextId) => {
          setCurrentTab(tab);
          if (contextId && tab === "audit") {
            setFilterCorrelationId(contextId);
          }
        }}
      />

      {/* Risk Configuration Modal */}
      <RiskConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={thresholds}
        inventory={inventory}
        onSaveConfig={(newConfig) => {
          setThresholds(newConfig);
          StorageService.saveThresholds(newConfig);
          runRiskScan();
        }}
      />
      </div>
    </div>
  </>);
}
