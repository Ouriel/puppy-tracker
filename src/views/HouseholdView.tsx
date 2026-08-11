import React, { useState } from 'react';
import type { Caretaker, UserAccount } from '../types';
import { Home, Users, UserPlus, Trash2, Mail, Send, CheckCircle2, UserCheck, Copy, Pencil, X, Check } from 'lucide-react';
import { createUser } from '../services/api';
import { showToast } from '../utils/toast';
import { useI18n } from '../i18n';
import { Card, Button, Input, Chip } from '@heroui/react';

interface HouseholdViewProps {
  user: UserAccount;
  caretakers: Caretaker[];
  currentUser: string;
  onAddCaretaker: (caretaker: Caretaker) => void;
  onUpdateCaretaker: (id: string, updatedFields: Partial<Caretaker>) => void;
  onDeleteCaretaker: (id: string) => void;
}

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  caretakers,
  currentUser,
  onAddCaretaker,
  onUpdateCaretaker,
  onDeleteCaretaker,
}) => {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [isInvitingEmail, setIsInvitingEmail] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [name, setName] = useState('');
  const [color, setColor] = useState('#EC4899');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#EC4899');

  const handlePreApproveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;

    const email = inviteEmail.trim().toLowerCase();
    const created = await createUser({
      email,
      name: email.split('@')[0],
      role: 'Member',
      status: 'ACTIVE',
    });

    if (created) {
      setInviteSuccess(`${email} authorized!`);
      setInviteEmail('');
      if (!caretakers.some((item) => item.name.toLowerCase() === email.split('@')[0])) {
        onAddCaretaker({
          id: `c-${Date.now()}`,
          name: email.split('@')[0],
          role: 'Member',
          color: '#8B5CF6',
        });
      }
    }
  };

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    onAddCaretaker({
      id: `c-${Date.now()}`,
      name: name.trim(),
      role: 'Member',
      color,
    });

    setName('');
    setIsAdding(false);
  };

  const copyAppUrl = () => {
    navigator.clipboard.writeText(window.location.origin);
    showToast(t.household.copiedSuccess, 'success');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{t.household.title}</h2>
              <p className="text-xs text-slate-400">{t.household.subtitle}</p>
            </div>
          </div>

          {/* Pre-Approve Action Button */}
          <Button
            variant="primary"
            onPress={() => setIsInvitingEmail(!isInvitingEmail)}
          >
            <Mail className="w-4 h-4 mr-1.5 inline" />
            {t.household.preApproveBtn}
          </Button>
        </Card.Content>
      </Card>

      {/* Email Registration Box */}
      {isInvitingEmail && (
        <Card className="bg-slate-900 border border-indigo-800/60 text-slate-100">
          <form onSubmit={handlePreApproveMember}>
            <Card.Content className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>{t.household.inviteViaEmail}</span>
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                {t.household.authorizeInstructions}
              </p>

              {inviteSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 p-3.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{inviteSuccess}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onPress={copyAppUrl}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1 inline" />
                    {t.household.copyLink}
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder={t.household.emailPlaceholder}
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5 inline" />
                  {t.household.sendInvite}
                </Button>
              </div>
            </Card.Content>
          </form>
        </Card>
      )}

      {/* Household Caretakers Badges */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Content className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>{t.household.membersTab} ({caretakers.length})</span>
            </h3>

            <Button
              size="sm"
              onPress={() => setIsAdding(!isAdding)}
              className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white"
            >
              <UserPlus className="w-4 h-4 mr-1 inline" />
              {isAdding ? t.potty.cancel : t.household.addMember}
            </Button>
          </div>

          {/* Add Caretaker Form */}
          {isAdding && (
            <Card variant="default" className="bg-slate-950/60">
              <form onSubmit={handleAddSubmit}>
                <Card.Content className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.household.memberName}</label>
                      <Input
                        type="text"
                        placeholder="e.g. Alex"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.household.badgeColor}</label>
                      <input
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl h-9 px-1 py-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                    >
                      {t.household.addMemberBadge}
                    </Button>
                  </div>
                </Card.Content>
              </form>
            </Card>
          )}

          {/* Caretakers List */}
          <div className="space-y-2">
            {caretakers.map((caretaker) => {
              const isSelected = currentUser === caretaker.name;
              const isEditingThis = editingId === caretaker.id;

              if (isEditingThis) {
                return (
                  <div
                    key={caretaker.id}
                    className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900 border border-indigo-500/60 rounded-xl gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-7 h-7 rounded-full bg-transparent border border-slate-700 cursor-pointer shrink-0"
                      />
                      <Input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Member Name"
                        autoFocus
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => {
                          if (!editName.trim()) return;
                          onUpdateCaretaker(caretaker.id, {
                            name: editName.trim(),
                            color: editColor,
                            role: caretaker.role,
                          });
                          setEditingId(null);
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-1 inline" />
                        Save
                      </Button>

                      <Button
                        size="sm"
                        isIconOnly
                        onPress={() => setEditingId(null)}
                        className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={caretaker.id}
                  className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full ring-2 ring-white/20 shrink-0"
                      style={{ backgroundColor: caretaker.color }}
                    />
                    <div className="text-xs font-bold text-slate-100">
                      {caretaker.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      isIconOnly
                      onPress={() => {
                        setEditingId(caretaker.id);
                        setEditName(caretaker.name);
                        setEditColor(caretaker.color);
                      }}
                      className="bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                      aria-label="Edit Member Name & Color"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    {isSelected && (
                      <Chip color="success" variant="soft" size="sm">
                        <UserCheck className="w-3.5 h-3.5 mr-1 inline text-emerald-400" />
                        {t.household.activeMember}
                      </Chip>
                    )}

                    {caretaker.name !== 'Matthieu' && (
                      <Button
                        variant="danger-soft"
                        size="sm"
                        isIconOnly
                        onPress={() => onDeleteCaretaker(caretaker.id)}
                        aria-label={t.household.deleteMember}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
