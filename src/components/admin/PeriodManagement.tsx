'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  Plus, 
  Lock, 
  Unlock, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Building2, 
  Layers, 
  Clock, 
  Sun, 
  Trash2, 
  Edit, 
  RefreshCw,
  Loader2,
  CalendarCheck2
} from 'lucide-react';
import { Select2, Select2Option } from '@/components/common/Select2';
import { MONTH_NAMES } from '@/shared/constants';

interface PeriodManagementProps {
  companyId?: string;
}

export function PeriodManagement({ companyId = 'ALL' }: PeriodManagementProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companyId);
  const [companies, setCompanies] = useState<Select2Option[]>([]);

  // Navigation Drilldown State: 'YEARS' -> 'MONTHS' -> 'DATES'
  const [drillTier, setDrillTier] = useState<'YEARS' | 'MONTHS' | 'DATES'>('YEARS');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10);

  // Data States
  const [years, setYears] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Auto-Generate Modal State
  const [autoGenModalOpen, setAutoGenModalOpen] = useState(false);
  const [autoGenYear, setAutoGenYear] = useState<number>(2027);
  const [autoGenWorkingDays, setAutoGenWorkingDays] = useState<number>(26);

  // Create Year Modal State
  const [addYearModalOpen, setAddYearModalOpen] = useState(false);
  const [newYearNum, setNewYearNum] = useState<number>(new Date().getFullYear() + 1);

  // Edit Month Modal State
  const [editMonthModalOpen, setEditMonthModalOpen] = useState(false);
  const [editingMonth, setEditingMonth] = useState<any>(null);
  const [editWorkingDays, setEditWorkingDays] = useState<number>(26);

  // Sync prop changes
  useEffect(() => {
    if (companyId) {
      setSelectedCompanyId(companyId);
    }
  }, [companyId]);

  // Load Companies
  useEffect(() => {
    async function loadCompanies() {
      try {
        const res = await fetch('/api/companies?pageSize=100');
        const json = await res.json();
        if (json.success && json.data) {
          setCompanies([
            { value: 'ALL', label: 'All Companies (Platform Default)' },
            ...json.data.map((c: any) => ({
              value: c.id,
              label: c.name,
              badge: c.code,
            })),
          ]);
        }
      } catch (err) {
        console.error('Failed to load companies:', err);
      }
    }
    loadCompanies();
  }, []);

  // Fetch Years
  const fetchYears = async () => {
    setLoading(true);
    try {
      const compParam = selectedCompanyId && selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
      const res = await fetch(`/api/periods?type=years${compParam.replace('?', '&')}`);
      const json = await res.json();
      if (json.success) {
        setYears(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching years:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Months for selectedYear
  const fetchMonths = async (yr: number) => {
    setLoading(true);
    try {
      const compParam = selectedCompanyId && selectedCompanyId !== 'ALL' ? `&companyId=${selectedCompanyId}` : '';
      const res = await fetch(`/api/periods?type=months&year=${yr}${compParam}`);
      const json = await res.json();
      if (json.success) {
        setMonths(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching months:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Dates for selectedYear and selectedMonth
  const fetchDates = async (yr: number, mo: number) => {
    setLoading(true);
    try {
      const compParam = selectedCompanyId && selectedCompanyId !== 'ALL' ? `&companyId=${selectedCompanyId}` : '';
      const res = await fetch(`/api/periods?type=dates&year=${yr}&month=${mo}${compParam}`);
      const json = await res.json();
      if (json.success) {
        setDates(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching dates:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger load based on drillTier
  useEffect(() => {
    if (drillTier === 'YEARS') {
      fetchYears();
    } else if (drillTier === 'MONTHS') {
      fetchMonths(selectedYear);
    } else if (drillTier === 'DATES') {
      fetchDates(selectedYear, selectedMonth);
    }
  }, [drillTier, selectedYear, selectedMonth, selectedCompanyId]);

  // Handler: Auto-generate period
  const handleAutoGenerate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto_create',
          companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
          year: autoGenYear,
          defaultWorkingDays: autoGenWorkingDays,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAutoGenModalOpen(false);
        fetchYears();
      } else {
        alert(json.error || 'Failed to auto-create reporting period');
      }
    } catch (err: any) {
      alert(err.message || 'Error auto-generating period');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Toggle Year Status
  const handleToggleYearStatus = async (yrItem: any) => {
    const newStatus = yrItem.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
    try {
      const res = await fetch('/api/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'year',
          id: yrItem.id,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchYears();
      }
    } catch (err) {
      console.error('Failed to update year status', err);
    }
  };

  // Handler: Toggle Month Status
  const handleToggleMonthStatus = async (moItem: any) => {
    const newStatus = moItem.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      const res = await fetch('/api/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'month',
          id: moItem.id,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchMonths(selectedYear);
      }
    } catch (err) {
      console.error('Failed to update month status', err);
    }
  };

  // Handler: Save Edited Working Days
  const handleSaveMonthWorkingDays = async () => {
    if (!editingMonth) return;
    try {
      const res = await fetch('/api/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'month',
          id: editingMonth.id,
          working_days: editWorkingDays,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditMonthModalOpen(false);
        fetchMonths(selectedYear);
      }
    } catch (err) {
      console.error('Failed to update working days', err);
    }
  };

  // Handler: Toggle Date Working Day / Holiday
  const handleToggleDateWorking = async (dtItem: any) => {
    const newIsWorking = !dtItem.is_working_day;
    const newStatus = newIsWorking ? 'OPEN' : 'HOLIDAY';
    try {
      const res = await fetch('/api/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'date',
          id: dtItem.id,
          is_working_day: newIsWorking,
          status: newStatus,
          holiday_name: newIsWorking ? null : 'Configured Holiday',
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchDates(selectedYear, selectedMonth);
      }
    } catch (err) {
      console.error('Failed to toggle date working day', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Breadcrumb Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <CalendarCheck2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <span>Year, Month & Date Period Governance</span>
            </h2>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Admin CRUD Control
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define fiscal calendar periods, manage working days per month, and lock/unlock dates for daily submissions
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoGenModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>⚡ Auto-Generate Period</span>
          </button>
        </div>
      </div>

      {/* 2. Drilldown Navigation Bar & Company Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-xs">
        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setDrillTier('YEARS')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              drillTier === 'YEARS'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Reporting Years</span>
          </button>

          {drillTier !== 'YEARS' && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <button
                onClick={() => setDrillTier('MONTHS')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  drillTier === 'MONTHS'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>Year {selectedYear} (12 Months)</span>
              </button>
            </>
          )}

          {drillTier === 'DATES' && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <div className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{MONTH_NAMES[selectedMonth - 1]} {selectedYear} (Daily Dates)</span>
              </div>
            </>
          )}
        </div>

        {/* Company Selector */}
        <div className="w-full sm:w-64">
          <Select2
            value={selectedCompanyId}
            onChange={(val) => setSelectedCompanyId(val)}
            options={companies}
            placeholder="Filter by Company Scope"
          />
        </div>
      </div>

      {/* 3. TIER 1: REPORTING YEARS GRID */}
      {drillTier === 'YEARS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {years.map((y) => (
              <div
                key={y.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                        {y.year}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        y.status === 'ACTIVE'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                      }`}>
                        {y.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleYearStatus(y)}
                      className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                        y.status === 'ACTIVE'
                          ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/50'
                          : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/50'
                      }`}
                      title="Toggle Year Active / Closed"
                    >
                      {y.status === 'ACTIVE' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      <span>{y.status === 'ACTIVE' ? 'Close Year' : 'Activate'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span>{y.company_name || 'Afaz Tobacco Company'}</span>
                  </p>

                  <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 mb-4 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Months</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">{y.total_months || 12}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-500 block uppercase">Open</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">{y.open_months || 12}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-500 block uppercase">Working Days</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">{y.total_working_days || 312}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setSelectedYear(y.year);
                      setDrillTier('MONTHS');
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>Manage 12 Months</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TIER 2: 12 MONTHLY PERIODS GRID */}
      {drillTier === 'MONTHS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setDrillTier('YEARS')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Years</span>
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing 12 Months for Year <strong>{selectedYear}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {months.map((m) => (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{String(m.month).padStart(2, '0')}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      m.status === 'OPEN'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    {m.month_name || MONTH_NAMES[m.month - 1]}
                  </h3>

                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800 mb-3">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Working Days:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                        {m.working_days} Days
                      </span>
                      <button
                        onClick={() => {
                          setEditingMonth(m);
                          setEditWorkingDays(m.working_days);
                          setEditMonthModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                        title="Edit Working Days"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleToggleMonthStatus(m)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      m.status === 'OPEN'
                        ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900'
                    }`}
                  >
                    {m.status === 'OPEN' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    <span>{m.status === 'OPEN' ? 'Close Month' : 'Open Month'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedMonth(m.month);
                      setDrillTier('DATES');
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                    title="View Daily Calendar"
                  >
                    Days & Holidays
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TIER 3: DAILY DATES CALENDAR GRID */}
      {drillTier === 'DATES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setDrillTier('MONTHS')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Months</span>
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Configuring Days for <strong>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {dates.map((d) => (
              <div
                key={d.id}
                className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                  !d.is_working_day
                    ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                    Day {d.day}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    d.is_working_day
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200'
                  }`}>
                    {d.is_working_day ? 'Working' : 'Holiday'}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-2 truncate">
                  {d.reporting_date}
                </div>

                <button
                  onClick={() => handleToggleDateWorking(d)}
                  className={`w-full py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                    d.is_working_day
                      ? 'border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800'
                      : 'border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800'
                  }`}
                >
                  {d.is_working_day ? 'Mark Holiday' : 'Mark Working'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUTO-GENERATE MODAL */}
      {autoGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Auto-Generate Reporting Period</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Instantly configures Year, 12 Months & All 365 Days</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Target Year</label>
                <select
                  value={autoGenYear}
                  onChange={(e) => setAutoGenYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Default Working Days per Month</label>
                <input
                  type="number"
                  min="20"
                  max="31"
                  value={autoGenWorkingDays}
                  onChange={(e) => setAutoGenWorkingDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400">Standard Bangladesh tobacco industry baseline: 26 days</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAutoGenModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Generate Calendar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MONTH WORKING DAYS MODAL */}
      {editMonthModalOpen && editingMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Edit Working Days: {editingMonth.month_name} {selectedYear}
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Working Days Count
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={editWorkingDays}
                onChange={(e) => setEditWorkingDays(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditMonthModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMonthWorkingDays}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
