'use client';

import React, { useState, useEffect } from 'react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { DynamicCrudModal, DynamicFormField } from '@/components/common/DynamicCrudModal';
import { Select2, Select2Option } from '@/components/common/Select2';
import { 
  Building2, 
  MapPin, 
  Tag, 
  Target, 
  Plus, 
  Edit, 
  Trash2, 
  CalendarDays,
  Briefcase,
  Network,
  Truck,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Users
} from 'lucide-react';
import { PeriodManagement } from './PeriodManagement';

interface MasterHierarchyManagementProps {
  companyId?: string;
}

export function MasterHierarchyManagement({ companyId = 'ALL' }: MasterHierarchyManagementProps) {
  const [activeTab, setActiveTab] = useState<
    'DEPARTMENTS' | 'POSITIONS' | 'DISTRIBUTORS' | 'TERRITORIES' | 'BRANDS' | 'TARGETS' | 'PERIODS'
  >('DEPARTMENTS');

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companyId);
  const [companies, setCompanies] = useState<Select2Option[]>([]);
  const [regions, setRegions] = useState<Select2Option[]>([]);
  const [brands, setBrands] = useState<Select2Option[]>([]);
  const [territories, setTerritories] = useState<Select2Option[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Select2Option[]>([]);
  const [positionOptions, setPositionOptions] = useState<Select2Option[]>([]);
  const [roleOptions, setRoleOptions] = useState<Select2Option[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);

  // Sync external companyId change
  useEffect(() => {
    if (companyId) {
      setSelectedCompanyId(companyId);
    }
  }, [companyId]);

  // Modal Controller State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<any>(null);

  // Load master options for Select2 dropdowns
  useEffect(() => {
    async function loadOptions() {
      try {
        const query = selectedCompanyId && selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
        const [compRes, masterRes, deptRes, posRes, rolesRes] = await Promise.all([
          fetch('/api/companies?pageSize=100'),
          fetch(`/api/master-data${query}`),
          fetch(`/api/organization/departments${query}`),
          fetch(`/api/organization/positions${query}`),
          fetch('/api/roles?all=true'),
        ]);

        const compJson = await compRes.json();
        const masterJson = await masterRes.json();
        const deptJson = await deptRes.json();
        const posJson = await posRes.json();
        const rolesJson = await rolesRes.json();

        if (compJson.success) {
          setCompanies([
            { value: 'ALL', label: 'All Companies (Enterprise)' },
            ...(compJson.data || []).map((c: any) => ({
              value: c.id,
              label: c.name,
              badge: c.code,
            })),
          ]);
        }

        if (masterJson.success) {
          setRegions(
            (masterJson.data?.regions || []).map((r: any) => ({
              value: r.id,
              label: `${r.name} Region`,
              subLabel: r.company_name || 'Assigned Company',
            }))
          );

          setBrands(
            (masterJson.data?.brands || []).map((b: any) => ({
              value: b.id,
              label: b.name,
              badge: b.type,
            }))
          );

          setTerritories(
            (masterJson.data?.territories || []).map((t: any) => ({
              value: t.id,
              label: t.name,
              subLabel: t.region_name ? `${t.region_name} Region` : 'Assigned Region',
            }))
          );
        }

        if (deptJson.success) {
          setDepartmentOptions(
            (deptJson.data || []).map((d: any) => ({
              value: d.id,
              label: d.name,
              badge: d.code,
              subLabel: d.company_name,
            }))
          );
        }

        if (posJson.success) {
          setPositionOptions(
            (posJson.data || []).map((p: any) => ({
              value: p.id,
              label: `${p.name} (Lvl ${p.level})`,
              badge: p.department_name || p.code,
              subLabel: p.company_name,
            }))
          );
        }

        if (rolesJson.success) {
          setRoleOptions(
            (rolesJson.data || []).map((r: any) => ({
              value: r.id,
              label: r.name,
              badge: r.is_system_role ? 'SYSTEM' : 'CUSTOM',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load hierarchy options:', err);
      }
    }

    loadOptions();
  }, [selectedCompanyId, refreshKey]);

  // Handle template provision
  const handleProvisionTemplate = async () => {
    if (selectedCompanyId === 'ALL') {
      alert('Please filter by a specific company first to provision its organization template.');
      return;
    }
    if (
      !confirm(
        'Provision default FMCG/Tobacco organizational hierarchy (Departments, Position tree, Roles, Supervisor relations, and Distributor structure) for this tenant?'
      )
    ) {
      return;
    }

    setIsProvisioning(true);
    try {
      const res = await fetch('/api/organization/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId }),
      });
      const json = await res.json();
      if (json.success) {
        alert(
          `Success! Provisioned ${json.data.departments} departments, ${json.data.positions} positions, and verified organizational reporting structure.`
        );
        setRefreshKey((prev) => prev + 1);
      } else {
        alert(json.error || 'Failed to provision template');
      }
    } catch (err: any) {
      alert(err.message || 'Provisioning failed');
    } finally {
      setIsProvisioning(false);
    }
  };

  // 1. DEPARTMENTS COLUMNS & FIELDS
  const departmentColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Department Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company / Tenant',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 text-xs">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          {row.company_name || 'Afaz Tobacco'}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
          {row.description || '—'}
        </span>
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
              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
              : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60'
          }`}
        >
          {row.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {row.is_active ? 'Active' : 'Inactive'}
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
              setEditingItem(row);
              setModalMode('edit');
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Department"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete('/api/organization/departments', row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Department"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const departmentFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Department Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Sales, Marketing, Logistics',
    },
    {
      name: 'code',
      label: 'Department Code',
      type: 'text',
      required: true,
      placeholder: 'e.g. SALES, MKT, LOG',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Scope and operations of this department...',
    },
    {
      name: 'isActive',
      label: 'Active Status',
      type: 'boolean',
      defaultValue: true,
    },
  ];

  // 2. POSITIONS COLUMNS & FIELDS
  const positionColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Position Title',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>
            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {row.code}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 text-xs font-medium">
          <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
          {row.department_name || 'General'}
        </span>
      ),
    },
    {
      key: 'level',
      header: 'Hierarchy Level',
      align: 'center',
      render: (row) => {
        let badgeColor = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
        if (row.level === 1) badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300';
        if (row.level === 2) badgeColor = 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300';
        if (row.level === 3) badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300';
        if (row.level === 4) badgeColor = 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300';
        if (row.level === 5) badgeColor = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300';
        if (row.level === 6) badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300';
        if (row.level >= 7) badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300';

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${badgeColor}`}>
            Lvl {row.level}
          </span>
        );
      },
    },
    {
      key: 'parent_position_name',
      header: 'Reports To (Supervisor Position)',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {row.parent_position_name ? `↳ ${row.parent_position_name}` : '★ Direct to Board / Executive'}
        </span>
      ),
    },
    {
      key: 'default_role_name',
      header: 'Default RBAC Role',
      render: (row) => (
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          {row.default_role_name || 'CSR'}
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
              setEditingItem(row);
              setModalMode('edit');
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Position"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete('/api/organization/positions', row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Position"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const positionFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Position Title',
      type: 'text',
      required: true,
      placeholder: 'e.g. Regional Manager, Area Manager, TSO, CSR',
    },
    {
      name: 'code',
      label: 'Position Code',
      type: 'text',
      required: true,
      placeholder: 'e.g. RM, ASM, TSO, CSR, BM',
    },
    {
      name: 'departmentId',
      label: 'Department',
      type: 'select2',
      required: true,
      options: departmentOptions,
      defaultValue: departmentOptions[0]?.value,
    },
    {
      name: 'level',
      label: 'Hierarchy Level (1=Top Executive to 8=Field Rep)',
      type: 'number',
      required: true,
      defaultValue: 6,
    },
    {
      name: 'parentPositionId',
      label: 'Reporting Parent Position',
      type: 'select2',
      options: [{ value: '', label: 'None (Top Level Executive)' }, ...positionOptions],
    },
    {
      name: 'defaultRoleId',
      label: 'Default RBAC Role',
      type: 'select2',
      options: roleOptions,
    },
  ];

  // 3. DISTRIBUTORS COLUMNS & FIELDS
  const distributorColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Distributor House',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>
            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              {row.code}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'proprietor_name',
      header: 'Proprietor / Contact',
      render: (row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800 dark:text-slate-200">{row.proprietor_name || '—'}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{row.phone || row.email || '—'}</div>
        </div>
      ),
    },
    {
      key: 'territory_name',
      header: 'Territory Coverage',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 text-xs">
          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
          {row.territory_name || 'All Territory'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            row.status === 'ACTIVE'
              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
              : 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60'
          }`}
        >
          {row.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {row.status}
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
              setEditingItem(row);
              setModalMode('edit');
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Distributor"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete('/api/organization/distributors', row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Distributor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const distributorFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Distributor House Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Chittagong Tobacco Traders',
    },
    {
      name: 'code',
      label: 'Distributor Code',
      type: 'text',
      required: true,
      placeholder: 'e.g. DIST-CTG-01',
    },
    {
      name: 'proprietorName',
      label: 'Proprietor Name',
      type: 'text',
      placeholder: 'e.g. Al-Haj Abdul Karim',
    },
    {
      name: 'phone',
      label: 'Contact Phone',
      type: 'text',
      placeholder: '+880 1711-000000',
    },
    {
      name: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'contact@distributor.com',
    },
    {
      name: 'territoryId',
      label: 'Assigned Territory Scope',
      type: 'select2',
      options: territories,
    },
    {
      name: 'address',
      label: 'Warehouse Address',
      type: 'textarea',
      placeholder: 'Physical depot/warehouse location...',
    },
  ];

  // 4. TERRITORY CRUD DEFINITIONS
  const territoryColumns: ColumnDef<any>[] = [
    {
      key: 'territory_name',
      header: 'Territory Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-white">{row.territory_name}</span>
        </div>
      ),
    },
    {
      key: 'region_name',
      header: 'Region / Wing / Division',
      render: (row) => (
        <div className="text-xs">
          <div className="text-slate-800 dark:text-slate-200 font-medium">{row.region_name}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {row.wing_name} • {row.division_name}
          </div>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Parent Company',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          {row.company_name}
        </span>
      ),
    },
    {
      key: 'sort_order',
      header: 'Order',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          #{row.sort_order}
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
              setEditingItem(row);
              setModalMode('edit');
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Territory"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete('/api/hierarchy', row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Territory"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const territoryFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Territory Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Kerani hat',
    },
    {
      name: 'regionId',
      label: 'Assigned Region',
      type: 'select2',
      required: true,
      options: regions,
      defaultValue: regions[0]?.value,
    },
    {
      name: 'sortOrder',
      label: 'Sort Order',
      type: 'number',
      defaultValue: 1,
    },
  ];

  // 5. BRAND CRUD DEFINITIONS
  const brandColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Brand Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company / Tenant',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          {row.company_name}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Product Line Type',
      align: 'center',
      render: (row) => (
        <span
          className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
            row.type === 'CIGARETTE'
              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
              : row.type === 'BIDI'
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      key: 'unit_price',
      header: 'Unit Price (Tk)',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-white">
          ৳{parseFloat(row.unit_price || 0).toFixed(2)}
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
              setEditingItem(row);
              setModalMode('edit');
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Brand"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete('/api/brands', row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Brand"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const brandFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Brand Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Navy, Sheikh, Gold Leaf',
    },
    {
      name: 'type',
      label: 'Product Line Type',
      type: 'select2',
      required: true,
      options: [
        { value: 'CIGARETTE', label: 'Cigarette' },
        { value: 'BIDI', label: 'Bidi' },
        { value: 'ZARDA', label: 'Zarda' },
        { value: 'EMPTY_PACKET', label: 'Empty Packet' },
      ],
      defaultValue: 'CIGARETTE',
    },
    {
      name: 'unitPrice',
      label: 'Unit Price (BDT)',
      type: 'number',
      required: true,
      placeholder: '0.00',
    },
    {
      name: 'sortOrder',
      label: 'Display Order',
      type: 'number',
      defaultValue: 1,
    },
  ];

  // 6. TARGET CRUD DEFINITIONS
  const targetColumns: ColumnDef<any>[] = [
    {
      key: 'territory_name',
      header: 'Territory',
      sortable: true,
      render: (row) => (
        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          {row.territory_name}
        </div>
      ),
    },
    {
      key: 'brand_name',
      header: 'Target Product Brand',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-800 dark:text-slate-200">{row.brand_name}</span>
      ),
    },
    {
      key: 'target_quantity',
      header: 'Target Volume (Mille/Units)',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
          {parseFloat(row.target_quantity || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'target_amount',
      header: 'Value (Tk)',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
          ৳{parseFloat(row.target_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'route_count',
      header: 'Routes / Outlets',
      align: 'center',
      render: (row) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
          {row.route_count} / {row.outlet_count}
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
              setEditingItem(row);
              setModalMode('edit');
              setModalOpen(true);
            }}
            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border-blue-800/50 transition-all cursor-pointer shadow-xs"
            title="Edit Target"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete('/api/targets', row.id)}
            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-900/60 dark:border-rose-800/50 transition-all cursor-pointer shadow-xs"
            title="Delete Target"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const targetFields: DynamicFormField[] = [
    {
      name: 'territoryId',
      label: 'Territory',
      type: 'select2',
      required: true,
      options: territories,
    },
    {
      name: 'brandId',
      label: 'Brand',
      type: 'select2',
      required: true,
      options: brands,
    },
    {
      name: 'targetQuantity',
      label: 'Target Volume',
      type: 'number',
      required: true,
      placeholder: '0.00',
    },
    {
      name: 'routeCount',
      label: 'Route Count',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'outletCount',
      label: 'Outlet Count',
      type: 'number',
      defaultValue: 0,
    },
  ];

  const handleDelete = async (endpoint: string, id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await fetch(`${endpoint}?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setRefreshKey((prev) => prev + 1);
      } else {
        alert(json.error || 'Failed to delete');
      }
    } catch {
      alert('Delete failed');
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>, mode: 'create' | 'edit') => {
    let endpoint = '/api/hierarchy';
    if (activeTab === 'DEPARTMENTS') endpoint = '/api/organization/departments';
    if (activeTab === 'POSITIONS') endpoint = '/api/organization/positions';
    if (activeTab === 'DISTRIBUTORS') endpoint = '/api/organization/distributors';
    if (activeTab === 'BRANDS') endpoint = '/api/brands';
    if (activeTab === 'TARGETS') endpoint = '/api/targets';

    const payload = {
      ...formData,
      ...(selectedCompanyId && selectedCompanyId !== 'ALL' && !formData.companyId
        ? { companyId: selectedCompanyId }
        : {}),
    };

    const method = mode === 'create' ? 'POST' : 'PUT';
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || `Failed to ${mode} record`);
    }

    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Module Overview Banner */}
      <div className="relative z-30 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Tenant Organization & Master Hierarchy Suite
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurable Organization Structure: Departments, Reporting Positions, Distributors, Geographical Boundaries, Pricing & Targets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* 1-Click Provision FMCG / Tobacco Template */}
            <button
              onClick={handleProvisionTemplate}
              disabled={isProvisioning || selectedCompanyId === 'ALL'}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              title={
                selectedCompanyId === 'ALL'
                  ? 'Select a specific company to provision template'
                  : 'Auto-provision full FMCG department and position tree'
              }
            >
              {isProvisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Provision FMCG Template</span>
            </button>

            {activeTab !== 'PERIODS' && (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setModalMode('create');
                  setModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {activeTab === 'DEPARTMENTS'
                    ? 'Add Department'
                    : activeTab === 'POSITIONS'
                    ? 'Add Position'
                    : activeTab === 'DISTRIBUTORS'
                    ? 'Add Distributor'
                    : activeTab === 'TERRITORIES'
                    ? 'Add Territory'
                    : activeTab === 'BRANDS'
                    ? 'Add Brand / Price'
                    : 'Set Monthly Target'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Company Filter via Select2 & Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('DEPARTMENTS')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'DEPARTMENTS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Departments</span>
            </button>

            <button
              onClick={() => setActiveTab('POSITIONS')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'POSITIONS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Positions & Hierarchy</span>
            </button>

            <button
              onClick={() => setActiveTab('DISTRIBUTORS')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'DISTRIBUTORS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Distributors</span>
            </button>

            <button
              onClick={() => setActiveTab('TERRITORIES')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'TERRITORIES'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Territories</span>
            </button>

            <button
              onClick={() => setActiveTab('BRANDS')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'BRANDS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Brands & Pricing</span>
            </button>

            <button
              onClick={() => setActiveTab('TARGETS')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'TARGETS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Targets</span>
            </button>

            <button
              onClick={() => setActiveTab('PERIODS')}
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'PERIODS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Periods</span>
            </button>
          </div>

          <div className="w-full sm:w-72">
            <Select2
              options={companies}
              value={selectedCompanyId}
              onChange={(val) => setSelectedCompanyId(val || 'ALL')}
              placeholder="Filter by Company Scope..."
              isClearable={false}
            />
          </div>
        </div>
      </div>

      {/* Dynamic Tab Body with ServerDataTable */}
      {activeTab === 'DEPARTMENTS' && (
        <ServerDataTable
          key={`dept_${refreshKey}_${selectedCompanyId}`}
          endpoint="/api/organization/departments"
          columns={departmentColumns}
          idField="id"
          title="Tenant Organizational Departments"
          searchPlaceholder="Search department name or code..."
          additionalParams={{ companyId: selectedCompanyId }}
          exportFilenamePrefix="Tenant_Departments"
          onBatchDelete={async (ids) => {
            await fetch('/api/organization/departments', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
          }}
        />
      )}

      {activeTab === 'POSITIONS' && (
        <ServerDataTable
          key={`pos_${refreshKey}_${selectedCompanyId}`}
          endpoint="/api/organization/positions"
          columns={positionColumns}
          idField="id"
          title="Organizational Position Hierarchy & Reporting Lines"
          searchPlaceholder="Search position name, department, or code..."
          additionalParams={{ companyId: selectedCompanyId }}
          exportFilenamePrefix="Tenant_Positions"
          onBatchDelete={async (ids) => {
            await fetch('/api/organization/positions', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
          }}
        />
      )}

      {activeTab === 'DISTRIBUTORS' && (
        <ServerDataTable
          key={`dist_${refreshKey}_${selectedCompanyId}`}
          endpoint="/api/organization/distributors"
          columns={distributorColumns}
          idField="id"
          title="Distributor Houses & Logistics Network"
          searchPlaceholder="Search distributor name, code, proprietor..."
          additionalParams={{ companyId: selectedCompanyId }}
          exportFilenamePrefix="Tenant_Distributors"
          onBatchDelete={async (ids) => {
            await fetch('/api/organization/distributors', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
          }}
        />
      )}

      {activeTab === 'TERRITORIES' && (
        <ServerDataTable
          key={`terr_${refreshKey}_${selectedCompanyId}`}
          endpoint="/api/hierarchy"
          columns={territoryColumns}
          idField="id"
          title="Active Operational Territories"
          searchPlaceholder="Search territory or region name..."
          additionalParams={{ companyId: selectedCompanyId }}
          exportFilenamePrefix="Territories_Hierarchy"
          onBatchDelete={async (ids) => {
            await fetch('/api/hierarchy', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
          }}
        />
      )}

      {activeTab === 'BRANDS' && (
        <ServerDataTable
          key={`brand_${refreshKey}_${selectedCompanyId}`}
          endpoint="/api/brands"
          columns={brandColumns}
          idField="id"
          title="Product Brand Catalog & Pricing"
          searchPlaceholder="Search brand name..."
          additionalParams={{ companyId: selectedCompanyId }}
          exportFilenamePrefix="Brand_Pricing_Catalog"
          onBatchDelete={async (ids) => {
            await fetch('/api/brands', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
          }}
        />
      )}

      {activeTab === 'TARGETS' && (
        <ServerDataTable
          key={`target_${refreshKey}_${selectedCompanyId}`}
          endpoint="/api/targets"
          columns={targetColumns}
          idField="id"
          title="October 2026 Monthly Targets"
          searchPlaceholder="Search targets by territory or brand..."
          additionalParams={{ year: 2026, month: 10, companyId: selectedCompanyId }}
          exportFilenamePrefix="October_2026_Targets"
          onBatchDelete={async (ids) => {
            await fetch('/api/targets', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            });
          }}
        />
      )}

      {activeTab === 'PERIODS' && (
        <PeriodManagement companyId={selectedCompanyId} />
      )}

      {/* Unified Single-Page Create & Edit Controller Modal */}
      <DynamicCrudModal
        isOpen={modalOpen}
        mode={modalMode}
        title={
          activeTab === 'DEPARTMENTS'
            ? modalMode === 'create' ? 'Add New Department' : `Edit Department: ${editingItem?.name}`
            : activeTab === 'POSITIONS'
            ? modalMode === 'create' ? 'Add Organizational Position' : `Edit Position: ${editingItem?.name}`
            : activeTab === 'DISTRIBUTORS'
            ? modalMode === 'create' ? 'Add Distributor House' : `Edit Distributor: ${editingItem?.name}`
            : activeTab === 'TERRITORIES'
            ? modalMode === 'create' ? 'Add New Territory' : `Edit Territory: ${editingItem?.territory_name}`
            : activeTab === 'BRANDS'
            ? modalMode === 'create' ? 'Add New Product Brand' : `Edit Brand: ${editingItem?.name}`
            : modalMode === 'create' ? 'Set Monthly Target' : `Edit Target: ${editingItem?.territory_name}`
        }
        fields={
          activeTab === 'DEPARTMENTS'
            ? departmentFields
            : activeTab === 'POSITIONS'
            ? positionFields
            : activeTab === 'DISTRIBUTORS'
            ? distributorFields
            : activeTab === 'TERRITORIES'
            ? territoryFields
            : activeTab === 'BRANDS'
            ? brandFields
            : targetFields
        }
        initialData={
          editingItem
            ? {
                id: editingItem.id,
                name: editingItem.territory_name || editingItem.name,
                code: editingItem.code,
                description: editingItem.description,
                departmentId: editingItem.department_id,
                level: editingItem.level,
                parentPositionId: editingItem.parent_position_id,
                defaultRoleId: editingItem.default_role_id,
                proprietorName: editingItem.proprietor_name,
                phone: editingItem.phone,
                email: editingItem.email,
                address: editingItem.address,
                regionId: editingItem.region_id,
                sortOrder: editingItem.sort_order,
                type: editingItem.type,
                unitPrice: editingItem.unit_price,
                isActive: editingItem.is_active ?? true,
                territoryId: editingItem.territory_id,
                brandId: editingItem.brand_id,
                targetQuantity: editingItem.target_quantity,
                routeCount: editingItem.route_count,
                outletCount: editingItem.outlet_count,
              }
            : null
        }
        onSubmit={handleFormSubmit}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
