'use client';

import React, { useState, useEffect } from 'react';
import { RoleType } from '@/lib/types';
import { SessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/client';
import { LoginPage } from '@/components/auth/LoginPage';
import { OnboardingModal } from '@/components/auth/OnboardingModal';
import { Navbar, CompanyOption } from '@/components/layout/Navbar';
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
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentRole, setCurrentRole] = useState<RoleType>('SUPER_ADMIN');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [driveOpen, setDriveOpen] = useState<boolean>(false);

  // Global Company Scoping State
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');

  // Load Companies Catalog on mount
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch('/api/companies?pageSize=100');
        const json = await res.json();
        if (json.success && json.data) {
          setCompanies(
            json.data.map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.code,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load companies list:', err);
      }
    }
    fetchCompanies();
  }, []);

  // 1. Check existing session and Supabase OAuth session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        const json = await res.json();
        if (json.success && json.user) {
          setCurrentUser(json.user);
          setCurrentRole(json.user.role);
          if (json.user.role !== 'SUPER_ADMIN' && json.user.companyId) {
            setSelectedCompanyId(json.user.companyId);
          }
          return;
        }

        // Check if Supabase client has an active OAuth session (e.g. from Google OAuth callback)
        const supabase = createClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            const googleRes = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user.email, idToken: session.access_token }),
            });
            const googleJson = await googleRes.json();
            if (googleJson.success && googleJson.user) {
              setCurrentUser(googleJson.user);
              setCurrentRole(googleJson.user.role);
              if (googleJson.user.role !== 'SUPER_ADMIN' && googleJson.user.companyId) {
                setSelectedCompanyId(googleJson.user.companyId);
              }
              return;
            }
          }
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
    if (user.role !== 'SUPER_ADMIN' && user.companyId) {
      setSelectedCompanyId(user.companyId);
    }
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
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {}
    setCurrentUser(null);
  };

  const handleExport = () => {
    // Triggers direct download of authoritative 34-sheet Excel report
    window.location.href = '/api/exports/xlsx?year=2026&month=10&day=6';
  };

  // Determine effective company scope based on user role
  const isSuperAdmin = (currentUser?.role || currentRole) === 'SUPER_ADMIN';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : (currentUser?.companyId || 'ALL');

  // Loading splash while checking session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 transition-colors duration-200">
        <div className="h-10 w-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-mono">Initializing Afaz Tobacco Intelligence Platform...</span>
      </div>
    );
  }

  // 2. Unauthenticated: Render Enterprise Login Screen (No public register page)
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Authenticated: Render Main Application Layout with Adaptive Theming
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex text-slate-900 dark:text-slate-100 transition-colors duration-200">
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
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-16'
        } pl-0`}
      >
        {/* Top Navbar: Super Admin Company Switcher, User Profile, Theme Toggle & Logout */}
        <Navbar
          currentRole={currentRole}
          currentUser={currentUser}
          selectedCompanyId={effectiveCompanyId}
          onCompanyChange={setSelectedCompanyId}
          companies={companies}
          onRoleChange={setCurrentRole}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onLogout={handleLogout}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {/* Operational Modules */}
          {activeTab === 'dashboard' && <ExecutiveDashboard companyId={effectiveCompanyId} />}
          {activeTab === 'entry' && <DailySalesGrid companyId={effectiveCompanyId} />}
          {activeTab === 'approvals' && <ApprovalHub currentRole={currentRole} companyId={effectiveCompanyId} />}

          {/* Super Admin Administrative Modules */}
          {activeTab === 'companies' && currentRole === 'SUPER_ADMIN' && <CompanyManagement />}
          {activeTab === 'users' && currentRole === 'SUPER_ADMIN' && <UserRoleManagement companyId={effectiveCompanyId} />}
          {activeTab === 'menu_management' && currentRole === 'SUPER_ADMIN' && <MenuManagement companyId={effectiveCompanyId} />}
          {activeTab === 'master_hierarchy' && currentRole === 'SUPER_ADMIN' && <MasterHierarchyManagement companyId={effectiveCompanyId} />}
          {activeTab === 'audit' && <AuditLogViewer companyId={effectiveCompanyId} />}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500 transition-colors duration-200">
          <p>
            Afaz Tobacco Sales & Stock Intelligence Platform • Production Specification Compliant • PostgreSQL Live
          </p>
        </footer>
      </div>

      {/* Mobile Sticky Bottom Nav Bar */}
      <MobileBottomNav
        currentRole={currentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

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
