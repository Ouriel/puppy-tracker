import React, { useState } from 'react';
import type { PuppyProfile, Caretaker, UserAccount } from '../types';
import { Modal, Button, Tabs } from '@heroui/react';
import { Settings, Dog, Users, Shield } from 'lucide-react';
import { PuppiesView } from '../views/PuppiesView';
import { HouseholdView } from '../views/HouseholdView';
import { AdminView } from '../views/AdminView';

interface SettingsAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

export const SettingsAdminModal: React.FC<SettingsAdminModalProps> = ({
  isOpen,
  onClose,
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
}) => {
  const isSuperAdmin = user.email.toLowerCase() === 'matthieu.jacquet@gmail.com';
  const [selectedTab, setSelectedTab] = useState<string>('dogs');

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-base font-extrabold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <span>Settings & Administration</span>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-4 space-y-4">
              {/* Tab Selector */}
              <Tabs selectedKey={selectedTab} onSelectionChange={(key) => setSelectedTab(key as string)}>
                <Tabs.ListContainer className="bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                  <Tabs.List className="flex gap-2">
                    <Tabs.Tab id="dogs" className="text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 cursor-pointer">
                      <Dog className="w-4 h-4 text-indigo-400" />
                      <span>Dog Profiles</span>
                    </Tabs.Tab>
                    <Tabs.Tab id="household" className="text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 cursor-pointer">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Household Members</span>
                    </Tabs.Tab>
                    {isSuperAdmin && (
                      <Tabs.Tab id="admin" className="text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 cursor-pointer">
                        <Shield className="w-4 h-4 text-red-400" />
                        <span>Super-Admin Panel</span>
                      </Tabs.Tab>
                    )}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>

              {/* Tab Contents */}
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
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose} size="sm">
                Done
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
