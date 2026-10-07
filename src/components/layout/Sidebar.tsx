'use client';

import React from 'react';
import { RoleType } from '@/lib/types';
import { 
  LayoutDashboard, 
  FileEdit, 
  ShieldCheck, 
  Download, 
  CloudUpload, 
  ShieldAlert, 
  Users, 
  Building2, 
  History, 
  Database,
  ChevronLeft,
  ChevronRight,
  Lock,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentRole: RoleType;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenImport: () => void;
  onOpenDrive: () => void;
  onExport: () => void;
}

export function Sidebar({
  currentRole,
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
  onOpenImport,
  onOpenDrive,
  onExport,
}: SidebarProps) {
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const operationalNav = [
    { id: 'dashboard', label: 'Executive Analytics', icon: LayoutDashboard },
    { id: 'entry', label: 'Daily Sales & Stock', icon: FileEdit },
    { id: 'approvals', label: 'Review & Approvals', icon: ShieldCheck },
  ];

  const adminNav = [
    { id: 'companies', label: 'Company Management', icon: Building2 },
    { id: 'users', label: 'User & Role Directory', icon: Users },
    { id: 'menu_management', label: 'Menu Access (RWMA / UWMA)', icon: ShieldAlert },
    { id: 'master_hierarchy', label: 'Hierarchy & Pricing', icon: Database },
    { id: 'audit', label: 'Audit & Governance Trail', icon: History },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md flex flex-col ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {isOpen && (
            <div className="leading-tight">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <span>Afaz Tobacco</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">HQ</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Intelligence Platform</p>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Body */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* OPERATIONAL SECTION */}
        <div className="space-y-1">
          {isOpen && (
            <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
              Operational
            </span>
          )}
          {operationalNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                {isOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* WORKBOOK ACTIONS SECTION */}
        <div className="space-y-1">
          {isOpen && (
            <span className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
              Workbook Actions
            </span>
          )}

          {/* Export Button */}
          <button
            onClick={onExport}
            title={!isOpen ? 'Export 34-Sheet XLSX' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40 cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {isOpen && <span className="truncate">Export 34-Sheet XLSX</span>}
          </button>

          {/* Import Button */}
          <button
            onClick={onOpenImport}
            title={!isOpen ? 'Import XLSX' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800/40 cursor-pointer"
          >
            <CloudUpload className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            {isOpen && <span className="truncate">Date-Safe XLSX Import</span>}
          </button>

          {/* Drive Archival Button (Super Admin Only) */}
          {isSuperAdmin && (
            <button
              onClick={onOpenDrive}
              title={!isOpen ? 'Google Drive Cloud Archival' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/40 cursor-pointer"
            >
              <CloudUpload className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              {isOpen && <span className="truncate">Drive Cloud Archival</span>}
            </button>
          )}
        </div>

        {/* ADMINISTRATIVE SECTION (SUPER ADMIN ONLY) */}
        {isSuperAdmin && (
          <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-900">
            {isOpen && (
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Administration
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  SUPER ADMIN
                </span>
              </div>
            )}
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  title={!isOpen ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  {isOpen && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      {isOpen && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              PostgreSQL Live
            </span>
            <span className="font-mono">v1.0.0</span>
          </div>
        </div>
      )}
    </aside>
  );
}
