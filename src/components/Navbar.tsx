import React from 'react';
import type { PuppyProfile, Caretaker, UserAccount } from '../types';
import { Users, FileText, BookOpen, Flame, Plus, Dog, Shield, Trash2, Lock, ShieldAlert } from 'lucide-react';

interface NavbarProps {
  puppies: PuppyProfile[];
  activePuppy: PuppyProfile;
  onSelectPuppy: (puppyId: string) => void;
  onOpenAddPuppy: () => void;
  user: UserAccount;
  caretakers: Caretaker[];
  currentUser: string;
  onSelectUser: (user: string) => void;
  onOpenQuickLog: () => void;
  onOpenShareModal: () => void;
  onOpenVetReport: () => void;
  onOpenCareGuide: () => void;
  onEditProfile: () => void;
  onClearSampleData: () => void;
  onLockVault: () => void;
  onOpenAdminCenter: () => void;
  streakDays: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  puppies,
  activePuppy,
  onSelectPuppy,
  onOpenAddPuppy,
  user,
  caretakers,
  currentUser,
  onSelectUser,
  onOpenQuickLog,
  onOpenShareModal,
  onOpenVetReport,
  onOpenCareGuide,
  onEditProfile,
  onClearSampleData,
  onLockVault,
  onOpenAdminCenter,
  streakDays,
}) => {
  // Back-end check mock: Check if logged in user is the super admin
  const isSuperAdmin = user.email.toLowerCase() === 'matthieu.jacquet@gmail.com';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        {/* Top row: Brand & Family Account info */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-2.5">
          {/* Logo & Brand */}
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
                  SaaS Platform 🐾
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Family Puppy Activity & Potty Sync</p>
            </div>
          </div>

          {/* Family Account & Pack Info */}
          <div className="flex items-center gap-2 flex-wrap">
            {isSuperAdmin && (
              <button
                onClick={onOpenAdminCenter}
                className="flex items-center gap-1 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-700/50 px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin Center</span>
              </button>
            )}

            <button
              onClick={onOpenShareModal}
              className="flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs transition cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-indigo-300 font-bold">{user.familyPackId}</span>
              <Users className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {/* Active User Switcher */}
            <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-slate-400 mr-1.5 hidden sm:inline">User:</span>
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

            {/* Lock App button */}
            <button
              onClick={onLockVault}
              title="Lock Family Vault"
              className="p-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>

        {/* Bottom row: Multi-Puppy Switcher + Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Multi-Puppy Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {puppies.map((p) => {
              const isActive = p.id === activePuppy.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPuppy(p.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 font-bold'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <img
                    src={p.avatarUrl || '/cocker_spaniel_mascot.jpg'}
                    alt={p.name}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-white/30"
                  />
                  <span>{p.name}</span>
                  {isActive && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">
                      {p.weightKg}kg
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={onOpenAddPuppy}
              title="Add another puppy profile"
              className="flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pup</span>
            </button>
          </div>

          {/* Active Puppy Summary & Action Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Potty Streak */}
            <div
              title={`${streakDays} days without indoor accidents!`}
              className="flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-semibold"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{streakDays}d Clean Streak</span>
            </div>

            {/* Clear Sample Data button */}
            <button
              onClick={onClearSampleData}
              title="Clear sample demo logs and start with a fresh blank log"
              className="flex items-center gap-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Sample Logs</span>
            </button>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenVetReport}
                title="Export Vet Summary Report"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenCareGuide}
                title="Cocker Spaniel Care & Potty Rules"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                onClick={onEditProfile}
                title="Edit Puppy Settings"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              >
                <Dog className="w-4 h-4 text-indigo-300" />
              </button>

              <button
                onClick={onOpenQuickLog}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Log Event</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
