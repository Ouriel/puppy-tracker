import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Send, Users, UserCheck, UserX, Trash2, RefreshCw, Home, Mail, Pencil, X } from 'lucide-react';
import {
  fetchUsers,
  sendInvite,
  updateUser,
  deleteUser,
  fetchAllHouseholds,
  fetchPrivacyRequests,
  markPrivacyRequestHandled,
  renameHousehold,
} from '../services/api';
import type { Caretaker, HouseholdItem, PrivacyRequestItem, RegisteredUserItem } from '../types';
import { formatCount, useI18n } from '../i18n';
import { Button, Input, Card, Chip, toast } from '@heroui/react';
import { formatShortDate } from '../utils/date';
import { buildInviteBadge } from '../utils/caretakers';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { PageHeader } from '../components/common/PageHeader';

// The invite form's household choice that creates a new one (no household id starts with '+')
const NEW_HOUSEHOLD = '+new';

interface AdminViewProps {
  currentUserEmail: string;
  caretakers: Caretaker[];
  onAddCaretaker: (caretaker: Caretaker) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserEmail, caretakers, onAddCaretaker }) => {
  const { t, lang } = useI18n();

  const [users, setUsers] = useState<RegisteredUserItem[]>([]);
  // Accounts the list did not load (the API sends at most 500): kept apart from users, which deletes shorten
  const [hiddenAccounts, setHiddenAccounts] = useState(0);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyRequestItem[]>([]);
  const [households, setHouseholds] = useState<HouseholdItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  // '' = the admin's own household, NEW_HOUSEHOLD = a new one named newHouseholdName
  const [newInviteHousehold, setNewInviteHousehold] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [householdToRename, setHouseholdToRename] = useState<{ id: string; name: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<RegisteredUserItem | null>(null);
  const [accountToMove, setAccountToMove] = useState<{ email: string; householdId: string } | null>(null);

  const currentHouseholdId = users.find((registeredUser) => registeredUser.email.toLowerCase() === currentUserEmail.toLowerCase())?.householdId;
  // A household the owner has not named is called after its admin (else its first account), never by its id
  const householdName = (householdId?: string) => {
    const stored = households.find((household) => household.id === householdId)?.name;
    if (stored) return stored;
    const accounts = users.filter((registeredUser) => registeredUser.householdId === householdId);
    const namedAfter = accounts.find((account) => account.role === 'Admin' || account.role === 'SuperAdmin') ?? accounts[0];
    return namedAfter ? t.admin.householdOf.replace('{name}', namedAfter.name) : t.admin.ownHousehold;
  };
  const sortedHouseholds = [...households].sort((first, second) => householdName(first.id).localeCompare(householdName(second.id), lang));
  // The list holds every account's household once loaded: until then, keep the account's own so the select shows it
  const householdOptions = (ownHouseholdId?: string) =>
    !ownHouseholdId || households.some((household) => household.id === ownHouseholdId)
      ? sortedHouseholds
      : [{ id: ownHouseholdId, name: null }, ...sortedHouseholds];

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [remoteUsers, remoteHouseholds, remotePrivacyRequests] = await Promise.all([
        fetchUsers(),
        fetchAllHouseholds(),
        fetchPrivacyRequests(),
      ]);
      if (remoteUsers.ok) {
        setUsers(remoteUsers.data.users);
        setHiddenAccounts(remoteUsers.data.total - remoteUsers.data.users.length);
      }
      if (remotePrivacyRequests.ok) setPrivacyRequests(remotePrivacyRequests.data);
      if (remoteHouseholds.ok && remoteHouseholds.data.length > 0) setHouseholds(remoteHouseholds.data);
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Settings shows this panel to the owner only (the session's role); the API refuses everyone else anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Asked first (accountToMove). Into the admin's own household, the same linked badge as an invite (28), so they never log under a guessed name.
  const handleMoveHousehold = async (email: string, newHouseholdId: string) => {
    try {
      const res = await updateUser({ email, householdId: newHouseholdId });
      if (res.ok) {
        const badge = newHouseholdId === currentHouseholdId ? buildInviteBadge(email, caretakers) : null;
        if (badge) onAddCaretaker(badge);
        setUsers((previous) =>
          previous.map((registeredUser) =>
            registeredUser.email === email
              // The server makes an Admin moved into another household a Member there.
              ? { ...registeredUser, householdId: newHouseholdId, role: res.data.role || registeredUser.role }
              : registeredUser
          )
        );
        setStatusMessage(t.admin.movedAccount.replace('{email}', email).replace('{household}', householdName(newHouseholdId)));
        setTimeout(() => setStatusMessage(''), 3500);
      } else {
        toast.danger(t.toasts[res.errorKey]);
      }
    } catch (err) {
      console.error('Failed to move user household', err);
    }
  };

  // Revoke, or restore (same household and role). The owner's own row (role SuperAdmin, which only the owner's email gets)
  // offers neither revoke nor delete.
  const changeAccess = async (email: string, status: 'REVOKED' | 'ACTIVE') => {
    if (users.some((registeredUser) => registeredUser.email === email && registeredUser.role === 'SuperAdmin')) return;
    try {
      const res = await updateUser({ email, status });
      if (res.ok) {
        setUsers((previous) =>
          previous.map((registeredUser) =>
            registeredUser.email === email
              ? { ...registeredUser, status }
              : registeredUser
          )
        );
        setStatusMessage((status === 'REVOKED' ? t.admin.revokedAccess : t.admin.restoredAccess).replace('{email}', email));
        setTimeout(() => setStatusMessage(''), 3500);
      } else {
        toast.danger(t.toasts[res.errorKey]);
      }
    } catch (err) {
      console.error('Failed to change user access', err);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.role === 'SuperAdmin') {
      setUserToDelete(null);
      return;
    }

    try {
      const res = await deleteUser(userToDelete.email);
      if (res.ok) {
        setUsers((previous) => previous.filter((registeredUser) => registeredUser.email !== userToDelete.email));
        setStatusMessage(t.admin.deletedAccount.replace('{email}', userToDelete.email));
      } else {
        toast.danger(t.toasts[res.errorKey]);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    } finally {
      setUserToDelete(null);
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  // The invitee joins from their own dashboard. Into the admin's own household, the same badge as the Members tab (28).
  // Into a new household, the server makes the invite an Admin one; their badge comes with their first log.
  const inviteMember = async (invite: { email: string; householdId?: string; newHouseholdName?: string }) => {
    const { email, householdId, newHouseholdName: newName } = invite;
    try {
      const res = await sendInvite(newName ? { email, newHouseholdName: newName } : { email, householdId });

      if (res.ok) {
        const badge = !newName && householdId === currentHouseholdId ? buildInviteBadge(email, caretakers) : null;
        if (badge) onAddCaretaker(badge);
        await loadData();
        setNewInviteEmail('');
        setNewInviteHousehold('');
        setNewHouseholdName('');
        setStatusMessage(t.household.inviteSent.replace('{email}', email));
        setTimeout(() => setStatusMessage(''), 3500);
      } else {
        toast.danger(t.toasts[res.errorKey]);
      }
    } catch (err) {
      console.error('Failed to send invite', err);
    }
  };

  const handlePreApproveInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newInviteEmail.trim()) return;
    const email = newInviteEmail.trim().toLowerCase();
    if (newInviteHousehold === NEW_HOUSEHOLD) {
      if (!newHouseholdName.trim()) return;
      await inviteMember({ email, newHouseholdName: newHouseholdName.trim() });
      return;
    }
    await inviteMember({ email, householdId: newInviteHousehold || currentHouseholdId });
  };

  const handleRenameHousehold = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = householdToRename?.name.trim();
    if (!householdToRename || !name) return;
    const res = await renameHousehold(householdToRename.id, name);
    if (res.ok) {
      setHouseholds((previous) => previous.map((household) => (household.id === res.data.id ? res.data : household)));
      setHouseholdToRename(null);
    } else {
      toast.danger(t.toasts[res.errorKey]);
    }
  };

  const handleMarkAnswered = async (id: string) => {
    const res = await markPrivacyRequestHandled(id);
    if (res.ok) {
      setPrivacyRequests((previous) => previous.map((privacyRequest) => (privacyRequest.id === id ? res.data : privacyRequest)));
    } else {
      toast.danger(t.toasts[res.errorKey]);
    }
  };

  const openPrivacyRequests = privacyRequests.filter((privacyRequest) => !privacyRequest.handledAt).length;
  const activeUsers = (users || []).filter((registeredUser) => registeredUser.status === 'ACTIVE');
  const revokedUsers = (users || []).filter((registeredUser) => registeredUser.status === 'REVOKED');

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <PageHeader
        icon={Shield}
        iconClassName="from-red-500 to-indigo-600"
        title={t.admin.title}
        subtitle={t.admin.subtitle}
        action={
          <Button
            size="sm"
            onPress={loadData}
            isDisabled={isLoading}
            className="min-h-11 bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t.admin.refreshUserList}</span>
          </Button>
        }
      />

      {hiddenAccounts > 0 && (
        <p className="text-xs text-slate-400">
          {t.admin.showingAccounts.replace('{shown}', String(users.length)).replace('{total}', String(users.length + hiddenAccounts))}
        </p>
      )}

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold shadow-lg">
          {statusMessage}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!accountToMove}
        title={t.admin.move}
        message={t.admin.moveHousehold.replace('{email}', accountToMove?.email ?? '').replace('{household}', householdName(accountToMove?.householdId))}
        confirmLabel={t.admin.move}
        tone="primary"
        onConfirm={() => accountToMove && void handleMoveHousehold(accountToMove.email, accountToMove.householdId)}
        onClose={() => setAccountToMove(null)}
      />

      <ConfirmationModal
        isOpen={!!userToDelete}
        title={t.admin.confirmDeletionFor.replace('{email}', String(userToDelete?.email))}
        message={t.admin.deleteConfirmBody}
        confirmLabel={t.admin.deleteUserBtn}
        onConfirm={() => void confirmDeleteUser()}
        onClose={() => setUserToDelete(null)}
      />

      {/* Privacy requests, from the /privacy form: answered by email, then marked here */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Header className="px-4 pt-4">
          <Card.Title className="flex flex-wrap items-center justify-between gap-x-2 font-bold">
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{t.admin.privacyRequests.replace('{count}', String(openPrivacyRequests))}</span>
            </span>
            <span className="text-xs text-slate-400 font-normal">{t.admin.privacyRequestsHint}</span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="p-4">
          {privacyRequests.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
              {t.admin.noPrivacyRequests}
            </p>
          ) : (
            <div className="space-y-3">
              {privacyRequests.map((privacyRequest) => {
                const hasAccount = users.some((registeredUser) => registeredUser.email.toLowerCase() === privacyRequest.email);
                return (
                  <div key={privacyRequest.id} className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-100">{t.admin.privacyRequestKinds[privacyRequest.kind] ?? privacyRequest.kind}</div>
                        <div className="text-xs text-slate-400 mt-0.5 break-all">
                          {privacyRequest.email} · {privacyRequest.lang.toUpperCase()} · {privacyRequest.createdAt ? formatShortDate(privacyRequest.createdAt, lang) : ''}
                        </div>
                        {/* An account the list did not load may hold this email: never say there is none then */}
                        {(hasAccount || hiddenAccounts === 0) && (
                          <div className={`text-xs mt-0.5 ${hasAccount ? 'text-emerald-400' : 'text-amber-300'}`}>
                            {hasAccount ? t.admin.requestFromAccount : t.admin.requestNoAccount}
                          </div>
                        )}
                      </div>
                      {privacyRequest.handledAt ? (
                        <span className="text-xs text-slate-400">{t.admin.answeredOn.replace('{date}', formatShortDate(privacyRequest.handledAt, lang))}</span>
                      ) : (
                        <Button
                          size="sm"
                          onPress={() => void handleMarkAnswered(privacyRequest.id)}
                          className="min-h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                        >
                          {t.admin.markAnswered}
                        </Button>
                      )}
                    </div>
                    {privacyRequest.message && (
                      <p className="text-xs text-slate-300 whitespace-pre-wrap break-words">{privacyRequest.message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Invite form */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <form onSubmit={handlePreApproveInvite}>
          <Card.Header className="px-4 pt-4">
            <Card.Title className="flex items-center gap-2 font-bold">
              <Send className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{t.admin.preApproveTitle}</span>
            </Card.Title>
          </Card.Header>
          <Card.Content className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="flex-1 min-w-0">
                <Input
                  type="email"
                  aria-label={t.admin.preApproveTitle}
                  placeholder={t.household.emailPlaceholder}
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  value={newInviteEmail}
                  onChange={(event) => setNewInviteEmail(event.target.value)}
                  required
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
                <select
                  aria-label={t.admin.household}
                  value={newInviteHousehold || currentHouseholdId || ''}
                  onChange={(event) => setNewInviteHousehold(event.target.value)}
                  className="w-full sm:w-auto min-w-0 min-h-11 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  {householdOptions(currentHouseholdId).map((household) => (
                    <option key={household.id} value={household.id} title={household.id}>
                      {householdName(household.id)}
                    </option>
                  ))}
                  <option value={NEW_HOUSEHOLD}>{t.admin.newHousehold}</option>
                </select>

                {newInviteHousehold === NEW_HOUSEHOLD && (
                  <div className="w-full sm:w-48 min-w-0">
                    <Input
                      aria-label={t.admin.householdNameLabel}
                      placeholder={t.admin.householdNameLabel}
                      className="bg-slate-950 border-slate-800 text-slate-100"
                      value={newHouseholdName}
                      onChange={(event) => setNewHouseholdName(event.target.value)}
                      maxLength={80}
                      required
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  size="sm"
                  className="min-h-11 font-bold text-xs shrink-0"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5 inline" />
                  {t.admin.preApprove}
                </Button>
              </div>
            </div>
          </Card.Content>
        </form>
      </Card>

      {/* Households: listed by name, renamed here; members never see these names */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Header className="px-4 pt-4">
          <Card.Title className="flex flex-wrap items-center justify-between gap-x-2 font-bold">
            <span className="flex items-center gap-2">
              <Home className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{t.admin.households.replace('{count}', String(households.length))}</span>
            </span>
            <span className="text-xs text-slate-400 font-normal">{t.admin.householdsHint}</span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="p-4 space-y-3">
          {sortedHouseholds.map((household) => {
            const accountCount = users.filter((registeredUser) => registeredUser.householdId === household.id).length;
            return householdToRename?.id === household.id ? (
              <form
                key={household.id}
                onSubmit={(event) => void handleRenameHousehold(event)}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800"
              >
                <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                  <Input
                    aria-label={t.admin.householdNameLabel}
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={householdToRename.name}
                    onChange={(event) => setHouseholdToRename({ id: household.id, name: event.target.value })}
                    maxLength={80}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" size="sm" className="min-h-11 font-bold text-xs">
                  {t.admin.saveHouseholdName}
                </Button>
                <button
                  type="button"
                  onClick={() => setHouseholdToRename(null)}
                  aria-label={t.potty.cancel}
                  className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div
                key={household.id}
                className="flex items-center justify-between gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-100 break-words">{householdName(household.id)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{formatCount(t.admin.householdAccounts, accountCount, lang)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setHouseholdToRename({ id: household.id, name: householdName(household.id) })}
                  aria-label={t.admin.renameHousehold.replace('{household}', householdName(household.id))}
                  className="min-h-11 min-w-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </Card.Content>
      </Card>

      {/* Active Accounts */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Header className="px-4 pt-4">
          <Card.Title className="flex items-center gap-2 font-bold">
            <Users className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{t.admin.activeAccounts.replace('{count}', String(activeUsers.length))}</span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="p-4">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">{t.admin.loadingAccounts}</div>
          ) : activeUsers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">{t.admin.noActiveAccounts}</div>
          ) : (
            <div className="space-y-3">
              {activeUsers.map((userItem) => (
                <div
                  key={userItem.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-100 break-words min-w-0">{userItem.name}</span>
                      <Chip color="default" size="sm" variant="soft">
                        {t.admin.roles[userItem.role as keyof typeof t.admin.roles] ?? userItem.role}
                      </Chip>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 break-all">{userItem.email}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto min-w-0">
                    {/* Household badge / mover */}
                    {userItem.role === 'SuperAdmin' ? (
                      <Chip color="accent" size="sm" variant="soft" className="font-bold">
                        {t.admin.superAdminOwner}
                      </Chip>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                          <Home className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <select
                            value={userItem.householdId ?? ''}
                            onChange={(event) => setAccountToMove({ email: userItem.email, householdId: event.target.value })}
                            aria-label={t.admin.householdFor.replace('{name}', userItem.name)}
                            className="w-full sm:w-auto min-w-0 min-h-11 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                          >
                            {householdOptions(userItem.householdId).map((household) => (
                              <option key={household.id} value={household.id} title={household.id}>
                                {householdName(household.id)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onPress={() => void changeAccess(userItem.email, 'REVOKED')}
                            className="min-h-11 bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs hover:bg-slate-800"
                          >
                            <UserX className="w-3.5 h-3.5 mr-1 inline" />
                            {t.admin.revoke}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(userItem)}
                            aria-label={t.common.deleteItem.replace('{item}', userItem.email)}
                            className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Revoked accounts: signed out and refused until the owner restores them */}
      {revokedUsers.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <Card.Header className="px-4 pt-4">
            <Card.Title className="flex items-center gap-2 font-bold">
              <UserX className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t.admin.revokedAccounts.replace('{count}', String(revokedUsers.length))}</span>
            </Card.Title>
          </Card.Header>
          <Card.Content className="p-4 space-y-3">
            {revokedUsers.map((userItem) => (
              <div
                key={userItem.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-100 break-words">{userItem.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5 break-all">{userItem.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5 break-words">{householdName(userItem.householdId)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onPress={() => void changeAccess(userItem.email, 'ACTIVE')}
                    className="min-h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                    {t.admin.restoreAccess}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setUserToDelete(userItem)}
                    aria-label={t.common.deleteItem.replace('{item}', userItem.email)}
                    className="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </Card.Content>
        </Card>
      )}
    </div>
  );
};
