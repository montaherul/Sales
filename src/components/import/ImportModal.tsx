'use client';

import React, { useState } from 'react';
import { 
  CloudUpload, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  X, 
  ShieldAlert 
} from 'lucide-react';
import { ImportPreviewPayload } from '@/lib/excel/import';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [selectedDate, setSelectedDate] = useState('2026-10-06');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewPayload | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setLoading(true);
    setPreview(null);
    setImportSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', selected);
      formData.append('applicationDate', selectedDate);

      const res = await fetch('/api/imports/xlsx', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setPreview(json.data);
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

  const handleCommit = async () => {
    if (!preview || !preview.records.length) return;
    try {
      const res = await fetch('/api/imports/xlsx/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: preview.records,
          fileName: file?.name || 'imported_file.xlsx',
          userId: 'admin-import-user',
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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/80 p-2 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">XLSX Import & Pre-flight Validator</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enforcing zero-tolerance date safety and 34-sheet integrity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-900 dark:text-white block mb-1">
              Application Selected Reporting Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Must match filename date and sheet number</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-900 dark:text-white block mb-1">Upload Reporting Workbook</label>
            <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 px-4 py-2 cursor-pointer hover:border-blue-500 transition-colors">
              <CloudUpload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate font-medium">
                {file ? file.name : 'Select .xlsx file...'}
              </span>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {loading && (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mb-2"></div>
            <p>Validating 34-sheet structure and verifying cross-source dates...</p>
          </div>
        )}

        {/* Validation Results Display */}
        {preview && (
          <div className="space-y-4">
            {/* Date Match Status Card */}
            <div className={`rounded-xl border p-4 ${
              preview.dateVerification.isValid 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60' 
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
            }`}>
              <div className="flex items-start gap-3">
                {preview.dateVerification.isValid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {preview.dateVerification.isValid 
                      ? 'Date Verification Passed' 
                      : 'IMPORT BLOCKED: Date Discrepancy Detected'}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Target Date: <span className="font-mono font-semibold">{preview.dateVerification.resolvedDate}</span>
                  </p>
                  {preview.dateVerification.conflicts.map((conflict, i) => (
                    <p key={i} className="text-[11px] text-rose-600 dark:text-rose-300 mt-1 font-medium">
                      ⚠️ {conflict}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Structure Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Worksheet Count</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {preview.totalSheetsFound} / 34 Sheets
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Extracted Valid Rows</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {preview.totalValidRecords} Records
                </span>
              </div>
            </div>

            {/* Records Preview */}
            {preview.records.length > 0 && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 overflow-hidden shadow-sm">
                <div className="px-3 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Extracted Raw Inputs (Satkania Region)
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-mono bg-slate-50 dark:bg-slate-950">
                      <tr>
                        <th className="py-1.5 px-3">Territory</th>
                        <th className="py-1.5 px-3 text-right">Sales Total</th>
                        <th className="py-1.5 px-3 text-right">Stock Total</th>
                        <th className="py-1.5 px-3 text-right">Zarda (BDT)</th>
                        <th className="py-1.5 px-3 text-right">Empty Packets</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300 font-mono">
                      {preview.records.map((r) => (
                        <tr key={r.territoryId} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/20">
                          <td className="py-1.5 px-3 font-sans font-medium text-slate-900 dark:text-white">{r.territoryName}</td>
                          <td className="py-1.5 px-3 text-right">{r.totalCigaretteSales.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{r.totalCigaretteStock.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right">৳ {r.totalZardaSalesValue}</td>
                          <td className="py-1.5 px-3 text-right">{r.emptyPackets.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {importSuccess && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 p-4 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Import committed successfully inside database transaction. Audit log entry recorded.</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Close
          </button>
          {preview?.isValid && !importSuccess && (
            <button
              onClick={handleCommit}
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Confirm & Commit Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
