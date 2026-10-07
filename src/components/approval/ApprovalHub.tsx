'use client';

import React, { useState, useCallback } from 'react';
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
  CheckCircle2,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { Select2 } from '@/components/common/Select2';

interface ApprovalHubProps {
  currentRole: RoleType;
}

export function ApprovalHub({ currentRole }: ApprovalHubProps) {
  const [reportDate, setReportDate] = useState('2026-10-06');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  const [rejectingRecord, setRejectingRecord] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [unlockingRecord, setUnlockingRecord] = useState<any | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async (record: any) => {
    let targetStatus: SubmissionStatus = 'TSO_APPROVED';
    if (currentRole === 'RSO') targetStatus = 'RSO_APPROVED';
    if (currentRole === 'SUPER_ADMIN') targetStatus = record.status === 'RSO_APPROVED' ? 'FINALIZED' : 'RSO_APPROVED';

    setActionLoading(true);
    try {
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: record.territory_id,
          reportDate: record.reporting_date,
          toStatus: targetStatus,
          userId: `${currentRole.toLowerCase()}@afaztobacco.com`,
          comments: `Approved by ${currentRole}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Approval failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating approval');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRecord || !rejectReason.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: rejectingRecord.territory_id,
          reportDate: rejectingRecord.reporting_date,
          toStatus: 'REJECTED',
          userId: `${currentRole.toLowerCase()}@afaztobacco.com`,
          comments: rejectReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setRejectingRecord(null);
        setRejectReason('');
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Rejection failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting submission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmUnlock = async () => {
    if (!unlockingRecord || !unlockReason.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: unlockingRecord.territory_id,
          reportDate: unlockingRecord.reporting_date,
          toStatus: 'RSO_APPROVED',
          isUnlock: true,
          userId: 'admin@afaztobacco.com',
          unlockReason,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setUnlockingRecord(null);
        setUnlockReason('');
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Unlock failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error unlocking record');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 text-[10px] font-medium border border-slate-200 dark:border-slate-700">Draft</span>;
      case 'SUBMITTED':
        return <span className="rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 text-[10px] font-medium border border-blue-200 dark:border-blue-800/60">TSO Pending</span>;
      case 'TSO_APPROVED':
        return <span className="rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-[10px] font-medium border border-amber-200 dark:border-amber-800/60">TSO Approved (RSO Pending)</span>;
      case 'RSO_APPROVED':
        return <span className="rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 px-2.5 py-0.5 text-[10px] font-medium border border-purple-200 dark:border-purple-800/60">RSO Verified</span>;
      case 'FINALIZED':
        return <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Finalized</span>;
      case 'REJECTED':
        return <span className="rounded-full bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 px-2.5 py-0.5 text-[10px] font-medium border border-rose-200 dark:border-rose-800/60">Rejected</span>;
      default:
        return <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 text-[10px] font-medium">{status}</span>;
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'territory_name',
      header: 'Territory & Region',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-white block">{row.territory_name}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{row.region_name || 'Satkania'}</span>
        </div>
      ),
    },
    {
      key: 'reporting_date',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="font-mono text-slate-700 dark:text-slate-300">{row.reporting_date}</span>,
    },
    {
      key: 'total_cigarette_sales',
      header: 'Cig. Sales (Mio)',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold text-slate-900 dark:text-white">{parseFloat(row.total_cigarette_sales || 0).toFixed(2)}</span>,
    },
    {
      key: 'total_cigarette_stock',
      header: 'Cig. Stock (Mio)',
      align: 'right',
      render: (row) => <span className="font-mono text-emerald-600 dark:text-emerald-400">{parseFloat(row.total_cigarette_stock || 0).toFixed(2)}</span>,
    },
    {
      key: 'total_zarda_sales_value',
      header: 'Zarda (BDT)',
      align: 'right',
      render: (row) => <span className="font-mono text-amber-600 dark:text-amber-300">৳ {parseFloat(row.total_zarda_sales_value || 0).toLocaleString()}</span>,
    },
    {
      key: 'empty_packets',
      header: 'Empty Pkts',
      align: 'right',
      render: (row) => <span className="font-mono text-slate-700 dark:text-slate-300">{parseInt(row.empty_packets || 0, 10).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Workflow Status',
      sortable: true,
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Review Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5 font-sans">
          {/* TSO Actions */}
          {currentRole === 'TSO' && row.status === 'SUBMITTED' && (
            <>
              <button
                onClick={() => handleApprove(row)}
                disabled={actionLoading}
                className="rounded px-2.5 py-1 text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-all"
              >
                Approve TSO
              </button>
              <button
                onClick={() => setRejectingRecord(row)}
                disabled={actionLoading}
                className="rounded px-2.5 py-1 text-[11px] font-semibold border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer shadow-xs"
              >
                Reject
              </button>
            </>
          )}

          {/* RSO Actions */}
          {currentRole === 'RSO' && row.status === 'TSO_APPROVED' && (
            <>
              <button
                onClick={() => handleApprove(row)}
                disabled={actionLoading}
                className="rounded px-2.5 py-1 text-[11px] font-semibold bg-purple-600 text-white hover:bg-purple-500 shadow-sm transition-all cursor-pointer"
              >
                Verify RSO
              </button>
              <button
                onClick={() => setRejectingRecord(row)}
                disabled={actionLoading}
                className="rounded px-2.5 py-1 text-[11px] font-semibold border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer shadow-xs"
              >
                Reject
              </button>
            </>
          )}

          {/* SUPER ADMIN Actions */}
          {currentRole === 'SUPER_ADMIN' && row.status === 'RSO_APPROVED' && (
            <button
              onClick={() => handleApprove(row)}
              disabled={actionLoading}
              className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all cursor-pointer"
            >
              <Lock className="h-3 w-3" />
              <span>Finalize & Lock</span>
            </button>
          )}

          {currentRole === 'SUPER_ADMIN' && row.status === 'FINALIZED' && (
            <button
              onClick={() => setUnlockingRecord(row)}
              disabled={actionLoading}
              className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer shadow-xs"
            >
              <Unlock className="h-3 w-3" />
              <span>Unlock Record</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Operational Review & Approval Governance</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PostgreSQL-governed verification workflow: Field CSR → TSO Review → RSO Verification → Super Admin Finalization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTableRefreshKey(k => k + 1)}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Table</span>
          </button>
        </div>
      </div>

      {/* Workflow Queue Status Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-4 backdrop-blur-sm space-y-3 shadow-sm">
        {/* Top Scope Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Verification & Approval Workflow Queue
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Authorized Scope:</span>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
              {currentRole} Access
            </span>
          </div>
        </div>

        {/* Interactive Segmented Queue Status Chips */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-800">
          {[
            { id: 'ALL', label: 'All Records', dot: 'bg-slate-400', activeBg: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' },
            { id: 'SUBMITTED', label: 'Pending TSO Review', dot: 'bg-blue-500', activeBg: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white' },
            { id: 'TSO_APPROVED', label: 'TSO Approved (RSO Queue)', dot: 'bg-amber-500', activeBg: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-white' },
            { id: 'RSO_APPROVED', label: 'RSO Verified (Super Admin)', dot: 'bg-purple-600', activeBg: 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white' },
            { id: 'FINALIZED', label: 'Finalized & Locked', dot: 'bg-emerald-500', activeBg: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white' },
            { id: 'REJECTED', label: 'Rejected', dot: 'bg-rose-500', activeBg: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white' },
          ].map((opt) => {
            const isSelected = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                  isSelected
                    ? `${opt.activeBg} shadow-sm ring-2 ring-blue-500/30`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white dark:bg-slate-900' : opt.dot}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ServerDataTable Calling PostgreSQL Stored Procedure */}
      <ServerDataTable
        key={tableRefreshKey}
        endpoint="/api/daily-submissions"
        columns={columns}
        searchPlaceholder="Search territory, status, remarks..."
        exportFilenamePrefix="Approval_Queue"
        additionalParams={{
          status: statusFilter,
        }}
      />

      {/* Reject Modal */}
      {rejectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Reject Submission</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Rejecting submission for <strong className="text-slate-900 dark:text-white">{rejectingRecord.territory_name}</strong> on {rejectingRecord.reporting_date}. A mandatory reason is required to notify the submitter.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide explicit operational rejection rationale..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-rose-500 focus:outline-none min-h-[90px]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setRejectingRecord(null);
                  setRejectReason('');
                }}
                disabled={actionLoading}
                className="rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer shadow"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Modal (Super Admin Only) */}
      {unlockingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-300 dark:border-amber-900/50 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Unlock className="h-5 w-5" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Super Admin Unlock Protocol</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Per Rule 10 & 26: Once finalized, records are immutable. Unlocking <strong className="text-slate-900 dark:text-white">{unlockingRecord.territory_name}</strong> requires an audited justification.
            </p>
            <textarea
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="State governance reason for unlocking finalized submission..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:outline-none min-h-[90px]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setUnlockingRecord(null);
                  setUnlockReason('');
                }}
                disabled={actionLoading}
                className="rounded-lg border border-slate-300 dark:border-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnlock}
                disabled={!unlockReason.trim() || actionLoading}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50 cursor-pointer shadow"
              >
                {actionLoading ? 'Unlocking...' : 'Audit & Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
