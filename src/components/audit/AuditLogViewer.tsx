'use client';

import React, { useEffect, useState } from 'react';
import { History, ShieldAlert, RefreshCw, FileText } from 'lucide-react';
import { AuditLogEntry } from '@/lib/repositories/submission.repository';

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-blue-400" />
            <span>Enterprise Audit & Governance Trail</span>
          </h2>
          <p className="text-xs text-slate-400">
            Immutable log of all operational entries, approvals, unlocks, and cloud archival events
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold font-mono">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Details / Diffs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No audit records recorded yet. Any edit, approval, or drive upload will appear here.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/50 px-2 py-0.5 text-[10px] font-bold font-sans">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">{log.entityName}</td>
                    <td className="py-3 px-4 text-slate-400 font-sans">{log.userId}</td>
                    <td className="py-3 px-4 text-slate-400 font-sans max-w-xs truncate">
                      {log.newValues ? JSON.stringify(log.newValues) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
