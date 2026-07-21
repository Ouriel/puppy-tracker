import React from 'react';
import type { PuppyProfile, Caretaker, UserAccount } from '../types';
import { FileText, BookOpen, Flame, Plus, Dog, Lock, ShieldAlert, LayoutDashboard, Home } from 'lucide-react';

export type MainTabType = 'dashboard' | 'puppies' | 'household' | 'admin' | 'careguide';

interface NavbarProps {
  activeMainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
  puppies: PuppyProfile[];
  activePuppy: PuppyProfile | null;
  onSelectPuppy: (puppyId: string) => void;
  user: UserAccount;
  caretakers: Caretaker[];
  currentUser: string;
  onSelectUser: (user: string) => void;
  onOpenQuickLog: () => void;
  onOpenVetReport: () => void;
  onClearSampleData: () => void;
  onLockVault: () => void;
  streakDays: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMainTab,
  onSelectMainTab,
  puppies,
  activePuppy,
  onSelectPuppy,
  user,
  caretakers,
  currentUser,
  onSelectUser,
  onOpenQuickLog,
  onOpenVetReport,
  onLockVault,
  streakDays,
}) => {
  const isSuperAdmin = user.email.toLowerCase() === 'matthieu.jacquet@gmail.com';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        {/* Top row: Brand & Active User */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-2.5">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-xl shadow-md">
              <Dog className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent">
                  PupPace
                </span>
                <span className="text-[10px] bg-indigo-950/90 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full font-semibold">
                  Smart Puppy Tracker 🐾
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Household & Multi-User Activity Sync</p>
            </div>
          </div>

          {/* Active User Account & Lock */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active User Switcher */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-slate-400 mr-1.5 hidden sm:inline">Active User:</span>
              <select
                value={currentUser}
                onChange={(e) => onSelectUser(e.target.value)}
                className="bg-transparent font-semibold text-pink-300 focus:outline-none cursor-pointer"
              >
                {caretakers.map((c) => (
                  <option key={c.id} value={`${c.name} (${c.role})`} className="bg-slate-800 text-slate-200">
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Lock App */}
            <button
              onClick={onLockVault}
              title="Lock Vault"
              className="p-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>

        {/* Bottom row: Main Page Tabs & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Navigation Tabs (NO MODALS!) */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            <button
              onClick={() => onSelectMainTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onSelectMainTab('puppies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'puppies'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Dog className="w-3.5 h-3.5" />
              <span>Dogs ({puppies.length})</span>
            </button>

            <button
              onClick={() => onSelectMainTab('household')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'household'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Household ({caretakers.length})</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => onSelectMainTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeMainTab === 'admin'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-red-400 hover:text-red-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}

            <button
              onClick={() => onSelectMainTab('careguide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'careguide'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Care Guide</span>
            </button>
          </div>

          {/* Quick Log & Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active Puppy Switcher dropdown in navbar */}
            {puppies.length > 0 && activePuppy && (
              <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400 mr-1.5">Dog:</span>
                <select
                  value={activePuppy.id}
                  onChange={(e) => onSelectPuppy(e.target.value)}
                  className="bg-transparent font-bold text-amber-300 focus:outline-none cursor-pointer"
                >
                  {puppies.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-800 text-slate-200">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              title={`${streakDays} days clean!`}
              className="flex items-center gap-1 bg-amber-950/40 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-semibold"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{streakDays}d Clean</span>
            </div>

            <button
              onClick={onOpenVetReport}
              title="Export Vet Summary PDF"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
            </button>

            {puppies.length > 0 && (
              <button
                onClick={onOpenQuickLog}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Log Event</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
