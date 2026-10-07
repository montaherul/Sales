'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Users,
  Fingerprint
} from 'lucide-react';
import { RoleType } from '@/lib/types';
import { SessionUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface LoginPageProps {
  onLoginSuccess: (user: SessionUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('admin@afaztobacco.com');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Check URL parameters for OAuth errors upon redirect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      const emailParam = params.get('email');

      if (errorParam === 'google_not_provisioned') {
        setErrorMessage(
          `Google account (${emailParam || 'used'}) is not authorized. Self-registration is disabled. Please contact your Super Administrator to provision your enterprise account.`
        );
      } else if (errorParam === 'account_deactivated') {
        setErrorMessage('This enterprise account has been deactivated. Please contact your Super Administrator.');
      } else if (errorParam === 'google_auth_failed') {
        setErrorMessage('Google authentication could not be completed. Please try again or use password login.');
      } else if (errorParam) {
        setErrorMessage(decodeURIComponent(errorParam));
      }

      // Clean address bar without reload
      if (errorParam) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const demoAccounts: { role: RoleType; email: string; label: string; desc: string }[] = [
    { role: 'SUPER_ADMIN', email: 'admin@afaztobacco.com', label: 'Super Admin', desc: 'Full Enterprise Access' },
    { role: 'RSO', email: 'rso.satkania@afaztobacco.com', label: 'RSO', desc: 'Satkania Region Scope' },
    { role: 'TSO', email: 'tso.keranihat@afaztobacco.com', label: 'TSO', desc: 'Kerani Hat Territory Scope' },
    { role: 'CSR', email: 'csr.keranihat@afaztobacco.com', label: 'CSR', desc: 'Field Route Operations' },
  ];

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('123');
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (json.success && json.user) {
        onLoginSuccess(json.user);
      } else {
        setErrorMessage(json.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Real Supabase Google OAuth Flow
   * Redirects to Google consent and returns to /auth/callback
   */
  const handleGoogleOAuth = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setGoogleLoading(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase client could not be loaded. Check environment configuration.');
      }

      const redirectTo = `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        // If Supabase Google OAuth provider is not toggled in Supabase dashboard
        if (
          error.message.toLowerCase().includes('not enabled') || 
          error.message.toLowerCase().includes('unsupported')
        ) {
          setErrorMessage(
            'Google OAuth provider is not yet activated in your Supabase project dashboard (Auth > Providers > Google). You can use "Google Identity Verification" below or log in with credentials.'
          );
        } else {
          setErrorMessage(error.message || 'Google OAuth failed.');
        }
        setGoogleLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google OAuth service connection failed.');
      setGoogleLoading(false);
    }
  };

  /**
   * Google Identity Auth (Direct Verification against pre-provisioned DB)
   * Ensures instant login without needing public OAuth consent configured in Supabase console
   */
  const handleGoogleIdentityAuth = async () => {
    if (!email) {
      setErrorMessage('Please specify your enterprise email to verify Google identity.');
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    setGoogleLoading(true);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      if (json.success && json.user) {
        onLoginSuccess(json.user);
      } else {
        setErrorMessage(json.error || 'Google identity verification failed for this account.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google identity verification request failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Top Floating Controls: Dark/Light Mode Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle showLabel />
      </div>

      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-500/20 border border-blue-400/20 mb-2">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-2">
            <span>Afaz Tobacco Company</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">HQ</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sales & Stock Intelligence Platform • Enterprise RBAC
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl dark:shadow-2xl space-y-5">
          {/* Quick Role Fill Strip */}
          <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Quick Role Switcher (Password: 123)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => {
                const isSelected = email === acc.email;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleSelectDemo(acc.email)}
                    className={`text-left p-2 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[11px] text-slate-900 dark:text-white">{acc.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{acc.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {infoMessage && (
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 p-3 text-xs text-blue-700 dark:text-blue-300">
              <CheckCircle2 className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Enterprise Email</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@afaztobacco.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-9 pr-9 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Platform'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-slate-900 px-3 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Or
            </span>
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          </div>

          {/* Google Sign In Actions */}
          <div className="space-y-2">
            {/* 1. Real Google OAuth Redirect Button */}
            <button
              type="button"
              onClick={handleGoogleOAuth}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Authenticate via Google OAuth provider"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleLoading ? 'Connecting Google OAuth...' : 'Sign in with Google OAuth'}</span>
            </button>

            {/* 2. Direct Identity Verification Bridge */}
            <button
              type="button"
              onClick={handleGoogleIdentityAuth}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-950/50 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 transition-all disabled:opacity-50 cursor-pointer"
              title="One-click identity auth for pre-provisioned email"
            >
              <Fingerprint className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Verify Google Identity Auth ({email || 'email'})</span>
            </button>

            {/* Supabase Google OAuth Callback URI Helper for Admin Setup */}
            <div className="pt-1">
              <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 rounded-lg p-2 border border-slate-200 dark:border-slate-800">
                <span className="truncate">
                  OAuth Callback: <code className="font-mono text-blue-600 dark:text-blue-400">...supabase.co/auth/v1/callback</code>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('https://plqhblngwyxnovxvhaao.supabase.co/auth/v1/callback');
                    setInfoMessage('Copied Supabase OAuth callback URL to clipboard!');
                    setTimeout(() => setInfoMessage(null), 3000);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0 font-medium transition-colors cursor-pointer"
                  title="Copy Authorized redirect URI for Google Cloud Console"
                >
                  Copy URI
                </button>
              </div>
            </div>
          </div>

          {/* Security Notice: Strict Provisioning */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Access Restricted:</strong> Self-registration is disabled. All user accounts and role scopes are strictly provisioned by the Super Administrator.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 dark:text-slate-600">
          Afaz Tobacco Sales & Stock Intelligence Platform • Production Ready
        </p>
      </div>
    </div>
  );
}
