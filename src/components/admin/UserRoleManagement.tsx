'use client';

import React, { useState, useEffect } from 'react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { DynamicCrudModal, DynamicFormField } from '@/components/common/DynamicCrudModal';
import { Select2, Select2Option } from '@/components/common/Select2';
import { 
  Users, 
  UserPlus, 
  Building2, 
  MapPin, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  ShieldAlert,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { RoleType } from '@/shared/constants';

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role_name: RoleType;
  is_active: boolean;
  company_id?: string;
  company_name?: string;
  territory_id?: string;
  territory_name?: string;
  region_id?: string;
  region_name?: string;
  created_at?: string;
}

export function UserRoleManagement() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [companies, setCompanies] = useState<Select2Option[]>([]);
  const [territories, setTerritories] = useState<Select2Option[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load companies and territories for Select2 dropdowns
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [compRes, masterRes] = await Promise.all([
          fetch('/api/companies?pageSize=100'),
          fetch('/api/master-data'),
        ]);

        const compJson = await compRes.json();
        const masterJson = await masterRes.json();

        if (compJson.success) {
          const compOpts: Select2Option[] = [
            { value: 'ALL', label: 'All Companies (Global)' },
            ...(compJson.data || []).map((c: any) => ({
              value: c.id,
              label: c.name,
              badge: c.code,
            })),
          ];
          setCompanies(compOpts);
        }

        if (masterJson.success) {
          const terrOpts: Select2Option[] = (masterJson.data?.territories || []).map((t: any) => ({
            value: t.id,
            label: t.name,
            subLabel: t.region_name || 'Satkania Region',
          }));
          setTerritories(terrOpts);
        }
      } catch (err) {
        console.error('Failed to load companies/territories:', err);
      }
    }

    loadMasterData();
  }, []);

  // Form Fields Schema for Create / Edit Controller
  const formFields: DynamicFormField[] = [
    {
      name: 'fullName',
      label: 'Full Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Mohammad Rahim',
    },
    {
      name: 'email',
      label: 'Corporate Email',
      type: 'email',
      required: true,
      placeholder: 'e.g. rahim@afaztobacco.com',
    },
    {
      name: 'phone',
      label: 'Contact Phone',
      type: 'text',
      placeholder: '+880 1711-000000',
    },
    {
      name: 'companyId',
      label: 'Assigned Company',
      type: 'select2',
      placeholder: 'Select company...',
      options: companies.filter((c) => c.value !== 'ALL'),
      hint: 'Scoping the user to an enterprise company entity.',
    },
    {
      name: 'roleName',
      label: 'System Role',
      type: 'select2',
      required: true,
      defaultValue: 'CSR',
      options: [
        { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN (Global System Access)', badge: 'GLOBAL' },
        { value: 'RSO', label: 'RSO (Regional Sales Officer)', badge: 'REGION' },
        { value: 'TSO', label: 'TSO (Territory Sales Officer)', badge: 'TERRITORY' },
        { value: 'CSR', label: 'CSR (Customer Sales Representative)', badge: 'OPERATIONAL' },
      ],
    },
    {
      name: 'territoryId',
      label: 'Assigned Territory Scope',
      type: 'select2',
      placeholder: 'Select territory...',
      options: territories,
      hint: 'Required for TSO and CSR operational boundary enforcement.',
    },
    {
      name: 'isActive',
      label: 'Account Active Status',
      type: 'boolean',
      defaultValue: true,
    },
  ];

  // Table Columns Definition
  const columns: ColumnDef<UserRecord>[] = [
    {
      key: 'full_name',
      header: 'User Profile',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
            {row.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">{row.full_name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role_name',
      header: 'Assigned Role',
      sortable: true,
      render: (row) => {
        let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700';
        if (row.role_name === 'SUPER_ADMIN') badgeStyle = 'bg-rose-950/70 text-rose-300 border-rose-800';
        if (row.role_name === 'RSO') badgeStyle = 'bg-purple-950/70 text-purple-300 border-purple-800';
        if (row.role_name === 'TSO') badgeStyle = 'bg-blue-950/70 text-blue-300 border-blue-800';
        if (row.role_name === 'CSR') badgeStyle = 'bg-emerald-950/70 text-emerald-300 border-emerald-800';

        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeStyle}`}>
            {row.role_name}
          </span>
        );
      },
    },
    {
      key: 'company_name',
      header: 'Company Scope',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-medium truncate">{row.company_name || 'Afaz Tobacco Company'}</span>
        </div>
      ),
    },
    {
      key: 'territory_name',
      header: 'Geographic Scope',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{row.territory_name || row.region_name || 'Global Access'}</span>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            row.is_active
              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
              : 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
          }`}
        >
          {row.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {row.is_active ? 'Active' : 'Suspended'}
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
            onClick={() => handleEditClick(row)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
            title="Edit User"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteSingle(row.id)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Delete User"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const handleCreateClick = () => {
    setCurrentUser(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditClick = (user: UserRecord) => {
    setCurrentUser(user);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDeleteSingle = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user profile?')) return;
    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alert(json.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting user');
    }
  };

  const handleBatchDelete = async (selectedIds: string[]) => {
    const res = await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Batch deletion failed');
    }
  };

  // Controller method for Submit (Handles both Create and Edit)
  const handleFormSubmit = async (formData: Record<string, any>, mode: 'create' | 'edit') => {
    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetch('/api/users', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || `Failed to ${mode} user`);
    }

    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Module Overview Banner & Filters */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md space-y-4 shadow-sm dark:shadow-none transition-colors duration-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Company-Wise User & Role Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage administrators, RSOs, TSOs, and CSRs scoped by enterprise company and operational territory.
              </p>
            </div>
          </div>

          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        </div>

        {/* Generic Select2 Company & Role Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Select2
            label="Filter by Company"
            options={companies}
            value={selectedCompanyId}
            onChange={(val) => setSelectedCompanyId(val || 'ALL')}
            placeholder="Select Company..."
            isClearable={false}
          />

          <Select2
            label="Filter by Role"
            options={[
              { value: 'ALL', label: 'All Roles' },
              { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN' },
              { value: 'RSO', label: 'RSO (Regional Sales Officer)' },
              { value: 'TSO', label: 'TSO (Territory Sales Officer)' },
              { value: 'CSR', label: 'CSR (Customer Sales Representative)' },
            ]}
            value={selectedRole}
            onChange={(val) => setSelectedRole(val || 'ALL')}
            placeholder="Select Role..."
            isClearable={false}
          />
        </div>
      </div>

      {/* 3-Tier Tabulator Server-Side Table */}
      <ServerDataTable<UserRecord>
        key={`${refreshTrigger}_${selectedCompanyId}_${selectedRole}`}
        endpoint="/api/users"
        columns={columns}
        idField="id"
        title="Active Personnel Directory"
        searchPlaceholder="Search users by name, email, or role..."
        additionalParams={{
          companyId: selectedCompanyId,
          roleName: selectedRole,
        }}
        exportFilenamePrefix="Afaz_Tobacco_Users"
        onBatchDelete={handleBatchDelete}
      />

      {/* Unified Single-Page Create & Edit Modal Controller */}
      <DynamicCrudModal
        isOpen={modalOpen}
        mode={modalMode}
        title={modalMode === 'create' ? 'Register New User Account' : `Edit User: ${currentUser?.full_name}`}
        fields={formFields}
        initialData={
          currentUser
            ? {
                id: currentUser.id,
                fullName: currentUser.full_name,
                email: currentUser.email,
                phone: currentUser.phone,
                roleName: currentUser.role_name,
                companyId: currentUser.company_id,
                territoryId: currentUser.territory_id,
                isActive: currentUser.is_active,
              }
            : null
        }
        onSubmit={handleFormSubmit}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
