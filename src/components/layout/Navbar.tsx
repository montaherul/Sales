'use client';

import React from 'react';
import { RoleType } from '@/lib/types';
import { 
  Building2, 
  ShieldCheck, 
  UserCheck, 
  Download, 
  CloudUpload, 
  Layers 
} from 'lucide-react';

interface NavbarProps {
  currentRole: RoleType;
  onRoleChange: (role: RoleType) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenImport: () => void;
  onOpenDrive: () => void;
  onExport: () => void;
}

export function Navbar({
  currentRole,
  onRoleChange,
  activeTab,
  onTabChange,
  onOpenImport,
  onOpenDrive,
  onExport,
}: NavbarProps) {
  const roles: RoleType[] = ['SUPER_ADMIN', 'RSO', 'TSO', 'CSR'];

  const tabs = [
    { id: 'dashboard', label: 'Executive Analytics', icon: Layers },
    { id: 'entry', label: 'Daily Field Entry', icon: Building2 },
    { id: 'approvals', label: 'Approval Hub', icon: ShieldCheck },
    { id: 'audit', label: 'Audit Trail', icon: Layers },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-500/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Afaz Tobacco <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">Intelligence</span>
            </h1>
            <p className="text-xs text-slate-400">Sales, Stock & 34-Sheet Reporting Platform</p>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="hidden md:flex items-center space-x-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls & Role Simulator */}
        <div className="flex items-center space-x-2">
          {/* Export Button */}
          <button
            onClick={onExport}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            title="Download Authoritative 34-Sheet Excel Workbook"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export 34-Sheet XLSX</span>
          </button>

          {/* Import Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            title="Import XLSX with Date Safety"
          >
            <CloudUpload className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Super Admin Drive Button */}
          {currentRole === 'SUPER_ADMIN' && (
            <button
              onClick={onOpenDrive}
              className="flex items-center space-x-1.5 rounded-lg border border-blue-600/40 bg-blue-950/40 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-900/60"
              title="Google Drive Cloud Archival (Super Admin Only)"
            >
              <CloudUpload className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">Drive Archive</span>
            </button>
          )}

          {/* Role Switcher */}
          <div className="flex items-center space-x-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1">
            <UserCheck className="h-3.5 w-3.5 text-blue-400" />
            <label className="text-[11px] text-slate-400">Role:</label>
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as RoleType)}
              className="bg-transparent text-xs font-semibold text-blue-300 focus:outline-none cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r} value={r} className="bg-slate-900 text-white">
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
