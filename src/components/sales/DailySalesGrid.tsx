'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  CigaretteBrandSales, 
  CigaretteBrandStock, 
  ZardaSalesQty, 
  ZardaStockQty,
  SubmissionStatus
} from '@/lib/types';
import { 
  calculateCigaretteSalesTotal, 
  calculateCigaretteStockTotal, 
  calculateZardaSalesValuation, 
  calculateZardaStockValuation 
} from '@/lib/calculations/engine';
import { 
  Save, 
  Send, 
  CheckCircle2, 
  Calculator, 
  Info,
  Lock,
  RefreshCw,
  AlertCircle,
  List,
  PlusCircle,
  ArrowLeft,
  FileEdit,
  Eye,
  Building2,
  Calendar,
  Trash2,
  Filter,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { Select2, Select2Option } from '@/components/common/Select2';
import { DatePicker } from '@/components/common/DatePicker';
import { getTodayDateString } from '@/shared/utils';

interface TerritoryItem {
  id: string;
  name: string;
  region_name: string;
  sort_order: number;
}

interface DailySalesGridProps {
  companyId?: string;
  onSaveDraft?: (record: any) => void;
  onSubmitForReview?: (record: any) => void;
}

export function DailySalesGrid({ companyId = 'ALL', onSaveDraft, onSubmitForReview }: DailySalesGridProps) {
  // Mode Controller: 'listing' | 'form'
  const [viewMode, setViewMode] = useState<'listing' | 'form'>('listing');
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null);

  // Filter & Master States
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>('');
  const [selectedTerritoryName, setSelectedTerritoryName] = useState<string>('');
  const [reportDate, setReportDate] = useState(() => getTodayDateString());
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Operational State
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<SubmissionStatus | 'NEW'>('NEW');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  // Cigarette Sales State
  const [sales, setSales] = useState<CigaretteBrandSales>({
    wilson: 0.00,
    shahara: 0.00,
    express: 0.00,
    nexus: 0.00,
    sb: 0.00,
    sm: 0.00,
  });

  // Cigarette Stock State
  const [stock, setStock] = useState<CigaretteBrandStock>({
    wilson: 0.00,
    shahara: 0.00,
    express: 0.00,
    nexus: 0.00,
    sb: 0.00,
    sm: 0.00,
  });

  // Zarda Sales State
  const [zardaSales, setZardaSales] = useState<ZardaSalesQty>({
    slb: 0.00,
    qty_22_25: 0,
    qty_99_14: 0,
    qty_33_15: 0,
  });

  // Zarda Stock State
  const [zardaStock, setZardaStock] = useState<ZardaStockQty>({
    slb: 0.00,
    qty_22_25: 0,
    qty_99_14: 0,
    qty_33_15: 0,
  });

  const [emptyPackets, setEmptyPackets] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');

  // Period Control & Locking State
  const [isPeriodLocked, setIsPeriodLocked] = useState(false);
  const [periodLockReason, setPeriodLockReason] = useState<string | null>(null);
  const [isCheckingPeriod, setIsCheckingPeriod] = useState(false);

  // Check reporting period status whenever reportDate or companyId changes
  useEffect(() => {
    let isMounted = true;
    async function checkPeriod() {
      if (!reportDate) return;
      setIsCheckingPeriod(true);
      try {
        const q = companyId && companyId !== 'ALL' ? `&companyId=${companyId}` : '';
        const res = await fetch(`/api/periods?type=check&date=${reportDate}${q}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success && json.data) {
            setIsPeriodLocked(!json.data.isOpen);
            setPeriodLockReason(json.data.reason || null);
          } else {
            setIsPeriodLocked(false);
            setPeriodLockReason(null);
          }
        }
      } catch (err) {
        console.warn('Period check error:', err);
      } finally {
        if (isMounted) setIsCheckingPeriod(false);
      }
    }
    checkPeriod();
    return () => {
      isMounted = false;
    };
  }, [reportDate, companyId]);

  // 1. Load Master Territories (Scoped to Company)
  useEffect(() => {
    async function loadMasterData() {
      try {
        const query = companyId && companyId !== 'ALL' ? `?companyId=${companyId}` : '';
        const res = await fetch(`/api/master-data${query}`);
        const json = await res.json();
        if (json.success && json.data.territories?.length > 0) {
          setTerritories(json.data.territories);
          setSelectedTerritoryId((prev) => {
            const exists = json.data.territories.some((t: any) => t.id === prev);
            return exists ? prev : (json.data.territories[0]?.id || 'ALL');
          });
          setSelectedTerritoryName((prev) => {
            const match = json.data.territories.find((t: any) => t.id === selectedTerritoryId);
            return match ? match.name : (json.data.territories[0]?.name || '');
          });
        }
      } catch (err) {
        console.error('Failed to load master territories:', err);
      }
    }
    loadMasterData();
  }, [companyId]);

  // Real-time calculations via centralized engine
  const totalSales = useMemo(() => calculateCigaretteSalesTotal(sales), [sales]);
  const totalStock = useMemo(() => calculateCigaretteStockTotal(stock), [stock]);
  const totalZardaSales = useMemo(() => calculateZardaSalesValuation(zardaSales), [zardaSales]);
  const totalZardaStock = useMemo(() => calculateZardaStockValuation(zardaStock), [zardaStock]);

  const isReadOnly = currentStatus === 'FINALIZED' || isPeriodLocked;

  // 2. Load submission into form state
  const loadSubmissionData = (record: any, mode: 'create' | 'edit') => {
    setFormMode(mode);
    setCurrentSubmissionId(record.id || null);
    setSelectedTerritoryId(record.territory_id || record.territoryId || (territories[0]?.id || ''));
    setSelectedTerritoryName(record.territory_name || record.territoryName || (territories[0]?.name || ''));
    setReportDate(record.reporting_date || record.reportDate || getTodayDateString());
    setCurrentStatus(record.status || (mode === 'create' ? 'NEW' : 'DRAFT'));
    setSubmittedStatus(null);

    if (mode === 'create') {
      setSales({ wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 });
      setStock({ wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 });
      setZardaSales({ slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 });
      setZardaStock({ slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 });
      setEmptyPackets(0);
      setRemarks('');
    } else {
      setSales({
        wilson: parseFloat(record.c_wilson_sales ?? record.cigaretteSales?.wilson ?? 0),
        shahara: parseFloat(record.c_shahara_sales ?? record.cigaretteSales?.shahara ?? 0),
        express: parseFloat(record.c_express_sales ?? record.cigaretteSales?.express ?? 0),
        nexus: parseFloat(record.c_nexus_sales ?? record.cigaretteSales?.nexus ?? 0),
        sb: parseFloat(record.c_sb_sales ?? record.cigaretteSales?.sb ?? 0),
        sm: parseFloat(record.c_sm_sales ?? record.cigaretteSales?.sm ?? 0),
      });
      setStock({
        wilson: parseFloat(record.c_wilson_stock ?? record.cigaretteStock?.wilson ?? 0),
        shahara: parseFloat(record.c_shahara_stock ?? record.cigaretteStock?.shahara ?? 0),
        express: parseFloat(record.c_express_stock ?? record.cigaretteStock?.express ?? 0),
        nexus: parseFloat(record.c_nexus_stock ?? record.cigaretteStock?.nexus ?? 0),
        sb: parseFloat(record.c_sb_stock ?? record.cigaretteStock?.sb ?? 0),
        sm: parseFloat(record.c_sm_stock ?? record.cigaretteStock?.sm ?? 0),
      });
      setZardaSales({
        slb: parseFloat(record.z_slb_sales ?? record.zardaSales?.slb ?? 0),
        qty_22_25: parseInt(record.z_22_25_sales ?? record.zardaSales?.qty_22_25 ?? 0, 10),
        qty_99_14: parseInt(record.z_99_14_sales ?? record.zardaSales?.qty_99_14 ?? 0, 10),
        qty_33_15: parseInt(record.z_33_15_sales ?? record.zardaSales?.qty_33_15 ?? 0, 10),
      });
      setZardaStock({
        slb: parseFloat(record.z_slb_stock ?? record.zardaStock?.slb ?? 0),
        qty_22_25: parseInt(record.z_22_25_stock ?? record.zardaStock?.qty_22_25 ?? 0, 10),
        qty_99_14: parseInt(record.z_99_14_stock ?? record.zardaStock?.qty_99_14 ?? 0, 10),
        qty_33_15: parseInt(record.z_33_15_stock ?? record.zardaStock?.qty_33_15 ?? 0, 10),
      });
      setEmptyPackets(parseInt(record.empty_packets ?? record.emptyPackets ?? 0, 10));
      setRemarks(record.remarks || '');
    }

    setViewMode('form');
  };

  const handleCreateNew = () => {
    loadSubmissionData({
      territory_id: selectedTerritoryId || (territories[0]?.id || ''),
      territory_name: selectedTerritoryName || (territories[0]?.name || ''),
      reporting_date: reportDate,
    }, 'create');
  };

  const handleTerritoryChange = (terrId: string) => {
    const terr = territories.find(t => t.id === terrId);
    if (terr) {
      setSelectedTerritoryId(terr.id);
      setSelectedTerritoryName(terr.name);
    }
  };

  // 3. Save Draft Handler
  const handleSaveDraft = async () => {
    if (isPeriodLocked) {
      alert(`Cannot save draft: ${periodLockReason || 'Reporting period is closed or locked.'}`);
      return;
    }
    setIsSaving(true);
    try {
      const selectedTerr = territories.find(t => t.id === selectedTerritoryId);
      const currentRegionName = selectedTerr?.region_name || 'Satkania';

      const record = {
        territoryId: selectedTerritoryId,
        territoryName: selectedTerritoryName,
        regionName: currentRegionName,
        reportDate,
        dayNumber: parseInt(reportDate.split('-')[2] || String(new Date().getDate()), 10),
        status: 'DRAFT',
        companyId: companyId !== 'ALL' ? companyId : undefined,
        cigaretteSales: sales,
        cigaretteStock: stock,
        zardaSales,
        zardaStock,
        emptyPackets,
        remarks,
        totalCigaretteSales: totalSales,
        totalCigaretteStock: totalStock,
        totalZardaSalesValue: totalZardaSales,
        totalZardaStockValue: totalZardaStock,
      };

      const res = await fetch('/api/daily-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, userId: 'csr.keranihat@afaztobacco.com' }),
      });

      const json = await res.json();
      if (json.success) {
        setCurrentStatus('DRAFT');
        setSubmittedStatus('Draft saved to PostgreSQL database.');
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Failed to save draft');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving draft');
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Submit for Review Handler
  const handleSubmit = async () => {
    if (isPeriodLocked) {
      alert(`Cannot submit record: ${periodLockReason || 'Reporting period is closed or locked.'}`);
      return;
    }
    setIsSaving(true);
    try {
      const selectedTerr = territories.find(t => t.id === selectedTerritoryId);
      const currentRegionName = selectedTerr?.region_name || 'Satkania';

      const record = {
        territoryId: selectedTerritoryId,
        territoryName: selectedTerritoryName,
        regionName: currentRegionName,
        reportDate,
        dayNumber: parseInt(reportDate.split('-')[2] || '6', 10),
        status: 'SUBMITTED',
        companyId: companyId !== 'ALL' ? companyId : undefined,
        cigaretteSales: sales,
        cigaretteStock: stock,
        zardaSales,
        zardaStock,
        emptyPackets,
        remarks,
        totalCigaretteSales: totalSales,
        totalCigaretteStock: totalStock,
        totalZardaSalesValue: totalZardaSales,
        totalZardaStockValue: totalZardaStock,
      };

      const res = await fetch('/api/daily-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, userId: 'csr.keranihat@afaztobacco.com' }),
      });

      const json = await res.json();
      if (json.success) {
        // Trigger workflow
        await fetch('/api/daily-submissions/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            territoryId: selectedTerritoryId,
            reportDate,
            toStatus: 'SUBMITTED',
            userId: 'csr.keranihat@afaztobacco.com',
            comments: 'Submitted by Field CSR for TSO Review',
          }),
        });

        setCurrentStatus('SUBMITTED');
        setSubmittedStatus('Daily submission published and forwarded for TSO Review.');
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Failed to submit daily record');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting daily record');
    } finally {
      setIsSaving(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 text-[10px] font-medium border border-slate-200 dark:border-slate-700">Draft</span>;
      case 'SUBMITTED':
        return <span className="rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 text-[10px] font-medium border border-blue-200 dark:border-blue-800/60">TSO Pending</span>;
      case 'TSO_APPROVED':
        return <span className="rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 px-2.5 py-0.5 text-[10px] font-medium border border-amber-200 dark:border-amber-800/60">TSO Approved</span>;
      case 'RSO_APPROVED':
        return <span className="rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 px-2.5 py-0.5 text-[10px] font-medium border border-purple-200 dark:border-purple-800/60">RSO Verified</span>;
      case 'FINALIZED':
        return <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 text-[10px] font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Finalized</span>;
      case 'REJECTED':
        return <span className="rounded-full bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 px-2.5 py-0.5 text-[10px] font-medium border border-rose-200 dark:border-rose-800/60">Rejected</span>;
      default:
        return <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 text-[10px] font-medium border border-slate-200 dark:border-slate-700">{status}</span>;
    }
  };

  // Table Columns Definition
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
      header: 'Sales (BITCL) (Mio)',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold text-slate-900 dark:text-white">{parseFloat(row.total_cigarette_sales || 0).toFixed(2)}</span>,
    },
    {
      key: 'total_cigarette_stock',
      header: 'Closing Stock (BITCL) (Mio)',
      align: 'right',
      render: (row) => <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{parseFloat(row.total_cigarette_stock || 0).toFixed(2)}</span>,
    },
    {
      key: 'total_zarda_sales_value',
      header: 'Zarda (BDT)',
      align: 'right',
      render: (row) => <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">৳ {parseFloat(row.total_zarda_sales_value || 0).toLocaleString()}</span>,
    },
    {
      key: 'empty_packets',
      header: 'Empty Pkts',
      align: 'right',
      render: (row) => <span className="font-mono text-slate-700 dark:text-slate-300">{parseInt(row.empty_packets || 0, 10).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => loadSubmissionData(row, 'edit')}
            className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 dark:border-blue-800/40 px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Open in Operational Entry Form"
          >
            <FileEdit className="h-3 w-3" />
            <span>Open / Edit</span>
          </button>
          {row.status === 'FINALIZED' ? (
            <span
              className="rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-medium flex items-center gap-1 cursor-not-allowed"
              title="Finalized records are locked. Super Admin must unlock before deleting."
            >
              <Lock className="h-3 w-3" />
              <span>Locked</span>
            </span>
          ) : (
            <button
              onClick={(e) => handleDeleteSingle(row.id, e)}
              className="rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/40 px-2.5 py-1 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              title="Delete this daily submission"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>Delete</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleDeleteSingle = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this daily submission record?')) return;
    try {
      const res = await fetch('/api/daily-submissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const json = await res.json();
      if (json.success) {
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Failed to delete submission');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting submission');
    }
  };

  const handleBatchDelete = async (selectedIds: string[]) => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} submission(s)?`)) return;
    try {
      const res = await fetch('/api/daily-submissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        setTableRefreshKey(k => k + 1);
      } else {
        alert(json.error || 'Failed to delete submissions');
      }
    } catch (e: any) {
      alert(e.message || 'Error deleting submissions');
    }
  };

  const handleExportDailyReport = (dateStr?: string) => {
    const targetDate = dateStr || reportDate || getTodayDateString();
    const now = new Date();
    const parts = targetDate.split('-');
    const y = parseInt(parts[0] || '', 10) || now.getFullYear();
    const m = parseInt(parts[1] || '', 10) || (now.getMonth() + 1);
    const d = parseInt(parts[2] || '', 10) || now.getDate();
    const compParam = companyId && companyId !== 'ALL' ? `&companyId=${companyId}` : '';
    window.location.href = `/api/exports/xlsx?year=${y}&month=${m}&day=${d}&type=daily${compParam}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Module Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>Daily Sales & Closing Stock Operations</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PostgreSQL-backed operational workflow: field sales, brand closing stock, zarda, empty packets & approval states
          </p>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => setViewMode('listing')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'listing'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Submissions History</span>
          </button>

          <button
            onClick={handleCreateNew}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'form'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>{formMode === 'create' ? 'New Daily Entry' : 'Edit Entry Form'}</span>
          </button>
        </div>
      </div>

      {/* 2. SUBMISSIONS LISTING VIEW (ServerDataTable + PostgreSQL Stored Procedure) */}
      {viewMode === 'listing' && (
        <div className="space-y-4">
          {/* Quick Filters Toolbar */}
          <div className="relative z-30 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-4 backdrop-blur-sm space-y-3.5 shadow-sm dark:shadow-none transition-colors duration-200">
            {/* Top Toolbar: Territory Filter & Create Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 relative z-40">
              <div className="w-full sm:w-72 relative z-50">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">
                  Filter by Territory Scope
                </label>
                <Select2
                  value={selectedTerritoryId}
                  onChange={(val) => setSelectedTerritoryId(val)}
                  options={[
                    { value: 'ALL', label: 'All Territories (Satkania Region)' },
                    ...territories.map(t => ({ value: t.id, label: t.name, subLabel: t.region_name }))
                  ]}
                  placeholder="Select Territory"
                />
              </div>

              <div className="w-full sm:w-56 relative z-50">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">
                  Reporting Date Scope
                </label>
                <DatePicker
                  value={reportDate}
                  onChange={(d) => setReportDate(d)}
                />
              </div>

              <div className="shrink-0 relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => handleExportDailyReport()}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  title="Export Authoritative Single-Day XLSX Report"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Day (XLSX)</span>
                </button>

                <button
                  onClick={handleCreateNew}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Create New Daily Entry</span>
                </button>
              </div>
            </div>

            {/* Bottom Toolbar: Interactive Status Filter Pills */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Filter className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span>Workflow Status Filter:</span>
                </div>
                {filterStatus !== 'ALL' && (
                  <button
                    onClick={() => setFilterStatus('ALL')}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Reset Filter (Show All)
                  </button>
                )}
              </div>

              {/* Status Chips Row */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {[
                  { id: 'ALL', label: 'All Submissions', dot: 'bg-slate-400 dark:bg-slate-300', activeBg: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' },
                  { id: 'DRAFT', label: 'Draft', dot: 'bg-slate-400', activeBg: 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900' },
                  { id: 'SUBMITTED', label: 'TSO Pending', dot: 'bg-blue-500', activeBg: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white' },
                  { id: 'TSO_APPROVED', label: 'TSO Approved', dot: 'bg-amber-500', activeBg: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-white' },
                  { id: 'RSO_APPROVED', label: 'RSO Verified', dot: 'bg-purple-600', activeBg: 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white' },
                  { id: 'FINALIZED', label: 'Finalized & Locked', dot: 'bg-emerald-500', activeBg: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white' },
                  { id: 'REJECTED', label: 'Rejected', dot: 'bg-rose-500', activeBg: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white' },
                ].map((opt) => {
                  const isSelected = filterStatus === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilterStatus(opt.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                        isSelected
                          ? `${opt.activeBg} shadow-sm ring-2 ring-blue-500/30`
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white dark:bg-slate-900' : opt.dot}`} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Server-Side Tabulator Table */}
          <div className="relative z-10">
            <ServerDataTable
              key={`${tableRefreshKey}_${companyId}`}
              endpoint="/api/daily-submissions"
              columns={columns}
              searchPlaceholder="Search territory, region, status, remarks..."
              exportFilenamePrefix="Daily_Submissions"
              onBatchDelete={handleBatchDelete}
              additionalParams={{
                territoryId: selectedTerritoryId,
                status: filterStatus,
                companyId: companyId !== 'ALL' ? companyId : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* 3. OPERATIONAL ENTRY FORM VIEW (Single-Page Form Controller) */}
      {viewMode === 'form' && (
        <div className="space-y-6">
          {/* Form Context Header Bar */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors duration-200">
            <button
              onClick={() => setViewMode('listing')}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Submissions History</span>
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mode: <strong className="text-slate-900 dark:text-white uppercase">{formMode}</strong>
              </span>
              {getStatusBadge(currentStatus)}
            </div>
          </div>

          {/* Submission Feedback Alert */}
          {submittedStatus && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{submittedStatus}</span>
            </div>
          )}

          {/* Period Locked Warning Banner */}
          {isPeriodLocked && (
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 p-3.5 text-xs text-amber-800 dark:text-amber-200 shadow-xs">
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1">
                <span className="font-bold uppercase tracking-wider block text-[11px]">Reporting Period Locked</span>
                <span>{periodLockReason || 'This date falls within a closed reporting year, closed month, or locked holiday. Operational data entry is restricted.'}</span>
              </div>
            </div>
          )}

          {/* Operational Scope Strip */}
          <div className="relative z-30 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-4 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-sm dark:shadow-none transition-colors duration-200">
            <div className="relative z-40">
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Operational Territory Scope</label>
              <Select2
                value={selectedTerritoryId}
                onChange={handleTerritoryChange}
                disabled={currentStatus === 'FINALIZED'}
                options={territories.map((t) => ({
                  value: t.id,
                  label: t.name,
                  subLabel: t.region_name,
                }))}
                placeholder="Select Territory"
              />
            </div>

            <div className="relative z-40">
              <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Reporting Date</label>
              <DatePicker
                value={reportDate}
                disabled={currentStatus === 'FINALIZED'}
                onChange={(d) => setReportDate(d)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => handleExportDailyReport(reportDate)}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                title="Export this specific day's report preserving exact Excel layout and formulas"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Day (XLSX)</span>
              </button>

              <div className="text-right">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Record Status</span>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{currentStatus}</span>
              </div>
            </div>
          </div>

          {/* KPI Calculation Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/40 p-3.5 shadow-sm dark:shadow-none">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Brand Wise Sales (BITCL)</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">{totalSales.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Million Sticks</span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/40 p-3.5 shadow-sm dark:shadow-none">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">Brand Wise Closing Stock (BITCL)</span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-300 font-mono">{totalStock.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Million Sticks</span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/40 p-3.5 shadow-sm dark:shadow-none">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 block">Total Zarda Sales</span>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-300 font-mono">৳ {totalZardaSales.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">BDT Valuation</span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/40 p-3.5 shadow-sm dark:shadow-none">
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block">Total Zarda Stock</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300 font-mono">৳ {totalZardaStock.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">BDT Valuation</span>
            </div>
          </div>

          {/* Form Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
            {/* 1. Cigarette Brands */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors duration-200">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                1. Brand Wise Sales & Closing Stock (BITCL) (Million Sticks)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Sales Columns */}
                <div className="space-y-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">Brand Wise Sales (BITCL)</span>
                  {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((brand) => (
                    <div key={brand}>
                      <label className="text-slate-600 dark:text-slate-400 capitalize block mb-1">{brand}</label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={isReadOnly || isLoading}
                        value={sales[brand] === 0 ? '' : sales[brand]}
                        placeholder="0.00"
                        onChange={(e) => setSales({ ...sales, [brand]: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-right text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-mono disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>

                {/* Stock Columns */}
                <div className="space-y-3">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">Brand Wise Closing Stock (BITCL)</span>
                  {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((brand) => (
                    <div key={brand}>
                      <label className="text-slate-600 dark:text-slate-400 capitalize block mb-1">{brand}</label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={isReadOnly || isLoading}
                        value={stock[brand] === 0 ? '' : stock[brand]}
                        placeholder="0.00"
                        onChange={(e) => setStock({ ...stock, [brand]: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-right text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Zarda Brands */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors duration-200">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                2. Zarda Operations (Qty & Value)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Zarda Sales */}
                <div className="space-y-3">
                  <span className="font-semibold text-amber-600 dark:text-amber-300 block">Zarda Sales</span>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">SLB (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly || isLoading}
                      value={zardaSales.slb === 0 ? '' : zardaSales.slb}
                      placeholder="0.00"
                      onChange={(e) => setZardaSales({ ...zardaSales, slb: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">22/25 (@15 Tk)</label>
                    <input
                      type="number"
                      disabled={isReadOnly || isLoading}
                      value={zardaSales.qty_22_25 === 0 ? '' : zardaSales.qty_22_25}
                      placeholder="0"
                      onChange={(e) => setZardaSales({ ...zardaSales, qty_22_25: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">99/14 (@6 Tk)</label>
                    <input
                      type="number"
                      disabled={isReadOnly || isLoading}
                      value={zardaSales.qty_99_14 === 0 ? '' : zardaSales.qty_99_14}
                      placeholder="0"
                      onChange={(e) => setZardaSales({ ...zardaSales, qty_99_14: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">33/15 (@8 Tk)</label>
                    <input
                      type="number"
                      disabled={isReadOnly || isLoading}
                      value={zardaSales.qty_33_15 === 0 ? '' : zardaSales.qty_33_15}
                      placeholder="0"
                      onChange={(e) => setZardaSales({ ...zardaSales, qty_33_15: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Zarda Stock */}
                <div className="space-y-3">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-300 block">Zarda Closing Stock</span>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">SLB (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly || isLoading}
                      value={zardaStock.slb === 0 ? '' : zardaStock.slb}
                      placeholder="0.00"
                      onChange={(e) => setZardaStock({ ...zardaStock, slb: parseFloat(e.target.value) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">22/25 (@15 Tk)</label>
                    <input
                      type="number"
                      disabled={isReadOnly || isLoading}
                      value={zardaStock.qty_22_25 === 0 ? '' : zardaStock.qty_22_25}
                      placeholder="0"
                      onChange={(e) => setZardaStock({ ...zardaStock, qty_22_25: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">99/14 (@6 Tk)</label>
                    <input
                      type="number"
                      disabled={isReadOnly || isLoading}
                      value={zardaStock.qty_99_14 === 0 ? '' : zardaStock.qty_99_14}
                      placeholder="0"
                      onChange={(e) => setZardaStock({ ...zardaStock, qty_99_14: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">33/15 (@8 Tk)</label>
                    <input
                      type="number"
                      disabled={isReadOnly || isLoading}
                      value={zardaStock.qty_33_15 === 0 ? '' : zardaStock.qty_33_15}
                      placeholder="0"
                      onChange={(e) => setZardaStock({ ...zardaStock, qty_33_15: parseInt(e.target.value, 10) || 0 })}
                      className="w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-right text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Empty Packets & Remarks */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 p-5 backdrop-blur-sm space-y-4 shadow-sm dark:shadow-none transition-colors duration-200 relative z-10">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Operational Returns & Route Remarks
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Express Empty Packet Return (Count)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={emptyPackets === 0 ? '' : emptyPackets}
                  placeholder="0"
                  onChange={(e) => setEmptyPackets(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Route & Field Remarks</label>
                <input
                  type="text"
                  disabled={isReadOnly || isLoading}
                  value={remarks}
                  placeholder="Operational remarks, route coverage notes..."
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 relative z-10">
            <button
              onClick={() => setViewMode('listing')}
              className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 sm:border-transparent"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Cancel & Return to Listing</span>
            </button>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={handleSaveDraft}
                disabled={isReadOnly || isSaving || isLoading}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                onClick={handleSubmit}
                disabled={isReadOnly || isSaving || isLoading}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Submit for TSO Review</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
