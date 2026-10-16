import React, { useState } from 'react';
import type { PuppyProfile, Caretaker, UserAccount } from '../types';
import { Settings, Dog, Users, Shield, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { PuppiesView } from './PuppiesView';
import { HouseholdView } from './HouseholdView';
import { AdminView } from './AdminView';
import { useI18n } from '../i18n';
import { isSuperAdminEmail } from '../utils/auth';

interface SettingsViewProps {
  user: UserAccount;
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => Promise<boolean>;
  onUpdatePuppy: (puppy: PuppyProfile) => Promise<boolean>;
  onDeletePuppy: (id: string) => void;
  deletedPuppies: PuppyProfile[];
  onRestorePuppy: (id: string) => void;
  caretakers: Caretaker[];
  onAddCaretaker: (caretaker: Caretaker) => void;
  onUpdateCaretaker: (id: string, updatedFields: Partial<Caretaker>) => void;
  onDeleteCaretaker: (id: string) => void;
  onBackToDashboard?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  puppies,
  activePuppyId,
  onSelectPuppy,
  onAddPuppy,
  onUpdatePuppy,
  onDeletePuppy,
  deletedPuppies,
  onRestorePuppy,
  caretakers,
  onAddCaretaker,
  onUpdateCaretaker,
  onDeleteCaretaker,
  onBackToDashboard,
}) => {
  const { t } = useI18n();
  const isSuperAdmin = isSuperAdminEmail(user.email);
  const [selectedTab, setSelectedTab] = useState<'dogs' | 'household' | 'admin'>('dogs');

  return (
    <div className="space-y-4 sm:space-y-6 w-full pb-12">
      {/* Top Navigation Bar */}
      {onBackToDashboard && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t.nav.backToDashboard}</span>
          </button>
        </div>
      )}

      {/* Header Banner */}
      <PageHeader
        icon={Settings}
        title={`${t.nav.settings} & Administration`}
        subtitle={t.household.manageSettingsSubtitle || 'Manage household dog profiles, family caretakers, and access approvals'}
      />

      {/* Full Page Navigation Tabs */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSelectedTab('dogs')}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all ${
            selectedTab === 'dogs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Dog className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="truncate">{t.settings.dogProfiles} ({puppies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTab('household')}
          className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all ${
            selectedTab === 'household'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="truncate">{t.settings.householdMembers} ({caretakers.length})</span>
        </button>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setSelectedTab('admin')}
            className={`col-span-2 sm:col-span-1 flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all ${
              selectedTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{t.settings.superAdminPanel}</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {selectedTab === 'dogs' && (
          <PuppiesView
            puppies={puppies}
            activePuppyId={activePuppyId}
            onSelectPuppy={onSelectPuppy}
            onAddPuppy={onAddPuppy}
            onUpdatePuppy={onUpdatePuppy}
            onDeletePuppy={onDeletePuppy}
            deletedPuppies={deletedPuppies}
            onRestorePuppy={onRestorePuppy}
          />
        )}

        {selectedTab === 'household' && (
          <HouseholdView
            caretakers={caretakers}
            user={user}
            onAddCaretaker={onAddCaretaker}
            onUpdateCaretaker={onUpdateCaretaker}
            onDeleteCaretaker={onDeleteCaretaker}
          />
        )}

        {selectedTab === 'admin' && isSuperAdmin && (
          <AdminView currentUserEmail={user.email} caretakers={caretakers} onAddCaretaker={onAddCaretaker} />
        )}
      </div>
    </div>
  );
};
