'use client';

import React, { useState, useEffect } from 'react';
import { RoleType } from '@/lib/types';
import { SessionUser } from '@/lib/auth/session';
import { LoginPage } from '@/components/auth/LoginPage';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import { DailySalesGrid } from '@/components/sales/DailySalesGrid';
import { ApprovalHub } from '@/components/approval/ApprovalHub';
import { MenuManagement } from '@/components/admin/MenuManagement';
import { CompanyManagement } from '@/components/admin/CompanyManagement';
import { UserRoleManagement } from '@/components/admin/UserRoleManagement';
import { MasterHierarchyManagement } from '@/components/admin/MasterHierarchyManagement';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { ImportModal } from '@/components/import/ImportModal';
import { DriveUploadWidget } from '@/components/drive/DriveUploadWidget';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentRole, setCurrentRole] = useState<RoleType>('SUPER_ADMIN');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [driveOpen, setDriveOpen] = useState<boolean>(false);

  // 1. Check existing session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (json.success && json.user) {
          setCurrentUser(json.user);
          setCurrentRole(json.user.role);
        }
      } catch (err) {
        console.error('Session check failed:', err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkSession();
  }, []);

  const handleLoginSuccess = (user: SessionUser) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    // CSRs start directly on entry form; executives start on dashboard
    if (user.role === 'CSR') {
      setActiveTab('entry');
    } else if (user.role === 'TSO' || user.role === 'RSO') {
      setActiveTab('approvals');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setCurrentUser(null);
  };

  const handleExport = () => {
    // Triggers direct download of authoritative 34-sheet Excel report
    window.location.href = '/api/exports/xlsx?year=2026&month=10&day=6';
  };

  // Loading splash while checking session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono">Initializing Afaz Tobacco Intelligence Platform...</span>
      </div>
    );
  }

  // 2. Unauthenticated: Render Enterprise Login Screen (No public register page)
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Authenticated: Render Main Application Layout
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
        {/* Top Navbar: Shows Company Name ONLY, User Profile, Role Simulator & Logout */}
        <Navbar
          currentRole={currentRole}
          currentUser={currentUser}
          onRoleChange={setCurrentRole}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onLogout={handleLogout}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Operational Modules */}
          {activeTab === 'dashboard' && <ExecutiveDashboard />}
          {activeTab === 'entry' && <DailySalesGrid />}
          {activeTab === 'approvals' && <ApprovalHub currentRole={currentRole} />}

          {/* Super Admin Administrative Modules */}
          {activeTab === 'companies' && currentRole === 'SUPER_ADMIN' && <CompanyManagement />}
          {activeTab === 'users' && currentRole === 'SUPER_ADMIN' && <UserRoleManagement />}
          {activeTab === 'menu_management' && currentRole === 'SUPER_ADMIN' && <MenuManagement />}
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

      {/* Mandatory Onboarding Modal if user needs initial setup */}
      {currentUser && (currentUser.mustChangePassword || !currentUser.isOnboarded) && (
        <OnboardingModal
          user={currentUser}
          isOpen={true}
          onComplete={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}
    </div>
  );
}
