'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleType, SubmissionStatus } from '@/lib/types';
import { 
  CheckCircle, 
  XCircle, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  MessageSquare, 
  Clock,
  RefreshCw,
  Filter,
  CheckCircle2
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
  const [reportDate, setReportDate] = useState('2026-10-06');
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'FINALIZED'>('ALL');

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const refreshSubmissions = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-submissions?date=${date}`);
      const json = await res.json();
      if (json.success && json.data) {
        setItems(
          json.data.map((r: any) => ({
            id: r.territoryId,
            territory: r.territoryName,
            reportDate: r.reportDate,
            sales: r.totalCigaretteSales || 0,
            stock: r.totalCigaretteStock || 0,
            zardaValue: r.totalZardaSalesValue || 0,
            emptyPackets: r.emptyPackets || 0,
            status: r.status as SubmissionStatus,
            submittedBy: 'Field CSR',
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load submissions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSubmissions(reportDate);
  }, [reportDate, refreshSubmissions]);

  const handleApprove = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    let targetStatus: SubmissionStatus = 'TSO_APPROVED';
    if (currentRole === 'RSO') targetStatus = 'RSO_APPROVED';
    if (currentRole === 'SUPER_ADMIN') targetStatus = item.status === 'RSO_APPROVED' ? 'FINALIZED' : 'RSO_APPROVED';

    try {
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: id,
          reportDate: item.reportDate,
          toStatus: targetStatus,
          userId: `${currentRole.toLowerCase()}@afaztobacco.com`,
          comments: `Approved by ${currentRole}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, status: targetStatus } : i))
        );
      } else {
        alert(json.error || 'Approval failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating approval');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    const item = items.find((i) => i.id === rejectingId);
    if (!item) return;

    try {
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: rejectingId,
          reportDate: item.reportDate,
          toStatus: 'REJECTED',
          userId: `${currentRole.toLowerCase()}@afaztobacco.com`,
          comments: rejectReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === rejectingId ? { ...i, status: 'REJECTED' } : i))
        );
        setRejectingId(null);
        setRejectReason('');
      } else {
        alert(json.error || 'Rejection failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting submission');
    }
  };

  const handleConfirmUnlock = async () => {
    if (!unlockingId || !unlockReason.trim()) return;
    const item = items.find((i) => i.id === unlockingId);
    if (!item) return;

    try {
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: unlockingId,
          reportDate: item.reportDate,
          toStatus: 'RSO_APPROVED',
          isUnlock: true,
          userId: 'admin@afaztobacco.com',
          unlockReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === unlockingId ? { ...i, status: 'RSO_APPROVED' } : i))
        );
        setUnlockingId(null);
        setUnlockReason('');
      } else {
        alert(json.error || 'Unlock failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error unlocking record');
    }
  };

  const handleFinalizeAll = async () => {
    setLoading(true);
    for (const item of items) {
      await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: item.id,
          reportDate: item.reportDate,
          toStatus: 'FINALIZED',
          userId: 'admin@afaztobacco.com',
          comments: 'Batch finalized by Super Admin',
        }),
      }).catch(console.error);
    }
    await refreshSubmissions(reportDate);
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'PENDING') return item.status === 'SUBMITTED' || item.status === 'TSO_APPROVED';
      if (statusFilter === 'APPROVED') return item.status === 'RSO_APPROVED';
      if (statusFilter === 'FINALIZED') return item.status === 'FINALIZED';
      return true;
    });
  }, [items, statusFilter]);

  // Statistics
  const counts = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'SUBMITTED' || i.status === 'TSO_APPROVED').length,
      approved: items.filter(i => i.status === 'RSO_APPROVED').length,
      finalized: items.filter(i => i.status === 'FINALIZED').length,
    };
  }, [items]);

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="rounded-full bg-slate-800 text-slate-300 px-2.5 py-0.5 text-[10px] font-medium border border-slate-700">Draft</span>;
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
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Review & Approval Queue</h2>
          <p className="text-xs text-slate-400">
            Role-governed verification workflow: CSR → TSO Review → RSO Verification → Super Admin Finalization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
          />

          <button
            onClick={() => refreshSubmissions(reportDate)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {currentRole === 'SUPER_ADMIN' && (
            <button
              onClick={handleFinalizeAll}
              disabled={loading || items.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-sm transition-all disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Finalize & Lock Period</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'ALL'
              ? 'border-blue-500/50 bg-blue-950/20 shadow-sm'
              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
          }`}
        >
          <span className="text-[11px] text-slate-400 block">Total Submissions</span>
          <span className="text-lg font-bold text-white font-mono">{counts.total}</span>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'PENDING'
              ? 'border-amber-500/50 bg-amber-950/20 shadow-sm'
              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
          }`}
        >
          <span className="text-[11px] text-amber-400 block">Pending Review</span>
          <span className="text-lg font-bold text-amber-300 font-mono">{counts.pending}</span>
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'APPROVED'
              ? 'border-purple-500/50 bg-purple-950/20 shadow-sm'
              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
          }`}
        >
          <span className="text-[11px] text-purple-400 block">RSO Verified</span>
          <span className="text-lg font-bold text-purple-300 font-mono">{counts.approved}</span>
        </button>

        <button
          onClick={() => setStatusFilter('FINALIZED')}
          className={`rounded-xl border p-3 text-left transition-all ${
            statusFilter === 'FINALIZED'
              ? 'border-emerald-500/50 bg-emerald-950/20 shadow-sm'
              : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
          }`}
        >
          <span className="text-[11px] text-emerald-400 block">Finalized & Locked</span>
          <span className="text-lg font-bold text-emerald-300 font-mono">{counts.finalized}</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Territory</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Cig. Sales (Mio)</th>
                <th className="py-3 px-4 text-right">Cig. Stock (Mio)</th>
                <th className="py-3 px-4 text-right">Zarda Sales (BDT)</th>
                <th className="py-3 px-4 text-right">Empty Packets</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No submissions found for the selected date and filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-white">{item.territory}</td>
                    <td className="py-3 px-4 text-slate-400">{item.reportDate}</td>
                    <td className="py-3 px-4 text-right font-semibold text-white">{item.sales.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-emerald-400">{item.stock.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">৳ {item.zardaValue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">{item.emptyPackets.toLocaleString()}</td>
                    <td className="py-3 px-4 font-sans">{getStatusBadge(item.status)}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* TSO Approve */}
                        {currentRole === 'TSO' && item.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="rounded px-2.5 py-1 text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
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
                              className="rounded px-2.5 py-1 text-[11px] font-medium bg-purple-600 text-white hover:bg-purple-500 shadow-sm"
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

                        {/* Super Admin Unlock */}
                        {currentRole === 'SUPER_ADMIN' && item.status === 'FINALIZED' && (
                          <button
                            onClick={() => setUnlockingId(item.id)}
                            className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium border border-amber-600/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 shadow-sm"
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
                              className="rounded px-2.5 py-1 text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Reject Submission</span>
            </h3>
            <p className="text-xs text-slate-400">
              Provide a clear reason for rejecting this territory submission. The field representative will be required to amend their figures.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State reason for rejection (e.g., closing stock discrepancy)..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-rose-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectingId(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal (Super Admin Only) */}
      {unlockingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-800/60 bg-slate-900 p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Unlock className="h-4 w-4 text-amber-400" />
              <span>Unlock Finalized Record (Super Admin)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Rule 10 & 12 Compliance: Unlocking a finalized period requires a mandatory audit justification recorded into the permanent log.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Mandatory reason for unlocking (e.g., formal regional reconciliation request)..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setUnlockingId(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnlock}
                disabled={!unlockReason.trim()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Unlock Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
