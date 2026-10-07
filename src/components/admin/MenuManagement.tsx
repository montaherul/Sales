'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Eye, 
  Edit3, 
  Check, 
  X, 
  Save, 
  RefreshCw,
  Search,
  Lock,
  Layers,
  Building2,
  Users,
  Settings,
  History,
  FileSpreadsheet,
  CloudUpload,
  FileEdit,
  LayoutDashboard
} from 'lucide-react';
import { RoleType } from '@/lib/types';
import { Select2, Select2Option } from '@/components/common/Select2';

interface SystemMenu {
  id: string;
  title: string;
  category: 'OPERATIONAL' | 'ADMINISTRATIVE';
  icon: string;
  description: string;
  sort_order: number;
}

interface RoleAccess {
  role_name: string;
  menu_id: string;
  can_view: boolean;
  can_edit: boolean;
}

interface UserAccess {
  user_id: string;
  email: string;
  full_name: string;
  role_name: string;
  menu_id: string;
  can_view: boolean;
  can_edit: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_name: string;
  is_active: boolean;
}

export function MenuManagement() {
  const [activeSubTab, setActiveSubTab] = useState<'RWMA' | 'UWMA'>('RWMA');
  const [menus, setMenus] = useState<SystemMenu[]>([]);
  const [rwma, setRwma] = useState<RoleAccess[]>([]);
  const [uwma, setUwma] = useState<UserAccess[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const roles: RoleType[] = ['SUPER_ADMIN', 'RSO', 'TSO', 'CSR'];

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/menu-management');
      const json = await res.json();
      if (json.success && json.data) {
        setMenus(json.data.menus || []);
        setRwma(json.data.rwma || []);
        setUwma(json.data.uwma || []);
        setUsers(json.data.users || []);
        if (json.data.users?.length > 0 && !selectedUserId) {
          setSelectedUserId(json.data.users[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load menu access data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to find RWMA permissions
  const getRwmaPermission = (role: string, menuId: string) => {
    return rwma.find((r) => r.role_name === role && r.menu_id === menuId) || {
      role_name: role,
      menu_id: menuId,
      can_view: role === 'SUPER_ADMIN',
      can_edit: role === 'SUPER_ADMIN',
    };
  };

  // Helper to find UWMA permissions
  const getUwmaPermission = (userId: string, menuId: string) => {
    const custom = uwma.find((u) => u.user_id === userId && u.menu_id === menuId);
    if (custom) return custom;
    // Fallback to user's role default
    const user = users.find((u) => u.id === userId);
    if (!user) return { user_id: userId, menu_id: menuId, can_view: false, can_edit: false };
    const roleDef = getRwmaPermission(user.role_name, menuId);
    return {
      user_id: userId,
      menu_id: menuId,
      can_view: roleDef.can_view,
      can_edit: roleDef.can_edit,
    };
  };

  const handleToggleRwma = async (role: string, menuId: string, field: 'can_view' | 'can_edit') => {
    if (role === 'SUPER_ADMIN' && field === 'can_view') {
      alert('Super Admin cannot have view access revoked from system menus.');
      return;
    }

    const current = getRwmaPermission(role, menuId);
    const updated = {
      ...current,
      [field]: !current[field],
    };

    setRwma((prev) => {
      const existingIdx = prev.findIndex((r) => r.role_name === role && r.menu_id === menuId);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    setSavingKey(`${role}_${menuId}`);
    try {
      const res = await fetch('/api/menu-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'RWMA',
          roleName: role,
          menuId,
          canView: updated.can_view,
          canEdit: updated.can_edit,
          modifiedBy: 'admin@afaztobacco.com',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveToast(`Updated RWMA for ${role} on ${menuId}`);
        setTimeout(() => setSaveToast(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleUwma = async (userId: string, menuId: string, field: 'can_view' | 'can_edit') => {
    const current = getUwmaPermission(userId, menuId);
    const updated = {
      ...current,
      [field]: !current[field],
    };

    setUwma((prev) => {
      const existingIdx = prev.findIndex((u) => u.user_id === userId && u.menu_id === menuId);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = updated as UserAccess;
        return copy;
      }
      return [...prev, updated as UserAccess];
    });

    setSavingKey(`${userId}_${menuId}`);
    try {
      const res = await fetch('/api/menu-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'UWMA',
          userId,
          menuId,
          canView: updated.can_view,
          canEdit: updated.can_edit,
          modifiedBy: 'admin@afaztobacco.com',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaveToast(`Updated user menu permission on ${menuId}`);
        setTimeout(() => setSaveToast(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingKey(null);
    }
  };

  const filteredMenus = menus.filter(
    (m) =>
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span>Menu Management (RWMA & UWMA)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enterprise Access Control: Role-Wise Menu Access (RWMA) & User-Wise Menu Access (UWMA)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Rules</span>
          </button>
        </div>
      </div>

      {saveToast && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/60 px-4 py-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Tabs Switcher: RWMA vs UWMA */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('RWMA')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'RWMA'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>RWMA (Role-Wise Menu Access)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('UWMA')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'UWMA'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>UWMA (User-Wise Menu Access)</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search system menus or categories..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {activeSubTab === 'UWMA' && (
          <div className="w-80">
            <Select2
              options={users.map((u) => ({
                value: u.id,
                label: u.full_name,
                subLabel: u.email,
                badge: u.role_name,
              }))}
              value={selectedUserId}
              onChange={(val) => setSelectedUserId(val)}
              placeholder="Search and select user..."
              isClearable={false}
            />
          </div>
        )}
      </div>

      {/* TAB 1: RWMA (Role-Wise Menu Access Matrix) */}
      {activeSubTab === 'RWMA' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-64">System Menu / Module</th>
                  <th className="py-3 px-3 w-32">Category</th>
                  {roles.map((role) => (
                    <th key={role} className="py-3 px-4 text-center border-l border-slate-200 dark:border-slate-800/60">
                      <div className="font-bold text-slate-900 dark:text-white tracking-wide">{role}</div>
                      <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 mt-0.5">
                        <span title="Can View">View</span>
                        <span>•</span>
                        <span title="Can Edit">Edit</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {filteredMenus.map((menu) => (
                  <tr key={menu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    {/* Menu details */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{menu.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{menu.description}</p>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          menu.category === 'ADMINISTRATIVE'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40'
                            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/40'
                        }`}
                      >
                        {menu.category}
                      </span>
                    </td>

                    {/* Roles Matrix Columns */}
                    {roles.map((role) => {
                      const perm = getRwmaPermission(role, menu.id);
                      const isSaving = savingKey === `${role}_${menu.id}`;

                      return (
                        <td key={role} className="py-3 px-4 border-l border-slate-200 dark:border-slate-800/60 text-center">
                          <div className="flex items-center justify-center gap-3">
                            {/* View Toggle */}
                            <button
                              onClick={() => handleToggleRwma(role, menu.id, 'can_view')}
                              disabled={isSaving}
                              title={`Toggle View for ${role}`}
                              className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                perm.can_view
                                  ? 'bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-500/40 hover:bg-blue-200 dark:hover:bg-blue-600/30'
                                  : 'bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 hover:text-slate-600 dark:hover:text-slate-400'
                              }`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit Toggle */}
                            <button
                              onClick={() => handleToggleRwma(role, menu.id, 'can_edit')}
                              disabled={isSaving}
                              title={`Toggle Edit for ${role}`}
                              className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                                perm.can_edit
                                  ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-200 dark:hover:bg-emerald-600/30'
                                  : 'bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 hover:text-slate-600 dark:hover:text-slate-400'
                              }`}
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UWMA (User-Wise Menu Access Overrides) */}
      {activeSubTab === 'UWMA' && selectedUser && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow shrink-0">
                {selectedUser.full_name[0]}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedUser.full_name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedUser.email} • Role: <strong className="text-blue-600 dark:text-blue-400">{selectedUser.role_name}</strong>
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Customize or override specific menu accessibility for this individual user account.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-sm overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">System Menu / Feature</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Can View (Access)</th>
                    <th className="py-3 px-4 text-center">Can Edit (Modify)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredMenus.map((menu) => {
                    const perm = getUwmaPermission(selectedUser.id, menu.id);
                    const isSaving = savingKey === `${selectedUser.id}_${menu.id}`;

                    return (
                      <tr key={menu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900 dark:text-white">{menu.title}</span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{menu.description}</p>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                              menu.category === 'ADMINISTRATIVE'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800/40'
                            }`}
                          >
                            {menu.category}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleUwma(selectedUser.id, menu.id, 'can_view')}
                            disabled={isSaving}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                              perm.can_view
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {perm.can_view ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleUwma(selectedUser.id, menu.id, 'can_edit')}
                            disabled={isSaving}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                              perm.can_edit
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {perm.can_edit ? 'Allowed' : 'Read-Only'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
