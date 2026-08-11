import React, { useState } from 'react';
import type { PuppyProfile, Caretaker, UserAccount } from '../types';
import { PuppiesView } from './PuppiesView';
import { HouseholdView } from './HouseholdView';
import { Dog, Home, Settings } from 'lucide-react';
import { useI18n } from '../i18n';
import { Card, Tabs } from '@heroui/react';

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
  onUpdateCaretaker: (id: string, updatedFields: Partial<Caretaker>) => void;
  onDeleteCaretaker: (id: string) => void;
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
  onUpdateCaretaker,
  onDeleteCaretaker,
}) => {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<'puppies' | 'members'>('puppies');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with Sub-tab Switcher */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
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
          <Tabs selectedKey={subTab} onSelectionChange={(key) => setSubTab(key as 'puppies' | 'members')}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Settings tabs">
                <Tabs.Tab id="puppies">
                  <div className="flex items-center gap-1.5">
                    <Dog className="w-4 h-4" />
                    <span>{t.puppies.title} ({puppies.length})</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="members">
                  <div className="flex items-center gap-1.5">
                    <Home className="w-4 h-4" />
                    <span>{t.household.title} ({caretakers.length})</span>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </Card.Content>
      </Card>

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
          onUpdateCaretaker={onUpdateCaretaker}
          onDeleteCaretaker={onDeleteCaretaker}
        />
      )}
    </div>
  );
};
