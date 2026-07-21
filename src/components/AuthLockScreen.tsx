import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AuthLockScreenProps {
  onUnlock: (pinOrPassword: string) => boolean;
  familyPackId: string;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({ onUnlock, familyPackId }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onUnlock(password);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2500);
    }
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
            PupPace Vault Locked
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            This puppy activity vault is protected. Enter your family security PIN or password to unlock.
          </p>
        </div>

        {/* Sync Pack Badge */}
        <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Family Pack ID:</span>
          </div>
          <span className="font-mono text-indigo-300 font-bold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-700/40">
            {familyPackId}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Family Security PIN / Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter PIN (Default demo PIN: 1234)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-slate-800 border ${
                  error ? 'border-red-500 text-red-200' : 'border-slate-700 focus:border-indigo-500'
                } rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
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
            {error && (
              <p className="text-[11px] text-red-400 mt-1.5 font-medium">
                ❌ Incorrect PIN/Password. Default demo PIN is: <span className="font-bold font-mono">1234</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-98 cursor-pointer"
          >
            <span>Unlock Family Vault</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security Footer Note */}
        <div className="pt-2 border-t border-slate-800/80 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Encrypted Local-First Security Storage</span>
        </div>
      </div>
    </div>
  );
};
