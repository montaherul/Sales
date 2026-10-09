'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  MapPin,
  Lock
} from 'lucide-react';
import { SessionUser } from '@/lib/auth/session';

interface OnboardingModalProps {
  user: SessionUser;
  isOpen: boolean;
  onComplete: (updatedUser: SessionUser) => void;
}

export function OnboardingModal({ user, isOpen, onComplete }: OnboardingModalProps) {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (newPassword.length < 3) {
      setErrorMessage('Password must be at least 3 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword,
          fullName,
          phone,
        }),
      });

      const json = await res.json();
      if (json.success && json.user) {
        onComplete(json.user);
      } else {
        setErrorMessage(json.error || 'Failed to complete onboarding.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error connecting to onboarding service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome & Account Activation</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Initial setup required for your assigned <strong className="text-blue-600 dark:text-blue-400">{user.role}</strong> account
          </p>
        </div>

        {/* Scoped Assignment Summary */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 text-xs">
          <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Organizational Scope:</span>
            <span className="font-semibold text-slate-900 dark:text-white">{user.companyName || 'Afaz Tobacco Company'}</span>
          </div>
          {user.regionName && (
            <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Assigned Region:</span>
              <span className="font-mono text-purple-700 dark:text-purple-300 font-semibold">{user.regionName}</span>
            </div>
          )}
          {user.territoryName && (
            <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Assigned Territory:</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300 font-semibold">{user.territoryName}</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Onboarding Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801700000000"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Set New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none font-mono transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Activating Account...' : 'Complete Activation & Enter Platform'}
          </button>
        </form>
      </div>
    </div>
  );
}
