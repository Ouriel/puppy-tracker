import React from 'react';
import type { PuppyProfile, UserAccount } from '../types';
import { Plus, Settings, Globe } from 'lucide-react';
import { Button, Select, ListBox, ListBoxItem } from '@heroui/react';
import type { Language } from '../i18n';

import { getPuppyAge } from '../utils/predictions';

interface NavbarProps {
  puppies: PuppyProfile[];
  activePuppy: PuppyProfile | null;
  onSelectPuppy: (puppyId: string) => void;
  user: UserAccount;
  onOpenQuickLog: () => void;
  onOpenSettings: () => void;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  t: any;
}

export const Navbar: React.FC<NavbarProps> = ({
  puppies,
  activePuppy,
  onSelectPuppy,
  onOpenQuickLog,
  onOpenSettings,
  lang,
  onLanguageChange,
  t,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl w-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand Logo & Clean Dog Selector */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="/flat_cocker_spaniel_logo.jpg"
              alt="PupPace Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover ring-2 ring-amber-500/50 shadow-md shrink-0"
            />
            <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent hidden md:inline">
              {t.brand}
            </span>
          </div>

          {/* Simple Active Dog Dropdown */}
          {puppies.length > 0 && activePuppy && (
            <div className="w-32 sm:w-48 shrink-0">
              <Select
                value={activePuppy.id}
                onChange={(val) => onSelectPuppy(val as string)}
                aria-label="Select Active Dog"
              >
                <Select.Trigger className="bg-slate-950/80 border-slate-700/80 min-h-0 h-9 font-bold text-xs text-slate-100 px-2 sm:px-3">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                  <ListBox>
                    {puppies.map((puppy) => {
                      let ageLabel = '';
                      if (puppy.birthDate) {
                        const age = getPuppyAge(puppy.birthDate);
                        ageLabel = age.weeks < 16 ? `${age.weeks}w` : `${Math.floor(age.months)}m`;
                      }
                      const displayName = ageLabel ? `${puppy.name} (${ageLabel})` : puppy.name;

                      return (
                        <ListBoxItem key={puppy.id} id={puppy.id} textValue={displayName}>
                          {displayName}
                        </ListBoxItem>
                      );
                    })}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          )}
        </div>

        {/* Right Controls: Language Selector, Settings Gear ⚙️, Quick Log Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Language Switcher Button (Globe + Flag) */}
          <button
            type="button"
            onClick={() => onLanguageChange(lang === 'en' ? 'fr' : 'en')}
            aria-label="Toggle language"
            className="h-9 px-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0 text-xs font-bold"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>{lang === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}</span>
          </button>

          {/* Settings & Admin Gear Icon Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings & Administration"
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* + Quick Log Button */}
          {puppies.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onPress={onOpenQuickLog}
              aria-label={t.nav.logEvent}
              className="font-bold text-xs h-9 px-2.5 sm:px-3.5 shadow-md shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3] sm:mr-1 inline" />
              <span className="hidden sm:inline">{t.nav.logEvent}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
