'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Tag, 
  Target, 
  Layers, 
  RefreshCw,
  Coins,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export function MasterHierarchyManagement() {
  const [territories, setTerritories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'HIERARCHY' | 'PRICING' | 'TARGETS'>('HIERARCHY');

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/master-data');
      const json = await res.json();
      if (json.success && json.data) {
        setTerritories(json.data.territories || []);
        setBrands(json.data.brands || []);
        setTargets(json.data.targets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const zardaPricing = [
    { name: '22/25', unitPrice: 15, unit: 'Packet', effective: '2026-01-01' },
    { name: '99/14', unitPrice: 6, unit: 'Packet', effective: '2026-01-01' },
    { name: '33/15', unitPrice: 8, unit: 'Pouch', effective: '2026-01-01' },
    { name: 'SLB', unitPrice: 0, unit: 'Raw Qty', effective: '2026-01-01' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-400" />
            <span>Master Organization, Pricing & Target Hierarchy</span>
          </h2>
          <p className="text-xs text-slate-400">
            Authoritative dynamic hierarchy (Company → Division → Wing → Region → Territory → Routes)
          </p>
        </div>

        <button
          onClick={fetchMasterData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Master Data</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('HIERARCHY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'HIERARCHY'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Organizational Hierarchy</span>
        </button>

        <button
          onClick={() => setActiveTab('PRICING')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'PRICING'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Coins className="h-4 w-4" />
          <span>Brand Catalog & Official Pricing</span>
        </button>

        <button
          onClick={() => setActiveTab('TARGETS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'TARGETS'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Monthly Territory Targets</span>
        </button>
      </div>

      {/* TAB 1: Organizational Hierarchy */}
      {activeTab === 'HIERARCHY' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm space-y-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span>Afaz Tobacco Company</span>
            <ChevronRight className="h-4 w-4 text-slate-500" />
            <span className="text-blue-400">Ctg South Division</span>
            <ChevronRight className="h-4 w-4 text-slate-500" />
            <span className="text-purple-400">Chittagong Wing</span>
            <ChevronRight className="h-4 w-4 text-slate-500" />
            <span className="text-emerald-400">Satkania Region</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {territories.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <span>{t.name}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    SL {t.sort_order}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Region: <strong className="text-slate-200">{t.region_name}</strong></p>
                  <p>Status: <strong className="text-emerald-400">Active Operational Route</strong></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Brand Catalog & Pricing */}
      {activeTab === 'PRICING' && (
        <div className="space-y-6">
          {/* Cigarettes */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-3">
            <h3 className="text-sm font-bold text-white">Cigarette Brand Catalog (BITCL Standard)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {['Wilson', 'Shahara', 'Express', 'Nexus', 'SB', 'SM'].map((brand, i) => (
                <div key={brand} className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-center space-y-1">
                  <span className="text-xs font-bold text-white block">{brand}</span>
                  <span className="text-[10px] text-blue-400 font-mono block">Rank {i + 1}</span>
                  <span className="text-[10px] text-slate-500 block">Unit: Million Sticks</span>
                </div>
              ))}
            </div>
          </div>

          {/* Zarda Official Valuation Formula Pricing */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Official Zarda Formula Valuation Prices</h3>
                <p className="text-xs text-slate-400">Used by calculation engine and Excel sheet formula W{'{r}'} & AC{'{r}'}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Brand Variant</th>
                    <th className="py-2.5 px-4 text-right">Official Unit Price</th>
                    <th className="py-2.5 px-4">Unit Packaging</th>
                    <th className="py-2.5 px-4">Effective Date</th>
                    <th className="py-2.5 px-4 text-right">Calculation Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {zardaPricing.map((zp) => (
                    <tr key={zp.name} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-4 font-sans font-medium text-white">{zp.name}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-400">৳ {zp.unitPrice}.00</td>
                      <td className="py-2.5 px-4 font-sans text-slate-400">{zp.unit}</td>
                      <td className="py-2.5 px-4 text-slate-400">{zp.effective}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-blue-400">
                        {zp.unitPrice > 0 ? `Qty * ${zp.unitPrice} BDT` : 'Quantity Tracking'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Targets */}
      {activeTab === 'TARGETS' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">October 2026 Monthly Brand Targets</h3>
              <p className="text-xs text-slate-400">Authoritative target figures powering Sheet 33 ('Target.') & Sheet 34 ('Analysis')</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">SL</th>
                  <th className="py-2.5 px-4">Territory Name</th>
                  <th className="py-2.5 px-4 text-right">Wilson Target</th>
                  <th className="py-2.5 px-4 text-right">Shahara Target</th>
                  <th className="py-2.5 px-4 text-right">Express Target</th>
                  <th className="py-2.5 px-4 text-right">Nexus Target</th>
                  <th className="py-2.5 px-4 text-right">SB Target</th>
                  <th className="py-2.5 px-4 text-right">SM Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {territories.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 px-4">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-sans font-medium text-white">{t.name}</td>
                    <td className="py-2.5 px-4 text-right">25,000</td>
                    <td className="py-2.5 px-4 text-right">18,000</td>
                    <td className="py-2.5 px-4 text-right text-blue-400 font-bold">12,000</td>
                    <td className="py-2.5 px-4 text-right">15,000</td>
                    <td className="py-2.5 px-4 text-right">8,000</td>
                    <td className="py-2.5 px-4 text-right">6,000</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
