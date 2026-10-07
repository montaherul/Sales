'use client';

import React, { useState } from 'react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { Select2, Select2Option } from '@/components/common/Select2';
import { History, ShieldAlert, FileText, CheckCircle2, User, Key, Layers } from 'lucide-react';

interface AuditLogRecord {
  id: string;
  created_at: string;
  event_type: string;
  entity_name: string;
  entity_id: string;
  user_email?: string;
  user_name?: string;
  role_name?: string;
  old_values?: any;
  new_values?: any;
}

export function AuditLogViewer() {
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('ALL');
  const [expandedLog, setExpandedLog] = useState<AuditLogRecord | null>(null);

  const eventTypeOptions: Select2Option[] = [
    { value: 'ALL', label: 'All Event Types' },
    { value: 'CREATE', label: 'CREATE (New Record Created)', badge: 'INSERT' },
    { value: 'UPDATE', label: 'UPDATE (Record Modified)', badge: 'UPDATE' },
    { value: 'DELETE', label: 'DELETE (Record Removed)', badge: 'DELETE' },
    { value: 'SUBMIT', label: 'SUBMIT (Sent for Approval)', badge: 'WORKFLOW' },
    { value: 'APPROVE', label: 'APPROVE (Verified & Passed)', badge: 'WORKFLOW' },
    { value: 'REJECT', label: 'REJECT (Sent Back for Revision)', badge: 'WORKFLOW' },
    { value: 'FINALIZE', label: 'FINALIZE (Locked & Immutable)', badge: 'SECURITY' },
    { value: 'UNLOCK', label: 'UNLOCK (Super Admin Override)', badge: 'SECURITY' },
    { value: 'IMPORT', label: 'IMPORT (XLSX Staged & Committed)', badge: 'SYSTEM' },
    { value: 'EXPORT', label: 'EXPORT (34-Sheet Report Downloaded)', badge: 'SYSTEM' },
    { value: 'GOOGLE_UPLOAD', label: 'GOOGLE_UPLOAD (Cloud Archive)', badge: 'CLOUD' },
    { value: 'TARGET_UPDATE', label: 'TARGET_UPDATE (Quota Changed)', badge: 'CONFIG' },
    { value: 'PRICE_UPDATE', label: 'PRICE_UPDATE (Unit Price Revised)', badge: 'CONFIG' },
  ];

  const entityOptions: Select2Option[] = [
    { value: 'ALL', label: 'All Target Entities' },
    { value: 'daily_submissions', label: 'Daily Submissions' },
    { value: 'companies', label: 'Companies' },
    { value: 'user_profiles', label: 'User Profiles & Roles' },
    { value: 'territories', label: 'Territories' },
    { value: 'brands', label: 'Brands & Prices' },
    { value: 'targets', label: 'Targets' },
    { value: 'google_drive_files', label: 'Google Drive Files' },
    { value: 'imports', label: 'Import Batches' },
  ];

  const columns: ColumnDef<AuditLogRecord>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-slate-300">
          {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'event_type',
      header: 'Action / Event',
      sortable: true,
      render: (row) => {
        let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
        if (row.event_type.includes('CREATE') || row.event_type.includes('SUBMIT')) {
          badgeColor = 'bg-blue-950/70 text-blue-300 border-blue-800';
        } else if (row.event_type.includes('APPROVE') || row.event_type.includes('FINALIZE')) {
          badgeColor = 'bg-emerald-950/70 text-emerald-300 border-emerald-800';
        } else if (row.event_type.includes('REJECT') || row.event_type.includes('DELETE')) {
          badgeColor = 'bg-rose-950/70 text-rose-300 border-rose-800';
        } else if (row.event_type.includes('UNLOCK')) {
          badgeColor = 'bg-amber-950/70 text-amber-300 border-amber-800';
        }

        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${badgeColor}`}>
            {row.event_type}
          </span>
        );
      },
    },
    {
      key: 'entity_name',
      header: 'Target Entity',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-200">
          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold">{row.entity_name}</span>
        </div>
      ),
    },
    {
      key: 'entity_id',
      header: 'Record Identifier',
      render: (row) => (
        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px] block" title={row.entity_id}>
          {row.entity_id}
        </span>
      ),
    },
    {
      key: 'user_name',
      header: 'Actor / User',
      render: (row) => (
        <div className="text-xs">
          <div className="text-white font-medium">{row.user_name || row.user_email || 'System'}</div>
          {row.role_name && (
            <div className="text-[10px] text-blue-400 font-semibold">{row.role_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Audit Payload',
      align: 'right',
      render: (row) => (
        <button
          onClick={() => setExpandedLog(row)}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
        >
          View JSON Diff
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Banner & Filters */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md space-y-4 shadow-sm dark:shadow-none transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Enterprise Immutable Audit & Governance Trail
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chronological, tamper-proof record of every operational entry, approval transition, unlock, price revision, and cloud archive.
            </p>
          </div>
        </div>

        {/* Generic Select2 Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Select2
            label="Filter by Event Action"
            options={eventTypeOptions}
            value={selectedEventType}
            onChange={(val) => setSelectedEventType(val || 'ALL')}
            placeholder="Select Event Type..."
            isClearable={false}
          />

          <Select2
            label="Filter by Target Entity"
            options={entityOptions}
            value={selectedEntityName}
            onChange={(val) => setSelectedEntityName(val || 'ALL')}
            placeholder="Select Entity..."
            isClearable={false}
          />
        </div>
      </div>

      {/* 3-Tier Tabulator Server-Side Table */}
      <ServerDataTable<AuditLogRecord>
        endpoint="/api/audit-logs"
        columns={columns}
        idField="id"
        title="Audit Logs History"
        searchPlaceholder="Search audit events, entities, or user emails..."
        additionalParams={{
          eventType: selectedEventType,
          entityName: selectedEntityName,
        }}
        exportFilenamePrefix="Afaz_Tobacco_Audit_Trail"
      />

      {/* Payload Inspection Modal */}
      {expandedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[85vh] transition-colors duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-950/70">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Audit Event Payload: <span className="text-blue-600 dark:text-blue-400">{expandedLog.event_type}</span>
                </h3>
              </div>
              <button
                onClick={() => setExpandedLog(null)}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>Entity: <strong className="text-slate-900 dark:text-white">{expandedLog.entity_name}</strong></div>
                <div>Record ID: <strong className="text-slate-900 dark:text-white">{expandedLog.entity_id}</strong></div>
                <div>User: <strong className="text-slate-900 dark:text-white">{expandedLog.user_email || 'System'}</strong></div>
                <div>Timestamp: <strong className="text-slate-900 dark:text-white">{expandedLog.created_at}</strong></div>
              </div>

              {expandedLog.old_values && (
                <div>
                  <h4 className="text-rose-600 dark:text-rose-400 font-bold mb-1 font-sans">Old Values (Previous State):</h4>
                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 overflow-x-auto">
                    {typeof expandedLog.old_values === 'string'
                      ? expandedLog.old_values
                      : JSON.stringify(expandedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {expandedLog.new_values && (
                <div>
                  <h4 className="text-emerald-600 dark:text-emerald-400 font-bold mb-1 font-sans">New Values (Modified State):</h4>
                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 overflow-x-auto">
                    {typeof expandedLog.new_values === 'string'
                      ? expandedLog.new_values
                      : JSON.stringify(expandedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
