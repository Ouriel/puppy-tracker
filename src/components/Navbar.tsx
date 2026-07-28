import React from 'react';
import type { PuppyProfile, UserAccount } from '../types';
import { FileText, BookOpen, Flame, Plus, LogOut, ShieldAlert, LayoutDashboard, Settings, Syringe, Globe } from 'lucide-react';
import type { Language } from '../i18n';

export type MainTabType = 'dashboard' | 'carnetdesante' | 'settings' | 'careguide' | 'admin';

interface NavbarProps {
  activeMainTab: MainTabType;
  onSelectMainTab: (tab: MainTabType) => void;
  puppies: PuppyProfile[];
  activePuppy: PuppyProfile | null;
  onSelectPuppy: (puppyId: string) => void;
  user: UserAccount;
  onOpenQuickLog: () => void;
  onOpenVetReport: () => void;
  onClearSampleData: () => void;
  onSignOut: () => void;
  streakDays: number;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  t: any;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMainTab,
  onSelectMainTab,
  puppies,
  activePuppy,
  onSelectPuppy,
  user,
  onOpenQuickLog,
  onOpenVetReport,
  onSignOut,
  streakDays,
  lang,
  onLanguageChange,
  t,
}) => {
  const isSuperAdmin = user.email.toLowerCase() === 'matthieu.jacquet@gmail.com';
  const showDogSelector = activeMainTab === 'dashboard' || activeMainTab === 'carnetdesante';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        {/* Top row: Flat Vector Brand Logo, Language Dropdown & Sign Out */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-2.5">
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/flat_cocker_spaniel_logo.jpg"
              alt="PupPace Logo"
              className="w-9 h-9 rounded-xl object-cover ring-2 ring-amber-500/50 shadow-md"
            />
            <div>
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent">
                {t.brand}
              </span>
              <p className="text-[11px] text-slate-400">{t.headerSubtitle}</p>
            </div>
          </div>

          {/* Controls: Scalable Language Select Dropdown & Sign Out */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Scalable Language Switcher Dropdown */}
            <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs font-semibold">
              <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={lang}
                onChange={(event) => onLanguageChange(event.target.value as Language)}
                aria-label="Select Language"
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-bold"
              >
                <option value="en" className="bg-slate-800 text-slate-200">🇬🇧 English</option>
                <option value="fr" className="bg-slate-800 text-slate-200">🇫🇷 Français</option>
              </select>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              title={t.nav.signOut}
              aria-label={t.nav.signOut}
              className="p-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-300 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">{t.nav.signOut}</span>
            </button>
          </div>
        </div>

        {/* Bottom row: Main Page Tabs & Contextual Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Re-organized Tab Order with Clean Routing */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            {/* 1. Daily Log / Suivi Quotidien */}
            <button
              onClick={() => onSelectMainTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t.nav.dashboard}</span>
            </button>

            {/* 2. Carnet de Santé */}
            <button
              onClick={() => onSelectMainTab('carnetdesante')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'carnetdesante'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-teal-400 hover:text-teal-200'
              }`}
            >
              <Syringe className="w-3.5 h-3.5" />
              <span>{t.nav.carnetDeSante}</span>
            </button>

            {/* 3. Paramètres & Foyer (Combined Dogs & Household) */}
            <button
              onClick={() => onSelectMainTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t.nav.settings}</span>
            </button>

            {/* 4. Care Guide */}
            <button
              onClick={() => onSelectMainTab('careguide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeMainTab === 'careguide'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.nav.careGuide}</span>
            </button>

            {/* 5. Admin (Super Admin only) */}
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
                <span>{t.nav.admin}</span>
              </button>
            )}
          </div>

          {/* Quick Log & Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Show Active Dog Selector ONLY on Dog-Specific Views (Daily Log & Carnet de Sante) */}
            {showDogSelector && puppies.length > 0 && activePuppy && (
              <div className="flex items-center bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400 mr-1.5">{t.nav.dog}</span>
                <select
                  value={activePuppy.id}
                  onChange={(event) => onSelectPuppy(event.target.value)}
                  aria-label="Select Dog"
                  className="bg-transparent font-bold text-amber-300 focus:outline-none cursor-pointer"
                >
                  {puppies.map((puppy) => (
                    <option key={puppy.id} value={puppy.id} className="bg-slate-800 text-slate-200">
                      {puppy.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Potty Clean Streak Badge */}
            {showDogSelector && (
              <div
                title={`${streakDays} days clean!`}
                className="flex items-center gap-1 bg-amber-950/40 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-semibold"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{streakDays}d {t.nav.cleanStreak}</span>
              </div>
            )}

            {/* Export Vet PDF Summary button */}
            <button
              onClick={onOpenVetReport}
              title="Export Vet Summary PDF"
              aria-label="Export Vet Summary PDF"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
            </button>

            {/* Quick Log Event Button */}
            {puppies.length > 0 && (
              <button
                onClick={onOpenQuickLog}
                aria-label={t.nav.logEvent}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{t.nav.logEvent}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
