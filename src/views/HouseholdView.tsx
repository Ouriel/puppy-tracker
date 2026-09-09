import React, { useState } from 'react';
import type { Caretaker } from '../types';
import { Home, Users, UserPlus, Trash2, Mail, Send, CheckCircle2, UserCheck, Copy, Pencil, X, Check } from 'lucide-react';
import { createUser } from '../services/api';
import { useI18n } from '../i18n';
import { Card, Button, Input, Chip, toast } from '@heroui/react';

interface HouseholdViewProps {
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
    const result = await createUser({
      email,
      name: email.split('@')[0],
      role: 'Member',
      status: 'ACTIVE',
    });

    if (result.ok) {
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
    } else {
      toast.danger(result.error || t.toasts.errorGeneric);
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
    toast.success(t.household.copiedSuccess);
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
        <Card.Content className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md shrink-0">
              <Home className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-100 truncate">{t.household.title}</h2>
              <p className="text-xs text-slate-400 truncate">{t.household.subtitle}</p>
            </div>
          </div>

          {/* Pre-Approve Action Button */}
          <Button
            variant="primary"
            size="sm"
            onPress={() => setIsInvitingEmail(!isInvitingEmail)}
            className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs shadow-sm"
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
            <Card.Content className="p-4 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>{t.household.inviteViaEmail}</span>
              </h3>

              <p className="text-xs text-slate-400 leading-relaxed">
                {t.household.authorizeInstructions}
              </p>

              {inviteSuccess && (
                <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 p-3 sm:p-3.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{inviteSuccess}</span>
                  </div>
                  <button
                    type="button"
                    onClick={copyAppUrl}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-white bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs"
                  >
                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.household.copyLink}</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    type="email"
                    placeholder={t.household.emailPlaceholder}
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1 inline" />
                  {t.household.sendInvite}
                </Button>
              </div>
            </Card.Content>
          </form>
        </Card>
      )}

      {/* Manual Member Management */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
        <Card.Content className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>{t.household.membersTab} ({caretakers.length})</span>
            </h3>

            <Button
              size="sm"
              variant="outline"
              onPress={() => setIsAdding(!isAdding)}
              className="text-xs border-slate-800"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1 inline" />
              {isAdding ? t.potty.cancel : t.household.addMember}
            </Button>
          </div>

          {/* Add Manual Caretaker Form */}
          {isAdding && (
            <form onSubmit={handleAddSubmit} className="bg-slate-950/60 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.household.memberName}</label>
                  <Input
                    type="text"
                    placeholder={t.household.namePlaceholder}
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
                    className="w-10 h-10 rounded-xl bg-transparent border border-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1 inline" />
                  {t.household.addMemberBadge}
                </Button>
              </div>
            </form>
          )}

          {/* Member List */}
          <div className="space-y-2">
            {caretakers.map((caretaker) => {
              const isSelected = currentUser === caretaker.name;
              const isEditingThis = editingId === caretaker.id;

              if (isEditingThis) {
                return (
                  <div
                    key={caretaker.id}
                    className="flex flex-wrap items-center justify-between p-3 sm:p-3.5 bg-slate-900 border border-indigo-500/60 rounded-xl gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(event) => setEditColor(event.target.value)}
                        className="w-7 h-7 rounded-full bg-transparent border border-slate-700 cursor-pointer shrink-0"
                      />
                      <Input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        placeholder={t.household.memberName}
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
                        {t.potty.saveChanges}
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
                  className="flex items-center justify-between p-3 sm:p-3.5 bg-slate-950/40 rounded-xl border border-slate-800 gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full ring-2 ring-white/20 shrink-0"
                      style={{ backgroundColor: caretaker.color }}
                    />
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {caretaker.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(caretaker.id);
                        setEditName(caretaker.name);
                        setEditColor(caretaker.color);
                      }}
                      aria-label={t.household.editMemberName}
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {isSelected && (
                      <Chip color="success" variant="soft" size="sm">
                        <UserCheck className="w-3.5 h-3.5 mr-1 inline text-emerald-400" />
                        {t.household.activeMember}
                      </Chip>
                    )}

                    {caretaker.name !== 'Matthieu' && (
                      <button
                        type="button"
                        onClick={() => onDeleteCaretaker(caretaker.id)}
                        aria-label={t.household.deleteMember}
                        className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
