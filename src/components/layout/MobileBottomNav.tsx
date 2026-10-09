'use client';

import React from 'react';
import { RoleType } from '@/lib/types';
import { 
  LayoutDashboard, 
  FileEdit, 
  ShieldCheck, 
  Menu,
  ShieldAlert,
  Building2
} from 'lucide-react';

interface MobileBottomNavProps {
  currentRole: RoleType;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSidebar: () => void;
}

export function MobileBottomNav({
  currentRole,
  activeTab,
  onTabChange,
  onOpenSidebar,
}: MobileBottomNavProps) {
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Analytics',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'entry',
      label: 'Sales Entry',
      icon: FileEdit,
      visible: true,
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: ShieldCheck,
      visible: true,
    },
    {
      id: 'more',
      label: 'More & Menu',
      icon: Menu,
      visible: true,
      isAction: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 shadow-lg px-2 py-1 safe-bottom transition-colors duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          if (!item.visible) return null;
          const Icon = item.icon;
          const isActive = !item.isAction && activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isAction) {
                  onOpenSidebar();
                } else {
                  onTabChange(item.id);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer select-none ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div
                className={`relative p-1 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                    : ''
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.id === 'more' && isSuperAdmin && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </div>
              <span className="text-[10px] tracking-tight truncate max-w-[70px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
