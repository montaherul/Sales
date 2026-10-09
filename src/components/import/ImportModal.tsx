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
  ChevronLeft,
  ChevronRight,
  Check,
  Calendar,
  Files,
  Plus,
  Trash2
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

export interface UploadedFileStatus {
  file: File;
  status: 'SUCCESS' | 'ERROR';
  matchedSheetName?: string;
  territoryCount?: number;
  totalSheetsFound?: number;
  error?: string;
  previewData?: ImportPreviewPayload;
}

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [pristineRecords, setPristineRecords] = useState<DailyOperationalRecord[] | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [brandViewMode, setBrandViewMode] = useState<'totals' | 'sales' | 'stock' | 'both' | 'zarda_sales' | 'zarda_stock'>('totals');
  const [isEditing, setIsEditing] = useState(false);
  const [expandedTerritoryId, setExpandedTerritoryId] = useState<string | null>(null);
  const [modifiedTerritories, setModifiedTerritories] = useState<Set<string>>(new Set());
  const [editingTerritoryIndex, setEditingTerritoryIndex] = useState<number | null>(null);
  const [activeTabSection, setActiveTabSection] = useState<'all' | 'sales' | 'stock' | 'zarda' | 'remarks'>('sales');

  if (!isOpen) return null;

  const parseFilesParallel = async (filesToParse: File[], dateStr: string) => {
    if (!filesToParse || filesToParse.length === 0) {
      setUploadedFiles([]);
      setPreview(null);
      setPristineRecords(null);
      return;
    }

    setLoading(true);
    setImportSuccess(false);
    setModifiedTerritories(new Set());

    try {
      // 1. Execute parallel upload & validation for all files
      const fileResults: UploadedFileStatus[] = await Promise.all(
        filesToParse.map(async (f) => {
          const formData = new FormData();
          formData.append('file', f);
          if (dateStr) {
            formData.append('applicationDate', dateStr);
          }
          if (companyId && companyId !== 'ALL') {
            formData.append('companyId', companyId);
          }

          try {
            const res = await fetch('/api/imports/xlsx', {
              method: 'POST',
              body: formData,
            });
            const json = await res.json();
            if (json.success && json.data) {
              return {
                file: f,
                status: 'SUCCESS' as const,
                matchedSheetName: json.data.matchedSheet?.name || 'N/A',
                territoryCount: json.data.records?.length || 0,
                totalSheetsFound: json.data.totalSheetsFound || 0,
                previewData: json.data as ImportPreviewPayload,
              };
            } else {
              return {
                file: f,
                status: 'ERROR' as const,
                error: json.error || 'Failed to parse workbook',
              };
            }
          } catch (err: any) {
            return {
              file: f,
              status: 'ERROR' as const,
              error: err.message || 'Network error processing file',
            };
          }
        })
      );

      setUploadedFiles(fileResults);

      const successfulFiles = fileResults.filter(
        (r) => r.status === 'SUCCESS' && r.previewData
      ) as Array<{
        file: File;
        status: 'SUCCESS';
        matchedSheetName: string;
        territoryCount: number;
        totalSheetsFound: number;
        previewData: ImportPreviewPayload;
      }>;

      if (successfulFiles.length === 0) {
        setPreview(null);
        setPristineRecords(null);
        return;
      }

      // 2. Consolidate data across all files for the selected date
      const territoryMap = new Map<string, {
        record: DailyOperationalRecord & { sourceFiles?: string[] };
        sources: string[];
      }>();

      for (const item of successfulFiles) {
        const payload = item.previewData;
        for (const rec of payload.records) {
          const key = (rec.territoryId || rec.territoryName || '').trim();
          if (!key) continue;

          if (!territoryMap.has(key)) {
            const copy: any = JSON.parse(JSON.stringify(rec));
            copy.sourceFiles = [item.file.name];
            territoryMap.set(key, {
              record: copy,
              sources: [item.file.name],
            });
          } else {
            const entry = territoryMap.get(key)!;
            if (!entry.sources.includes(item.file.name)) {
              entry.sources.push(item.file.name);
            }
            const r = entry.record as any;
            r.sourceFiles = entry.sources;

            // Merge Cigarette Sales
            for (const b of ['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const) {
              const val1 = Number(r.cigaretteSales?.[b]) || 0;
              const val2 = Number(rec.cigaretteSales?.[b]) || 0;
              r.cigaretteSales[b] = Number((val1 + val2).toFixed(4));
            }
            r.totalCigaretteSales = calculateCigaretteSalesTotal(r.cigaretteSales);

            // Merge Cigarette Stock
            for (const b of ['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const) {
              const val1 = Number(r.cigaretteStock?.[b]) || 0;
              const val2 = Number(rec.cigaretteStock?.[b]) || 0;
              r.cigaretteStock[b] = Number((val1 + val2).toFixed(4));
            }
            r.totalCigaretteStock = calculateCigaretteStockTotal(r.cigaretteStock);

            // Merge Zarda Sales
            for (const b of ['slb', 'qty_22_25', 'qty_99_14', 'qty_33_15'] as const) {
              const val1 = Number(r.zardaSales?.[b]) || 0;
              const val2 = Number(rec.zardaSales?.[b]) || 0;
              r.zardaSales[b] = val1 + val2;
            }
            r.totalZardaSalesValue = calculateZardaSalesValuation(r.zardaSales);

            // Merge Zarda Stock
            for (const b of ['slb', 'qty_22_25', 'qty_99_14', 'qty_33_15'] as const) {
              const val1 = Number(r.zardaStock?.[b]) || 0;
              const val2 = Number(rec.zardaStock?.[b]) || 0;
              r.zardaStock[b] = val1 + val2;
            }
            r.totalZardaStockValue = calculateZardaStockValuation(r.zardaStock);

            // Merge Empty Packets
            r.emptyPackets = (Number(r.emptyPackets) || 0) + (Number(rec.emptyPackets) || 0);

            // Merge Remarks
            if (rec.remarks && rec.remarks.trim()) {
              if (r.remarks && r.remarks.trim()) {
                r.remarks = `${r.remarks} | [${item.file.name}]: ${rec.remarks.trim()}`;
              } else {
                r.remarks = `[${item.file.name}]: ${rec.remarks.trim()}`;
              }
            }
          }
        }
      }

      const combinedRecords = Array.from(territoryMap.values()).map((v) => v.record);

      // Recalculate combined totals
      let totalCigaretteSales = 0;
      let totalCigaretteStock = 0;
      let totalZardaSalesValue = 0;
      let totalZardaStockValue = 0;
      let totalEmptyPackets = 0;

      for (const r of combinedRecords) {
        totalCigaretteSales += r.totalCigaretteSales;
        totalCigaretteStock += r.totalCigaretteStock;
        totalZardaSalesValue += r.totalZardaSalesValue;
        totalZardaStockValue += r.totalZardaStockValue;
        totalEmptyPackets += r.emptyPackets;
      }

      const allErrors = successfulFiles.flatMap((s) => s.previewData.errors || []);
      const allWarnings = successfulFiles.flatMap((s) => s.previewData.warnings || []);
      const totalSheetsSum = successfulFiles.reduce(
        (acc, s) => acc + (s.previewData.totalSheetsFound || 0),
        0
      );

      const combinedPreview: ImportPreviewPayload = {
        isValid: allErrors.length === 0,
        targetDate: dateStr,
        matchedSheet: {
          name:
            successfulFiles.length === 1
              ? successfulFiles[0].previewData.matchedSheet.name
              : `${successfulFiles.length} Workbooks Combined`,
          index: 0,
          matchMethod: 'SEARCHED_TAB_MATCH',
          headerDateText: dateStr,
          resolvedDate: dateStr,
        },
        availableSheets: successfulFiles[0]?.previewData.availableSheets || [],
        summary: {
          totalRecords: combinedRecords.length,
          newRecordsCount: combinedRecords.length,
          revisionRecordsCount: 0,
          totalCigaretteSales: Number(totalCigaretteSales.toFixed(2)),
          totalCigaretteStock: Number(totalCigaretteStock.toFixed(2)),
          totalZardaSalesValue,
          totalZardaStockValue,
          totalEmptyPackets,
        },
        dateVerification: {
          isValid: true,
          resolvedDate: dateStr,
          conflicts: [],
          warnings: allWarnings,
        },
        totalSheetsFound: totalSheetsSum,
        totalValidRecords: combinedRecords.length,
        duplicateTerritories: [],
        records: combinedRecords,
        errors: allErrors,
        warnings: allWarnings,
      };

      setPreview(combinedPreview);
      setPristineRecords(JSON.parse(JSON.stringify(combinedRecords)));
      setActiveSheetName(combinedPreview.matchedSheet.name);
    } catch (err: any) {
      console.error('Parallel multi-file import error:', err);
      alert(err.message || 'Error processing Excel files in parallel');
    } finally {
      setLoading(false);
    }
  };

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    const incoming = Array.from(selected);

    // Merge with existing files by name
    const existingNames = new Set(uploadedFiles.map((u) => u.file.name));
    const newFiles = incoming.filter((f) => !existingNames.has(f.name));
    const combinedFileList = [...uploadedFiles.map((u) => u.file), ...newFiles];

    await parseFilesParallel(combinedFileList, selectedDate);
    e.target.value = '';
  };

  const handleRemoveFile = async (fileNameToRemove: string) => {
    const remainingFiles = uploadedFiles
      .map((u) => u.file)
      .filter((f) => f.name !== fileNameToRemove);
    await parseFilesParallel(remainingFiles, selectedDate);
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    if (uploadedFiles.length > 0) {
      await parseFilesParallel(uploadedFiles.map((u) => u.file), newDate);
    }
  };

  const handleSheetSwitch = async (sheetName: string) => {
    if (uploadedFiles.length === 1 && sheetName !== activeSheetName) {
      setActiveSheetName(sheetName);
      const currentFile = uploadedFiles[0].file;
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('applicationDate', selectedDate);
        formData.append('sheetName', sheetName);
        if (companyId && companyId !== 'ALL') formData.append('companyId', companyId);
        const res = await fetch('/api/imports/xlsx', { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success && json.data) {
          setPreview(json.data);
          setPristineRecords(JSON.parse(JSON.stringify(json.data.records)));
        }
      } catch (err: any) {
        console.error('Sheet switch error:', err);
      } finally {
        setLoading(false);
      }
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

  /**
   * Reverts a single territory record back to its original Excel imported values
   */
  const handleResetSingleTerritory = (index: number) => {
    if (!preview || !pristineRecords || !pristineRecords[index]) return;
    const original = JSON.parse(JSON.stringify(pristineRecords[index]));
    const updatedRecords = [...preview.records];
    updatedRecords[index] = original;

    let totalCigaretteSales = 0;
    let totalCigaretteStock = 0;
    let totalZardaSalesValue = 0;
    let totalZardaStockValue = 0;
    let totalEmptyPackets = 0;

    for (const r of updatedRecords) {
      totalCigaretteSales += r.totalCigaretteSales;
      totalCigaretteStock += r.totalCigaretteStock;
      totalZardaSalesValue += r.totalZardaSalesValue;
      totalZardaStockValue += r.totalZardaStockValue;
      totalEmptyPackets += r.emptyPackets;
    }

    setPreview({
      ...preview,
      records: updatedRecords,
      summary: {
        ...preview.summary,
        totalCigaretteSales: Number(totalCigaretteSales.toFixed(2)),
        totalCigaretteStock: Number(totalCigaretteStock.toFixed(2)),
        totalZardaSalesValue,
        totalZardaStockValue,
        totalEmptyPackets,
      },
    });

    setModifiedTerritories((prev) => {
      const next = new Set(prev);
      next.delete(original.territoryId);
      return next;
    });
  };

  const handleCommit = async () => {
    if (!preview || !preview.records.length) return;
    setCommitting(true);
    try {
      const fileNames = uploadedFiles.map((u) => u.file.name).join(', ') || 'multi_import_consolidated.xlsx';
      const res = await fetch('/api/imports/xlsx/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: preview.records,
          fileName: fileNames,
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
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl space-y-5 max-h-[92vh] min-h-[420px] sm:min-h-[480px] overflow-y-auto">
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
            <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between gap-1.5 mb-1.5">
              <span className="flex items-center gap-1.5">
                <CloudUpload className="h-4 w-4 text-blue-500" />
                2. Parallel Multi-File Upload (.xlsx)
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                Multi-File Parallel
              </span>
            </label>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 cursor-pointer hover:border-blue-500 transition-colors">
              <CloudUpload className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">
                {uploadedFiles.length > 0
                  ? `${uploadedFiles.length} file(s) loaded — Click to select or add more...`
                  : 'Select 1, 4, 5+ .xlsx workbooks (with 34 tabs each)...'}
              </span>
              <input
                type="file"
                accept=".xlsx"
                multiple
                onChange={handleFilesSelect}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Upload multiple workbooks simultaneously. All files are checked by date and merged into one unified preview.
            </p>
          </div>
        </div>

        {/* Uploaded Workbooks List Tray */}
        {uploadedFiles.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Files className="h-4 w-4 text-indigo-500" />
                <span>Uploaded Workbooks ({uploadedFiles.length})</span>
                <span className="text-[10px] font-mono font-normal text-slate-500">
                  • Target Date: {selectedDate}
                </span>
              </span>
              <label className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer flex items-center gap-1">
                <Plus className="h-3 w-3" />
                <span>Add More Files</span>
                <input
                  type="file"
                  accept=".xlsx"
                  multiple
                  onChange={handleFilesSelect}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {uploadedFiles.map((uf, idx) => (
                <div
                  key={uf.file.name + idx}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                    uf.status === 'SUCCESS'
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <FileSpreadsheet className={`h-4 w-4 shrink-0 ${uf.status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate" title={uf.file.name}>
                        {uf.file.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                        {(uf.file.size / 1024).toFixed(1)} KB •{' '}
                        {uf.status === 'SUCCESS' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Tab &quot;{uf.matchedSheetName}&quot; ({uf.territoryCount} terr)
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">{uf.error || 'Failed'}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(uf.file.name)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                    title="Remove this file from import"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            <p>Scanning all workbook tabs in parallel, matching reporting date, and merging data into combined preview...</p>
          </div>
        )}

        {/* Tab Match Status Banner */}
        {preview && (
          <div className="space-y-4">
            {/* Matched Tab & Date Safety Card */}
            <div className={`rounded-xl border p-4 ${preview.dateVerification.isValid
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
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-mono transition-all shrink-0 cursor-pointer ${isSelected
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
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${brandViewMode === 'totals'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        Totals Overview
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('stock')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${brandViewMode === 'stock'
                            ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                          }`}
                      >
                        Closing Stock (BITCL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('sales')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${brandViewMode === 'sales'
                            ? 'bg-blue-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
                          }`}
                      >
                        Sales (BITCL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('both')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${brandViewMode === 'both'
                            ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                      >
                        Both Brands & Stock
                      </button>
                      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('zarda_sales')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${brandViewMode === 'zarda_sales'
                            ? 'bg-purple-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
                          }`}
                      >
                        Zarda Sales
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandViewMode('zarda_stock')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-all ${brandViewMode === 'zarda_stock'
                            ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                      >
                        Zarda Stock
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingTerritoryIndex(0);
                        setActiveTabSection('sales');
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
                      title="Open full-screen responsive popup with comfortable mobile spacing"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Full Popup Editor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditing(!isEditing)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium hidden sm:flex items-center gap-1.5 transition-all cursor-pointer ${isEditing
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500'
                        }`}
                      title="Toggle direct inline table cell editing"
                    >
                      {isEditing ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Done Inline Edit</span>
                        </>
                      ) : (
                        <>
                          <span>Inline Table Edit</span>
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
                  <div className="px-3.5 py-2 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-800 dark:text-blue-300 hidden sm:flex items-center gap-2">
                    <Edit3 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>
                      <strong>Inline Edit Active:</strong> You can edit Brand Wise Sales (BITCL), Brand Wise Closing Stock (BITCL), Zarda, empty packets, or remarks directly below. Totals recalculate live before inserting into the database.
                    </span>
                  </div>
                )}

                {/* Mobile Responsive Cards View (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60 max-h-96 overflow-y-auto">
                  {preview.records.map((r, idx) => {
                    const isRev = preview.duplicateTerritories?.includes(r.territoryId);
                    const isModified = modifiedTerritories.has(r.territoryId);

                    return (
                      <div key={r.territoryId} className="p-3.5 space-y-3 bg-white dark:bg-slate-900">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {r.territoryName}
                              </span>
                              {isModified ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  EDITED
                                </span>
                              ) : isRev ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  UPDATE
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  INSERT
                                </span>
                              )}
                            </div>
                            {(r as any).sourceFiles && (r as any).sourceFiles.length > 1 && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">
                                {(r as any).sourceFiles.length} files merged
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTerritoryIndex(idx);
                              setActiveTabSection('sales');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* 4-Grid Key Metrics */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Sales Total</span>
                            <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">
                              {r.totalCigaretteSales.toFixed(2)} <span className="text-[10px] font-normal">Mio</span>
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Closing Stock</span>
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                              {r.totalCigaretteStock.toFixed(2)} <span className="text-[10px] font-normal">Mio</span>
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Zarda Sales</span>
                            <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-xs">
                              ৳ {r.totalZardaSalesValue.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Zarda Stock</span>
                            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 text-xs">
                              ৳ {r.totalZardaStockValue.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {r.remarks && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            Note: {r.remarks}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingTerritoryIndex(idx);
                            setActiveTabSection('sales');
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Open Full Popup Editor for {r.territoryName}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Comprehensive Tabular Matrix */}
                <div className="hidden md:block max-h-72 overflow-y-auto">
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

                        {brandViewMode === 'zarda_sales' && (
                          <>
                            <th className="py-2 px-2 text-right text-purple-600 dark:text-purple-400">SLB (Sale)</th>
                            <th className="py-2 px-2 text-right text-purple-600 dark:text-purple-400">22/25 (Sale)</th>
                            <th className="py-2 px-2 text-right text-purple-600 dark:text-purple-400">99/14 (Sale)</th>
                            <th className="py-2 px-2 text-right text-purple-600 dark:text-purple-400">33/15 (Sale)</th>
                            <th className="py-2 px-2 text-right font-bold text-purple-700 dark:text-purple-300">Zarda Sales (৳)</th>
                          </>
                        )}

                        {brandViewMode === 'zarda_stock' && (
                          <>
                            <th className="py-2 px-2 text-right text-indigo-600 dark:text-indigo-400">SLB (Stk)</th>
                            <th className="py-2 px-2 text-right text-indigo-600 dark:text-indigo-400">22/25 (Stk)</th>
                            <th className="py-2 px-2 text-right text-indigo-600 dark:text-indigo-400">99/14 (Stk)</th>
                            <th className="py-2 px-2 text-right text-indigo-600 dark:text-indigo-400">33/15 (Stk)</th>
                            <th className="py-2 px-2 text-right font-bold text-indigo-700 dark:text-indigo-300">Zarda Stock (৳)</th>
                          </>
                        )}

                        {brandViewMode !== 'zarda_sales' && (
                          <th className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">Zarda Sales</th>
                        )}
                        {brandViewMode !== 'zarda_stock' && (
                          <th className="py-2 px-3 text-right text-indigo-600 dark:text-indigo-400">Zarda Stock</th>
                        )}
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
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{r.territoryName}</span>
                                    {(r as any).sourceFiles && (r as any).sourceFiles.length > 1 && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        {(r as any).sourceFiles.length} files merged
                                      </span>
                                    )}
                                  </div>
                                  {(r as any).sourceFiles && (
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block truncate max-w-[200px]" title={(r as any).sourceFiles.join(', ')}>
                                      {(r as any).sourceFiles.join(', ')}
                                    </span>
                                  )}
                                </div>
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

                              {/* Zarda Sales Mode */}
                              {brandViewMode === 'zarda_sales' && (
                                <>
                                  {(['slb', 'qty_22_25', 'qty_99_14', 'qty_33_15'] as const).map((b) => (
                                    <td key={`zsale-${b}`} className="py-2 px-2 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step={b === 'slb' ? '0.01' : '1'}
                                          min="0"
                                          value={r.zardaSales[b]}
                                          onChange={(e) => handleRecordChange(idx, 'zardaSales', b, e.target.value)}
                                          className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500 text-slate-900 dark:text-white"
                                        />
                                      ) : (
                                        <span className="text-slate-900 dark:text-white">{r.zardaSales[b]}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 px-2 text-right font-semibold text-purple-600 dark:text-purple-400">
                                    ৳ {r.totalZardaSalesValue.toLocaleString()}
                                  </td>
                                </>
                              )}

                              {/* Zarda Stock Mode */}
                              {brandViewMode === 'zarda_stock' && (
                                <>
                                  {(['slb', 'qty_22_25', 'qty_99_14', 'qty_33_15'] as const).map((b) => (
                                    <td key={`zstock-${b}`} className="py-2 px-2 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          step={b === 'slb' ? '0.01' : '1'}
                                          min="0"
                                          value={r.zardaStock[b]}
                                          onChange={(e) => handleRecordChange(idx, 'zardaStock', b, e.target.value)}
                                          className="w-16 px-1.5 py-0.5 text-right font-mono text-xs rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                        />
                                      ) : (
                                        <span className="text-slate-900 dark:text-white">{r.zardaStock[b]}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 px-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                    ৳ {r.totalZardaStockValue.toLocaleString()}
                                  </td>
                                </>
                              )}

                              {brandViewMode !== 'zarda_sales' && (
                                <td className="py-2 px-3 text-right text-purple-600 dark:text-purple-400 font-semibold">
                                  ৳ {r.totalZardaSalesValue.toLocaleString()}
                                </td>
                              )}

                              {brandViewMode !== 'zarda_stock' && (
                                <td className="py-2 px-3 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                                  ৳ {r.totalZardaStockValue.toLocaleString()}
                                </td>
                              )}

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

                              <td className="py-2 px-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTerritoryIndex(idx);
                                      setActiveTabSection('sales');
                                    }}
                                    className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold cursor-pointer flex items-center gap-1 shadow-xs"
                                    title="Open full popup editor with comfortable mobile & desktop spacing"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTerritoryId(isExpanded ? null : r.territoryId)}
                                    className="text-xs p-1 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                                    title="Toggle inline details"
                                  >
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                </div>
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

        {/* Full Popup Editor Modal Dialog (Mobile-First Ergonomics & Desktop Luxury) */}
        {editingTerritoryIndex !== null && preview && preview.records[editingTerritoryIndex] && (() => {
          const r = preview.records[editingTerritoryIndex];
          const idx = editingTerritoryIndex;
          const isModified = modifiedTerritories.has(r.territoryId);
          const totalCount = preview.records.length;

          return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
              <div className="relative w-full max-w-3xl max-h-[94vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                {/* Modal Sticky Header */}
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-between shrink-0 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
                      <Edit3 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {r.territoryName}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Territory {idx + 1} of {totalCount}
                        </span>
                        {isModified ? (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Edited
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Original Excel
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        Date: <span className="font-semibold text-slate-700 dark:text-slate-300">{preview.targetDate}</span> • Tab &quot;{preview.matchedSheet.name}&quot;
                        {(r as any).sourceFiles && (r as any).sourceFiles.length > 1 && (
                          <span className="ml-1.5 text-blue-600 dark:text-blue-400 font-mono">
                            ({(r as any).sourceFiles.length} files merged)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Quick Prev / Next Pagination in Header */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => setEditingTerritoryIndex(idx - 1)}
                        className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Previous Territory"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-[10px] font-mono font-semibold px-1.5 text-slate-600 dark:text-slate-400">
                        {idx + 1}/{totalCount}
                      </span>
                      <button
                        type="button"
                        disabled={idx === totalCount - 1}
                        onClick={() => setEditingTerritoryIndex(idx + 1)}
                        className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Next Territory"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingTerritoryIndex(null)}
                      className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Close Popup Editor"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Section Navigation Tabs for Quick Mobile Ergonomics */}
                <div className="flex items-center gap-1 px-3 sm:px-6 py-2 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setActiveTabSection('sales')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTabSection === 'sales'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Sales ({r.totalCigaretteSales.toFixed(2)} Mio)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabSection('stock')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTabSection === 'stock'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Boxes className="h-3.5 w-3.5" />
                    <span>Stock ({r.totalCigaretteStock.toFixed(2)} Mio)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabSection('zarda')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTabSection === 'zarda'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>Zarda (৳ {(r.totalZardaSalesValue + r.totalZardaStockValue).toLocaleString()})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabSection('remarks')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTabSection === 'remarks'
                        ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>Packets & Notes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabSection('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTabSection === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>All Sections</span>
                  </button>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                  {/* Section 1: Cigarette Brand Wise Sales (BITCL) */}
                  {(activeTabSection === 'sales' || activeTabSection === 'all') && (
                    <div className="space-y-3 bg-blue-50/30 dark:bg-blue-950/20 p-3.5 sm:p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-blue-200/60 dark:border-blue-900/60">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            1. Brand Wise Sales (BITCL)
                          </h4>
                          <span className="text-[10px] text-slate-500 font-normal">Million Sticks</span>
                        </div>
                        <div className="px-3 py-1 rounded-xl bg-blue-100 dark:bg-blue-900/70 text-blue-800 dark:text-blue-200 font-mono font-bold text-xs sm:text-sm">
                          Total: {r.totalCigaretteSales.toFixed(2)} Mio
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'wilson', label: 'Wilson' },
                          { key: 'shahara', label: 'Shahara' },
                          { key: 'express', label: 'Express' },
                          { key: 'nexus', label: 'Nexus' },
                          { key: 'sb', label: 'Special Blend (SB)' },
                          { key: 'sm', label: 'SM' },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                {label}
                              </label>
                              <span className="text-[10px] text-slate-400">Mio</span>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.cigaretteSales[key as keyof typeof r.cigaretteSales]}
                              onChange={(e) => handleRecordChange(idx, 'sales', key, e.target.value)}
                              className="w-full text-right font-mono font-bold text-sm sm:text-base h-11 sm:h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 2: Cigarette Brand Wise Closing Stock (BITCL) */}
                  {(activeTabSection === 'stock' || activeTabSection === 'all') && (
                    <div className="space-y-3 bg-emerald-50/30 dark:bg-emerald-950/20 p-3.5 sm:p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-200/60 dark:border-emerald-900/60">
                        <div className="flex items-center gap-2">
                          <Boxes className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            2. Brand Wise Closing Stock (BITCL)
                          </h4>
                          <span className="text-[10px] text-slate-500 font-normal">Million Sticks</span>
                        </div>
                        <div className="px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 font-mono font-bold text-xs sm:text-sm">
                          Total: {r.totalCigaretteStock.toFixed(2)} Mio
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { key: 'wilson', label: 'Wilson' },
                          { key: 'shahara', label: 'Shahara' },
                          { key: 'express', label: 'Express' },
                          { key: 'nexus', label: 'Nexus' },
                          { key: 'sb', label: 'Special Blend (SB)' },
                          { key: 'sm', label: 'SM' },
                        ].map(({ key, label }) => (
                          <div key={key} className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                {label}
                              </label>
                              <span className="text-[10px] text-slate-400">Mio</span>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={r.cigaretteStock[key as keyof typeof r.cigaretteStock]}
                              onChange={(e) => handleRecordChange(idx, 'stock', key, e.target.value)}
                              className="w-full text-right font-mono font-bold text-sm sm:text-base h-11 sm:h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 3: Zarda Sales & Closing Stock */}
                  {(activeTabSection === 'zarda' || activeTabSection === 'all') && (
                    <div className="space-y-4">
                      {/* Zarda Sales */}
                      <div className="space-y-3 bg-purple-50/30 dark:bg-purple-950/20 p-3.5 sm:p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-purple-200/60 dark:border-purple-900/60">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              3. Zarda Sales Quantities & Valuation
                            </h4>
                          </div>
                          <div className="px-3 py-1 rounded-xl bg-purple-100 dark:bg-purple-900/70 text-purple-800 dark:text-purple-200 font-mono font-bold text-xs sm:text-sm">
                            Valuation: ৳ {r.totalZardaSalesValue.toLocaleString()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { key: 'slb', label: 'SLB (Loose)', unit: 'Kg', step: '0.01' },
                            { key: 'qty_22_25', label: '22/25', unit: '৳1,250/can', step: '1' },
                            { key: 'qty_99_14', label: '99/14', unit: '৳700/can', step: '1' },
                            { key: 'qty_33_15', label: '33/15', unit: '৳750/can', step: '1' },
                          ].map(({ key, label, unit, step }) => (
                            <div key={key} className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  {label}
                                </label>
                                <span className="text-[10px] text-slate-400">{unit}</span>
                              </div>
                              <input
                                type="number"
                                step={step}
                                min="0"
                                value={r.zardaSales[key as keyof typeof r.zardaSales]}
                                onChange={(e) => handleRecordChange(idx, 'zardaSales', key, e.target.value)}
                                className="w-full text-right font-mono font-bold text-sm sm:text-base h-11 sm:h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Zarda Closing Stock */}
                      <div className="space-y-3 bg-indigo-50/30 dark:bg-indigo-950/20 p-3.5 sm:p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-indigo-200/60 dark:border-indigo-900/60">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              4. Zarda Closing Stock Quantities & Valuation
                            </h4>
                          </div>
                          <div className="px-3 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 font-mono font-bold text-xs sm:text-sm">
                            Valuation: ৳ {r.totalZardaStockValue.toLocaleString()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { key: 'slb', label: 'SLB (Loose)', unit: 'Kg', step: '0.01' },
                            { key: 'qty_22_25', label: '22/25', unit: '৳1,250/can', step: '1' },
                            { key: 'qty_99_14', label: '99/14', unit: '৳700/can', step: '1' },
                            { key: 'qty_33_15', label: '33/15', unit: '৳750/can', step: '1' },
                          ].map(({ key, label, unit, step }) => (
                            <div key={key} className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                  {label}
                                </label>
                                <span className="text-[10px] text-slate-400">{unit}</span>
                              </div>
                              <input
                                type="number"
                                step={step}
                                min="0"
                                value={r.zardaStock[key as keyof typeof r.zardaStock]}
                                onChange={(e) => handleRecordChange(idx, 'zardaStock', key, e.target.value)}
                                className="w-full text-right font-mono font-bold text-sm sm:text-base h-11 sm:h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 4: Operational Fields (Empty Packets & Remarks) */}
                  {(activeTabSection === 'remarks' || activeTabSection === 'all') && (
                    <div className="space-y-4 bg-slate-50/60 dark:bg-slate-950/40 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
                        5. Empty Packets & Operational Remarks
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Empty Packets Count
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={r.emptyPackets}
                            onChange={(e) => handleRecordChange(idx, 'emptyPackets', undefined, e.target.value)}
                            className="w-full text-right font-mono font-bold text-sm sm:text-base h-11 sm:h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                          />
                          <p className="text-[10px] text-slate-400">Total physical cigarette packs collected</p>
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Operational Remarks
                          </label>
                          <textarea
                            rows={2}
                            value={r.remarks || ''}
                            placeholder="Enter notes, distribution remarks, or supervisor comments..."
                            onChange={(e) => handleRecordChange(idx, 'remarks', undefined, e.target.value)}
                            className="w-full p-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Sticky Footer */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    {isModified && (
                      <button
                        type="button"
                        onClick={() => handleResetSingleTerritory(idx)}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Revert this territory to original imported values"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset Territory</span>
                      </button>
                    )}
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      Changes update summary totals in real-time
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditingTerritoryIndex(idx - 1)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Prev</span>
                      </button>
                    )}

                    {idx < totalCount - 1 && (
                      <button
                        type="button"
                        onClick={() => setEditingTerritoryIndex(idx + 1)}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingTerritoryIndex(null)}
                      className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>Apply & Close</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
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
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-center"
            >
              {importSuccess ? 'Close' : 'Cancel'}
            </button>
            {preview?.isValid && !importSuccess && (
              <button
                onClick={handleCommit}
                disabled={committing}
                className="flex-1 sm:flex-initial rounded-lg bg-blue-600 px-5 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 text-center"
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
