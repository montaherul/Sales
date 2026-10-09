'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  X, 
  Calendar, 
  Building2, 
  MapPin, 
  Layers, 
  CheckCircle2, 
  Sparkles, 
  Calculator, 
  ShieldCheck, 
  Loader2,
  TrendingUp,
  LayoutTemplate
} from 'lucide-react';
import { MONTH_NAMES } from '@/shared/constants';
import { DatePicker } from '@/components/common/DatePicker';
import { generateExportFilename } from '@/shared/utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompanyId?: string;
  isSuperAdmin?: boolean;
  defaultDate?: string; // YYYY-MM-DD
}

export function ExportModal({
  isOpen,
  onClose,
  currentCompanyId = 'ALL',
  isSuperAdmin = false,
  defaultDate,
}: ExportModalProps) {
  // Dynamic current date initialization
  const now = new Date();
  const parsedDate = defaultDate ? new Date(defaultDate) : now;
  const initialYear = !isNaN(parsedDate.getFullYear()) ? parsedDate.getFullYear() : now.getFullYear();
  const initialMonth = !isNaN(parsedDate.getMonth()) ? parsedDate.getMonth() + 1 : now.getMonth() + 1;
  const initialDay = !isNaN(parsedDate.getDate()) ? parsedDate.getDate() : now.getDate();

  // Form State: 4 CRUD period modes: daily, monthly, yearly, blank_month
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly' | 'blank_month'>('monthly');
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  const [day, setDay] = useState<number>(initialDay);
  const [companyId, setCompanyId] = useState<string>(currentCompanyId);
  const [regionId, setRegionId] = useState<string>('ALL');

  // Master Data State
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [regions, setRegions] = useState<Array<{ id: string; name: string; company_id?: string }>>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (currentCompanyId && currentCompanyId !== 'ALL') {
      setCompanyId(currentCompanyId);
    }
  }, [currentCompanyId]);

  // Load companies and regions
  useEffect(() => {
    if (!isOpen) return;

    async function loadMasterData() {
      setLoadingMaster(true);
      try {
        const query = companyId && companyId !== 'ALL' ? `?companyId=${companyId}` : '';
        const res = await fetch(`/api/master-data${query}`);
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.companies) {
            setCompanies(json.data.companies);
          }
          if (json.data.regions) {
            setRegions(json.data.regions);
          }
        }
      } catch (err) {
        console.error('Failed to load export filter master data', err);
      } finally {
        setLoadingMaster(false);
      }
    }

    loadMasterData();
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  // Month name calculation
  const monthName = MONTH_NAMES[month - 1] || 'October';

  // Dynamic filename calculation matching AGENTS.md Rules 2, 3, 17
  const previewFilename = generateExportFilename(year, month, day, reportType);

  // Filtered regions based on selected company
  const availableRegions = regions.filter((r) => {
    if (!companyId || companyId === 'ALL') return true;
    return !r.company_id || r.company_id === companyId;
  });

  const handleDownload = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      const params = new URLSearchParams();
      params.set('year', String(year));
      params.set('month', String(month));
      params.set('day', String(day));
      params.set('type', reportType);

      if (companyId && companyId !== 'ALL') {
        params.set('companyId', companyId);
      }
      if (regionId && regionId !== 'ALL') {
        params.set('regionId', regionId);
      }

      const downloadUrl = `/api/exports/xlsx?${params.toString()}`;

      // Trigger download via anchor element
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', previewFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportComplete(true);
      setTimeout(() => {
        setIsExporting(false);
      }, 1500);
    } catch (err) {
      console.error('Export download error:', err);
      alert('Failed to generate Excel report. Please check server logs.');
      setIsExporting(false);
    }
  };

  const getDownloadButtonLabel = () => {
    if (reportType === 'daily') {
      return `Download Daily Report (${day} ${monthName} ${year})`;
    }
    if (reportType === 'yearly') {
      return `Download Yearly Report (${year})`;
    }
    if (reportType === 'blank_month') {
      return `Download Blank Template (${monthName} ${year} • 34 Sheets • 0 Data)`;
    }
    return `Download Monthly 34-Sheet Report (${monthName} ${year})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Excel Report Generator
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Dynamic XLSX
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate dynamic reports preserving exact formulas, styles, and template hierarchy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 1. Report Type Selector: 4 Format Options */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Select Export Period & Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Daily Format */}
              <button
                type="button"
                onClick={() => setReportType('daily')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'daily'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Daily Report</span>
                  </div>
                  {reportType === 'daily' && (
                    <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Single day export with only that day&apos;s data, row formulas &amp; regional totals.
                </p>
              </button>

              {/* Monthly Format */}
              <button
                type="button"
                onClick={() => setReportType('monthly')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'monthly'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Monthly 34-Sheet</span>
                  </div>
                  {reportType === 'monthly' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Populated 34 sheets (1–31, STD &amp; ADS, Target, Analysis) with live data.
                </p>
              </button>

              {/* Blank New Month Template */}
              <button
                type="button"
                onClick={() => setReportType('blank_month')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'blank_month'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <LayoutTemplate className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>New Month (0 Data)</span>
                  </div>
                  {reportType === 'blank_month' && (
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Clean 34-sheet template. Formats all 31 dates to chosen month with 0 data &amp; full formulas.
                </p>
              </button>

              {/* Yearly Format */}
              <button
                type="button"
                onClick={() => setReportType('yearly')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'yearly'
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 ring-2 ring-purple-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Yearly Summary</span>
                  </div>
                  {reportType === 'yearly' && (
                    <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Consolidated annual report with cumulative sales, latest stock, Target &amp; Analysis.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Date Scope: Dynamically adapts to Daily, Monthly, Blank Month, or Yearly */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {reportType === 'daily'
                  ? 'Reporting Day (Interactive Calendar)'
                  : reportType === 'blank_month'
                  ? 'Select New Month & Year (Initializes 34 Tabs with 0 Data)'
                  : reportType === 'monthly'
                  ? 'Selected Month & Year'
                  : 'Selected Year'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setYear(today.getFullYear());
                    setMonth(today.getMonth() + 1);
                    setDay(today.getDate());
                  }}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  Current Date
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date();
                    next.setMonth(next.getMonth() + 1);
                    setYear(next.getFullYear());
                    setMonth(next.getMonth() + 1);
                    setDay(1);
                  }}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  Next Month
                </button>
              </div>
            </div>

            {reportType === 'daily' && (
              <div>
                <DatePicker
                  value={`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
                  onChange={(dateStr) => {
                    const [y, m, d] = dateStr.split('-').map(Number);
                    if (y) setYear(y);
                    if (m) setMonth(m);
                    if (d) setDay(d);
                  }}
                />
              </div>
            )}

            {(reportType === 'monthly' || reportType === 'blank_month') && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Month
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    >
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={name} value={idx + 1}>
                          {idx + 1} - {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                      Year
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                    >
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {reportType === 'blank_month' && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>
                      <strong>Clean New Month Template:</strong> All 31 daily tab dates are dynamically formatted to{' '}
                      <span className="font-bold underline">{monthName} {year}</span>. Every input cell (Cigarettes, Stock, Zarda, Packets) is initialized to <strong className="font-mono">0</strong> with 100% of native formulas preserved across all 34 sheets!
                    </span>
                  </div>
                )}
              </div>
            )}

            {reportType === 'yearly' && (
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Organizational Scope: Company & Region */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Company Selector */}
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-slate-400" />
                Company Scope
              </label>
              {isSuperAdmin ? (
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setRegionId('ALL');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="ALL">All Companies (Platform Default)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-300 font-medium">
                  {companies.find((c) => c.id === companyId)?.name || 'Assigned Company'}
                </div>
              )}
            </div>

            {/* Region Selector */}
            <div>
              <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-slate-400" />
                Region Scope
              </label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Regions (Standard Grid)</option>
                {availableRegions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Live Dynamic File Destination Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Generated File Destination</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {reportType === 'daily'
                  ? 'Daily Scoped • 1 Sheet'
                  : reportType === 'yearly'
                  ? 'Yearly Scoped • Consolidated'
                  : reportType === 'blank_month'
                  ? 'Blank New Month Template • 34 Sheets (0 Data)'
                  : 'Monthly Scoped • 34 Sheets'}
              </span>
            </div>
            <div className="font-mono text-xs text-slate-900 dark:text-slate-100 font-semibold break-all bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>{previewFilename}</span>
            </div>

            {/* Safety Verification Badges */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Template Intact</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>Native Formulas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span>Zero Formula Errors</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building Dynamic XLSX...
              </>
            ) : exportComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-white" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {getDownloadButtonLabel()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
