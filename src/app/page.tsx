'use client';

import React, { useState } from 'react';
import { RoleType } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import { DailySalesGrid } from '@/components/sales/DailySalesGrid';
import { ApprovalHub } from '@/components/approval/ApprovalHub';
import { MenuManagement } from '@/components/admin/MenuManagement';
import { UserRoleManagement } from '@/components/admin/UserRoleManagement';
import { MasterHierarchyManagement } from '@/components/admin/MasterHierarchyManagement';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { ImportModal } from '@/components/import/ImportModal';
import { DriveUploadWidget } from '@/components/drive/DriveUploadWidget';

export default function Home() {
  const [currentRole, setCurrentRole] = useState<RoleType>('SUPER_ADMIN');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [driveOpen, setDriveOpen] = useState<boolean>(false);

  const handleExport = () => {
    // Triggers direct download of authoritative 34-sheet Excel report
    window.location.href = '/api/exports/xlsx?year=2026&month=10&day=6';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100">
      {/* 1. Collapsible Enterprise Sidebar */}
      <Sidebar
        currentRole={currentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onOpenImport={() => setImportOpen(true)}
        onOpenDrive={() => setDriveOpen(true)}
        onExport={handleExport}
      />

      {/* 2. Main Workspace Layout */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarOpen ? 'pl-64' : 'pl-16'
        }`}
      >
        {/* Top Navbar: Shows Company Name ONLY, User Profile, and Role Simulator */}
        <Navbar
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Operational Modules */}
          {activeTab === 'dashboard' && <ExecutiveDashboard />}
          {activeTab === 'entry' && <DailySalesGrid />}
          {activeTab === 'approvals' && <ApprovalHub currentRole={currentRole} />}

          {/* Super Admin Administrative Modules */}
          {activeTab === 'menu_management' && currentRole === 'SUPER_ADMIN' && <MenuManagement />}
          {activeTab === 'users' && currentRole === 'SUPER_ADMIN' && <UserRoleManagement />}
          {activeTab === 'master_hierarchy' && currentRole === 'SUPER_ADMIN' && <MasterHierarchyManagement />}
          {activeTab === 'audit' && <AuditLogViewer />}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
          <p>
            Afaz Tobacco Sales & Stock Intelligence Platform • Production Specification Compliant • PostgreSQL Live
          </p>
        </footer>
      </div>

      {/* Modals & Drawers */}
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <DriveUploadWidget isOpen={driveOpen} onClose={() => setDriveOpen(false)} />
    </div>
  );
}
