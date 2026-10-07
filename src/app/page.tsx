'use client';

import React, { useState } from 'react';
import { RoleType } from '@/lib/types';
import { Navbar } from '@/components/layout/Navbar';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import { DailySalesGrid } from '@/components/sales/DailySalesGrid';
import { ApprovalHub } from '@/components/approval/ApprovalHub';
import { ImportModal } from '@/components/import/ImportModal';
import { DriveUploadWidget } from '@/components/drive/DriveUploadWidget';

export default function Home() {
  const [currentRole, setCurrentRole] = useState<RoleType>('SUPER_ADMIN');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [driveOpen, setDriveOpen] = useState<boolean>(false);

  const handleExport = () => {
    // Triggers direct download of authoritative 34-sheet Excel report
    window.location.href = '/api/exports/xlsx?year=2026&month=10&day=6';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenImport={() => setImportOpen(true)}
        onOpenDrive={() => setDriveOpen(true)}
        onExport={handleExport}
      />

      {/* Main Body */}
      <main className="flex-1 mx-auto max-w-7xl w-full p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && <ExecutiveDashboard />}
        {activeTab === 'entry' && <DailySalesGrid />}
        {activeTab === 'approvals' && <ApprovalHub currentRole={currentRole} />}
      </main>

      {/* Modals & Drawers */}
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <DriveUploadWidget isOpen={driveOpen} onClose={() => setDriveOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <p>Afaz Tobacco Sales & Stock Intelligence Platform • Production Specification Compliant</p>
      </footer>
    </div>
  );
}
