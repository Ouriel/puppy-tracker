import React from 'react';
import type { PuppyProfile, Caretaker } from '../types';
import { getPuppyAge } from '../utils/predictions';
import { Users, FileText, BookOpen, Flame, Plus } from 'lucide-react';

interface NavbarProps {
  profile: PuppyProfile;
  caretakers: Caretaker[];
  currentUser: string;
  onSelectUser: (user: string) => void;
  onOpenQuickLog: () => void;
  onOpenShareModal: () => void;
  onOpenVetReport: () => void;
  onOpenCareGuide: () => void;
  onEditProfile: () => void;
  streakDays: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  profile,
  caretakers,
  currentUser,
  onSelectUser,
  onOpenQuickLog,
  onOpenShareModal,
  onOpenVetReport,
  onOpenCareGuide,
  onEditProfile,
  streakDays,
}) => {
  const age = getPuppyAge(profile.birthDate);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Puppy Badge */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={onEditProfile}>
            <img
              src={profile.avatarUrl || '/puppy_mascot.jpg'}
              alt={profile.name}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-500 shadow-md group-hover:scale-105 transition-transform"
            />
            <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white shadow">
              {profile.weightKg}kg
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={onEditProfile}
                className="text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent cursor-pointer hover:opacity-90"
              >
                {profile.name}
              </h1>
              <span className="text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full font-medium">
                {age.text}
              </span>
            </div>
            <p className="text-xs text-slate-400">{profile.breed}</p>
          </div>
        </div>

        {/* Streak & Active User Selector */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Potty Streak */}
          <div
            title={`${streakDays} days without indoor accidents!`}
            className="flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm"
          >
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{streakDays}d Streak</span>
          </div>

          {/* Logged by switcher */}
          <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-slate-400 mr-2 hidden sm:inline">Logging as:</span>
            <select
              value={currentUser}
              onChange={(e) => onSelectUser(e.target.value)}
              className="bg-transparent font-medium text-indigo-300 focus:outline-none cursor-pointer"
            >
              {caretakers.map((c) => (
                <option key={c.id} value={c.name} className="bg-slate-800 text-slate-200">
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenShareModal}
              title="Share Pack Code / Caretakers"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenVetReport}
              title="Export Vet Report & CSV"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenCareGuide}
              title="Puppy Care Guide & Tips"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenQuickLog}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-3.5 py-1.5 rounded-xl font-semibold text-xs shadow-md hover:shadow-indigo-500/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Log Event</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
