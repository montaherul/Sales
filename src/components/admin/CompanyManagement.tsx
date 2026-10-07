'use client';

import React, { useState } from 'react';
import { ServerDataTable, ColumnDef } from '@/components/common/ServerDataTable';
import { DynamicCrudModal, DynamicFormField } from '@/components/common/DynamicCrudModal';
import { Building2, Plus, Edit, Trash2, Shield, MapPin, Users } from 'lucide-react';

interface CompanyRecord {
  id: string;
  name: string;
  code: string;
  division_count: number | string;
  territory_count: number | string;
  user_count: number | string;
  created_at: string;
}

export function CompanyManagement() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCompany, setSelectedCompany] = useState<CompanyRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Form Fields Schema for Create / Edit
  const formFields: DynamicFormField[] = [
    {
      name: 'name',
      label: 'Company Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Afaz Tobacco Company Ltd.',
      hint: 'The legal registered name of the enterprise company entity.',
    },
    {
      name: 'code',
      label: 'Company Code / Acronym',
      type: 'text',
      required: true,
      placeholder: 'e.g. ATC',
      hint: 'Short unique abbreviation used in report identifiers and data scoping.',
    },
  ];

  // Table Columns Definition
  const columns: ColumnDef<CompanyRecord>[] = [
    {
      key: 'name',
      header: 'Company Entity',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
            <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{row.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'division_count',
      header: 'Divisions',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold">
          <MapPin className="w-3 h-3" />
          {row.division_count || 0}
        </span>
      ),
    },
    {
      key: 'territory_count',
      header: 'Territories',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 font-semibold">
          {row.territory_count || 0} Territories
        </span>
      ),
    },
    {
      key: 'user_count',
      header: 'Assigned Staff',
      align: 'center',
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
          <Users className="w-3 h-3" />
          {row.user_count || 0} Users
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created On',
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
            onClick={() => handleEditClick(row)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            title="Edit Company"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteSingle(row.id)}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            title="Delete Company"
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
    setSelectedCompany(company);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDeleteSingle = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company? All cascading divisions will be removed.')) return;
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

  // Controller method for Submit (Handles both Create and Edit)
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

  return (
    <div className="space-y-6">
      {/* Module Overview Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-sm dark:shadow-none transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Enterprise Company Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage parent companies and root organizations for dynamic multi-company scoping and role assignments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleCreateClick}
            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Company</span>
          </button>
        </div>
      </div>

      {/* 3-Tier Tabulator Server-Side Table */}
      <ServerDataTable<CompanyRecord>
        key={refreshTrigger}
        endpoint="/api/companies"
        columns={columns}
        idField="id"
        title="Active Companies & Scoped Hierarchy"
        searchPlaceholder="Search company by name or code..."
        exportFilenamePrefix="Afaz_Tobacco_Companies"
        onBatchDelete={handleBatchDelete}
      />

      {/* Unified Single-Page Create & Edit Modal Controller */}
      <DynamicCrudModal
        isOpen={modalOpen}
        mode={modalMode}
        title={modalMode === 'create' ? 'Add New Enterprise Company' : `Edit Company: ${selectedCompany?.name}`}
        fields={formFields}
        initialData={selectedCompany}
        onSubmit={handleFormSubmit}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
