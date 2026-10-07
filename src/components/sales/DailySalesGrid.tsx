'use client';

import React, { useState, useMemo } from 'react';
import { 
  CigaretteBrandSales, 
  CigaretteBrandStock, 
  ZardaSalesQty, 
  ZardaStockQty 
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
  Info 
} from 'lucide-react';

interface DailySalesGridProps {
  onSaveDraft?: (record: any) => void;
  onSubmitForReview?: (record: any) => void;
}

export function DailySalesGrid({ onSaveDraft, onSubmitForReview }: DailySalesGridProps) {
  const [selectedTerritory, setSelectedTerritory] = useState('Kerani hat');
  const [reportDate, setReportDate] = useState('2026-10-06');
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  // Cigarette Sales State
  const [sales, setSales] = useState<CigaretteBrandSales>({
    wilson: 0.00,
    shahara: 0.00,
    express: 0.68,
    nexus: 0.00,
    sb: 0.00,
    sm: 0.00,
  });

  // Cigarette Stock State
  const [stock, setStock] = useState<CigaretteBrandStock>({
    wilson: 0.19,
    shahara: 0.00,
    express: 0.84,
    nexus: 0.00,
    sb: 0.00,
    sm: 0.00,
  });

  // Zarda Sales State
  const [zardaSales, setZardaSales] = useState<ZardaSalesQty>({
    slb: 0.01,
    qty_22_25: 5,
    qty_99_14: 0,
    qty_33_15: 0,
  });

  // Zarda Stock State
  const [zardaStock, setZardaStock] = useState<ZardaStockQty>({
    slb: 0.97,
    qty_22_25: 1298,
    qty_99_14: 0,
    qty_33_15: 0,
  });

  const [emptyPackets, setEmptyPackets] = useState<number>(6660);
  const [remarks, setRemarks] = useState<string>('Standard field operational day');

  // Real-time calculations via centralized engine
  const totalSales = useMemo(() => calculateCigaretteSalesTotal(sales), [sales]);
  const totalStock = useMemo(() => calculateCigaretteStockTotal(stock), [stock]);
  const totalZardaSales = useMemo(() => calculateZardaSalesValuation(zardaSales), [zardaSales]);
  const totalZardaStock = useMemo(() => calculateZardaStockValuation(zardaStock), [zardaStock]);

  const territoryMapping: Record<string, string> = {
    'Kerani hat': 'satkania-1',
    'Satkania': 'satkania-2',
    'Bandarban': 'satkania-3',
    'Rajasthali': 'satkania-4',
    'Dohazari': 'satkania-5',
  };

  const handleSaveDraft = async () => {
    try {
      const terrId = territoryMapping[selectedTerritory] || 'satkania-1';
      const record = {
        territoryId: terrId,
        territoryName: selectedTerritory,
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
        body: JSON.stringify({ record, userId: 'csr-field-id' }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmittedStatus('Draft saved and persisted successfully.');
      } else {
        alert(json.error || 'Failed to save draft');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving draft');
    }
  };

  const handleSubmit = async () => {
    try {
      const terrId = territoryMapping[selectedTerritory] || 'satkania-1';
      const record = {
        territoryId: terrId,
        territoryName: selectedTerritory,
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

      // Save submission first
      await fetch('/api/daily-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record, userId: 'csr-field-id' }),
      });

      // Transition to SUBMITTED
      const res = await fetch('/api/daily-submissions/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: terrId,
          reportDate,
          toStatus: 'SUBMITTED',
          userId: 'csr-field-id',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSubmittedStatus('Submitted to Territory Sales Officer (TSO) for review.');
      } else {
        alert(json.error || 'Failed to submit for review');
      }
    } catch (err: any) {
      alert(err.message || 'Error submitting for review');
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
              value={selectedTerritory}
              onChange={(e) => setSelectedTerritory(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="Kerani hat">Kerani hat (SL 1)</option>
              <option value="Satkania">Satkania (SL 2)</option>
              <option value="Bandarban">Bandarban (SL 3)</option>
              <option value="Rajasthali">Rajasthali (SL 4)</option>
              <option value="Dohazari">Dohazari (SL 5)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Report Date</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Region Scope</label>
            <span className="inline-flex items-center rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300">
              Satkania Region (Division: Ctg South)
            </span>
          </div>
        </div>

        {/* Live Calculation Preview Pills */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-950/60 border border-blue-800/40 px-3 py-1.5 text-right">
            <span className="text-[10px] text-blue-300 font-medium block">Total Sales</span>
            <span className="text-sm font-bold text-white font-mono">{totalSales.toFixed(2)} Mio</span>
          </div>
          <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 text-right">
            <span className="text-[10px] text-emerald-300 font-medium block">Total Stock</span>
            <span className="text-sm font-bold text-white font-mono">{totalStock.toFixed(2)} Mio</span>
          </div>
        </div>
      </div>

      {submittedStatus && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{submittedStatus}</span>
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
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {/* Sales Row */}
              <tr>
                <td className="py-2.5 font-sans font-medium text-slate-300">Daily Sales</td>
                {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                  <td key={b} className="py-2 px-1 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={sales[b]}
                      onChange={(e) => setSales({ ...sales, [b]: parseFloat(e.target.value) || 0 })}
                      className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-bold text-white bg-blue-950/30">
                  {totalSales.toFixed(2)}
                </td>
              </tr>

              {/* Closing Stock Row */}
              <tr>
                <td className="py-2.5 font-sans font-medium text-slate-300">Closing Stock</td>
                {(['wilson', 'shahara', 'express', 'nexus', 'sb', 'sm'] as const).map((b) => (
                  <td key={b} className="py-2 px-1 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={stock[b]}
                      onChange={(e) => setStock({ ...stock, [b]: parseFloat(e.target.value) || 0 })}
                      className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-bold text-emerald-400 bg-blue-950/30">
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
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-300">Prices: 22/25=15৳, 99/14=6৳, 33/15=8৳</span>
            </h3>
            <p className="text-xs text-slate-400">Quantities in units. Valuations calculated automatically in BDT.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-2 w-32">Metric</th>
                <th className="pb-2 text-right">SLB (Kg)</th>
                <th className="pb-2 text-right">22/25 (Qty)</th>
                <th className="pb-2 text-right">99/14 (Qty)</th>
                <th className="pb-2 text-right">33/15 (Qty)</th>
                <th className="pb-2 text-right text-emerald-400 bg-emerald-950/30 px-3 rounded-t">Total Valuation (BDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {/* Zarda Sales Row */}
              <tr>
                <td className="py-2.5 font-sans font-medium text-slate-300">Zarda Sales</td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={zardaSales.slb}
                    onChange={(e) => setZardaSales({ ...zardaSales, slb: parseFloat(e.target.value) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    value={zardaSales.qty_22_25}
                    onChange={(e) => setZardaSales({ ...zardaSales, qty_22_25: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    value={zardaSales.qty_99_14}
                    onChange={(e) => setZardaSales({ ...zardaSales, qty_99_14: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    value={zardaSales.qty_33_15}
                    onChange={(e) => setZardaSales({ ...zardaSales, qty_33_15: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-bold text-white bg-emerald-950/30">
                  ৳ {totalZardaSales.toLocaleString()}
                </td>
              </tr>

              {/* Zarda Stock Row */}
              <tr>
                <td className="py-2.5 font-sans font-medium text-slate-300">Closing Stock</td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={zardaStock.slb}
                    onChange={(e) => setZardaStock({ ...zardaStock, slb: parseFloat(e.target.value) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    value={zardaStock.qty_22_25}
                    onChange={(e) => setZardaStock({ ...zardaStock, qty_22_25: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    value={zardaStock.qty_99_14}
                    onChange={(e) => setZardaStock({ ...zardaStock, qty_99_14: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-1 text-right">
                  <input
                    type="number"
                    value={zardaStock.qty_33_15}
                    onChange={(e) => setZardaStock({ ...zardaStock, qty_33_15: parseInt(e.target.value, 10) || 0 })}
                    className="w-20 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-right text-xs text-white"
                  />
                </td>
                <td className="py-2 px-3 text-right font-bold text-emerald-400 bg-emerald-950/30">
                  ৳ {totalZardaStock.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Empty Packets & Remarks */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-xs font-semibold text-white block mb-1">Express Empty Packets Recovered</label>
          <p className="text-[11px] text-slate-400 mb-2">Count of returned packets collected from retail accounts.</p>
          <input
            type="number"
            value={emptyPackets}
            onChange={(e) => setEmptyPackets(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white font-mono"
          />
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <label className="text-xs font-semibold text-white block mb-1">Operational Remarks</label>
          <p className="text-[11px] text-slate-400 mb-2">Field observations, market conditions, or weather notes.</p>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
            placeholder="Enter route observations..."
          />
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleSaveDraft}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <Save className="h-4 w-4" />
          <span>Save Draft</span>
        </button>

        <button
          onClick={handleSubmit}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
        >
          <Send className="h-4 w-4" />
          <span>Submit for TSO Review</span>
        </button>
      </div>
    </div>
  );
}
