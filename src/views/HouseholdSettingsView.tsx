import React, { useState } from 'react';
import type { PuppyProfile, Caretaker, UserAccount, FamilyRole } from '../types';
import { PuppiesView } from './PuppiesView';
import { HouseholdView } from './HouseholdView';
import { Dog, Home, Settings } from 'lucide-react';
import { useI18n } from '../i18n';

interface HouseholdSettingsViewProps {
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => void;
  onUpdatePuppy: (puppy: PuppyProfile) => void;
  onDeletePuppy: (id: string) => void;
  user: UserAccount;
  caretakers: Caretaker[];
  currentUser: string;
  onAddCaretaker: (caretaker: Caretaker) => void;
  onDeleteCaretaker: (id: string) => void;
  onSwitchUserAccount: (name: string, role: FamilyRole) => void;
}

export const HouseholdSettingsView: React.FC<HouseholdSettingsViewProps> = ({
  puppies,
  activePuppyId,
  onSelectPuppy,
  onAddPuppy,
  onUpdatePuppy,
  onDeletePuppy,
  user,
  caretakers,
  currentUser,
  onAddCaretaker,
  onDeleteCaretaker,
  onSwitchUserAccount,
}) => {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<'puppies' | 'members'>('puppies');

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header with Sub-tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>{t.nav.settings}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {t.household.manageSettingsSubtitle}
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSubTab('puppies')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              subTab === 'puppies'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Dog className="w-4 h-4" />
            <span>{t.puppies.title} ({puppies.length})</span>
          </button>

          <button
            onClick={() => setSubTab('members')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              subTab === 'members'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>{t.household.title} ({caretakers.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Content */}
      {subTab === 'puppies' ? (
        <PuppiesView
          puppies={puppies}
          activePuppyId={activePuppyId}
          onSelectPuppy={onSelectPuppy}
          onAddPuppy={onAddPuppy}
          onUpdatePuppy={onUpdatePuppy}
          onDeletePuppy={onDeletePuppy}
        />
      ) : (
        <HouseholdView
          user={user}
          caretakers={caretakers}
          currentUser={currentUser}
          onAddCaretaker={onAddCaretaker}
          onDeleteCaretaker={onDeleteCaretaker}
          onSwitchUserAccount={onSwitchUserAccount}
        />
      )}
    </div>
  );
};
