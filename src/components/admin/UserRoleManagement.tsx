'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  RefreshCw, 
  Search, 
  MapPin, 
  Mail, 
  Phone,
  CheckCircle2,
  XCircle,
  Building2
} from 'lucide-react';
import { RoleType } from '@/lib/types';

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role_name: RoleType;
  is_active: boolean;
  created_at?: string;
  territory_name?: string;
  region_name?: string;
}

interface TerritoryItem {
  id: string;
  name: string;
  region_name: string;
}

export function UserRoleManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<RoleType>('CSR');
  const [formTerritoryId, setFormTerritoryId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [userRes, masterRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/master-data'),
      ]);
      const userJson = await userRes.json();
      const masterJson = await masterRes.json();

      if (userJson.success) setUsers(userJson.data);
      if (masterJson.success) {
        setTerritories(masterJson.data.territories || []);
        if (masterJson.data.territories?.length > 0 && !formTerritoryId) {
          setFormTerritoryId(masterJson.data.territories[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load user records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          fullName: formName,
          phone: formPhone,
          roleName: formRole,
          territoryId: formTerritoryId,
          modifiedBy: 'admin@afaztobacco.com',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setModalOpen(false);
        setFormEmail('');
        setFormName('');
        setFormPhone('');
        fetchUsers();
      } else {
        alert(json.error || 'Failed to save user');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.role_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.territory_name && u.territory_name.toLowerCase().includes(search.toLowerCase()))
  );

  const getRoleBadge = (role: RoleType) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <span className="rounded-full bg-rose-950/80 text-rose-300 px-2.5 py-0.5 text-[10px] font-semibold border border-rose-800/60">SUPER ADMIN</span>;
      case 'RSO':
        return <span className="rounded-full bg-purple-950/80 text-purple-300 px-2.5 py-0.5 text-[10px] font-semibold border border-purple-800/60">RSO</span>;
      case 'TSO':
        return <span className="rounded-full bg-blue-950/80 text-blue-300 px-2.5 py-0.5 text-[10px] font-semibold border border-blue-800/60">TSO</span>;
      case 'CSR':
        return <span className="rounded-full bg-emerald-950/80 text-emerald-300 px-2.5 py-0.5 text-[10px] font-semibold border border-emerald-800/60">CSR</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span>User & Role Directory</span>
          </h2>
          <p className="text-xs text-slate-400">
            Manage enterprise user accounts, operational roles, and territorial access scopes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-md transition-all"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New User</span>
          </button>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, role or territory..."
          className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">User Name</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Geographic Scope</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-white">{u.full_name}</span>
                    {u.phone && <p className="text-[11px] text-slate-500">{u.phone}</p>}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-300">{u.email}</td>
                  <td className="py-3 px-4">{getRoleBadge(u.role_name)}</td>
                  <td className="py-3 px-4">
                    {u.territory_name ? (
                      <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                        <MapPin className="h-3 w-3 text-blue-400" />
                        {u.territory_name}
                      </span>
                    ) : u.region_name ? (
                      <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                        <Building2 className="h-3 w-3 text-purple-400" />
                        {u.region_name} Region
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Global Enterprise Scope</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                      <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-400" />
              <span>Create New User Profile</span>
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Mohammad Hossain"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g., mhossain@afaztobacco.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+8801700000000"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">System Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as RoleType)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="CSR">CSR (Customer Sales Representative)</option>
                  <option value="TSO">TSO (Territory Sales Officer)</option>
                  <option value="RSO">RSO (Regional Sales Officer)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (System Administrator)</option>
                </select>
              </div>

              {formRole !== 'SUPER_ADMIN' && (
                <div>
                  <label className="text-slate-400 block mb-1">Assigned Territory Scope</label>
                  <select
                    value={formTerritoryId}
                    onChange={(e) => setFormTerritoryId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white focus:border-blue-500 focus:outline-none"
                  >
                    {territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.region_name} Region)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
