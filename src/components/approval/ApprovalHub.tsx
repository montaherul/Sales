'use client';

import React, { useState } from 'react';
import { RoleType, SubmissionStatus } from '@/lib/types';
import { 
  CheckCircle, 
  XCircle, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  MessageSquare, 
  Clock 
} from 'lucide-react';

interface ApprovalHubProps {
  currentRole: RoleType;
}

interface SubmissionItem {
  id: string;
  territory: string;
  reportDate: string;
  sales: number;
  stock: number;
  zardaValue: number;
  emptyPackets: number;
  status: SubmissionStatus;
  submittedBy: string;
}

export function ApprovalHub({ currentRole }: ApprovalHubProps) {
  const [items, setItems] = useState<SubmissionItem[]>([
    {
      id: 'sub-1',
      territory: 'Kerani hat',
      reportDate: '2026-10-06',
      sales: 0.68,
      stock: 1.03,
      zardaValue: 75,
      emptyPackets: 6660,
      status: 'SUBMITTED',
      submittedBy: 'CSR Kabir',
    },
    {
      id: 'sub-2',
      territory: 'Satkania',
      reportDate: '2026-10-06',
      sales: 0.42,
      stock: 1.20,
      zardaValue: 150,
      emptyPackets: 4270,
      status: 'TSO_APPROVED',
      submittedBy: 'CSR Rahim',
    },
    {
      id: 'sub-3',
      territory: 'Bandarban',
      reportDate: '2026-10-06',
      sales: 0.42,
      stock: 2.93,
      zardaValue: 360,
      emptyPackets: 4050,
      status: 'RSO_APPROVED',
      submittedBy: 'CSR Hasan',
    },
    {
      id: 'sub-4',
      territory: 'Rajasthali',
      reportDate: '2026-10-06',
      sales: 0.06,
      stock: 0.20,
      zardaValue: 0,
      emptyPackets: 600,
      status: 'SUBMITTED',
      submittedBy: 'CSR Mamun',
    },
    {
      id: 'sub-5',
      territory: 'Dohazari',
      reportDate: '2026-10-06',
      sales: 0.62,
      stock: 3.92,
      zardaValue: 270,
      emptyPackets: 6400,
      status: 'FINALIZED',
      submittedBy: 'CSR Faruk',
    },
  ]);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const handleApprove = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        let newStatus = item.status;
        if (currentRole === 'TSO' && item.status === 'SUBMITTED') {
          newStatus = 'TSO_APPROVED';
        } else if (currentRole === 'RSO' && item.status === 'TSO_APPROVED') {
          newStatus = 'RSO_APPROVED';
        } else if (currentRole === 'SUPER_ADMIN') {
          newStatus = item.status === 'SUBMITTED' ? 'TSO_APPROVED' : item.status === 'TSO_APPROVED' ? 'RSO_APPROVED' : 'FINALIZED';
        }
        return { ...item, status: newStatus };
      })
    );
  };

  const handleConfirmReject = () => {
    if (!rejectingId || !rejectReason.trim()) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === rejectingId ? { ...item, status: 'REJECTED' } : item
      )
    );
    setRejectingId(null);
    setRejectReason('');
  };

  const handleConfirmUnlock = () => {
    if (!unlockingId || !unlockReason.trim()) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === unlockingId ? { ...item, status: 'RSO_APPROVED' } : item
      )
    );
    setUnlockingId(null);
    setUnlockReason('');
  };

  const handleFinalizeAll = () => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, status: 'FINALIZED' }))
    );
  };

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="rounded-full bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-medium border border-slate-700">Draft</span>;
      case 'SUBMITTED':
        return <span className="rounded-full bg-blue-950/80 text-blue-400 px-2.5 py-0.5 text-[10px] font-medium border border-blue-800/60">TSO Review Pending</span>;
      case 'TSO_APPROVED':
        return <span className="rounded-full bg-amber-950/80 text-amber-400 px-2.5 py-0.5 text-[10px] font-medium border border-amber-800/60">TSO Approved (RSO Pending)</span>;
      case 'RSO_APPROVED':
        return <span className="rounded-full bg-purple-950/80 text-purple-400 px-2.5 py-0.5 text-[10px] font-medium border border-purple-800/60">RSO Verified</span>;
      case 'FINALIZED':
        return <span className="rounded-full bg-emerald-950/80 text-emerald-400 px-2.5 py-0.5 text-[10px] font-medium border border-emerald-800/60 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Finalized (Locked)</span>;
      case 'REJECTED':
        return <span className="rounded-full bg-rose-950/80 text-rose-400 px-2.5 py-0.5 text-[10px] font-medium border border-rose-800/60">Rejected</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Review & Approval Queue</h2>
          <p className="text-xs text-slate-400">
            Role-governed verification workflow: CSR → TSO Review → RSO Verification → Super Admin Finalization
          </p>
        </div>

        {currentRole === 'SUPER_ADMIN' && (
          <button
            onClick={handleFinalizeAll}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition-all"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Finalize & Lock October 6 Period</span>
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Territory</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Sales (Mio)</th>
                <th className="py-3 px-4 text-right">Stock (Mio)</th>
                <th className="py-3 px-4 text-right">Zarda (BDT)</th>
                <th className="py-3 px-4 text-right">Empty Packets</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-white">{item.territory}</td>
                  <td className="py-3 px-4 text-slate-400">{item.reportDate}</td>
                  <td className="py-3 px-4 text-right font-semibold text-white">{item.sales.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">{item.stock.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right">৳ {item.zardaValue}</td>
                  <td className="py-3 px-4 text-right">{item.emptyPackets.toLocaleString()}</td>
                  <td className="py-3 px-4 font-sans">{getStatusBadge(item.status)}</td>
                  <td className="py-3 px-4 font-sans text-slate-400">{item.submittedBy}</td>
                  <td className="py-3 px-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* TSO Approve */}
                      {currentRole === 'TSO' && item.status === 'SUBMITTED' && (
                        <>
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="rounded px-2.5 py-1 text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500"
                          >
                            Approve TSO
                          </button>
                          <button
                            onClick={() => setRejectingId(item.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium border border-rose-800 text-rose-400 hover:bg-rose-950"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* RSO Approve */}
                      {currentRole === 'RSO' && item.status === 'TSO_APPROVED' && (
                        <>
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="rounded px-2.5 py-1 text-[11px] font-medium bg-purple-600 text-white hover:bg-purple-500"
                          >
                            Verify Regional
                          </button>
                          <button
                            onClick={() => setRejectingId(item.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium border border-rose-800 text-rose-400 hover:bg-rose-950"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Super Admin Unlock / Finalize */}
                      {currentRole === 'SUPER_ADMIN' && item.status === 'FINALIZED' && (
                        <button
                          onClick={() => setUnlockingId(item.id)}
                          className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium border border-amber-600/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60"
                        >
                          <Unlock className="h-3 w-3" />
                          <span>Unlock</span>
                        </button>
                      )}

                      {/* Super Admin generic approval */}
                      {currentRole === 'SUPER_ADMIN' && item.status !== 'FINALIZED' && (
                        <>
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="rounded px-2.5 py-1 text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(item.id)}
                            className="rounded px-2 py-1 text-[11px] font-medium border border-rose-800 text-rose-400 hover:bg-rose-950"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Locked state info for CSR */}
                      {currentRole === 'CSR' && item.status === 'FINALIZED' && (
                        <span className="text-[10px] text-slate-500 italic">Locked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection Feedback Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Reject Territory Submission</h3>
            </div>
            <p className="text-xs text-slate-400">
              A mandatory rejection reason is required. This feedback will be sent back to the field representative.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Specify discrepancy (e.g., Mismatched closing stock on Express brand)..."
              rows={3}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectingId(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim()}
                onClick={handleConfirmReject}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Unlock Modal */}
      {unlockingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Unlock className="h-5 w-5" />
              <h3 className="text-sm font-bold text-white">Super Admin Unlock Override</h3>
            </div>
            <p className="text-xs text-slate-400">
              Per rule 10 of AGENTS.md, unlocking a finalized record requires a mandatory reason permanently logged in the audit trail.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="State authorized business justification for unlocking..."
              rows={3}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setUnlockingId(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={!unlockReason.trim()}
                onClick={handleConfirmUnlock}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Unlock & Log Reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
