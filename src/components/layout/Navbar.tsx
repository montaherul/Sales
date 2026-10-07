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
    <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        {/* Left: Sidebar Toggle & Company Name ONLY */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
            title="Toggle Sidebar Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span>{currentUser?.companyName || 'Afaz Tobacco Company'}</span>
              <span className="hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-700/40">
                Sales & Stock Intelligence Platform
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 sm:hidden">Sales & Stock Intelligence</p>
          </div>
        </div>

        {/* Right: Active Role & User Profile & Logout */}
        <div className="flex items-center space-x-3">
          {/* User Profile info */}
          <div className="hidden md:flex items-center gap-2.5 text-right">
            <div>
              <span className="text-xs font-semibold text-white block">
                {currentUser?.fullName || (currentRole === 'SUPER_ADMIN' ? 'System Administrator' : `${currentRole} Officer`)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                {currentUser?.email || `${currentRole.toLowerCase()}@afaztobacco.com`}
              </span>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
              {(currentUser?.fullName || currentRole)[0].toUpperCase()}
            </div>
          </div>

          {/* Role Switcher Simulator for Super Admin */}
          {currentUser?.role === 'SUPER_ADMIN' && (
            <div className="flex items-center space-x-1.5 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 shadow-xs">
              <UserCheck className="h-3.5 w-3.5 text-blue-400" />
              <label className="text-[11px] text-slate-400 font-medium">Role:</label>
              <select
                value={currentRole}
                onChange={(e) => onRoleChange(e.target.value as RoleType)}
                className="bg-transparent text-xs font-bold text-blue-300 focus:outline-none cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r} value={r} className="bg-slate-900 text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sign Out Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-rose-950/40 hover:border-rose-800/60 hover:text-rose-400 px-3 py-1.5 text-xs text-slate-400 transition-all cursor-pointer"
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
