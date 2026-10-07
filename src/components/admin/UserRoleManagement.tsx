'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ShieldCheck,
  Shield,
  Plus,
  Globe
} from 'lucide-react';
import { RoleType } from '@/shared/constants';

interface RawRegion {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
}

interface RawTerritory {
  id: string;
  name: string;
  region_id: string;
  region_name: string;
  company_id: string;
  company_name: string;
  sort_order: number;
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role_name: RoleType;
  is_active: boolean;
  company_id?: string;
  company_name?: string;
  company_code?: string;
  territory_id?: string;
  territory_name?: string;
  region_id?: string;
  region_name?: string;
  created_at?: string;
}

interface RoleRecord {
  id: string;
  name: string;
  description: string;
  company_id?: string | null;
  company_name?: string | null;
  company_code?: string | null;
  user_count: number;
  permission_count: number;
  is_system_role: boolean;
  created_at: string;
}

export function UserRoleManagement() {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES'>('USERS');

  // Master Data Cache
  const [rawRegions, setRawRegions] = useState<RawRegion[]>([]);
  const [rawTerritories, setRawTerritories] = useState<RawTerritory[]>([]);
  const [companies, setCompanies] = useState<Select2Option[]>([]);
  const [roles, setRoles] = useState<Select2Option[]>([]);

  // User Tab State
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Active form state inside User Modal (for dependent dropdown cascading)
  const [modalUserCompanyId, setModalUserCompanyId] = useState<string>('');
  const [modalUserRoleName, setModalUserRoleName] = useState<string>('CSR');

  // Role Tab State
  const [selectedRoleCompanyId, setSelectedRoleCompanyId] = useState<string>('ALL');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<'create' | 'edit'>('create');
  const [currentRoleItem, setCurrentRoleItem] = useState<RoleRecord | null>(null);
  const [roleRefreshTrigger, setRoleRefreshTrigger] = useState(0);

  // Load companies, regions, territories, and dynamic roles
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [compRes, masterRes, rolesRes] = await Promise.all([
          fetch('/api/companies?pageSize=100'),
          fetch('/api/master-data'),
          fetch('/api/roles?all=true'),
        ]);

        const compJson = await compRes.json();
        const masterJson = await masterRes.json();
        const rolesJson = await rolesRes.json();

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
          setRawRegions(masterJson.data?.regions || []);
          setRawTerritories(masterJson.data?.territories || []);
        }

        if (rolesJson.success && rolesJson.data) {
          const roleOpts: Select2Option[] = (rolesJson.data || []).map((r: any) => ({
            value: r.name,
            label: `${r.name} - ${r.description || 'System Role'}`,
            badge: r.is_system_role ? 'SYSTEM' : 'CUSTOM',
          }));
          setRoles(roleOpts);
        }
      } catch (err) {
        console.error('Failed to load companies/territories/roles:', err);
      }
    }

    loadMasterData();
  }, [roleRefreshTrigger]);

  // When opening Create or Edit user, sync modal state
  const handleOpenUserModal = (user: UserRecord | null, mode: 'create' | 'edit') => {
    setCurrentUser(user);
    setModalMode(mode);
    if (user) {
      setModalUserCompanyId(user.company_id || (companies[1]?.value || ''));
      setModalUserRoleName(user.role_name || 'CSR');
    } else {
      // Default to the first available real company or currently filtered company
      const defaultComp = selectedCompanyId !== 'ALL' ? selectedCompanyId : (companies[1]?.value || '');
      setModalUserCompanyId(defaultComp);
      setModalUserRoleName('CSR');
    }
    setModalOpen(true);
  };

  // Filtered regions and territories for the current selected company in modal
  const availableRegions = useMemo(() => {
    const list = modalUserCompanyId
      ? rawRegions.filter((r) => r.company_id === modalUserCompanyId)
      : rawRegions;
    return list.map((r) => ({
      value: r.id,
      label: r.name,
      subLabel: r.company_name,
    }));
  }, [modalUserCompanyId, rawRegions]);

  const availableTerritories = useMemo(() => {
    const list = modalUserCompanyId
      ? rawTerritories.filter((t) => t.company_id === modalUserCompanyId)
      : rawTerritories;
    return list.map((t) => ({
      value: t.id,
      label: t.name,
      subLabel: `${t.region_name} • ${t.company_name}`,
    }));
  }, [modalUserCompanyId, rawTerritories]);

  // Dynamic user form fields depending on Role and Company
  const userFormFields = useMemo((): DynamicFormField[] => {
    const fields: DynamicFormField[] = [
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
        required: true,
        placeholder: 'Select company...',
        options: companies.filter((c) => c.value !== 'ALL'),
        defaultValue: modalUserCompanyId || companies.filter((c) => c.value !== 'ALL')[0]?.value,
        hint: 'Primary enterprise organization that owns this user account and scopes.',
      },
      {
        name: 'roleName',
        label: 'Assigned Role',
        type: 'select2',
        required: true,
        defaultValue: modalUserRoleName || 'CSR',
        options: roles.length > 0 ? roles : [
          { value: 'SUPER_ADMIN', label: 'SUPER_ADMIN (Global System Access)', badge: 'GLOBAL' },
          { value: 'RSO', label: 'RSO (Regional Sales Officer)', badge: 'REGION' },
          { value: 'TSO', label: 'TSO (Territory Sales Officer)', badge: 'TERRITORY' },
          { value: 'CSR', label: 'CSR (Customer Sales Representative)', badge: 'OPERATIONAL' },
        ],
        hint: 'Determines operational permissions and workflow capabilities.',
      },
    ];

    // RSO scope: Region
    if (modalUserRoleName === 'RSO') {
      fields.push({
        name: 'regionId',
        label: 'Assigned Regional Scope',
        type: 'select2',
        required: true,
        placeholder: availableRegions.length > 0 ? 'Select region...' : 'No regions found for this company',
        options: availableRegions,
        hint: 'RSO supervises all territories within this assigned region.',
      });
    }

    // TSO and CSR scope: Territory
    if (modalUserRoleName === 'TSO' || modalUserRoleName === 'CSR') {
      fields.push({
        name: 'territoryId',
        label: 'Assigned Territory Scope',
        type: 'select2',
        required: true,
        placeholder: availableTerritories.length > 0 ? 'Select territory...' : 'No territories found for this company',
        options: availableTerritories,
        hint: `${modalUserRoleName} operational boundary for daily data entries and review.`,
      });
    }

    fields.push({
      name: 'isActive',
      label: 'Account Active Status',
      type: 'boolean',
      defaultValue: true,
    });

    return fields;
  }, [modalUserCompanyId, modalUserRoleName, companies, roles, availableRegions, availableTerritories]);

  // Handle dynamic field changes inside User modal
  const handleUserModalFieldChange = (fieldName: string, value: any) => {
    if (fieldName === 'companyId') {
      setModalUserCompanyId(value);
    }
    if (fieldName === 'roleName') {
      setModalUserRoleName(value);
    }
  };

  const userColumns: ColumnDef<UserRecord>[] = [
    {
      key: 'full_name',
      header: 'User Profile',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
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
      header: 'Role',
      sortable: true,
      render: (row) => {
        let badgeStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
        if (row.role_name === 'SUPER_ADMIN') badgeStyle = 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
        if (row.role_name === 'RSO') badgeStyle = 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800';
        if (row.role_name === 'TSO') badgeStyle = 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';
        if (row.role_name === 'CSR') badgeStyle = 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';

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
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-xs">{row.company_name || 'Afaz Tobacco Company'}</span>
          {row.company_code && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {row.company_code}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'territory_name',
      header: 'Geographic Scope',
      render: (row) => {
        if (row.role_name === 'SUPER_ADMIN') {
          return (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-mono">
              <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Global Enterprise</span>
            </div>
          );
        }

        if (row.role_name === 'RSO') {
          return (
            <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Region: {row.region_name || 'Assigned Region'}</span>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 text-xs font-medium">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{row.territory_name || 'Assigned Territory'}</span>
            {row.region_name && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                ({row.region_name})
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            row.is_active
              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
              : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60'
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
            onClick={() => handleOpenUserModal(row, 'edit')}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit User"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteUserSingle(row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete User"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const handleDeleteUserSingle = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user profile?')) return;
    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alert(json.error || 'Failed to delete user');
      }
    } catch {
      alert('Error deleting user');
    }
  };

  const handleUserBatchDelete = async (selectedIds: string[]) => {
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

  const handleUserFormSubmit = async (formData: Record<string, any>, mode: 'create' | 'edit') => {
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

  // ==========================================
  // 2. ROLE CRUD SCHEMAS & CONTROLLERS (COMPANY-WISE)
  // ==========================================

  const roleFormFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Role Identifier Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. AUDITOR or REGIONAL_DIRECTOR',
      hint: 'Identifier will be auto-formatted to uppercase (e.g. AUDITOR). Core system roles cannot be renamed.',
    },
    {
      name: 'description',
      label: 'Role Description & Scope',
      type: 'text',
      placeholder: 'e.g. Compliance auditor with read-only inspection access',
      hint: 'Operational responsibilities and authorization boundaries.',
    },
    {
      name: 'companyId',
      label: 'Assigned Company (Optional)',
      type: 'select2',
      placeholder: 'Select company for role scoping...',
      options: [
        { value: 'GLOBAL', label: 'Global / Enterprise-Wide (All Companies)' },
        ...companies.filter((c) => c.value !== 'ALL'),
      ],
      defaultValue: 'GLOBAL',
      hint: 'Leave Global for enterprise roles, or select a specific company entity.',
    },
  ];

  const roleColumns: ColumnDef<RoleRecord>[] = [
    {
      key: 'name',
      header: 'Role Name & Type',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{row.name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  row.is_system_role
                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                }`}
              >
                {row.is_system_role ? 'PROTECTED SYSTEM' : 'CUSTOM ROLE'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{row.description || 'No description configured'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company Scope',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          {row.company_name ? (
            <span className="font-medium text-slate-900 dark:text-white">{row.company_name}</span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">Global (All Companies)</span>
          )}
        </div>
      ),
    },
    {
      key: 'user_count',
      header: 'Assigned Personnel',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
          {row.user_count} User{row.user_count !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created On',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'Initial Setup'}
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
              setCurrentRoleItem(row);
              setRoleModalMode('edit');
              setRoleModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Role Description"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>

          {!row.is_system_role ? (
            <button
              onClick={() => handleDeleteRoleSingle(row.id, row.name, row.user_count)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
              title="Delete Role"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span
              className="p-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed"
              title="System protected role cannot be deleted"
            >
              <Trash2 className="w-3.5 h-3.5 opacity-30" />
            </span>
          )}
        </div>
      ),
    },
  ];

  const handleDeleteRoleSingle = async (roleId: string, roleName: string, userCount: number) => {
    if (userCount > 0) {
      alert(`Cannot delete role "${roleName}" because ${userCount} active users are currently assigned to it.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete role "${roleName}"?`)) return;

    try {
      const res = await fetch(`/api/roles?id=${roleId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRoleRefreshTrigger((prev) => prev + 1);
      } else {
        alert(json.error || 'Failed to delete role');
      }
    } catch {
      alert('Error deleting role');
    }
  };

  const handleRoleBatchDelete = async (selectedIds: string[]) => {
    const res = await fetch('/api/roles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Batch deletion failed');
    }
    setRoleRefreshTrigger((prev) => prev + 1);
  };

  const handleRoleFormSubmit = async (formData: Record<string, any>, mode: 'create' | 'edit') => {
    const payload = {
      ...formData,
      companyId: formData.companyId === 'GLOBAL' ? null : formData.companyId,
    };
    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetch('/api/roles', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || `Failed to ${mode} role`);
    }

    setRoleRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Module Overview Banner & Sub-Tabs */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md space-y-4 shadow-sm dark:shadow-none transition-colors duration-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Enterprise Users & Roles Governance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage company-scoped personnel (RSO, TSO, CSR), geographic boundaries, and company-wise role catalogs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {activeSubTab === 'USERS' ? (
              <button
                onClick={() => handleOpenUserModal(null, 'create')}
                className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create New User</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setCurrentRoleItem(null);
                  setRoleModalMode('create');
                  setRoleModalOpen(true);
                }}
                className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Role</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher: Users vs Roles */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveSubTab('USERS')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'USERS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Personnel Directory (Company & Role Wise)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ROLES')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'ROLES'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>System Roles & Catalog (Company Scoped)</span>
          </button>
        </div>

        {/* Filters (Shown for Users Tab) */}
        {activeSubTab === 'USERS' && (
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
                ...roles,
              ]}
              value={selectedRole}
              onChange={(val) => setSelectedRole(val || 'ALL')}
              placeholder="Select Role..."
              isClearable={false}
            />
          </div>
        )}

        {/* Filters (Shown for Roles Tab) */}
        {activeSubTab === 'ROLES' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Select2
              label="Filter Roles by Company"
              options={companies}
              value={selectedRoleCompanyId}
              onChange={(val) => setSelectedRoleCompanyId(val || 'ALL')}
              placeholder="Select Company..."
              isClearable={false}
            />
          </div>
        )}
      </div>

      {/* SUB-TAB 1: USERS DIRECTORY */}
      {activeSubTab === 'USERS' && (
        <ServerDataTable<UserRecord>
          key={`users_${refreshTrigger}_${selectedCompanyId}_${selectedRole}`}
          endpoint="/api/users"
          columns={userColumns}
          idField="id"
          title="Active Personnel Directory"
          searchPlaceholder="Search users by name, email, or role..."
          additionalParams={{
            companyId: selectedCompanyId,
            roleName: selectedRole,
          }}
          exportFilenamePrefix="Afaz_Tobacco_Users"
          onBatchDelete={handleUserBatchDelete}
        />
      )}

      {/* SUB-TAB 2: ROLES CATALOG */}
      {activeSubTab === 'ROLES' && (
        <ServerDataTable<RoleRecord>
          key={`roles_${roleRefreshTrigger}_${selectedRoleCompanyId}`}
          endpoint="/api/roles"
          columns={roleColumns}
          idField="id"
          title="Role Definitions & User Allocation"
          searchPlaceholder="Search roles by identifier or description..."
          additionalParams={{
            companyId: selectedRoleCompanyId,
          }}
          exportFilenamePrefix="Afaz_Tobacco_Roles"
          onBatchDelete={handleRoleBatchDelete}
        />
      )}

      {/* User Create & Edit Modal Controller */}
      <DynamicCrudModal
        isOpen={modalOpen}
        mode={modalMode}
        title={modalMode === 'create' ? 'Register New User Account' : `Edit User: ${currentUser?.full_name}`}
        fields={userFormFields}
        onFieldChange={handleUserModalFieldChange}
        initialData={
          currentUser
            ? {
                id: currentUser.id,
                fullName: currentUser.full_name,
                email: currentUser.email,
                phone: currentUser.phone,
                roleName: currentUser.role_name,
                companyId: currentUser.company_id,
                regionId: currentUser.region_id,
                territoryId: currentUser.territory_id,
                isActive: currentUser.is_active,
              }
            : null
        }
        onSubmit={handleUserFormSubmit}
        onClose={() => setModalOpen(false)}
      />

      {/* Role Create & Edit Modal Controller */}
      <DynamicCrudModal
        isOpen={roleModalOpen}
        mode={roleModalMode}
        title={roleModalMode === 'create' ? 'Create Custom System Role' : `Edit Role: ${currentRoleItem?.name}`}
        fields={roleFormFields}
        initialData={
          currentRoleItem
            ? {
                id: currentRoleItem.id,
                name: currentRoleItem.name,
                description: currentRoleItem.description,
                companyId: currentRoleItem.company_id || 'GLOBAL',
              }
            : null
        }
        onSubmit={handleRoleFormSubmit}
        onClose={() => setRoleModalOpen(false)}
      />
    </div>
  );
}
