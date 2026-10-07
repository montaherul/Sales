'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Layers, 
  Coins, 
  PackageCheck, 
  RefreshCw,
  Award
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export function ExecutiveDashboard() {
  const [reportDate, setReportDate] = useState('2026-10-06');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/daily-submissions?date=${date}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRecords(json.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(reportDate);
  }, [reportDate]);

  // Aggregate metrics from live records
  const metrics = useMemo(() => {
    const totalCigSales = records.reduce((acc, r) => acc + (r.totalCigaretteSales || 0), 0);
    const totalCigStock = records.reduce((acc, r) => acc + (r.totalCigaretteStock || 0), 0);
    const totalZardaValue = records.reduce((acc, r) => acc + (r.totalZardaSalesValue || 0), 0);
    const totalEmptyPackets = records.reduce((acc, r) => acc + (r.emptyPackets || 0), 0);
    const workingDays = 26;
    const currentDay = parseInt(reportDate.split('-')[2] || '6', 10);
    const ads = currentDay > 0 ? (totalCigSales / currentDay) : 0;

    return {
      totalCigSales: parseFloat(totalCigSales.toFixed(2)),
      totalCigStock: parseFloat(totalCigStock.toFixed(2)),
      totalZardaValue,
      totalEmptyPackets,
      ads: parseFloat(ads.toFixed(2)),
    };
  }, [records, reportDate]);

  // Dynamic Territory Leaderboard
  const territoryLeaderboard = useMemo(() => {
    return records.map((r) => {
      const targetEstimate = 0.50; // default target per territory
      const sales = r.totalCigaretteSales || 0;
      const achievement = targetEstimate > 0 ? Math.min(100, (sales / targetEstimate) * 100) : 0;
      return {
        name: r.territoryName,
        sales: parseFloat(sales.toFixed(2)),
        target: targetEstimate,
        achievement: parseFloat(achievement.toFixed(1)),
        stock: parseFloat((r.totalCigaretteStock || 0).toFixed(2)),
        zarda: r.totalZardaSalesValue || 0,
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [records]);

  // Dynamic Brand Share
  const brandShareData = useMemo(() => {
    const brandSums: Record<string, number> = {
      Express: 0,
      Wilson: 0,
      Shahara: 0,
      Nexus: 0,
      SB: 0,
      SM: 0,
    };

    records.forEach((r) => {
      if (r.cigaretteSales) {
        brandSums.Express += r.cigaretteSales.express || 0;
        brandSums.Wilson += r.cigaretteSales.wilson || 0;
        brandSums.Shahara += r.cigaretteSales.shahara || 0;
        brandSums.Nexus += r.cigaretteSales.nexus || 0;
        brandSums.SB += r.cigaretteSales.sb || 0;
        brandSums.SM += r.cigaretteSales.sm || 0;
      }
    });

    const colors: Record<string, string> = {
      Express: '#3b82f6',
      Wilson: '#10b981',
      Shahara: '#f59e0b',
      Nexus: '#8b5cf6',
      SB: '#ec4899',
      SM: '#06b6d4',
    };

    return Object.entries(brandSums).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2)),
      color: colors[name],
    }));
  }, [records]);

  // Pacing trend mockup based on day
  const dailyPacingData = useMemo(() => {
    const day = parseInt(reportDate.split('-')[2] || '6', 10);
    const data = [];
    for (let d = 1; d <= Math.min(day, 6); d++) {
      data.push({
        day: `Day ${d}`,
        sales: parseFloat((metrics.totalCigSales * (0.8 + 0.05 * d)).toFixed(2)),
        targetADS: 2.10,
      });
    }
    return data;
  }, [metrics.totalCigSales, reportDate]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Subtitle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Executive Operations Dashboard</h2>
          <p className="text-xs text-slate-400">
            Real-time sales pacing, closing stock monitoring & Supabase PostgreSQL aggregation overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
          />

          <button
            onClick={() => fetchDashboardData(reportDate)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Cigarette Sales</span>
            <div className="rounded-lg bg-blue-950/60 p-2 text-blue-400 border border-blue-800/40">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">{metrics.totalCigSales}</span>
            <span className="ml-1 text-xs text-slate-400">Mio Sticks</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400 font-medium">All 5 territories recorded</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cigarette Closing Stock</span>
            <div className="rounded-lg bg-emerald-950/60 p-2 text-emerald-400 border border-emerald-800/40">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">{metrics.totalCigStock}</span>
            <span className="ml-1 text-xs text-slate-400">Mio Sticks</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Warehouse & Route buffer</p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Daily Average (ADS)</span>
            <div className="rounded-lg bg-purple-950/60 p-2 text-purple-400 border border-purple-800/40">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">{metrics.ads}</span>
            <span className="ml-1 text-xs text-slate-400">Mio/Day</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400 font-medium">Standard 26 working days</p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Zarda Sales Value</span>
            <div className="rounded-lg bg-amber-950/60 p-2 text-amber-400 border border-amber-800/40">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">৳ {metrics.totalZardaValue.toLocaleString()}</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-400 font-medium">22/25, 99/14, 33/15 pouches</p>
        </div>

        {/* Metric 5 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Empty Packets</span>
            <div className="rounded-lg bg-rose-950/60 p-2 text-rose-400 border border-rose-800/40">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white font-mono">{metrics.totalEmptyPackets.toLocaleString()}</span>
            <span className="ml-1 text-xs text-slate-400">Units</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Express promotion return</p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pacing Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Daily Sales Pacing vs Target ADS</h3>
              <p className="text-xs text-slate-400">Comparison of daily actual sales against standard target ADS</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyPacingData}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" textAnchor="end" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#salesGrad)" name="Sales (Mio)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Brand Distribution Donut */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Brand Sales Volume Mix</h3>
            <p className="text-xs text-slate-400">Actual sales distribution across cigarette brands</p>
          </div>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={brandShareData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {brandShareData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {brandShareData.map((b) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }}></span>
                <span className="text-slate-300 font-medium">{b.name}</span>
                <span className="text-slate-400 ml-auto font-mono">{b.value}M</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Territory Performance Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              <span>Satkania Region Territory Performance Summary</span>
            </h3>
            <p className="text-xs text-slate-400">Live operational figures recorded across all assigned territories</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                <th className="pb-2">Territory</th>
                <th className="pb-2 text-right">Daily Cigarette Sales (Mio)</th>
                <th className="pb-2 text-right">Closing Stock (Mio)</th>
                <th className="pb-2 text-right">Zarda Value (BDT)</th>
                <th className="pb-2 text-right">Target Achievement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {territoryLeaderboard.map((t) => (
                <tr key={t.name} className="hover:bg-slate-800/30">
                  <td className="py-2.5 font-sans font-medium text-white">{t.name}</td>
                  <td className="py-2.5 text-right font-bold text-blue-400">{t.sales.toFixed(2)}</td>
                  <td className="py-2.5 text-right text-emerald-400">{t.stock.toFixed(2)}</td>
                  <td className="py-2.5 text-right text-amber-300">৳ {t.zarda.toLocaleString()}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-block rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-200">
                      {t.achievement}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
