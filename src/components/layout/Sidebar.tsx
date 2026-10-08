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
  Sparkles,
  X
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

  const handleNavClick = (tabId: string) => {
    onTabChange(tabId);
    // On mobile screens, auto-close sidebar drawer after selecting a route
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && isOpen) {
      onToggle();
    }
  };

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
    <>
      {/* 1. Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity duration-300 animate-fadeIn"
          aria-hidden="true"
        />
      )}

      {/* 2. Responsive Sidebar (Off-Canvas on Mobile/Tablet, Collapsible on Laptop/Desktop) */}
      <aside
        className={`fixed top-0 left-0 z-50 lg:z-30 h-screen transition-all duration-300 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md flex flex-col ${
          isOpen
            ? 'translate-x-0 w-72 max-w-[85vw] lg:w-64 shadow-2xl lg:shadow-none'
            : '-translate-x-full lg:translate-x-0 lg:w-16'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            {/* Show brand title if open on laptop, OR always if drawer is open on mobile */}
            <div className={`leading-tight ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <span>Afaz Tobacco</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">HQ</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Intelligence Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile Close Button */}
            <button
              onClick={onToggle}
              className="lg:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              title="Close Menu"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Desktop Collapse/Expand Button */}
            <button
              onClick={onToggle}
              className="hidden lg:flex text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
            >
              {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* OPERATIONAL SECTION */}
          <div className="space-y-1">
            <span className={`px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>
              Operational
            </span>
          {operationalNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className={`truncate ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* WORKBOOK ACTIONS SECTION */}
        <div className="space-y-1">
          <span className={`px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>
            Workbook Actions
          </span>

          {/* Export Button */}
          <button
            onClick={() => {
              onExport();
              if (typeof window !== 'undefined' && window.innerWidth < 1024 && isOpen) onToggle();
            }}
            title={!isOpen ? 'Export 34-Sheet XLSX' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40 cursor-pointer"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className={`truncate ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>Export 34-Sheet XLSX</span>
          </button>

          {/* Import Button */}
          <button
            onClick={() => {
              onOpenImport();
              if (typeof window !== 'undefined' && window.innerWidth < 1024 && isOpen) onToggle();
            }}
            title={!isOpen ? 'Import XLSX' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-800/40 cursor-pointer"
          >
            <CloudUpload className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className={`truncate ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>Date-Safe XLSX Import</span>
          </button>

          {/* Drive Archival Button (Super Admin Only) */}
          {isSuperAdmin && (
            <button
              onClick={() => {
                onOpenDrive();
                if (typeof window !== 'undefined' && window.innerWidth < 1024 && isOpen) onToggle();
              }}
              title={!isOpen ? 'Google Drive Cloud Archival' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/40 cursor-pointer"
            >
              <CloudUpload className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className={`truncate ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>Drive Cloud Archival</span>
            </button>
          )}
        </div>

        {/* ADMINISTRATIVE SECTION (SUPER ADMIN & COMPANY ADMIN) */}
        {(isSuperAdmin || currentRole === 'COMPANY_ADMIN') && (
          <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-900">
            <div className={`px-3 mb-2 flex items-center justify-between ${!isOpen ? 'hidden lg:hidden' : 'flex'}`}>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                {isSuperAdmin ? 'Platform Control' : 'Tenant Admin'}
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                isSuperAdmin 
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' 
                  : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
              }`}>
                {isSuperAdmin ? 'SUPER ADMIN' : 'COMPANY ADMIN'}
              </span>
            </div>
            {(isSuperAdmin
              ? adminNav
              : [
                  { id: 'users', label: 'Company Staff & Roles', icon: Users },
                  { id: 'master_hierarchy', label: 'Hierarchy & Pricing', icon: Database },
                  { id: 'audit', label: 'Company Audit Trail', icon: History },
                ]
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={!isOpen ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? isSuperAdmin 
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold'
                        : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className={`truncate ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className={`p-3 border-t border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/60 ${!isOpen ? 'hidden lg:hidden' : 'block'}`}>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            PostgreSQL Live
          </span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  </>
  );
}
