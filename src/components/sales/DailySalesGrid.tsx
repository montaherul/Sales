'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  AlertCircle
} from 'lucide-react';

interface TerritoryItem {
  id: string;
  name: string;
  region_name: string;
  sort_order: number;
}

interface DailySalesGridProps {
  onSaveDraft?: (record: any) => void;
  onSubmitForReview?: (record: any) => void;
}

export function DailySalesGrid({ onSaveDraft, onSubmitForReview }: DailySalesGridProps) {
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string>('');
  const [selectedTerritoryName, setSelectedTerritoryName] = useState<string>('Kerani hat');
  const [reportDate, setReportDate] = useState('2026-10-06');
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<SubmissionStatus | 'NEW'>('NEW');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // 1. Load Master Territories
  useEffect(() => {
    async function loadMasterData() {
      try {
        const res = await fetch('/api/master-data');
        const json = await res.json();
        if (json.success && json.data.territories?.length > 0) {
          setTerritories(json.data.territories);
          setSelectedTerritoryId(json.data.territories[0].id);
          setSelectedTerritoryName(json.data.territories[0].name);
        }
      } catch (err) {
        console.error('Failed to load master territories:', err);
      }
    }
    loadMasterData();
  }, []);

  // 2. Fetch Submission for Selected Territory & Date
  const fetchSubmission = useCallback(async (terrId: string, terrName: string, date: string) => {
    if (!terrId && !terrName) return;
    setIsLoading(true);
    setSubmittedStatus(null);
    try {
      const res = await fetch(`/api/daily-submissions?date=${date}&territoryId=${terrId}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const rec = json.data[0];
        setSales(rec.cigaretteSales || { wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 });
        setStock(rec.cigaretteStock || { wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 });
        setZardaSales(rec.zardaSales || { slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 });
        setZardaStock(rec.zardaStock || { slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 });
        setEmptyPackets(rec.emptyPackets || 0);
        setRemarks(rec.remarks || '');
        setCurrentStatus(rec.status || 'DRAFT');
      } else {
        // Reset to empty fields if no submission exists yet
        setSales({ wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 });
        setStock({ wilson: 0, shahara: 0, express: 0, nexus: 0, sb: 0, sm: 0 });
        setZardaSales({ slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 });
        setZardaStock({ slb: 0, qty_22_25: 0, qty_99_14: 0, qty_33_15: 0 });
        setEmptyPackets(0);
        setRemarks('');
        setCurrentStatus('NEW');
      }
    } catch (err) {
      console.error('Failed to fetch submission:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTerritoryId || selectedTerritoryName) {
      fetchSubmission(selectedTerritoryId, selectedTerritoryName, reportDate);
    }
  }, [selectedTerritoryId, selectedTerritoryName, reportDate, fetchSubmission]);

  // Real-time calculations via centralized engine
  const totalSales = useMemo(() => calculateCigaretteSalesTotal(sales), [sales]);
  const totalStock = useMemo(() => calculateCigaretteStockTotal(stock), [stock]);
  const totalZardaSales = useMemo(() => calculateZardaSalesValuation(zardaSales), [zardaSales]);
  const totalZardaStock = useMemo(() => calculateZardaStockValuation(zardaStock), [zardaStock]);

  const isReadOnly = currentStatus === 'FINALIZED';

  const handleTerritoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const terr = territories.find(t => t.id === e.target.value);
    if (terr) {
      setSelectedTerritoryId(terr.id);
      setSelectedTerritoryName(terr.name);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const record = {
        territoryId: selectedTerritoryId,
        territoryName: selectedTerritoryName,
        regionName: 'Satkania',
        reportDate,
        dayNumber: parseInt(reportDate.split('-')[2] || '6', 10),
        status: 'DRAFT',
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
        setSubmittedStatus('Draft saved to Supabase PostgreSQL database.');
      } else {
        alert(json.error || 'Failed to save draft');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving draft');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const record = {
        territoryId: selectedTerritoryId,
        territoryName: selectedTerritoryName,
        regionName: 'Satkania',
        reportDate,
        dayNumber: parseInt(reportDate.split('-')[2] || '6', 10),
        status: 'SUBMITTED',
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

      // 1. Save submission
      await fetch('/api/daily-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, userId: 'csr.keranihat@afaztobacco.com' }),
      });

      // 2. Transition workflow state
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: selectedTerritoryId,
          reportDate,
          toStatus: 'SUBMITTED',
          userId: 'csr.keranihat@afaztobacco.com',
          comments: 'Submitted by CSR for TSO review',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setCurrentStatus('SUBMITTED');
        setSubmittedStatus('Successfully submitted to Territory Sales Officer (TSO) for review.');
      } else {
        alert(json.error || 'Failed to submit for review');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting for review');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = () => {
    switch (currentStatus) {
      case 'FINALIZED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20"><Lock className="h-3 w-3" /> Finalized & Locked</span>;
      case 'RSO_APPROVED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20"><CheckCircle2 className="h-3 w-3" /> RSO Approved</span>;
      case 'TSO_APPROVED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20"><CheckCircle2 className="h-3 w-3" /> TSO Approved</span>;
      case 'SUBMITTED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20"><AlertCircle className="h-3 w-3" /> Submitted (In Review)</span>;
      case 'DRAFT':
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-400 border border-slate-500/20">Draft (Unsubmitted)</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-400 border border-purple-500/20">New Entry</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Territory</label>
            <select
              value={selectedTerritoryId}
              onChange={handleTerritoryChange}
              disabled={isLoading}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
            >
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (SL {t.sort_order})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Report Date</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              disabled={isLoading}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Workflow Status</label>
            <div>{getStatusBadge()}</div>
          </div>
        </div>

        {/* Live Calculation Preview Pills */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-950/60 border border-blue-800/40 px-3 py-1.5 text-right">
            <span className="text-[10px] text-blue-300 font-medium block">Total Cigarette Sales</span>
            <span className="text-sm font-bold text-white font-mono">{totalSales.toFixed(2)} Mio</span>
          </div>
          <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 text-right">
            <span className="text-[10px] text-emerald-300 font-medium block">Total Closing Stock</span>
            <span className="text-sm font-bold text-white font-mono">{totalStock.toFixed(2)} Mio</span>
          </div>
        </div>
      </div>

      {submittedStatus && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{submittedStatus}</span>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-950/60 border border-amber-800/60 px-4 py-2.5 text-xs text-amber-300">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <span>This record is <strong>FINALIZED</strong>. Direct field editing is locked. Super Admin can unlock this submission with mandatory audit justification.</span>
        </div>
      )}

      {/* 1. Cigarette Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Brand Wise Cigarette Sales & Closing Stock</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">BITCL Brands (Mio)</span>
            </h3>
            <p className="text-xs text-slate-400">Values in Millions of sticks. Totals computed by centralized formula engine.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-2 w-32">Metric</th>
                <th className="pb-2 text-right">Wilson</th>
                <th className="pb-2 text-right">Shahara</th>
                <th className="pb-2 text-right">Express</th>
                <th className="pb-2 text-right">Nexus</th>
                <th className="pb-2 text-right">SB</th>
                <th className="pb-2 text-right">SM</th>
                <th className="pb-2 text-right text-blue-400 bg-blue-950/30 px-3 rounded-t">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {/* Daily Sales Row */}
              <tr>
                <td className="py-2.5 font-medium text-slate-300">Daily Sales (Mio)</td>
                {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((brand) => (
                  <td key={brand} className="py-2.5 text-right pl-2">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly || isLoading}
                      value={sales[brand] === 0 ? '' : sales[brand]}
                      placeholder="0.00"
                      onChange={(e) => setSales({ ...sales, [brand]: parseFloat(e.target.value) || 0 })}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-blue-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </td>
                ))}
                <td className="py-2.5 text-right font-mono font-bold text-blue-400 bg-blue-950/30 px-3">
                  {totalSales.toFixed(2)}
                </td>
              </tr>

              {/* Closing Stock Row */}
              <tr>
                <td className="py-2.5 font-medium text-slate-300">Closing Stock (Mio)</td>
                {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((brand) => (
                  <td key={brand} className="py-2.5 text-right pl-2">
                    <input
                      type="number"
                      step="0.01"
                      disabled={isReadOnly || isLoading}
                      value={stock[brand] === 0 ? '' : stock[brand]}
                      placeholder="0.00"
                      onChange={(e) => setStock({ ...stock, [brand]: parseFloat(e.target.value) || 0 })}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-emerald-500 focus:outline-none font-mono disabled:opacity-50"
                    />
                  </td>
                ))}
                <td className="py-2.5 text-right font-mono font-bold text-emerald-400 bg-emerald-950/30 px-3">
                  {totalStock.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Zarda Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Brand Wise Zarda Sales & Closing Stock</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">Standard Packets & Pouches</span>
            </h3>
            <p className="text-xs text-slate-400">Formula Value: 22/25 × 15 BDT + 99/14 × 6 BDT + 33/15 × 8 BDT</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Zarda Sales */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-slate-300">Zarda Sales Quantities</span>
              <span className="text-xs font-bold text-amber-400 font-mono">Value: {totalZardaSales.toLocaleString()} BDT</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">SLB (Qty)</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={isReadOnly || isLoading}
                  value={zardaSales.slb === 0 ? '' : zardaSales.slb}
                  placeholder="0.00"
                  onChange={(e) => setZardaSales({ ...zardaSales, slb: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">22/25 (@15 Tk)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={zardaSales.qty_22_25 === 0 ? '' : zardaSales.qty_22_25}
                  placeholder="0"
                  onChange={(e) => setZardaSales({ ...zardaSales, qty_22_25: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">99/14 (@6 Tk)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={zardaSales.qty_99_14 === 0 ? '' : zardaSales.qty_99_14}
                  placeholder="0"
                  onChange={(e) => setZardaSales({ ...zardaSales, qty_99_14: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">33/15 (@8 Tk)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={zardaSales.qty_33_15 === 0 ? '' : zardaSales.qty_33_15}
                  placeholder="0"
                  onChange={(e) => setZardaSales({ ...zardaSales, qty_33_15: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Zarda Closing Stock */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-slate-300">Zarda Closing Stock</span>
              <span className="text-xs font-bold text-amber-400 font-mono">Value: {totalZardaStock.toLocaleString()} BDT</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">SLB (Qty)</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={isReadOnly || isLoading}
                  value={zardaStock.slb === 0 ? '' : zardaStock.slb}
                  placeholder="0.00"
                  onChange={(e) => setZardaStock({ ...zardaStock, slb: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">22/25 (@15 Tk)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={zardaStock.qty_22_25 === 0 ? '' : zardaStock.qty_22_25}
                  placeholder="0"
                  onChange={(e) => setZardaStock({ ...zardaStock, qty_22_25: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">99/14 (@6 Tk)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={zardaStock.qty_99_14 === 0 ? '' : zardaStock.qty_99_14}
                  placeholder="0"
                  onChange={(e) => setZardaStock({ ...zardaStock, qty_99_14: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">33/15 (@8 Tk)</label>
                <input
                  type="number"
                  disabled={isReadOnly || isLoading}
                  value={zardaStock.qty_33_15 === 0 ? '' : zardaStock.qty_33_15}
                  placeholder="0"
                  onChange={(e) => setZardaStock({ ...zardaStock, qty_33_15: parseInt(e.target.value, 10) || 0 })}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right text-xs text-white focus:border-amber-500 focus:outline-none font-mono disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Empty Packets & Remarks */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
          Operational Returns & Route Remarks
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Express Empty Packet Return (Count)</label>
            <input
              type="number"
              disabled={isReadOnly || isLoading}
              value={emptyPackets === 0 ? '' : emptyPackets}
              placeholder="0"
              onChange={(e) => setEmptyPackets(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono disabled:opacity-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-400 block mb-1">Route & Field Remarks</label>
            <input
              type="text"
              disabled={isReadOnly || isLoading}
              value={remarks}
              placeholder="Operational remarks, route coverage notes..."
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleSaveDraft}
          disabled={isReadOnly || isSaving || isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
        </button>

        <button
          onClick={handleSubmit}
          disabled={isReadOnly || isSaving || isLoading}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          <span>Submit for TSO Review</span>
        </button>
      </div>
    </div>
  );
}
