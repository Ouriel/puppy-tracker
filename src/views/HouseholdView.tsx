import React, { useState } from 'react';
import type { Caretaker, UserAccount } from '../types';
import { Home, Users, UserPlus, Trash2, Mail, Send, CheckCircle2, UserCheck, Copy, Pencil, X, Check } from 'lucide-react';
import { createUser } from '../services/api';
import { buildInviteBadge, findLinkedCaretaker, firstFreeBadgeColor } from '../utils/caretakers';
import { isSuperAdminEmail } from '../utils/auth';
import { useI18n } from '../i18n';
import { Card, Button, Input, Chip, toast } from '@heroui/react';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface HouseholdViewProps {
  caretakers: Caretaker[];
  user: UserAccount;
  onAddCaretaker: (caretaker: Caretaker) => void;
  onUpdateCaretaker: (id: string, updatedFields: Partial<Caretaker>) => void;
  onDeleteCaretaker: (id: string) => void;
}

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  caretakers,
  user,
  onAddCaretaker,
  onUpdateCaretaker,
  onDeleteCaretaker,
}) => {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [isInvitingEmail, setIsInvitingEmail] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [emailToMove, setEmailToMove] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('#EC4899');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#EC4899');
  const [editIsMe, setEditIsMe] = useState(false);

  const myEmail = user.email.toLowerCase();
  // The same rule as logged-by: the chip and the delete guard follow the email link, never a name guess.
  const linkedCaretaker = findLinkedCaretaker(user, caretakers);
  // Only the owner pre-approves: the server refuses members and keeps moves between households for the owner.
  const canPreApprove = isSuperAdminEmail(user.email);

  // Into the inviter's own household (the server's default): the account keeps its Google name, and the badge
  // carries the invited email.
  const inviteMember = async (email: string, confirmMove = false) => {
    const result = await createUser({ email, role: 'Member', status: 'ACTIVE', ...(confirmMove ? { confirmMove } : {}) });

    if (result.ok) {
      setInviteSuccess(`${email} authorized!`);
      setInviteEmail('');
      const badge = buildInviteBadge(email, caretakers);
      if (badge) onAddCaretaker(badge);
    } else if (result.status === 409) {
      setEmailToMove(email);
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  const handlePreApproveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    await inviteMember(inviteEmail.trim().toLowerCase());
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
          {canPreApprove && (
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsInvitingEmail(!isInvitingEmail)}
              className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs shadow-sm"
            >
              <Mail className="w-4 h-4 mr-1.5 inline" />
              {t.household.preApproveBtn}
            </Button>
          )}
        </Card.Content>
      </Card>

      <ConfirmationModal
        isOpen={!!emailToMove}
        title={t.household.addToFamily}
        message={t.household.alreadyHasAccount}
        confirmLabel={t.household.addToFamily}
        cancelLabel={t.potty.cancel}
        onConfirm={() => emailToMove && void inviteMember(emailToMove, true)}
        onClose={() => setEmailToMove(null)}
      />

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
              onPress={() => {
                // Every new badge starts on the first colour no other badge uses (42); the picker can change it.
                if (!isAdding) setColor(firstFreeBadgeColor(caretakers));
                setIsAdding(!isAdding);
              }}
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
                    maxLength={80}
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
              const isSelected = linkedCaretaker?.id === caretaker.id;
              const isEditingThis = editingId === caretaker.id;

              if (isEditingThis) {
                const isLinkedToMe = caretaker.email?.toLowerCase() === myEmail;
                // 'This is me' on an unlinked badge while no badge carries my email; unticking it on my own badge
                // (unlinking) is for the owner only, as the server refuses it to members.
                const canClaim = caretaker.email
                  ? isLinkedToMe && isSuperAdminEmail(user.email)
                  : !caretakers.some((item) => item.email?.toLowerCase() === myEmail);
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
                        maxLength={80}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        placeholder={t.household.memberName}
                        autoFocus
                      />
                      {canClaim && (
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editIsMe}
                            onChange={(event) => setEditIsMe(event.target.checked)}
                            className="w-4 h-4 accent-indigo-500"
                          />
                          {t.household.thisIsMe}
                        </label>
                      )}
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
                            // Links the badge to my login by email, or '' to unlink it.
                            ...(editIsMe !== isLinkedToMe ? { email: editIsMe ? myEmail : '' } : {}),
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
                        setEditIsMe(caretaker.email?.toLowerCase() === myEmail);
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

                    {!isSelected && (
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
