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
  Loader2
} from 'lucide-react';
import { MONTH_NAMES } from '@/shared/constants';
import { DatePicker } from '@/components/common/DatePicker';

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
  defaultDate = '2026-10-06',
}: ExportModalProps) {
  // Parse initial date
  const parsedDate = new Date(defaultDate || '2026-10-06');
  const initialYear = !isNaN(parsedDate.getFullYear()) ? parsedDate.getFullYear() : 2026;
  const initialMonth = !isNaN(parsedDate.getMonth()) ? parsedDate.getMonth() + 1 : 10;
  const initialDay = !isNaN(parsedDate.getDate()) ? parsedDate.getDate() : 6;

  // Form State
  const [reportType, setReportType] = useState<'monthly' | 'daily'>('monthly');
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

  // Live filename preview according to AGENTS.md Rule 17
  const previewFilename = reportType === 'daily'
    ? `Daily sales and Closing Stock Information ${monthName} ${day} ${year} (Daily).xlsx`
    : `Daily sales and Closing Stock Information ${monthName} ${day} ${year}.xlsx`;

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
      }, 1200);
    } catch (err) {
      console.error('Export download error:', err);
      alert('Failed to generate Excel report. Please check server logs.');
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
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
                  Authoritative XLSX
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
          {/* 1. Report Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Select Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportType('monthly')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'monthly'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Full Monthly Workbook
                  </div>
                  {reportType === 'monthly' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Complete 34-sheet workbook (Days 1–31, STD & ADS, Target., Analysis) with 3D formula linkages.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setReportType('daily')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportType === 'daily'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Single Day Report
                  </div>
                  {reportType === 'daily' && (
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Focused 1-sheet report matching exact 32-column template layout, row formulas & regional totals.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Date Scope: Interactive Calendar UI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {reportType === 'daily' ? 'Reporting Date (Interactive Calendar)' : 'Period & Active Day (Interactive Calendar)'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setYear(2026);
                  setMonth(10);
                  setDay(6);
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                Reset to Oct 6, 2026 (Template Default)
              </button>
            </div>

            <div>
              <DatePicker
                value={`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`}
                onChange={(dateStr) => {
                  const [y, m, d] = dateStr.split('-').map(Number);
                  setYear(y);
                  setMonth(m);
                  setDay(d);
                }}
              />
            </div>
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

          {/* 4. Live Export Preview Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Generated File Destination</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Rule 17 Compliant
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
                <span>PostgreSQL Live</span>
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
                Building XLSX...
              </>
            ) : exportComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-white" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download {reportType === 'daily' ? 'Daily Report' : '34-Sheet Report'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
