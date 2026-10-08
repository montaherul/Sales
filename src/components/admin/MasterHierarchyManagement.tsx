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
  Coins, 
  Layers, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

interface MasterHierarchyManagementProps {
  companyId?: string;
}

export function MasterHierarchyManagement({ companyId = 'ALL' }: MasterHierarchyManagementProps) {
  const [activeTab, setActiveTab] = useState<'TERRITORIES' | 'BRANDS' | 'TARGETS'>('TERRITORIES');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companyId);
  const [companies, setCompanies] = useState<Select2Option[]>([]);
  const [regions, setRegions] = useState<Select2Option[]>([]);
  const [brands, setBrands] = useState<Select2Option[]>([]);
  const [territories, setTerritories] = useState<Select2Option[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);

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

  // Load master options for Select2 dropdowns (scoped to selectedCompanyId)
  useEffect(() => {
    async function loadOptions() {
      try {
        const query = selectedCompanyId && selectedCompanyId !== 'ALL' ? `?companyId=${selectedCompanyId}` : '';
        const [compRes, masterRes] = await Promise.all([
          fetch('/api/companies?pageSize=100'),
          fetch(`/api/master-data${query}`),
        ]);

        const compJson = await compRes.json();
        const masterJson = await masterRes.json();

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
          // Region options from master data
          const regOpts: Select2Option[] = (masterJson.data?.regions || []).map((r: any) => ({
            value: r.id,
            label: `${r.name} Region`,
            subLabel: r.company_name || 'Assigned Company',
          }));
          setRegions(regOpts);

          // Brand options
          const brandOpts: Select2Option[] = (masterJson.data?.brands || []).map((b: any) => ({
            value: b.id,
            label: b.name,
            badge: b.type,
          }));
          setBrands(brandOpts);

          // Territory options
          const terrOpts: Select2Option[] = (masterJson.data?.territories || []).map((t: any) => ({
            value: t.id,
            label: t.name,
            subLabel: t.region_name ? `${t.region_name} Region` : 'Assigned Region',
          }));
          setTerritories(terrOpts);
        }
      } catch (err) {
        console.error('Failed to load hierarchy options:', err);
      }
    }

    loadOptions();
  }, [selectedCompanyId]);

  // 1. TERRITORY CRUD DEFINITIONS
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
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.wing_name} • {row.division_name}</div>
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

  // 2. BRAND CRUD DEFINITIONS
  const brandColumns: ColumnDef<any>[] = [
    {
      key: 'name',
      header: 'Brand Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-white">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Category',
      sortable: true,
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
            row.type === 'CIGARETTE'
              ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
              : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
          }`}
        >
          {row.type}
        </span>
      ),
    },
    {
      key: 'unit_price',
      header: 'Unit Price (BDT)',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          {row.unit_price ? `BDT ${parseFloat(row.unit_price).toFixed(2)}` : '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <span className={`inline-flex items-center gap-1 text-[11px] ${row.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {row.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
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
      placeholder: 'e.g. Wilson or 22/25',
    },
    {
      name: 'type',
      label: 'Product Category',
      type: 'select2',
      required: true,
      options: [
        { value: 'CIGARETTE', label: 'Cigarette' },
        { value: 'ZARDA', label: 'Zarda' },
      ],
      defaultValue: 'CIGARETTE',
    },
    {
      name: 'unitPrice',
      label: 'Unit Price in BDT',
      type: 'number',
      placeholder: '0.00',
    },
    {
      name: 'sortOrder',
      label: 'Sort Order',
      type: 'number',
      defaultValue: 1,
    },
    {
      name: 'isActive',
      label: 'Is Active',
      type: 'boolean',
      defaultValue: true,
    },
  ];

  // 3. TARGET CRUD DEFINITIONS
  const targetColumns: ColumnDef<any>[] = [
    {
      key: 'territory_name',
      header: 'Territory',
      sortable: true,
      render: (row) => <span className="font-semibold text-slate-900 dark:text-white">{row.territory_name}</span>,
    },
    {
      key: 'brand_name',
      header: 'Brand',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {row.brand_name} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({row.brand_type})</span>
        </span>
      ),
    },
    {
      key: 'target_quantity',
      header: 'Target Volume',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
          {parseFloat(row.target_quantity || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'route_count',
      header: 'Routes',
      align: 'center',
      render: (row) => <span className="text-slate-600 dark:text-slate-400 font-mono">{row.route_count || 0}</span>,
    },
    {
      key: 'outlet_count',
      header: 'Outlets',
      align: 'center',
      render: (row) => <span className="text-slate-600 dark:text-slate-400 font-mono">{row.outlet_count || 0}</span>,
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
                Master Hierarchy, Pricing & Target Suite
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure Company-Scoped Divisions, Wings, Regions, Territories, Product Pricing, and Monthly Territory Targets.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setEditingItem(null);
              setModalMode('create');
              setModalOpen(true);
            }}
            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeTab === 'TERRITORIES'
                ? 'Add Territory'
                : activeTab === 'BRANDS'
                ? 'Add Brand / Price'
                : 'Set Territory Target'}
            </span>
          </button>
        </div>

        {/* Company Filter via Select2 & Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <button
              onClick={() => setActiveTab('TERRITORIES')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'TERRITORIES'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Territories & Geography</span>
            </button>

            <button
              onClick={() => setActiveTab('BRANDS')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'BRANDS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Brand Catalog & Pricing</span>
            </button>

            <button
              onClick={() => setActiveTab('TARGETS')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'TARGETS'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Territory Targets</span>
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

      {/* Unified Single-Page Create & Edit Controller Modal */}
      <DynamicCrudModal
        isOpen={modalOpen}
        mode={modalMode}
        title={
          activeTab === 'TERRITORIES'
            ? modalMode === 'create' ? 'Add New Territory' : `Edit Territory: ${editingItem?.territory_name}`
            : activeTab === 'BRANDS'
            ? modalMode === 'create' ? 'Add New Product Brand' : `Edit Brand: ${editingItem?.name}`
            : modalMode === 'create' ? 'Set Monthly Target' : `Edit Target: ${editingItem?.territory_name}`
        }
        fields={
          activeTab === 'TERRITORIES'
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
                regionId: editingItem.region_id,
                sortOrder: editingItem.sort_order,
                type: editingItem.type,
                unitPrice: editingItem.unit_price,
                isActive: editingItem.is_active,
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
