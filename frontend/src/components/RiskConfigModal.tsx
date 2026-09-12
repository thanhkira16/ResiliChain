import React, { useState } from "react";
import { RiskThresholdConfig, InventoryItem } from "../types";
import { Sliders, ShieldAlert, Check, X, RotateCcw } from "lucide-react";

interface RiskConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: RiskThresholdConfig;
  inventory: InventoryItem[];
  onSaveConfig: (newConfig: RiskThresholdConfig) => void;
}

export const RiskConfigModal: React.FC<RiskConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  inventory,
  onSaveConfig,
}) => {
  if (!isOpen) return null;

  const [defaultThreshold, setDefaultThreshold] = useState<number>(config.defaultThreshold);
  const [autoTriggerAgent2, setAutoTriggerAgent2] = useState<boolean>(config.autoTriggerAgent2 ?? true);
  const [w1, setW1] = useState<number>(config.w1 ?? 0.5);
  const [w2, setW2] = useState<number>(config.w2 ?? 0.25);
  const [w3, setW3] = useState<number>(config.w3 ?? 0.25);
  const [skuOverrides, setSkuOverrides] = useState<Record<string, number>>(
    config.skuOverrides || {}
  );

  const weightSum = Number((w1 + w2 + w3).toFixed(2));
  const isWeightValid = Math.abs(weightSum - 1.0) < 0.01;

  const handleOverrideChange = (sku: string, val: number) => {
    setSkuOverrides((prev) => ({
      ...prev,
      [sku]: val,
    }));
  };

  const handleSave = () => {
    onSaveConfig({
      defaultThreshold: Number(defaultThreshold),
      autoTriggerAgent2,
      w1: Number(w1),
      w2: Number(w2),
      w3: Number(w3),
      skuOverrides,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setDefaultThreshold(70);
    setAutoTriggerAgent2(true);
    setW1(0.5);
    setW2(0.25);
    setW3(0.25);
    setSkuOverrides({});
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">
              Agent 1 Risk Monitoring Configuration
            </h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Default Threshold */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-900">Default Risk Threshold:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={99}
                  value={defaultThreshold}
                  onChange={(e) => setDefaultThreshold(Number(e.target.value))}
                  className="w-16 p-1 text-center border border-slate-300 rounded font-bold text-xs"
                />
                <span className="font-bold text-slate-500">/ 100</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              When an order&apos;s <code className="font-mono text-slate-700">delay_risk_score</code> exceeds this threshold, Agent 1 will immediately trigger a new Incident.
            </p>
          </div>

          {/* Weights Configuration (§2.3) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-slate-900 block">Risk Formula Weights (SRS §2.3 Weights):</label>
                <span className="text-[11px] text-slate-500">
                  delay_risk = (w1 × lateness) + (w2 × (1-reliability)) + (w3 × stock buffer)
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isWeightValid
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                Total w: {weightSum} / 1.0 {isWeightValid ? "✓" : "(!)"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700">w1: Lateness</div>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={w1}
                    onChange={(e) => setW1(Number(e.target.value))}
                    className="w-full p-1 text-center font-bold text-xs border border-slate-200 rounded"
                  />
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700">w2: Reliability</div>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={w2}
                    onChange={(e) => setW2(Number(e.target.value))}
                    className="w-full p-1 text-center font-bold text-xs border border-slate-200 rounded"
                  />
                </div>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700">w3: Stock Buffer</div>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={w3}
                    onChange={(e) => setW3(Number(e.target.value))}
                    className="w-full p-1 text-center font-bold text-xs border border-slate-200 rounded"
                  />
                </div>
              </div>
            </div>
            {!isWeightValid && (
              <p className="text-[11px] text-rose-600 font-medium">
                Note: The sum of weights w1 + w2 + w3 must equal exactly 1.0 per SRS §2.3.
              </p>
            )}
          </div>

          {/* Auto Trigger Agent 2 Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200">
            <div>
              <div className="font-bold text-slate-900">
                Automatically trigger Agent 2 upon incident detection
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Agent 2 will automatically filter backup suppliers and issue RFQs immediately when an Incident is opened.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoTriggerAgent2}
              onChange={(e) => setAutoTriggerAgent2(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
          </div>

          {/* SKU-Specific Overrides Table */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 block">
              SKU-Specific Risk Threshold Overrides:
            </label>
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
              {inventory.map((item) => (
                <div
                  key={item.sku}
                  className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{item.sku}</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 text-[11px]">Threshold:</span>
                    <input
                      type="number"
                      min={10}
                      max={99}
                      placeholder={String(defaultThreshold)}
                      value={skuOverrides[item.sku] ?? ""}
                      onChange={(e) =>
                        handleOverrideChange(
                          item.sku,
                          e.target.value === "" ? defaultThreshold : Number(e.target.value)
                        )
                      }
                      className="w-14 p-1 text-center border border-slate-300 rounded text-xs font-medium"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default (70)</span>
          </button>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
