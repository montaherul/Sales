'use client';

import React from 'react';
import { RoleType } from '@/lib/types';
import { 
  Building2, 
  Menu, 
  UserCheck, 
  ShieldAlert,
  Sparkles,
  LogOut
} from 'lucide-react';
import { SessionUser } from '@/lib/auth/session';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface NavbarProps {
  currentRole: RoleType;
  currentUser?: SessionUser | null;
  onRoleChange: (role: RoleType) => void;
  onToggleSidebar: () => void;
  onLogout?: () => void;
}

export function Navbar({
  currentRole,
  currentUser,
  onRoleChange,
  onToggleSidebar,
  onLogout,
}: NavbarProps) {
  const roles: RoleType[] = ['SUPER_ADMIN', 'RSO', 'TSO', 'CSR'];

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors duration-200">
      <div className="flex h-full items-center justify-between px-3 sm:px-6">
        {/* Left: Sidebar Toggle & Company Name ONLY */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
            title="Toggle Sidebar Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 truncate">
              <span className="truncate max-w-[140px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
                {currentUser?.companyName || 'Afaz Tobacco Company'}
              </span>
              <span className="hidden md:inline text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/40 shrink-0">
                Sales & Stock Platform
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 md:hidden truncate">Sales & Stock Intelligence</p>
          </div>
        </div>

        {/* Right: Active Role, Theme Toggle, User Profile & Logout */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
          {/* User Profile Info with Accurate Role Badge (Desktop / Tablet) */}
          <div className="hidden md:flex items-center gap-2.5 text-right">
            <div>
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {currentUser?.fullName || (currentRole === 'SUPER_ADMIN' ? 'System Administrator' : `${currentRole} Officer`)}
                </span>
                {/* Accurate Authenticated Role Badge */}
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    (currentUser?.role || currentRole) === 'SUPER_ADMIN'
                      ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : (currentUser?.role || currentRole) === 'RSO'
                      ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                      : (currentUser?.role || currentRole) === 'TSO'
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {currentUser?.role || currentRole}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">
                {currentUser?.email || `${currentRole.toLowerCase()}@afaztobacco.com`}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
              {(currentUser?.fullName || currentRole)[0].toUpperCase()}
            </div>
          </div>

          {/* Mobile User Avatar pill */}
          <div className="md:hidden flex items-center gap-1.5">
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                (currentUser?.role || currentRole) === 'SUPER_ADMIN'
                  ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
              }`}
            >
              {currentUser?.role || currentRole}
            </span>
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-[11px] shadow-sm shrink-0" title={currentUser?.fullName || currentRole}>
              {(currentUser?.fullName || currentRole)[0].toUpperCase()}
            </div>
          </div>

          {/* Theme Mode Toggle */}
          <ThemeToggle />

          {/* Sign Out Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-800/60 hover:text-rose-600 dark:hover:text-rose-400 px-2 sm:px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 transition-all cursor-pointer shadow-xs"
              title="Sign Out of Session"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
