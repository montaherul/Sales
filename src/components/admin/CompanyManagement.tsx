'use client';

import React, { useState, useEffect } from 'react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { DynamicCrudModal, DynamicFormField } from '@/components/common/DynamicCrudModal';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  MapPin, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  TrendingUp, 
  FileSpreadsheet,
  Globe,
  Sparkles,
  UserPlus
} from 'lucide-react';

interface CompanyRecord {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'INACTIVE';
  plan: 'STARTER' | 'PRO' | 'ENTERPRISE';
  contact_email?: string;
  contact_phone?: string;
  currency?: string;
  timezone?: string;
  division_count: number | string;
  territory_count: number | string;
  user_count: number | string;
  submission_count: number | string;
  created_at: string;
}

interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  totalTerritories: number;
  totalSubmissions: number;
  todaySales: number;
  mtdSales: number;
}

export function CompanyManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);

  // Quick Company Admin Creation Modal State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminCompany, setAdminCompany] = useState<CompanyRecord | null>(null);

  // Fetch platform stats on mount and refresh
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/platform/stats');
        const json = await res.json();
        if (json.success && json.data) {
          setPlatformStats(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch platform stats:', err);
      }
    }
    fetchStats();
  }, [refreshTrigger]);

  // Form Fields Schema for Create / Edit
  const formFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Tenant Company Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Afaz Tobacco Company Ltd.',
      hint: 'The legal registered name of the enterprise tenant company.',
    },
    {
      name: 'code',
      label: 'Tenant Code / Acronym',
      type: 'text',
      required: true,
      placeholder: 'e.g. ATC',
      hint: 'Short unique abbreviation used in report identifiers and data scoping.',
    },
    {
      name: 'status',
      label: 'Tenant Lifecycle Status',
      type: 'select2',
      required: true,
      options: [
        { value: 'ACTIVE', label: '🟢 ACTIVE (Fully Operational)' },
        { value: 'TRIAL', label: '🔵 TRIAL (Evaluation Mode)' },
        { value: 'SUSPENDED', label: '🔴 SUSPENDED (Operations Locked)' },
        { value: 'INACTIVE', label: '⚪ INACTIVE (Decommissioned)' },
      ],
      defaultValue: 'ACTIVE',
      hint: 'Controls whether tenant users can record daily entries and submit data.',
    },
    {
      name: 'plan',
      label: 'SaaS Subscription Plan',
      type: 'select2',
      required: true,
      options: [
        { value: 'STARTER', label: 'Starter Plan (Up to 10 users, 5 territories)' },
        { value: 'PRO', label: 'Professional Plan (Up to 50 users, 25 territories)' },
        { value: 'ENTERPRISE', label: 'Enterprise SaaS (Unlimited users & territories)' },
      ],
      defaultValue: 'PRO',
      hint: 'Assigns tenant resource quota and cloud feature availability.',
    },
    {
      name: 'contactEmail',
      label: 'Administrator Contact Email',
      type: 'text',
      required: false,
      placeholder: 'admin@company.com',
      hint: 'Primary contact for tenant operational notices and billing.',
    },
    {
      name: 'contactPhone',
      label: 'Contact Phone Number',
      type: 'text',
      required: false,
      placeholder: '+8801700000000',
    },
    {
      name: 'currency',
      label: 'Default Currency',
      type: 'select2',
      required: true,
      options: [
        { value: 'BDT', label: 'BDT (Bangladeshi Taka)' },
        { value: 'USD', label: 'USD (US Dollar)' },
        { value: 'EUR', label: 'EUR (Euro)' },
      ],
      defaultValue: 'BDT',
    },
    {
      name: 'timezone',
      label: 'Operating Timezone',
      type: 'select2',
      required: true,
      options: [
        { value: 'Asia/Dhaka', label: 'Asia/Dhaka (GMT+6)' },
        { value: 'UTC', label: 'UTC (GMT+0)' },
      ],
      defaultValue: 'Asia/Dhaka',
    },
    {
      name: 'address',
      label: 'Corporate Office Address',
      type: 'text',
      required: false,
      placeholder: 'Corporate Headquarters, Dhaka, Bangladesh',
    },
  ];

  // Form Fields Schema for Quick Company Admin Creation
  const adminFormFields: DynamicFormField[] = [
    {
      name: 'fullName',
      label: 'Administrator Full Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Mohammad Rahim',
    },
    {
      name: 'email',
      label: 'Corporate Email',
      type: 'email',
      required: true,
      placeholder: 'e.g. admin@company.com',
      hint: 'Primary login identifier for this tenant administrator.',
    },
    {
      name: 'phone',
      label: 'Contact Phone Number',
      type: 'text',
      required: false,
      placeholder: '+880 1711-000000',
    },
    {
      name: 'password',
      label: 'Initial Password',
      type: 'text',
      required: true,
      defaultValue: '123',
      hint: 'Default password is 123. Can be changed upon first login.',
    },
  ];

  // Table Columns Definition
  const columns: ColumnDef<CompanyRecord>[] = [
    {
      key: 'name',
      header: 'Tenant Company',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-200 dark:border-blue-700/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 font-bold text-xs shadow-xs">
            {row.code ? row.code.substring(0, 3) : <Building2 className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{row.name}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="text-blue-600 dark:text-blue-400 font-bold">{row.code}</span>
              <span>•</span>
              <span>{row.currency || 'BDT'}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Tenant Status',
      sortable: true,
      align: 'center',
      render: (row) => {
        const status = row.status || 'ACTIVE';
        if (status === 'ACTIVE') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              ACTIVE
            </span>
          );
        }
        if (status === 'SUSPENDED') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
              <ShieldAlert className="w-3 h-3 text-rose-500" />
              SUSPENDED
            </span>
          );
        }
        if (status === 'TRIAL') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              <Sparkles className="w-3 h-3 text-blue-500" />
              TRIAL
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            INACTIVE
          </span>
        );
      },
    },
    {
      key: 'plan',
      header: 'Plan',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
          {row.plan || 'PRO'}
        </span>
      ),
    },
    {
      key: 'territory_count',
      header: 'Territories',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-semibold">
          <MapPin className="w-3 h-3" />
          {row.territory_count || 0}
        </span>
      ),
    },
    {
      key: 'user_count',
      header: 'Assigned Staff',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold">
          <Users className="w-3 h-3" />
          {row.user_count || 0}
        </span>
      ),
    },
    {
      key: 'submission_count',
      header: 'Submissions',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-semibold">
          <FileSpreadsheet className="w-3 h-3" />
          {row.submission_count || 0}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Onboarded Date',
      sortable: true,
      render: (row) => (
        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setAdminCompany(row);
              setAdminModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:hover:bg-indigo-900/60 dark:border-indigo-800/50 transition-all cursor-pointer shadow-xs"
            title={`Create / Assign Administrator for ${row.name}`}
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleEditClick(row)}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Configure Tenant"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteSingle(row.id, row.name)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Tenant"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const handleCreateClick = () => {
    setSelectedCompany(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditClick = (company: CompanyRecord) => {
    setSelectedCompany({
      ...company,
      contactEmail: company.contact_email,
      contactPhone: company.contact_phone,
    } as any);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDeleteSingle = async (companyId: string, companyName: string) => {
    if (!confirm(`Are you sure you want to delete tenant "${companyName}"? All cascading tenant data and scopes will be removed.`)) return;
    try {
      const res = await fetch(`/api/companies?id=${companyId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alert(json.error || 'Failed to delete company');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting company');
    }
  };

  const handleBatchDelete = async (selectedIds: string[]) => {
    const res = await fetch('/api/companies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Batch deletion failed');
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>, mode: 'create' | 'edit') => {
    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetch('/api/companies', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || `Failed to ${mode} company`);
    }

    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAdminFormSubmit = async (formData: Record<string, any>) => {
    if (!adminCompany) return;
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password || '123',
        roleName: 'COMPANY_ADMIN',
        companyId: adminCompany.id,
      }),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to create Company Administrator');
    }

    alert(`✓ Company Administrator created successfully for ${adminCompany.name}!\nEmail: ${formData.email}\nInitial Password: ${formData.password || '123'}`);
    setAdminModalOpen(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* 1. SaaS Platform Multi-Tenant KPI Banner */}
      {platformStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-medium">Total Tenants</span>
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {platformStats.totalCompanies}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">Active SaaS Orgs</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-medium">Active Tenants</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {platformStats.activeCompanies}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">100% Operational</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-medium">Suspended</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {platformStats.suspendedCompanies}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Restricted</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-medium">Platform Users</span>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {platformStats.totalUsers}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Across Tenants</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-medium">Territories</span>
              <MapPin className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
              {platformStats.totalTerritories}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">All Geographies</span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-medium">Platform MTD</span>
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {Number(platformStats.mtdSales).toFixed(2)}M
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Total Volume</span>
          </div>
        </div>
      )}

      {/* 2. Module Overview Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-xs transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Multi-Tenant Platform Control</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                SaaS Isolation Boundary
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage enterprise tenants, lifecycle states, subscription plans, and organizational boundaries.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleCreateClick}
            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Tenant Company</span>
          </button>
        </div>
      </div>

      {/* 3. Server-Side Multi-Tenant Data Table */}
      <ServerDataTable<CompanyRecord>
        key={refreshTrigger}
        endpoint="/api/companies"
        columns={columns}
        idField="id"
        title="Registered Tenant Organizations"
        searchPlaceholder="Search company by name or acronym..."
        exportFilenamePrefix="Afaz_SaaS_Tenants"
        onBatchDelete={handleBatchDelete}
      />

      {/* 4. Tenant Onboarding / Editing Modal */}
      <DynamicCrudModal
        isOpen={modalOpen}
        mode={modalMode}
        title={modalMode === 'create' ? 'Onboard New Tenant Company' : `Configure Tenant: ${selectedCompany?.name}`}
        fields={formFields}
        initialData={selectedCompany}
        onSubmit={handleFormSubmit}
        onClose={() => setModalOpen(false)}
      />

      {/* 5. Quick Company Admin Creation Modal */}
      <DynamicCrudModal
        isOpen={adminModalOpen}
        mode="create"
        title={`Create Administrator: ${adminCompany?.name || ''}`}
        fields={adminFormFields}
        onSubmit={handleAdminFormSubmit}
        onClose={() => setAdminModalOpen(false)}
        submitButtonText="Create Company Admin"
      />
    </div>
  );
}
