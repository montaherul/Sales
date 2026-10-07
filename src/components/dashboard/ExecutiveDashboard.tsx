'use client';

import React from 'react';
import { 
  TrendingUp, 
  Target, 
  Layers, 
  Coins, 
  PackageCheck, 
  AlertCircle 
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

const dailyPacingData = [
  { day: 'Day 1', sales: 2.20, targetADS: 2.10 },
  { day: 'Day 2', sales: 2.15, targetADS: 2.10 },
  { day: 'Day 3', sales: 2.35, targetADS: 2.10 },
  { day: 'Day 4', sales: 2.05, targetADS: 2.10 },
  { day: 'Day 5', sales: 2.40, targetADS: 2.10 },
  { day: 'Day 6', sales: 2.25, targetADS: 2.10 },
];

const territoryLeaderboard = [
  { name: 'Kerani hat', sales: 0.68, target: 0.75, achievement: 90.7 },
  { name: 'Dohazari', sales: 0.62, target: 0.65, achievement: 95.4 },
  { name: 'Bandarban', sales: 0.42, target: 0.50, achievement: 84.0 },
  { name: 'Satkania', sales: 0.42, target: 0.48, achievement: 87.5 },
  { name: 'Rajasthali', sales: 0.06, target: 0.10, achievement: 60.0 },
];

const brandShareData = [
  { name: 'Express', value: 2.19, color: '#3b82f6' },
  { name: 'Wilson', value: 0.01, color: '#10b981' },
  { name: 'Shahara', value: 0.00, color: '#f59e0b' },
  { name: 'Nexus', value: 0.00, color: '#8b5cf6' },
  { name: 'SB', value: 0.00, color: '#ec4899' },
  { name: 'SM', value: 0.00, color: '#06b6d4' },
];

export function ExecutiveDashboard() {
  return (
    <div className="space-y-6">
      {/* Top Welcome & Subtitle */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Executive Operations Dashboard</h2>
          <p className="text-xs text-slate-400">
            Real-time sales pacing, closing stock monitoring & 34-sheet aggregation overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Reporting Period: October 2026
          </span>
        </div>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Metric 1 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">MTD Total Volume</span>
            <div className="rounded-lg bg-blue-950/60 p-2 text-blue-400 border border-blue-800/40">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white">2.20</span>
            <span className="ml-1 text-xs text-slate-400">Mio Sticks</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400 font-medium">+4.8% vs. Last Month</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Target Achievement</span>
            <div className="rounded-lg bg-amber-950/60 p-2 text-amber-400 border border-amber-800/40">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white">88.7%</span>
            <span className="ml-1 text-xs text-slate-400">of quota</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Req. ADS: 0.08 Mio/day</p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Daily Average (ADS)</span>
            <div className="rounded-lg bg-purple-950/60 p-2 text-purple-400 border border-purple-800/40">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white">0.37</span>
            <span className="ml-1 text-xs text-slate-400">Mio/Day</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400 font-medium">On track for 26 days</p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Zarda Sales Value</span>
            <div className="rounded-lg bg-emerald-950/60 p-2 text-emerald-400 border border-emerald-800/40">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white">৳ 855</span>
            <span className="ml-1 text-xs text-slate-400">BDT</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">Stock Value: ৳ 47,049</p>
        </div>

        {/* Metric 5 */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Empty Packet Recovery</span>
            <div className="rounded-lg bg-cyan-950/60 p-2 text-cyan-400 border border-cyan-800/40">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-white">21,980</span>
            <span className="ml-1 text-xs text-slate-400">Packets</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400 font-medium">Express Brand return</p>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart 1: Daily Run Rate vs Target ADS */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Sales Pacing vs Target ADS</h3>
              <p className="text-xs text-slate-400">Cumulative run rate across operational working days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                <span className="text-slate-300">Actual Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span className="text-slate-400">Target ADS Baseline</span>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyPacingData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[1.5, 3]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="targetADS" stroke="#64748b" strokeDasharray="3 3" fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Brand Distribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-white mb-1">Brand Contribution Share</h3>
          <p className="text-xs text-slate-400 mb-4">Volume distribution across cigarette brands</p>
          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={brandShareData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {brandShareData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {brandShareData.map((brand) => (
              <div key={brand.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brand.color }}></span>
                <span className="text-slate-300 font-medium truncate">{brand.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Territory Leaderboard Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Territory Performance Ranking</h3>
            <p className="text-xs text-slate-400">Satkania Region performance against territory targets</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Territory</th>
                <th className="pb-3 font-semibold text-right">Daily Sales (Mio)</th>
                <th className="pb-3 font-semibold text-right">Target (Mio)</th>
                <th className="pb-3 font-semibold text-right">Achievement %</th>
                <th className="pb-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {territoryLeaderboard.map((item) => (
                <tr key={item.name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 font-medium text-white">{item.name}</td>
                  <td className="py-3 text-right font-mono">{item.sales.toFixed(2)}</td>
                  <td className="py-3 text-right font-mono text-slate-400">{item.target.toFixed(2)}</td>
                  <td className="py-3 text-right font-mono font-semibold text-blue-400">
                    {item.achievement.toFixed(1)}%
                  </td>
                  <td className="py-3 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      item.achievement >= 90
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                        : item.achievement >= 80
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                        : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                    }`}>
                      {item.achievement >= 90 ? 'Ahead' : item.achievement >= 80 ? 'Pacing' : 'Lagging'}
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
