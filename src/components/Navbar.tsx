import React from 'react';
import type { PuppyProfile, UserAccount } from '../types';
import { FileText, BookOpen, Flame, Plus, LogOut, ShieldAlert, LayoutDashboard, Settings, Syringe, Globe } from 'lucide-react';
import { Button, Select, ListBox, ListBoxItem } from '@heroui/react';
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
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5 shrink-0">
          {/* Brand Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/flat_cocker_spaniel_logo.jpg"
              alt="PupPace Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover ring-2 ring-amber-500/50 shadow-md shrink-0"
            />
            <div className="min-w-0">
              <span className="text-sm sm:text-base font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent block truncate">
                {t.brand}
              </span>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">{t.headerSubtitle}</p>
            </div>
          </div>

          {/* Controls: Scalable Language Select Dropdown & Sign Out */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Scalable Language Switcher Dropdown */}
            <div className="flex items-center w-24">
              <Select
                value={lang}
                onChange={(val) => onLanguageChange(val as Language)}
                aria-label="Select Language"
              >
                <Select.Trigger className="bg-slate-950/80 border-slate-700/80 min-h-0 h-8">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBoxItem id="en" textValue="English">🇬🇧 EN</ListBoxItem>
                    <ListBoxItem id="fr" textValue="Français">🇫🇷 FR</ListBoxItem>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            {/* Sign Out Button */}
            <Button
              onPress={onSignOut}
              aria-label={t.nav.signOut}
              variant="tertiary"
              size="sm"
              className="font-semibold text-xs min-w-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0 mr-1 inline" />
              <span className="hidden sm:inline">{t.nav.signOut}</span>
            </Button>
          </div>
        </div>

        {/* Bottom row: Main Page Tabs & Contextual Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Re-organized Tab Order with Clean Routing */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
            {/* 1. Daily Log / Suivi Quotidien */}
            <Button
              onPress={() => onSelectMainTab('dashboard')}
              variant={activeMainTab === 'dashboard' ? 'primary' : 'tertiary'}
              size="sm"
              className="text-xs font-bold min-w-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1 inline" />
              {t.nav.dashboard}
            </Button>

            {/* 2. Carnet de Santé */}
            <Button
              onPress={() => onSelectMainTab('carnetdesante')}
              variant={activeMainTab === 'carnetdesante' ? 'primary' : 'tertiary'}
              size="sm"
              className="text-xs font-bold min-w-0"
            >
              <Syringe className="w-3.5 h-3.5 mr-1 inline" />
              {t.nav.carnetDeSante}
            </Button>

            {/* 3. Paramètres & Foyer (Combined Dogs & Household) */}
            <Button
              onPress={() => onSelectMainTab('settings')}
              variant={activeMainTab === 'settings' ? 'primary' : 'tertiary'}
              size="sm"
              className="text-xs font-bold min-w-0"
            >
              <Settings className="w-3.5 h-3.5 mr-1 inline" />
              {t.nav.settings}
            </Button>

            {/* 4. Care Guide */}
            <Button
              onPress={() => onSelectMainTab('careguide')}
              variant={activeMainTab === 'careguide' ? 'primary' : 'tertiary'}
              size="sm"
              className="text-xs font-bold min-w-0"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1 inline" />
              {t.nav.careGuide}
            </Button>

            {/* 5. Admin (Super Admin only) */}
            {isSuperAdmin && (
              <Button
                onPress={() => onSelectMainTab('admin')}
                variant={activeMainTab === 'admin' ? 'danger' : 'tertiary'}
                size="sm"
                className="text-xs font-bold min-w-0"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1 inline" />
                {t.nav.admin}
              </Button>
            )}
          </div>

          {/* Quick Log & Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Show Active Dog Selector ONLY on Dog-Specific Views (Daily Log & Carnet de Sante) */}
            {showDogSelector && puppies.length > 0 && activePuppy && (
              <div className="flex items-center w-36">
                <Select
                  value={activePuppy.id}
                  onChange={(val) => onSelectPuppy(val as string)}
                  aria-label="Select Dog"
                >
                  <Select.Trigger className="bg-slate-800/80 border-slate-700/80 min-h-0 h-8">
                    <span className="text-slate-400 text-xs mr-1">{t.nav.dog}</span>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {puppies.map((puppy) => (
                        <ListBoxItem key={puppy.id} id={puppy.id} textValue={puppy.name}>
                          {puppy.name}
                        </ListBoxItem>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
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
            <Button
              isIconOnly
              onPress={onOpenVetReport}
              aria-label="Export Vet Summary PDF"
              variant="secondary"
              size="sm"
            >
              <FileText className="w-4 h-4" />
            </Button>

            {/* Quick Log Event Button */}
            {puppies.length > 0 && (
              <Button
                onPress={onOpenQuickLog}
                aria-label={t.nav.logEvent}
                variant="primary"
                size="sm"
                className="font-bold text-xs"
              >
                <Plus className="w-4 h-4 stroke-[3] mr-1 inline" />
                {t.nav.logEvent}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
