import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AuthLockScreenProps {
  onUnlockWithSSO: (email: string, name: string, token: string) => boolean;
  onUnlockWithPassword: (email: string, pass: string) => boolean;
  onRequestAccess: (email: string) => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  onUnlockWithSSO,
  onUnlockWithPassword,
  onRequestAccess,
}) => {
  const [activeTab, setActiveTab] = useState<'sso' | 'password' | 'request'>('sso');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleGoogleSSO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const successResult = onUnlockWithSSO(
      email.trim().toLowerCase(),
      email.split('@')[0],
      'mock-google-token-12345'
    );

    if (!successResult) {
      setError('Registration pending. Super Admin Matthieu must approve your account first.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const successResult = onUnlockWithPassword(email.trim().toLowerCase(), password);
    if (!successResult) {
      setError('Invalid email or password credentials. Verify accepted status.');
      setTimeout(() => setError(''), 4500);
    }
  };

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    onRequestAccess(email.trim().toLowerCase());
    setSuccess(`Access request sent! Matthieu has been notified to accept your account: ${email}`);
    setEmail('');
    setTimeout(() => setSuccess(''), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Glow Decor */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Mascot & Header */}
        <div className="text-center space-y-2 relative z-10">
          <div className="relative inline-block">
            <img
              src="/cocker_spaniel_mascot.jpg"
              alt="Cocker Spaniel Mascot"
              className="w-20 h-20 rounded-full object-cover mx-auto ring-4 ring-indigo-500/50 shadow-xl"
            />
            <div className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full shadow-lg ring-2 ring-slate-900">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            PupPace SaaS Platform
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Log, share and predict puppy activities with secure family sync.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setActiveTab('sso');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'sso' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Google SSO
          </button>
          <button
            onClick={() => {
              setActiveTab('password');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'password' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Password
          </button>
          <button
            onClick={() => {
              setActiveTab('request');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'request' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Request
          </button>
        </div>

        {error && (
          <div className="bg-red-950/30 border border-red-800/40 text-red-300 p-2.5 rounded-xl text-xs font-medium text-center">
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 p-2.5 rounded-xl text-xs font-medium text-center">
            {success}
          </div>
        )}

        {/* Dynamic Auth Forms */}
        {activeTab === 'sso' && (
          <form onSubmit={handleGoogleSSO} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Google Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="e.g. matthieu.jacquet@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Demo access: <span className="font-semibold text-indigo-400">matthieu.jacquet@gmail.com</span>
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
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
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
            >
              <span>Log In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {activeTab === 'request' && (
          <form onSubmit={handleRequestAccess} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Your Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="Enter email to request access"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg transition active:scale-98 cursor-pointer"
            >
              <span>Submit Access Request</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Security Footer Note */}
        <div className="pt-2 border-t border-slate-800/80 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>SSO & Standard Security Token Authentication</span>
        </div>
      </div>
    </div>
  );
};
