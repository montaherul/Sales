'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  MapPin, 
  TrendingUp, 
  Calendar, 
  Download, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Trophy, 
  Layers, 
  FileSpreadsheet, 
  Users, 
  Calculator, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Building2,
  ChevronRight,
  Filter,
  Check,
  Plus,
  Trash2,
  X
} from 'lucide-react';
import { 
  TerritoryPerformanceOverview, 
  RouteDailySaleEntry, 
  RoutePerformanceSummary 
} from '@/modules/territory-csr/domain/types';
import { DatePicker } from '@/components/common/DatePicker';
import { MONTH_NAMES } from '@/shared/constants';

interface TerritoryOption {
  id: string;
  name: string;
  region_name: string;
  route_count: number;
}

interface TerritoryCsrHubProps {
  currentUser?: any;
  companyId?: string;
  userTerritoryId?: string;
}

export function TerritoryCsrHub({
  currentUser,
  companyId = 'ALL',
  userTerritoryId,
}: TerritoryCsrHubProps) {
  const isTso = currentUser?.role === 'TSO';
  const effectiveRole = currentUser?.role || 'COMPANY_ADMIN';

  // Master Territories List
  const [territories, setTerritories] = useState<TerritoryOption[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>(userTerritoryId || '');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-22');

  // Active Tab: 'daily' | 'atda' | 'leaderboard' | 'targets'
  const [activeTab, setActiveTab] = useState<'daily' | 'atda' | 'leaderboard' | 'targets'>('daily');

  // Selected Day for Daily Sheet tab (1 to 31)
  const [activeDayNum, setActiveDayNum] = useState<number>(22);

  // Overview Data from API
  const [overview, setOverview] = useState<TerritoryPerformanceOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Local Editable Daily Sales State (Map routeId -> { cig: number, bidi: number, remarks: string })
  const [editableDailySales, setEditableDailySales] = useState<Record<string, { cig: number; bidi: number; remarks: string }>>({});

  // Local Editable Target State
  const [editableTargets, setEditableTargets] = useState<Record<string, { cig: number; bidi: number }>>({});
  const [editableBenchmarks, setEditableBenchmarks] = useState<{ lms: number; lmAds: number; workingDays: number }>({
    lms: 11.06,
    lmAds: 0.43,
    workingDays: 26,
  });

  // Dynamic Route Creation Modal State
  const [addRouteModalOpen, setAddRouteModalOpen] = useState(false);
  const [newRouteData, setNewRouteData] = useState({
    name: '',
    csrName: '',
    outletCount: 0,
    cigTarget: 0,
    bidiTarget: 0,
  });

  // Load Territories List
  useEffect(() => {
    async function fetchTerritories() {
      try {
        const query = companyId && companyId !== 'ALL' ? `?companyId=${companyId}` : '';
        const res = await fetch(`/api/territory-csr/territories${query}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTerritories(json.data);
          // If no territory selected yet, select Chandanaish or first one
          if (!selectedTerritoryId) {
            const defaultTerr = json.data.find((t: TerritoryOption) => t.name.toLowerCase().includes('chandan')) || json.data[0];
            if (defaultTerr) {
              setSelectedTerritoryId(defaultTerr.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load territories:', err);
      }
    }
    fetchTerritories();
  }, [companyId]);

  // Sync selectedDate with activeDayNum
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts[2]) {
        setActiveDayNum(parseInt(parts[2], 10));
      }
    }
  }, [selectedDate]);

  // Fetch Overview Data
  const loadOverview = useCallback(async () => {
    if (!selectedTerritoryId) return;

    setLoading(true);
    try {
      const parts = selectedDate.split('-');
      const year = parts[0] || '2026';
      const month = parts[1] || '10';
      const day = activeDayNum;

      const res = await fetch(
        `/api/territory-csr/overview?territoryId=${selectedTerritoryId}&year=${year}&month=${month}&day=${day}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const data: TerritoryPerformanceOverview = json.data;
        setOverview(data);

        // Populate local editable daily sales
        const salesMap: Record<string, { cig: number; bidi: number; remarks: string }> = {};
        data.dailySalesForSelectedDate.forEach((entry) => {
          salesMap[entry.routeId] = {
            cig: entry.salesCigarette,
            bidi: entry.salesBidi,
            remarks: entry.remarks || '',
          };
        });
        setEditableDailySales(salesMap);

        // Populate local editable targets
        const tgMap: Record<string, { cig: number; bidi: number }> = {};
        data.routes.forEach((r) => {
          tgMap[r.routeId] = {
            cig: r.monthlyTargetCigarette,
            bidi: r.monthlyTargetBidi,
          };
        });
        setEditableTargets(tgMap);

        setEditableBenchmarks({
          lms: data.benchmarks.lms,
          lmAds: data.benchmarks.lmAds,
          workingDays: data.benchmarks.workingDays,
        });
      } else {
        throw new Error(json.error || 'Failed to fetch overview data');
      }
    } catch (err: any) {
      console.error('Error fetching territory overview:', err);
      showToast(err.message || 'Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTerritoryId, selectedDate, activeDayNum]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Save Daily Sales
  const handleSaveDailySales = async () => {
    if (!selectedTerritoryId || !overview) return;

    setSaving(true);
    try {
      const parts = selectedDate.split('-');
      const year = parts[0] || '2026';
      const month = parts[1] || '10';
      const dayStr = String(activeDayNum).padStart(2, '0');
      const targetDate = `${year}-${month}-${dayStr}`;

      const salesPayload = Object.keys(editableDailySales).map((rId) => ({
        routeId: rId,
        salesCigarette: editableDailySales[rId].cig || 0,
        salesBidi: editableDailySales[rId].bidi || 0,
        remarks: editableDailySales[rId].remarks || '',
      }));

      const res = await fetch('/api/territory-csr/daily-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: selectedTerritoryId,
          reportDate: targetDate,
          sales: salesPayload,
          companyId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(`Saved Day ${activeDayNum} sales successfully!`, 'success');
        await loadOverview();
      } else {
        throw new Error(json.error || 'Failed to save sales');
      }
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save Targets
  const handleSaveTargets = async () => {
    if (!selectedTerritoryId || !overview) return;

    setSaving(true);
    try {
      const parts = selectedDate.split('-');
      const year = parseInt(parts[0] || '2026', 10);
      const month = parseInt(parts[1] || '10', 10);

      const targetsPayload = Object.keys(editableTargets).map((rId) => ({
        routeId: rId,
        targetCigarette: editableTargets[rId].cig || 0,
        targetBidi: editableTargets[rId].bidi || 0,
      }));

      const res = await fetch('/api/territory-csr/targets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: selectedTerritoryId,
          year,
          month,
          benchmarks: editableBenchmarks,
          targets: targetsPayload,
          companyId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast('Targets and benchmarks updated successfully!', 'success');
        await loadOverview();
      } else {
        throw new Error(json.error || 'Failed to update targets');
      }
    } catch (err: any) {
      showToast(err.message || 'Target save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Add Route Dynamically
  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerritoryId || !newRouteData.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/territory-csr/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: selectedTerritoryId,
          name: newRouteData.name,
          csrName: newRouteData.csrName,
          outletCount: newRouteData.outletCount,
          companyId,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const created = json.data;
        if (newRouteData.cigTarget > 0 || newRouteData.bidiTarget > 0) {
          const parts = selectedDate.split('-');
          const year = parseInt(parts[0] || '2026', 10);
          const month = parseInt(parts[1] || '10', 10);
          await fetch('/api/territory-csr/targets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              territoryId: selectedTerritoryId,
              year,
              month,
              targets: [{
                routeId: created.id,
                targetCigarette: newRouteData.cigTarget,
                targetBidi: newRouteData.bidiTarget,
              }],
              companyId,
            }),
          });
        }
        showToast(`Route "${newRouteData.name}" created successfully!`, 'success');
        setAddRouteModalOpen(false);
        setNewRouteData({ name: '', csrName: '', outletCount: 0, cigTarget: 0, bidiTarget: 0 });
        await loadOverview();
      } else {
        throw new Error(json.error || 'Failed to create route');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create route', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Deactivate / Delete Route
  const handleDeleteRoute = async (routeId: string, routeName: string) => {
    if (!confirm(`Are you sure you want to deactivate route "${routeName}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/territory-csr/routes?id=${routeId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(`Route "${routeName}" deactivated`, 'success');
        await loadOverview();
      } else {
        throw new Error(json.error || 'Failed to deactivate route');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate route', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Export 34-Sheet Excel
  const handleExportWorkbook = async () => {
    if (!selectedTerritoryId) return;

    setExporting(true);
    try {
      const parts = selectedDate.split('-');
      const year = parts[0] || '2026';
      const month = parts[1] || '10';
      const day = activeDayNum;

      const res = await fetch(
        `/api/territory-csr/export?territoryId=${selectedTerritoryId}&year=${year}&month=${month}&day=${day}`
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers.get('Content-Disposition');
      let downloadFilename = `Territory_CSR_Sales_${selectedDate}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) downloadFilename = match[1];
      }
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`Exported ${downloadFilename}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Export error', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Helper for performance tier styling
  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'Top Performer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Top Performer
          </span>
        );
      case 'Achieved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Achieved
          </span>
        );
      case 'Near Target':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <TrendingUp className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Near Target
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Needs Pacing
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toastMessage.text}
        </div>
      )}

      {/* Top Banner & Dynamic Controls */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Territory Intelligence Hub
              </span>
              <span className="text-xs text-slate-400">
                Live Dynamic Sync
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              {overview?.territory.name || 'Territory'} CSR Sales & Target
              <span className="text-sm font-normal px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Region: {overview?.territory.regionName || 'Region'}
              </span>
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Performance as of Working Day {overview?.period.workingDaysElapsed || 19} of {overview?.period.workingDaysTotal || 26} ({selectedDate}) | Standard 26 Working Days (Fridays Excluded)
            </p>
          </div>

          {/* Action Header */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Dynamic Territory Switcher */}
            <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-400 pl-2 font-medium">Territory:</span>
              <select
                id="tso-territory-selector"
                value={selectedTerritoryId}
                onChange={(e) => setSelectedTerritoryId(e.target.value)}
                className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.region_name}) - {t.route_count} Routes
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Month & Year Selectors */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
              <select
                id="tso-month-selector"
                value={parseInt(selectedDate.split('-')[1] || '10', 10)}
                onChange={(e) => {
                  const m = String(e.target.value).padStart(2, '0');
                  const parts = selectedDate.split('-');
                  setSelectedDate(`${parts[0] || '2026'}-${m}-${parts[2] || '01'}`);
                }}
                className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                id="tso-year-selector"
                value={parseInt(selectedDate.split('-')[0] || '2026', 10)}
                onChange={(e) => {
                  const y = e.target.value;
                  const parts = selectedDate.split('-');
                  setSelectedDate(`${y}-${parts[1] || '10'}-${parts[2] || '01'}`);
                }}
                className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-2 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div className="w-36 bg-slate-800/80 rounded-xl border border-slate-700 p-1">
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Select Date"
              />
            </div>

            {/* Export 34-Sheet Excel Button */}
            <button
              id="tso-export-excel-btn"
              onClick={handleExportWorkbook}
              disabled={exporting || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Export 34-Sheet XLSX
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards (Executive Overview) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Territory Monthly Target */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Monthly Target
          </span>
          <div className="my-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {overview?.territoryTotals.totalMonthlyTarget.toFixed(2) || '0.00'}
            </span>
            <span className="text-xs text-slate-500 ml-1">Mio</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Target ADS: {overview?.benchmarks.tmTargetAds.toFixed(2) || '0.00'}
          </span>
        </div>

        {/* Card 2: MTD Target to Date */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            MTD Target To Date
          </span>
          <div className="my-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {overview?.territoryTotals.mtdTargetToDate.toFixed(2) || '0.00'}
            </span>
            <span className="text-xs text-slate-500 ml-1">Mio</span>
          </div>
          <span className="text-[11px] text-slate-500">
            For {overview?.period.workingDaysElapsed || 0} elapsed days
          </span>
        </div>

        {/* Card 3: Actual Sales MTD */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Actual Sales MTD
          </span>
          <div className="my-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {overview?.territoryTotals.actualSalesMtdTotal.toFixed(2) || '0.00'}
            </span>
            <span className="text-xs text-slate-500 ml-1">Mio</span>
          </div>
          <span className={`text-[11px] font-semibold ${
            (overview?.territoryTotals.varianceMtd || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            Variance: {overview?.territoryTotals.varianceMtd && overview.territoryTotals.varianceMtd > 0 ? '+' : ''}{overview?.territoryTotals.varianceMtd.toFixed(2) || '0.00'}
          </span>
        </div>

        {/* Card 4: Overall ATDA % */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Overall ATDA %
          </span>
          <div className="my-2">
            <span className={`text-2xl font-black ${
              (overview?.territoryTotals.overallAtdaPct || 0) >= 1.0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {((overview?.territoryTotals.overallAtdaPct || 0) * 100).toFixed(1)}%
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Status: {overview?.territoryTotals.pacingStatus}
          </span>
        </div>

        {/* Card 5: Average Daily Sales (ADS) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Avg Daily Sales (ADS)
          </span>
          <div className="my-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {overview?.territoryTotals.ads.toFixed(2) || '0.00'}
            </span>
            <span className="text-xs text-slate-500 ml-1">Mio</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Req. Run Rate: {overview?.territoryTotals.reqRunRate.toFixed(2) || '0.00'}/day
          </span>
        </div>

        {/* Card 6: Month-End Projected Sales */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Projected Sales
          </span>
          <div className="my-2">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {overview?.territoryTotals.monthEndProjectedSales.toFixed(2) || '0.00'}
            </span>
            <span className="text-xs text-slate-500 ml-1">Mio</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Projected Ach: {((overview?.territoryTotals.projectedAchPct || 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          id="tab-daily-route-sales"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'daily'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Daily Route Sales (Sheets 1–31)
        </button>

        <button
          id="tab-atda-ads"
          onClick={() => setActiveTab('atda')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'atda'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          ATDA & ADS Performance Grid
        </button>

        <button
          id="tab-leaderboard"
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          Route Performance Leaderboard
        </button>

        <button
          id="tab-targets"
          onClick={() => setActiveTab('targets')}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'targets'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Target & Baseline Configuration
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Calculating dynamic territory performance...
          </span>
        </div>
      )}

      {/* TAB 1: DAILY ROUTE SALES (SHEETS 1-31) */}
      {!loading && activeTab === 'daily' && overview && (
        <div className="space-y-4">
          {/* Day Selector (1 to 31 tabs) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => {
                  setActiveDayNum(d);
                  const parts = selectedDate.split('-');
                  const year = parts[0] || '2026';
                  const month = parts[1] || '10';
                  setSelectedDate(`${year}-${month}-${String(d).padStart(2, '0')}`);
                }}
                className={`h-9 min-w-9 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center ${
                  activeDayNum === d
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{d}</span>
              </button>
            ))}
          </div>

          {/* Daily Route Sales Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Day {activeDayNum} Daily Route Sales Sheet
                </h3>
                <span className="text-xs text-slate-500">
                  Enter daily sales per route. Total sales, variance, and achievement % calculate live automatically.
                </span>
              </div>

              <button
                id="btn-save-daily-sales"
                onClick={handleSaveDailySales}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Day {activeDayNum} Sales
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-3 w-12 text-center">SL</th>
                    <th className="px-4 py-3">SR / CSR</th>
                    <th className="px-4 py-3">Route Name</th>
                    <th className="px-3 py-3 text-center">Outlets</th>
                    <th className="px-3 py-3 text-right">Daily Target (Cig)</th>
                    <th className="px-3 py-3 text-right">Daily Target (Bidi)</th>
                    <th className="px-4 py-3 text-right w-28 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300">
                      Sales (Cigarette)
                    </th>
                    <th className="px-4 py-3 text-right w-28 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300">
                      Sales (Bidi)
                    </th>
                    <th className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">Total Sales</th>
                    <th className="px-3 py-3 text-right">Variance</th>
                    <th className="px-3 py-3 text-right">Achievement %</th>
                    <th className="px-4 py-3">Performance Tier</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {overview.dailySalesForSelectedDate.map((row, idx) => {
                    const currentCig = editableDailySales[row.routeId]?.cig ?? row.salesCigarette;
                    const currentBidi = editableDailySales[row.routeId]?.bidi ?? row.salesBidi;
                    const totalEntered = Number((Number(currentCig || 0) + Number(currentBidi || 0)).toFixed(2));
                    const totalTarget = row.totalDailyTarget;
                    const liveVariance = Number((totalEntered - totalTarget).toFixed(2));
                    const liveAchRatio = totalTarget > 0 ? totalEntered / totalTarget : 0;
                    const liveTier = totalEntered === 0 ? 'Needs Pacing' : 
                      liveAchRatio >= 1.01 ? 'Top Performer' : liveAchRatio >= 1.0 ? 'Achieved' : liveAchRatio >= 0.98 ? 'Near Target' : 'Needs Pacing';

                    return (
                      <tr key={row.routeId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{row.csrName}</td>
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-semibold">{row.routeName}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500 font-mono">{row.dailyTargetCigarette > 0 ? (idx * 5 + 30) : '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{row.dailyTargetCigarette.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {row.dailyTargetBidi > 0 ? row.dailyTargetBidi.toFixed(2) : '-'}
                        </td>

                        {/* Input: Cigarette Sales */}
                        <td className="px-2 py-1.5 text-right bg-indigo-50/30 dark:bg-indigo-950/10">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentCig === 0 ? '' : currentCig}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditableDailySales(prev => ({
                                ...prev,
                                [row.routeId]: {
                                  cig: val,
                                  bidi: prev[row.routeId]?.bidi || 0,
                                  remarks: prev[row.routeId]?.remarks || '',
                                }
                              }));
                            }}
                            className="w-full text-right px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Input: Bidi Sales */}
                        <td className="px-2 py-1.5 text-right bg-indigo-50/30 dark:bg-indigo-950/10">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentBidi === 0 ? '' : currentBidi}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditableDailySales(prev => ({
                                ...prev,
                                [row.routeId]: {
                                  cig: prev[row.routeId]?.cig || 0,
                                  bidi: val,
                                  remarks: prev[row.routeId]?.remarks || '',
                                }
                              }));
                            }}
                            className="w-full text-right px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>

                        {/* Live Total */}
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {totalEntered.toFixed(2)}
                        </td>

                        {/* Live Variance */}
                        <td className={`px-3 py-2.5 text-right font-mono font-semibold ${
                          liveVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {liveVariance > 0 ? '+' : ''}{liveVariance.toFixed(2)}
                        </td>

                        {/* Live Achievement % */}
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {(liveAchRatio * 100).toFixed(1)}%
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-2.5">
                          {getTierBadge(liveTier)}
                        </td>

                        {/* Remarks */}
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={editableDailySales[row.routeId]?.remarks ?? row.remarks}
                            placeholder="Add remark..."
                            onChange={(e) => {
                              const rem = e.target.value;
                              setEditableDailySales(prev => ({
                                ...prev,
                                [row.routeId]: {
                                  cig: prev[row.routeId]?.cig || 0,
                                  bidi: prev[row.routeId]?.bidi || 0,
                                  remarks: rem,
                                }
                              }));
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATDA & ADS MASTER PERFORMANCE GRID */}
      {!loading && activeTab === 'atda' && overview && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Performance Achievement To Date Average (ATDA) & Average Daily Sales (ADS)
              </h3>
              <span className="text-xs text-slate-500">
                Calculated across {overview.period.workingDaysElapsed} elapsed working days of {overview.period.workingDaysTotal} total working days.
              </span>
            </div>

            <button
              onClick={handleExportWorkbook}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download XLSX
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">SL</th>
                  <th className="px-4 py-3">Name of SR / CSR</th>
                  <th className="px-4 py-3">Name of Route</th>
                  <th className="px-3 py-3 text-right">Monthly Target</th>
                  <th className="px-3 py-3 text-right">MTD Target</th>
                  <th className="px-3 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">Actual MTD</th>
                  <th className="px-3 py-3 text-right">Variance MTD</th>
                  <th className="px-3 py-3 text-right font-bold">ATDA %</th>
                  <th className="px-3 py-3 text-right">ADS (Actual)</th>
                  <th className="px-3 py-3 text-right">Req Run Rate</th>
                  <th className="px-3 py-3 text-right">Projected Sales</th>
                  <th className="px-3 py-3 text-right">Projected Ach %</th>
                  <th className="px-4 py-3">Performance Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {overview.routes.map((r, idx) => (
                  <tr key={r.routeId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{r.csrName}</td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-semibold">{r.routeName}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{r.totalMonthlyTarget.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{r.mtdTargetToDate.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{r.actualSalesMtdTotal.toFixed(2)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${
                      r.varianceMtd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {r.varianceMtd > 0 ? '+' : ''}{r.varianceMtd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">
                      {(r.atdaPct * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{r.ads.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{r.reqRunRate.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white">{r.projectedSales.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{(r.projectedAchPct * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5">{getTierBadge(r.performanceTier)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-950 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-slate-900 dark:text-white font-black uppercase">
                    Territory Total / Benchmark
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{overview.territoryTotals.totalMonthlyTarget.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono">{overview.territoryTotals.mtdTargetToDate.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {overview.territoryTotals.actualSalesMtdTotal.toFixed(2)}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono font-bold ${
                    overview.territoryTotals.varianceMtd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {overview.territoryTotals.varianceMtd > 0 ? '+' : ''}{overview.territoryTotals.varianceMtd.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-black">
                    {(overview.territoryTotals.overallAtdaPct * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{overview.territoryTotals.ads.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono">{overview.territoryTotals.reqRunRate.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono">{overview.territoryTotals.monthEndProjectedSales.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-mono">{(overview.territoryTotals.projectedAchPct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">{getTierBadge(overview.territoryTotals.pacingStatus)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LEADERBOARD & PERFORMANCE DASHBOARD */}
      {!loading && activeTab === 'leaderboard' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Leaderboard Table */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Route Performance Ranking Leaderboard
                </h3>
                <span className="text-xs text-slate-500">
                  Sorted dynamically by ATDA % (Achievement To Date Average)
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.routes
                .slice()
                .sort((a, b) => b.atdaPct - a.atdaPct)
                .map((r, rankIdx) => {
                  const rank = rankIdx + 1;
                  const isTop3 = rank <= 3;
                  return (
                    <div
                      key={r.routeId}
                      className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                            rank === 1
                              ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 border border-amber-300'
                              : rank === 2
                              ? 'bg-gradient-to-tr from-slate-200 to-slate-400 text-slate-900 border border-slate-300'
                              : rank === 3
                              ? 'bg-gradient-to-tr from-amber-700 to-amber-600 text-amber-100 border border-amber-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {rank}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {r.routeName}
                            </span>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                              SR: {r.csrName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span>Target: {r.mtdTargetToDate.toFixed(2)} Mio</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Actual: {r.actualSalesMtdTotal.toFixed(2)} Mio
                            </span>
                            <span>•</span>
                            <span className={r.varianceMtd >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600'}>
                              Variance: {r.varianceMtd > 0 ? '+' : ''}{r.varianceMtd.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Achievement and Tier Badge */}
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                          {(r.atdaPct * 100).toFixed(1)}%
                        </span>
                        {getTierBadge(r.performanceTier)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Baseline Benchmarks & Summary Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Territory Benchmarks & Baseline
            </h4>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">This Month Target</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {overview.benchmarks.tmTarget.toFixed(2)} Mio
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Target ADS (TM ADS)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {overview.benchmarks.tmTargetAds.toFixed(2)} Mio / day
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Last Month Sales (LMS)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {overview.benchmarks.lms.toFixed(2)} Mio
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Last Month ADS (LM ADS)</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {overview.benchmarks.lmAds.toFixed(2)} Mio / day
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Current Actual ADS</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {overview.territoryTotals.ads.toFixed(2)} Mio / day
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-500">Standard Working Days</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {overview.benchmarks.workingDays} Days
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Pacing Formula:
              </span>
              Required Run Rate = (Monthly Target - Actual MTD) / Remaining Working Days.
              Routes with ATDA &gt;= 100% are on pace to surpass monthly target.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TARGET & BASELINE CONFIGURATION */}
      {!loading && activeTab === 'targets' && overview && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                Route Targets & Baseline Configuration
              </h3>
              <span className="text-xs text-slate-500">
                Set monthly targets per route and baseline benchmarks. Daily targets are automatically computed as Monthly Target / {editableBenchmarks.workingDays || 26}.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="btn-add-route"
                type="button"
                onClick={() => setAddRouteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Add New Route
              </button>

              <button
                onClick={handleSaveTargets}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save All Targets
              </button>
            </div>
          </div>

          {/* Benchmarks Input Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Last Month Sales (LMS)
              </label>
              <input
                type="number"
                step="0.01"
                value={editableBenchmarks.lms}
                onChange={(e) => setEditableBenchmarks(prev => ({ ...prev, lms: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Last Month ADS (LM ADS)
              </label>
              <input
                type="number"
                step="0.01"
                value={editableBenchmarks.lmAds}
                onChange={(e) => setEditableBenchmarks(prev => ({ ...prev, lmAds: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Working Days (Excluding Fridays)
              </label>
              <input
                type="number"
                value={editableBenchmarks.workingDays}
                onChange={(e) => setEditableBenchmarks(prev => ({ ...prev, workingDays: parseInt(e.target.value, 10) || 26 }))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Route Targets Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">SL</th>
                  <th className="px-4 py-3">SR / CSR</th>
                  <th className="px-4 py-3">Route Name</th>
                  <th className="px-4 py-3 text-right">Monthly Cigarette Target</th>
                  <th className="px-4 py-3 text-right">Monthly Bidi Target</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">Total Monthly Target</th>
                  <th className="px-4 py-3 text-right">Daily Target (Cig)</th>
                  <th className="px-4 py-3 text-right">Daily Target (Bidi)</th>
                  <th className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">Total Daily Target</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {overview.routes.map((r, idx) => {
                  const cig = editableTargets[r.routeId]?.cig ?? r.monthlyTargetCigarette;
                  const bidi = editableTargets[r.routeId]?.bidi ?? r.monthlyTargetBidi;
                  const totalMonthly = Number((Number(cig || 0) + Number(bidi || 0)).toFixed(2));
                  const wDays = editableBenchmarks.workingDays || 26;
                  const dailyCig = Number((cig / wDays).toFixed(2));
                  const dailyBidi = Number((bidi / wDays).toFixed(2));
                  const totalDaily = Number((dailyCig + dailyBidi).toFixed(2));

                  return (
                    <tr key={r.routeId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">{r.csrName}</td>
                      <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">{r.routeName}</td>
                      
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={cig === 0 ? '' : cig}
                          placeholder="0.00"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditableTargets(prev => ({
                              ...prev,
                              [r.routeId]: {
                                cig: val,
                                bidi: prev[r.routeId]?.bidi || 0,
                              }
                            }));
                          }}
                          className="w-28 text-right px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </td>

                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={bidi === 0 ? '' : bidi}
                          placeholder="0.00"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditableTargets(prev => ({
                              ...prev,
                              [r.routeId]: {
                                cig: prev[r.routeId]?.cig || 0,
                                bidi: val,
                              }
                            }));
                          }}
                          className="w-28 text-right px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </td>

                      <td className="px-4 py-2 text-right font-mono font-black text-slate-900 dark:text-white">
                        {totalMonthly.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">{dailyCig.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">{dailyBidi.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {totalDaily.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRoute(r.routeId, r.routeName)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Deactivate route"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynamic Add Route Modal */}
      {addRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Add New Operational Route
              </h3>
              <button
                type="button"
                onClick={() => setAddRouteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRoute} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Route Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. North Bazar Point"
                  value={newRouteData.name}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Assigned SR / CSR Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Karim / Solaiman"
                  value={newRouteData.csrName}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, csrName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Outlet Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 45"
                    value={newRouteData.outletCount || ''}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, outletCount: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Monthly Cig Target (Mio)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newRouteData.cigTarget || ''}
                    onChange={(e) => setNewRouteData(prev => ({ ...prev, cigTarget: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Monthly Bidi Target (Mio)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newRouteData.bidiTarget || ''}
                  onChange={(e) => setNewRouteData(prev => ({ ...prev, bidiTarget: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddRouteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newRouteData.name.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
