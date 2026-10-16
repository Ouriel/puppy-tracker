import React from 'react';
import type { PuppyProfile } from '../types';
import { Plus, Settings, Globe } from 'lucide-react';
import { Button, Select, ListBox, ListBoxItem } from '@heroui/react';
import { useI18n } from '../i18n';

import { getPuppyAge } from '../utils/predictions';

interface NavbarProps {
  puppies: PuppyProfile[];
  activePuppy: PuppyProfile | null;
  onSelectPuppy: (puppyId: string) => void;
  onOpenQuickLog: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  puppies,
  activePuppy,
  onSelectPuppy,
  onOpenQuickLog,
  onOpenSettings,
}) => {
  const { t, lang, changeLanguage } = useI18n();
  /** "8 sem." under 16 weeks, then "7 mois"; none without a birth date. The bar and the list both show it. */
  const ageLabel = (puppy: PuppyProfile) => {
    if (!puppy.birthDate) return '';
    const age = getPuppyAge(puppy.birthDate);
    return age.weeks < 16
      ? t.weightChart.weeksOld.replace('{weeks}', String(age.weeks))
      : t.weightChart.monthsOld.replace('{months}', String(Math.floor(age.months)));
  };
  const activeAge = activePuppy ? ageLabel(activePuppy) : '';
  return (
    <header className="relative z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl w-full">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand Logo & Clean Dog Selector */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
          {/* No logo on phones: its room goes to the dog's name, still readable with large text at 320 px */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <img
              src="/puppace_logo.webp"
              alt="PupPace Logo"
              width="36"
              height="36"
              fetchPriority="high"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
            />
            <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent hidden md:inline">
              {t.brand}
            </span>
          </div>

          {/* Simple Active Dog Dropdown */}
          {puppies.length > 0 && activePuppy && (
            <div className="flex-1 min-w-0 max-w-48">
              <Select
                value={activePuppy.id}
                onChange={(val) => onSelectPuppy(val as string)}
                aria-label={t.nav.selectDog}
              >
                <Select.Trigger className="bg-slate-950/80 border-slate-700/80 min-h-0 h-11 py-0 items-center font-bold text-xs text-slate-100 ps-2 sm:ps-3 pe-7">
                  {/* The name, the age on a second line: each one cut rather than wrapped at 320 px or with large text.
                      The space between them is what a screen reader hears between the name and the age. */}
                  <Select.Value className="min-w-0 text-xs leading-tight">
                    <span className="block truncate">{activePuppy.name}</span>
                    {activeAge && <>{' '}<span data-dog-age className="block truncate text-[0.6875rem] font-medium text-slate-400">{activeAge}</span></>}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                  <ListBox>
                    {puppies.map((puppy) => {
                      const age = ageLabel(puppy);
                      const displayName = age ? `${puppy.name} (${age})` : puppy.name;

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
            onClick={() => changeLanguage(lang === 'en' ? 'fr' : 'en')}
            aria-label={t.nav.changeLanguage}
            className="h-11 min-h-[44px] min-w-11 px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0 text-xs font-bold"
          >
            {/* Below sm only "FR" / "EN", so the "+" button always fits */}
            <Globe className="w-4 h-4 text-indigo-400 shrink-0 hidden sm:block" />
            <span>
              <span className="hidden sm:inline">{lang === 'en' ? '🇬🇧 ' : '🇫🇷 '}</span>
              {lang === 'en' ? 'EN' : 'FR'}
            </span>
          </button>

          {/* Settings & Admin Gear Icon Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t.nav.settings}
            className="h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
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
              className="font-bold text-xs h-11 min-h-[44px] min-w-11 px-3 sm:px-4 shadow-md shrink-0"
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
