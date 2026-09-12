import React, { useEffect, useState } from 'react';
import { SupplyChainApi } from '../services/api';

export function LogisticsChatModal({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ id: string; senderRole: string; body: string; createdAt: string }>>([]);
  const [body, setBody] = useState('Please confirm updated ETA, root cause of delay, and transport options.');
  useEffect(() => { SupplyChainApi.getLogisticsMessages(incidentId).then(setMessages).catch(console.error); }, [incidentId]);
  const send = async () => { if (!body.trim()) return; const message = await SupplyChainApi.sendLogisticsMessage(incidentId, body, 'PROCUREMENT'); setMessages((items) => [...items, message]); setBody(''); };
  return <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"><div className="w-full max-w-xl bg-white rounded-xl p-5 space-y-3 shadow-xl"><div className="flex justify-between"><b>Logistics coordination · Incident {incidentId}</b><button onClick={onClose}>✕</button></div><p className="text-xs text-slate-500">Discuss ETA, carrier details, checkpoints, and delivery plan.</p><div className="h-56 overflow-y-auto border rounded p-3 space-y-2">{messages.map((m) => <div key={m.id} className="text-sm"><b>{m.senderRole}:</b> {m.body}</div>)}</div><div className="flex gap-2"><input className="flex-1 border rounded px-3 text-xs" value={body} onChange={(e) => setBody(e.target.value)} /><button className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-semibold" onClick={() => void send()}>Send Logistics Update</button></div></div></div>;
}
