'use client';

import React, { useState } from 'react';
import { 
  CloudUpload, 
  CheckCircle2, 
  FileSpreadsheet, 
  X, 
  ShieldAlert,
  Layers,
  ArrowRight,
  TrendingUp,
  Package,
  Boxes,
  RotateCcw,
  Edit3,
  ChevronDown,
  ChevronUp,
  Check,
  Calendar
} from 'lucide-react';
import { ImportPreviewPayload } from '@/lib/excel/import';
import { DatePicker } from '@/components/common/DatePicker';
import { 
  calculateCigaretteSalesTotal, 
  calculateCigaretteStockTotal, 
  calculateZardaSalesValuation, 
  calculateZardaStockValuation 
} from '@/lib/calculations/engine';
import { DailyOperationalRecord } from '@/lib/types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
  defaultDate?: string;
}

export function ImportModal({ isOpen, onClose, companyId = 'ALL', defaultDate }: ImportModalProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    if (defaultDate) return defaultDate;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [pristineRecords, setPristineRecords] = useState<DailyOperationalRecord[] | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [brandViewMode, setBrandViewMode] = useState<'totals' | 'sales' | 'stock' | 'both'>('totals');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedTerritoryId, setExpandedTerritoryId] = useState<string | null>(null);
  const [modifiedTerritories, setModifiedTerritories] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const parseFile = async (currentFile: File, dateStr: string, sheetOverride?: string) => {
    setLoading(true);
    setImportSuccess(false);
    setModifiedTerritories(new Set());

    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      if (dateStr) {
        formData.append('applicationDate', dateStr);
      }
      if (sheetOverride) {
        formData.append('sheetName', sheetOverride);
      }
      if (companyId && companyId !== 'ALL') {
        formData.append('companyId', companyId);
      }

      const res = await fetch('/api/imports/xlsx', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setPreview(json.data);
        setPristineRecords(JSON.parse(JSON.stringify(json.data.records)));
        setActiveSheetName(json.data.matchedSheet.name);
        if (json.data.targetDate && json.data.targetDate !== selectedDate) {
          setSelectedDate(json.data.targetDate);
        }
      } else {
        alert(json.error || 'Failed to parse workbook');
      }
    } catch (err: any) {
      console.error('Import upload error:', err);
      alert(err.message || 'Error processing Excel file');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    await parseFile(selected, selectedDate);
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    if (file) {
      await parseFile(file, newDate);
    }
  };

  const handleSheetSwitch = async (sheetName: string) => {
    if (file && sheetName !== activeSheetName) {
      setActiveSheetName(sheetName);
      await parseFile(file, selectedDate, sheetName);
    }
  };

  /**
   * Updates an operational record and triggers live recalculations
   */
  const handleRecordChange = (
    index: number,
    section: 'sales' | 'stock' | 'zardaSales' | 'zardaStock' | 'emptyPackets' | 'remarks',
    field?: string,
    val?: any
  ) => {
    if (!preview) return;
    const newRecords = [...preview.records];
    const rec = { ...newRecords[index] };

    if (section === 'sales' && field) {
      rec.cigaretteSales = { ...rec.cigaretteSales, [field]: Math.max(0, Number(val) || 0) };
      rec.totalCigaretteSales = calculateCigaretteSalesTotal(rec.cigaretteSales);
    } else if (section === 'stock' && field) {
      rec.cigaretteStock = { ...rec.cigaretteStock, [field]: Math.max(0, Number(val) || 0) };
      rec.totalCigaretteStock = calculateCigaretteStockTotal(rec.cigaretteStock);
    } else if (section === 'zardaSales' && field) {
      rec.zardaSales = { ...rec.zardaSales, [field]: Math.max(0, Number(val) || 0) };
      rec.totalZardaSalesValue = calculateZardaSalesValuation(rec.zardaSales);
    } else if (section === 'zardaStock' && field) {
      rec.zardaStock = { ...rec.zardaStock, [field]: Math.max(0, Number(val) || 0) };
      rec.totalZardaStockValue = calculateZardaStockValuation(rec.zardaStock);
    } else if (section === 'emptyPackets') {
      rec.emptyPackets = Math.max(0, Math.round(Number(val) || 0));
    } else if (section === 'remarks') {
      rec.remarks = String(val || '');
    }

    newRecords[index] = rec;

    // Recalculate summary KPIs live
    let totalCigaretteSales = 0;
    let totalCigaretteStock = 0;
    let totalZardaSalesValue = 0;
    let totalZardaStockValue = 0;
    let totalEmptyPackets = 0;

    for (const r of newRecords) {
      totalCigaretteSales += r.totalCigaretteSales;
      totalCigaretteStock += r.totalCigaretteStock;
      totalZardaSalesValue += r.totalZardaSalesValue;
      totalZardaStockValue += r.totalZardaStockValue;
      totalEmptyPackets += r.emptyPackets;
    }

    setPreview({
      ...preview,
      records: newRecords,
      summary: {
        ...preview.summary,
        totalCigaretteSales: Number(totalCigaretteSales.toFixed(2)),
        totalCigaretteStock: Number(totalCigaretteStock.toFixed(2)),
        totalZardaSalesValue,
        totalZardaStockValue,
        totalEmptyPackets,
      },
    });

    setModifiedTerritories((prev) => new Set(prev).add(rec.territoryId));
  };

  /**
   * Resets all edited fields back to the pristine Excel import values
   */
  const handleResetToOriginal = () => {
    if (!preview || !pristineRecords) return;
    const cloned = JSON.parse(JSON.stringify(pristineRecords));
    let totalCigaretteSales = 0;
    let totalCigaretteStock = 0;
    let totalZardaSalesValue = 0;
    let totalZardaStockValue = 0;
    let totalEmptyPackets = 0;

    for (const r of cloned) {
      totalCigaretteSales += r.totalCigaretteSales;
      totalCigaretteStock += r.totalCigaretteStock;
      totalZardaSalesValue += r.totalZardaSalesValue;
      totalZardaStockValue += r.totalZardaStockValue;
      totalEmptyPackets += r.emptyPackets;
    }

    setPreview({
      ...preview,
      records: cloned,
      summary: {
        ...preview.summary,
        totalCigaretteSales: Number(totalCigaretteSales.toFixed(2)),
        totalCigaretteStock: Number(totalCigaretteStock.toFixed(2)),
        totalZardaSalesValue,
        totalZardaStockValue,
        totalEmptyPackets,
      },
    });
    setModifiedTerritories(new Set());
  };

  const handleCommit = async () => {
    if (!preview || !preview.records.length) return;
    setCommitting(true);
    try {
      const res = await fetch('/api/imports/xlsx/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: preview.records,
          fileName: file?.name || 'imported_file.xlsx',
          companyId: companyId !== 'ALL' ? companyId : undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setImportSuccess(true);
      } else {
        alert(json.error || 'Failed to commit import records');
      }
    } catch (err: any) {
      alert(err.message || 'Error committing import');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/80 p-2 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                XLSX Import, Tab Finder & Review Hub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pick reporting date, auto-match first tab or scan tabs, review raw fields, edit live, and insert
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload & Date Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-950/40 relative z-30">
            <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
              <Calendar className="h-4 w-4 text-blue-500" />
              1. Selected Reporting Date (Target Date)
            </label>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              System checks 1st tab date first; if different, it scans all sheets to find this target date.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-950/40 relative z-10">
            <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-1.5">
              <CloudUpload className="h-4 w-4 text-blue-500" />
              2. Upload Reporting Workbook (.xlsx)
            </label>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 cursor-pointer hover:border-blue-500 transition-colors">
              <CloudUpload className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">
                {file ? file.name : 'Select .xlsx file (1 tab, 4 tabs, or full 34 tabs)...'}
              </span>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Supports single-day files or multi-tab workbooks (e.g. 4 sheets, 34 sheets).
            </p>
          </div>
        </div>

        {loading && (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            <p>Inspecting 1st tab, matching reporting date across workbook, and re-evaluating calculations...</p>
          </div>
        )}

        {/* Tab Match Status Banner */}
        {preview && (
          <div className="space-y-4">
            {/* Matched Tab & Date Safety Card */}
            <div className={`rounded-xl border p-4 ${
              preview.dateVerification.isValid 
                ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60' 
                : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  {preview.dateVerification.isValid ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {preview.dateVerification.isValid 
                          ? 'Tab & Date Verification Passed' 
                          : 'IMPORT BLOCKED: Date Discrepancy Detected'}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                        Tab: &quot;{preview.matchedSheet.name}&quot;
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-sans font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {preview.matchedSheet.matchMethod === 'FIRST_TAB_MATCH' 
                          ? '✓ Matched First Tab' 
                          : '🔍 Found Tab Matching Date'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                      Target Date: <span className="font-mono font-semibold text-slate-900 dark:text-white">{preview.targetDate}</span>
                      {preview.matchedSheet.headerDateText && (
                        <span className="ml-2 font-mono text-slate-500">
                          (Header Cell B5: {preview.matchedSheet.headerDateText})
                        </span>
                      )}
                    </p>
                    {preview.dateVerification.conflicts.map((conflict, i) => (
                      <p key={i} className="text-[11px] text-rose-600 dark:text-rose-300 mt-1 font-medium">
                        ⚠️ {conflict}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Total Sheets Found</span>
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    {preview.totalSheetsFound} Sheets
                  </span>
                </div>
              </div>
            </div>

            {/* Workbook Available Tabs Bar (if multi-tab workbook) */}
            {preview.availableSheets && preview.availableSheets.length > 1 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-500" />
                    Available Tabs in Workbook:
                  </span>
                  <span className="text-[10px] text-slate-400">Click any tab to switch preview</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {preview.availableSheets.slice(0, 15).map((ws) => {
                    const isSelected = ws.name === activeSheetName;
                    return (
                      <button
                        key={ws.name}
                        onClick={() => handleSheetSwitch(ws.name)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-mono transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
                        }`}
                      >
                        Sheet {ws.name}
                        {ws.resolvedDate && (
                          <span className="text-[9px] opacity-75 ml-1">
                            ({ws.resolvedDate.slice(5)})
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {preview.availableSheets.length > 15 && (
                    <span className="text-[10px] text-slate-400 px-2 shrink-0">
                      +{preview.availableSheets.length - 15} more tabs
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Review Summary KPI Grid */}
            {preview.summary && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Executive Review Summary (Live Recalculated)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBrandViewMode(brandViewMode === 'totals' ? 'both' : 'totals')}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                    >
                      {brandViewMode === 'totals' ? 'Expand All Brand Columns' : 'Collapse to Totals'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <span className="text-[10px] text-slate-400 block">Territory Records</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {preview.summary.totalRecords}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      <span>{preview.summary.newRecordsCount} new</span>
                      {preview.summary.revisionRecordsCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          • {preview.summary.revisionRecordsCount} rev
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-500" /> Brand Wise Sales (BITCL)
                    </span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">
                      {preview.summary.totalCigaretteSales.toFixed(2)} <span className="text-[10px] font-normal">Mio</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Cigarette brands (BITCL)</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Boxes className="h-3 w-3 text-emerald-500" /> Brand Wise Closing Stock (BITCL)
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {preview.summary.totalCigaretteStock.toFixed(2)} <span className="text-[10px] font-normal">Mio</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Cigarette brands (BITCL)</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Package className="h-3 w-3 text-purple-500" /> Zarda Sales
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400 font-mono">
                      ৳ {preview.summary.totalZardaSalesValue.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Sales Valuation</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Package className="h-3 w-3 text-indigo-500" /> Zarda Stock
                    </span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                      ৳ {preview.summary.totalZardaStockValue.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Stock Valuation</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                    <span className="text-[10px] text-slate-400 block">Empty Packets</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                      {preview.summary.totalEmptyPackets.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Total packets</span>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Errors Table (Rule 28) */}
            {preview.errors && preview.errors.length > 0 && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Validation Errors ({preview.errors.length})</span>
                </div>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-mono border-b border-rose-200 dark:border-rose-900/40">
                      <tr>
                        <th className="py-1 px-2.5">Sheet</th>
                        <th className="py-1 px-2.5">Cell</th>
                        <th className="py-1 px-2.5">Field</th>
                        <th className="py-1 px-2.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 dark:divide-rose-900/20 text-slate-700 dark:text-slate-300">
                      {preview.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="py-1 px-2.5 font-mono font-semibold">{err.sheet}</td>
                          <td className="py-1 px-2.5 font-mono">{err.column}{err.row > 0 ? err.row : ''}</td>
                          <td className="py-1 px-2.5">{err.field}</td>
                          <td className="py-1 px-2.5 text-rose-600 dark:text-rose-400">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Records Review Table with Live Inline & Drawer Editing */}
            {preview.records.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm space-y-0">
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span>Records for Tab &quot;{preview.matchedSheet.name}&quot; ({preview.targetDate})</span>
                    {modifiedTerritories.size > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                        {modifiedTerritories.size} Edited
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Brand View Mode Selector */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('totals')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          brandViewMode === 'totals'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Totals Overview
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('stock')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          brandViewMode === 'stock'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                      >
                        Closing Stock (BITCL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('sales')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          brandViewMode === 'sales'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                        }`}
                      >
                        Sales (BITCL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('both')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                          brandViewMode === 'both'
                            ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        Both Brands & Stock
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsEditing(!isEditing)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        isEditing
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500'
                      }`}
                    >
                      {isEditing ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Done Editing</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-3.5 w-3.5 text-blue-500" />
                          <span>Edit Preview Data</span>
                        </>
                      )}
                    </button>

                    {modifiedTerritories.size > 0 && (
                      <button
                        type="button"
                        onClick={handleResetToOriginal}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                        title="Revert all modifications to original Excel import values"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset ({modifiedTerritories.size})</span>
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="px-3.5 py-2 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <Edit3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                      <strong>Edit Mode Active:</strong> You can edit Brand Wise Sales (BITCL), Brand Wise Closing Stock (BITCL), Zarda, empty packets, or remarks directly below. Totals recalculate live before inserting into the database.
                    </span>
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono bg-slate-50/50 dark:bg-slate-950/50 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Territory</th>
                        <th className="py-2 px-2 text-center">Status</th>

                        {brandViewMode === 'stock' && (
                          <>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">Wilson (Stk)</th>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">Shahara (Stk)</th>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">Express (Stk)</th>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">Nexus (Stk)</th>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">SB (Stk)</th>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">SM (Stk)</th>
                            <th className="py-2 px-2 text-right font-bold text-emerald-700 dark:text-emerald-300">Total Stock (Mio)</th>
                            <th className="py-2 px-2 text-right">Sales Total (Mio)</th>
                          </>
                        )}

                        {brandViewMode === 'sales' && (
                          <>
                            <th className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">Wilson</th>
                            <th className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">Shahara</th>
                            <th className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">Express</th>
                            <th className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">Nexus</th>
                            <th className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">SB</th>
                            <th className="py-2 px-2 text-right text-blue-600 dark:text-blue-400">SM</th>
                            <th className="py-2 px-2 text-right font-bold text-blue-700 dark:text-blue-300">Sales Total (Mio)</th>
                            <th className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">Stock Total (Mio)</th>
                          </>
                        )}

                        {brandViewMode === 'both' && (
                          <>
                            <th className="py-2 px-1 text-right text-blue-600 dark:text-blue-400">W (Sale)</th>
                            <th className="py-2 px-1 text-right text-blue-600 dark:text-blue-400">Sh (Sale)</th>
                            <th className="py-2 px-1 text-right text-blue-600 dark:text-blue-400">Ex (Sale)</th>
                            <th className="py-2 px-1 text-right text-blue-600 dark:text-blue-400">Nx (Sale)</th>
                            <th className="py-2 px-1 text-right text-blue-600 dark:text-blue-400">SB (Sale)</th>
                            <th className="py-2 px-1 text-right text-blue-600 dark:text-blue-400">SM (Sale)</th>
                            <th className="py-2 px-1 text-right font-semibold text-blue-700 dark:text-blue-300">Sales Mio</th>
                            <th className="py-2 px-1 text-right text-emerald-600 dark:text-emerald-400">W (Stk)</th>
                            <th className="py-2 px-1 text-right text-emerald-600 dark:text-emerald-400">Sh (Stk)</th>
                            <th className="py-2 px-1 text-right text-emerald-600 dark:text-emerald-400">Ex (Stk)</th>
                            <th className="py-2 px-1 text-right text-emerald-600 dark:text-emerald-400">Nx (Stk)</th>
                            <th className="py-2 px-1 text-right text-emerald-600 dark:text-emerald-400">SB (Stk)</th>
                            <th className="py-2 px-1 text-right text-emerald-600 dark:text-emerald-400">SM (Stk)</th>
                            <th className="py-2 px-1 text-right font-semibold text-emerald-700 dark:text-emerald-300">Stock Mio</th>
                          </>
                        )}

                        {brandViewMode === 'totals' && (
                          <>
                            <th className="py-2 px-3 text-right">Sales Total (BITCL)</th>
                            <th className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">Closing Stock (BITCL)</th>
                          </>
                        )}

                        <th className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">Zarda Sales</th>
                        <th className="py-2 px-3 text-right text-indigo-600 dark:text-indigo-400">Zarda Stock</th>
                        <th className="py-2 px-3 text-right">Empty Packets</th>
                        <th className="py-2 px-3">Remarks</th>
                        <th className="py-2 px-2 text-center">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300 font-mono">
                      {preview.records.map((r, idx) => {
                        const isRev = preview.duplicateTerritories?.includes(r.territoryId);
                        const isModified = modifiedTerritories.has(r.territoryId);
                        const isExpanded = expandedTerritoryId === r.territoryId;

                        return (
                          <React.Fragment key={r.territoryId}>
                            <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${isExpanded ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
                              <td className="py-2 px-3 font-sans font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setExpandedTerritoryId(isExpanded ? null : r.territoryId)}
                                  className="text-slate-400 hover:text-blue-600 cursor-pointer"
                                  title="Expand full brand & stock editor"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-blue-500" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                                <span>{r.territoryName}</span>
                              </td>

                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                {isModified ? (
                                  <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800/40">
                                    EDITED
                                  </span>
                                ) : isRev ? (
                                  <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40">
                                    UPDATE
                                  </span>
                                ) : (
                                  <span className="inline-block text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40">
                                    INSERT
                                  </span>
                                )}
                              </td>

                              {/* Stock Mode: Brand Wise Closing Stock (BITCL) Columns */}
                              {brandViewMode === 'stock' && (
                                <>
                                  {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                                    <td key={b} className="py-2 px-2 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={r.cigaretteStock[b]}
                                          onChange={(e) => handleRecordChange(idx, 'stock', b, e.target.value)}
                                          className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
                                        />
                                      ) : (
                                        <span className="text-emerald-700 dark:text-emerald-300">{r.cigaretteStock[b]}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 px-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                    {r.totalCigaretteStock.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                                    {r.totalCigaretteSales.toFixed(2)}
                                  </td>
                                </>
                              )}

                              {/* Sales Mode: Brand Wise Sales (BITCL) Columns */}
                              {brandViewMode === 'sales' && (
                                <>
                                  {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                                    <td key={b} className="py-2 px-2 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={r.cigaretteSales[b]}
                                          onChange={(e) => handleRecordChange(idx, 'sales', b, e.target.value)}
                                          className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                        />
                                      ) : (
                                        <span className="text-slate-900 dark:text-white">{r.cigaretteSales[b]}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 px-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                                    {r.totalCigaretteSales.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">
                                    {r.totalCigaretteStock.toFixed(2)}
                                  </td>
                                </>
                              )}

                              {/* Both Mode: All 6 Sales + All 6 Closing Stock Brands */}
                              {brandViewMode === 'both' && (
                                <>
                                  {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                                    <td key={`sale-${b}`} className="py-2 px-1 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={r.cigaretteSales[b]}
                                          onChange={(e) => handleRecordChange(idx, 'sales', b, e.target.value)}
                                          className="w-12 px-1 py-0.5 text-right font-mono text-[10px] rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                        />
                                      ) : (
                                        <span className="text-slate-900 dark:text-white">{r.cigaretteSales[b]}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 px-1 text-right font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                    {r.totalCigaretteSales.toFixed(2)}
                                  </td>

                                  {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                                    <td key={`stock-${b}`} className="py-2 px-1 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={r.cigaretteStock[b]}
                                          onChange={(e) => handleRecordChange(idx, 'stock', b, e.target.value)}
                                          className="w-12 px-1 py-0.5 text-right font-mono text-[10px] rounded border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
                                        />
                                      ) : (
                                        <span className="text-emerald-700 dark:text-emerald-300">{r.cigaretteStock[b]}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 px-1 text-right font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                                    {r.totalCigaretteStock.toFixed(2)}
                                  </td>
                                </>
                              )}

                              {/* Totals Mode */}
                              {brandViewMode === 'totals' && (
                                <>
                                  <td className="py-2 px-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                                    {r.totalCigaretteSales.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                    {r.totalCigaretteStock.toFixed(2)}
                                  </td>
                                </>
                              )}

                              <td className="py-2 px-3 text-right text-purple-600 dark:text-purple-400 font-semibold">
                                ৳ {r.totalZardaSalesValue.toLocaleString()}
                              </td>

                              <td className="py-2 px-3 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                                ৳ {r.totalZardaStockValue.toLocaleString()}
                              </td>

                              <td className="py-2 px-3 text-right">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={r.emptyPackets}
                                    onChange={(e) => handleRecordChange(idx, 'emptyPackets', undefined, e.target.value)}
                                    className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                  />
                                ) : (
                                  r.emptyPackets.toLocaleString()
                                )}
                              </td>

                              <td className="py-2 px-3 font-sans text-[10px] text-slate-500 truncate max-w-[120px]">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={r.remarks || ''}
                                    placeholder="Remarks..."
                                    onChange={(e) => handleRecordChange(idx, 'remarks', undefined, e.target.value)}
                                    className="w-24 px-1.5 py-0.5 font-sans text-xs rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                  />
                                ) : (
                                  r.remarks || '—'
                                )}
                              </td>

                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setExpandedTerritoryId(isExpanded ? null : r.territoryId)}
                                  className="text-xs px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 cursor-pointer"
                                >
                                  {isExpanded ? 'Hide' : 'Edit'}
                                </button>
                              </td>
                            </tr>

                            {/* Expandable Territory Detailed Editor Card */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={brandViewMode === 'both' ? 21 : (brandViewMode === 'sales' || brandViewMode === 'stock') ? 15 : 9} className="p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-4 space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                                          Detailed Editor: {r.territoryName} ({r.territoryId})
                                        </span>
                                        {isModified && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                            Modified
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-slate-400">
                                        Row changes update calculations automatically
                                      </span>
                                    </div>

                                    {/* 1. Brand Wise Sales (BITCL) (Million Sticks) */}
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                          <TrendingUp className="h-3.5 w-3.5" />
                                          Brand Wise Sales (BITCL) (Million Sticks)
                                        </span>
                                        <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                                          Total: {r.totalCigaretteSales.toFixed(2)} Mio
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                        {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                                          <div key={b} className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                                              {b}
                                            </label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={r.cigaretteSales[b]}
                                              onChange={(e) => handleRecordChange(idx, 'sales', b, e.target.value)}
                                              className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* 2. Brand Wise Closing Stock (BITCL) (Million Sticks) */}
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                          <Boxes className="h-3.5 w-3.5" />
                                          Brand Wise Closing Stock (BITCL) (Million Sticks)
                                        </span>
                                        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                          Total: {r.totalCigaretteStock.toFixed(2)} Mio
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                        {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                                          <div key={b} className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                                              {b}
                                            </label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={r.cigaretteStock[b]}
                                              onChange={(e) => handleRecordChange(idx, 'stock', b, e.target.value)}
                                              className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* 3. Zarda Sales Quantities & Valuation */}
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                                          <Package className="h-3.5 w-3.5" />
                                          Zarda Sales Quantities (Valuation: ৳ {r.totalZardaSalesValue.toLocaleString()})
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">SLB</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaSales.slb}
                                            onChange={(e) => handleRecordChange(idx, 'zardaSales', 'slb', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">22/25 (৳1,250)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaSales.qty_22_25}
                                            onChange={(e) => handleRecordChange(idx, 'zardaSales', 'qty_22_25', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">99/14 (৳700)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaSales.qty_99_14}
                                            onChange={(e) => handleRecordChange(idx, 'zardaSales', 'qty_99_14', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">33/15 (৳750)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaSales.qty_33_15}
                                            onChange={(e) => handleRecordChange(idx, 'zardaSales', 'qty_33_15', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* 4. Zarda Closing Stock Quantities & Valuation */}
                                    <div>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                                          <Package className="h-3.5 w-3.5" />
                                          Zarda Closing Stock Quantities (Valuation: ৳ {r.totalZardaStockValue.toLocaleString()})
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">SLB (Kg)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={r.zardaStock.slb}
                                            onChange={(e) => handleRecordChange(idx, 'zardaStock', 'slb', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">22/25 (৳1,250)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaStock.qty_22_25}
                                            onChange={(e) => handleRecordChange(idx, 'zardaStock', 'qty_22_25', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">99/14 (৳700)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaStock.qty_99_14}
                                            onChange={(e) => handleRecordChange(idx, 'zardaStock', 'qty_99_14', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">33/15 (৳750)</label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={r.zardaStock.qty_33_15}
                                            onChange={(e) => handleRecordChange(idx, 'zardaStock', 'qty_33_15', e.target.value)}
                                            className="w-full text-right font-mono text-xs p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* 5. Operational Fields */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                                      <div>
                                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Empty Packets</label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={r.emptyPackets}
                                          onChange={(e) => handleRecordChange(idx, 'emptyPackets', undefined, e.target.value)}
                                          className="w-full text-right font-mono text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Remarks</label>
                                        <input
                                          type="text"
                                          value={r.remarks || ''}
                                          placeholder="Enter operational remarks..."
                                          onChange={(e) => handleRecordChange(idx, 'remarks', undefined, e.target.value)}
                                          className="w-full font-sans text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {importSuccess && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold">Data Inserted Successfully!</p>
              <p className="text-[11px] mt-0.5 text-emerald-700 dark:text-emerald-400">
                All records have been saved into daily submissions and an audit log trail was recorded.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {preview && preview.records.length > 0 && !importSuccess && (
              <span>
                Ready to insert <strong className="text-slate-900 dark:text-white font-mono">{preview.records.length}</strong> territory records
                {modifiedTerritories.size > 0 && (
                  <span className="text-purple-600 dark:text-purple-400 font-semibold ml-1.5">
                    ({modifiedTerritories.size} edited by user)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {importSuccess ? 'Close' : 'Cancel'}
            </button>
            {preview?.isValid && !importSuccess && (
              <button
                onClick={handleCommit}
                disabled={committing}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {committing ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Inserting Data...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Insert Data ({preview.records.length} Records)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
