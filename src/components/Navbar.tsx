import React from 'react';
import type { PuppyProfile, UserAccount } from '../types';
import { Plus, Settings, Globe } from 'lucide-react';
import { Button, Select, ListBox, ListBoxItem } from '@heroui/react';
import type { Language } from '../i18n';

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
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand Logo & Clean Dog Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src="/flat_cocker_spaniel_logo.jpg"
              alt="PupPace Logo"
              className="w-9 h-9 rounded-xl object-cover ring-2 ring-amber-500/50 shadow-md shrink-0"
            />
            <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300 bg-clip-text text-transparent hidden sm:inline">
              {t.brand}
            </span>
          </div>

          {/* Simple Active Dog Dropdown */}
          {puppies.length > 0 && activePuppy && (
            <div className="w-36 sm:w-44">
              <Select
                value={activePuppy.id}
                onChange={(val) => onSelectPuppy(val as string)}
                aria-label="Select Active Dog"
              >
                <Select.Trigger className="bg-slate-950/80 border-slate-700/80 min-h-0 h-9 font-bold text-xs text-slate-100">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
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
        </div>

        {/* Right Controls: Language Selector, Settings Gear ⚙️, Quick Log Button */}
        <div className="flex items-center gap-2">
          {/* Language Switcher Dropdown */}
          <div className="w-20 sm:w-24">
            <Select
              value={lang}
              onChange={(val) => onLanguageChange(val as Language)}
              aria-label="Select Language"
            >
              <Select.Trigger className="bg-slate-950/80 border-slate-700/80 min-h-0 h-9 text-xs">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1 hidden sm:inline" />
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                <ListBox>
                  <ListBoxItem id="en" textValue="EN">🇬🇧 EN</ListBoxItem>
                  <ListBoxItem id="fr" textValue="FR">🇫🇷 FR</ListBoxItem>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {/* Settings & Admin Gear Icon Button */}
          <Button
            isIconOnly
            variant="tertiary"
            size="sm"
            onPress={onOpenSettings}
            aria-label="Settings & Administration"
            className="h-9 w-9 bg-slate-950/80 border border-slate-700/80 text-slate-300 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* + Quick Log Button */}
          {puppies.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onPress={onOpenQuickLog}
              aria-label={t.nav.logEvent}
              className="font-bold text-xs h-9 px-3.5 shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[3] mr-1 inline" />
              <span>{t.nav.logEvent}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
