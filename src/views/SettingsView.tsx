import React, { useState } from 'react';
import type { PuppyProfile, Caretaker, UserAccount } from '../types';
import { Settings, Dog, Users, Shield, ArrowLeft } from 'lucide-react';
import { Card } from '@heroui/react';
import { PuppiesView } from './PuppiesView';
import { HouseholdView } from './HouseholdView';
import { AdminView } from './AdminView';
import { useI18n } from '../i18n';
import { isSuperAdminEmail } from '../constants/auth';

interface SettingsViewProps {
  user: UserAccount;
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => void;
  onUpdatePuppy: (puppy: PuppyProfile) => void;
  onDeletePuppy: (id: string) => void;
  caretakers: Caretaker[];
  currentUser: string;
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
  caretakers,
  currentUser,
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
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl overflow-hidden">
        <Card.Content className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md shrink-0">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-100 leading-tight sm:leading-snug break-words">
              <span>{t.nav.settings} &amp; Administration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 sm:mt-1 leading-normal break-words">
              {t.household.manageSettingsSubtitle || 'Manage household dog profiles, family caretakers, and access approvals'}
            </p>
          </div>
        </Card.Content>
      </Card>

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
          />
        )}

        {selectedTab === 'household' && (
          <HouseholdView
            user={user}
            caretakers={caretakers}
            currentUser={currentUser}
            onAddCaretaker={onAddCaretaker}
            onUpdateCaretaker={onUpdateCaretaker}
            onDeleteCaretaker={onDeleteCaretaker}
          />
        )}

        {selectedTab === 'admin' && isSuperAdmin && (
          <AdminView currentUserEmail={user.email} />
        )}
      </div>
    </div>
  );
};
