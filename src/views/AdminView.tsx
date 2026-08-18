import React, { useState, useEffect } from 'react';
import { Shield, Send, Users, AlertCircle, UserCheck, UserX, Trash2, RefreshCw, Home } from 'lucide-react';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  fetchAllHouseholds,
} from '../services/api';
import type { RegisteredUserItem } from '../types';
import { useI18n } from '../i18n';
import { Button, Input, Card, Chip, Modal } from '@heroui/react';
import { SUPER_ADMIN_EMAIL, isSuperAdminEmail } from '../constants/auth';

interface AdminViewProps {
  currentUserEmail: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserEmail }) => {
  const { t } = useI18n();
  const isSuperAdmin = isSuperAdminEmail(currentUserEmail);

  const [users, setUsers] = useState<RegisteredUserItem[]>([]);
  const [households, setHouseholds] = useState<Array<{ id: string; name: string }>>([
    { id: 'FAMILY-COCKER-2026', name: 'Family Pack (Main)' },
  ]);
  const [targetHouseholds, setTargetHouseholds] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteHousehold, setNewInviteHousehold] = useState('FAMILY-COCKER-2026');
  const [statusMessage, setStatusMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<RegisteredUserItem | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [remoteUsers, remoteHouseholds] = await Promise.all([
        fetchUsers(),
        fetchAllHouseholds(),
      ]);

      if (remoteUsers.ok) {
        setUsers(remoteUsers.data);
      }
      if (remoteHouseholds.ok && remoteHouseholds.data.length > 0) {
        setHouseholds(remoteHouseholds.data);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (email: string) => {
    const targetHouseholdId = targetHouseholds[email] || 'FAMILY-COCKER-2026';
    try {
      const res = await updateUser({ email, status: 'ACTIVE', householdId: targetHouseholdId });
      if (res.ok) {
        setUsers((previous) =>
          previous.map((registeredUser) =>
            registeredUser.email === email
              ? { ...registeredUser, status: 'ACTIVE' as const, householdId: targetHouseholdId }
              : registeredUser
          )
        );
        setStatusMessage(
          `Activated ${email} in household "${households.find((h) => h.id === targetHouseholdId)?.name || targetHouseholdId}"`
        );
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err) {
      console.error('Failed to activate user', err);
    }
  };

  const handleMoveHousehold = async (email: string, newHouseholdId: string) => {
    try {
      const res = await updateUser({ email, householdId: newHouseholdId });
      if (res.ok) {
        setUsers((previous) =>
          previous.map((registeredUser) =>
            registeredUser.email === email
              ? { ...registeredUser, householdId: newHouseholdId }
              : registeredUser
          )
        );
        setStatusMessage(
          `Moved ${email} to household "${households.find((h) => h.id === newHouseholdId)?.name || newHouseholdId}"`
        );
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err) {
      console.error('Failed to move user household', err);
    }
  };

  const handleDeactivate = async (email: string) => {
    if (isSuperAdminEmail(email)) return;
    try {
      const res = await updateUser({ email, status: 'PENDING_APPROVAL' });
      if (res.ok) {
        setUsers((previous) =>
          previous.map((registeredUser) =>
            registeredUser.email === email
              ? { ...registeredUser, status: 'PENDING_APPROVAL' as const }
              : registeredUser
          )
        );
        setStatusMessage(t.admin.revokedAccess ? t.admin.revokedAccess.replace('{email}', email) : `Revoked ${email}`);
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err) {
      console.error('Failed to deactivate user', err);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (isSuperAdminEmail(userToDelete.email)) {
      setUserToDelete(null);
      return;
    }

    try {
      const res = await deleteUser(userToDelete.email);
      if (res.ok) {
        setUsers((previous) => previous.filter((registeredUser) => registeredUser.email !== userToDelete.email));
        setStatusMessage(t.admin.deletedAccount ? t.admin.deletedAccount.replace('{email}', userToDelete.email) : `Deleted ${userToDelete.email}`);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    } finally {
      setUserToDelete(null);
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  const handlePreApproveInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newInviteEmail.trim()) return;

    const email = newInviteEmail.trim().toLowerCase();
    try {
      const res = await createUser({
        email,
        name: email.split('@')[0],
        role: 'Member',
        status: 'ACTIVE',
        householdId: newInviteHousehold,
      });

      if (res.ok) {
        await loadData();
        setNewInviteEmail('');
        setStatusMessage(`Pre-approved ${email} in household "${newInviteHousehold}"`);
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err) {
      console.error('Failed to pre-approve user', err);
    }
  };

  const pendingUsers = (users || []).filter((registeredUser) => registeredUser.status === 'PENDING_APPROVAL');
  const activeUsers = (users || []).filter((registeredUser) => registeredUser.status === 'ACTIVE');

  if (!isSuperAdmin) {
    return (
      <Card className="bg-slate-900 border-slate-800 border-red-900/40 text-center">
        <Card.Content className="p-8 space-y-3">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">
            {t.admin.accessRestricted}
          </h2>
          <p className="text-xs text-slate-400">
            {t.admin.onlySuperAdmin}
            <strong className="text-white">{SUPER_ADMIN_EMAIL}</strong>
            {t.admin.canAccessCenter}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-red-500 to-indigo-600 rounded-xl shadow-md">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {t.admin.title}
              </h2>
              <p className="text-xs text-slate-400">
                {t.admin.subtitle}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onPress={loadData}
            isDisabled={isLoading}
            className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t.admin.refreshUserList}</span>
          </Button>
        </Card.Content>
      </Card>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 px-4 py-3 rounded-xl text-xs font-semibold shadow-lg">
          {statusMessage}
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <Modal isOpen={!!userToDelete} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span>{t.admin.confirmDeletionFor.replace('{email}', String(userToDelete?.email))}</span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-4">
                <p className="text-sm text-slate-400">{t.admin.deleteConfirmBody}</p>
              </Modal.Body>
              <Modal.Footer className="border-t border-slate-800 pt-3">
                <Button onPress={() => setUserToDelete(null)} className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800">
                  {t.potty.cancel}
                </Button>
                <Button onPress={confirmDeleteUser} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
                  {t.admin.deleteUserBtn}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Pending Activations List */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Header>
          <Card.Title className="flex items-center justify-between text-amber-300">
            <span>{t.admin.pendingActivations.replace('{count}', String(pendingUsers.length))}</span>
            <span className="text-[10px] text-slate-500 font-mono font-normal">
              {t.admin.requiresApprovalAndHousehold}
            </span>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {pendingUsers.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
              {t.admin.noPendingActivations}
            </p>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((userItem) => {
                const currentSelectedHousehold = targetHouseholds[userItem.email] || 'FAMILY-COCKER-2026';
                return (
                  <div
                    key={userItem.id}
                    className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-100">
                          {userItem.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{userItem.email}</div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                        <Home className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{t.admin.currentId} <span className="font-mono text-slate-300">{userItem.householdId || t.admin.isolated}</span></span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">{t.admin.assignTo}</span>
                        <select
                          value={currentSelectedHousehold}
                          onChange={(event) =>
                            setTargetHouseholds({ ...targetHouseholds, [userItem.email]: event.target.value })
                          }
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                        >
                          {households.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name} ({h.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onPress={() => handleActivate(userItem.email)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                          {t.admin.approveAndAssign}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setUserToDelete(userItem)}
                          aria-label={t.admin.deleteUserAccount}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Pre-Approve Form */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <form onSubmit={handlePreApproveInvite}>
          <Card.Header>
            <Card.Title className="text-white font-bold">{t.admin.preApproveTitle}</Card.Title>
          </Card.Header>
          <Card.Content className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex-1 min-w-[200px]">
                <Input
                  type="email"
                  placeholder="e.g. partner@family.com"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  value={newInviteEmail}
                  onChange={(event) => setNewInviteEmail(event.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={newInviteHousehold}
                  onChange={(event) => setNewInviteHousehold(event.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                >
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>

                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5 inline" />
                  {t.admin.preApprove}
                </Button>
              </div>
            </div>
          </Card.Content>
        </form>
      </Card>

      {/* Active Accounts */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
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
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-100">{userItem.name}</span>
                      <Chip color="default" size="sm" variant="soft" className="text-[10px]">
                        {userItem.role}
                      </Chip>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{userItem.email}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Household badge / mover */}
                    {isSuperAdminEmail(userItem.email) ? (
                      <Chip color="accent" size="sm" variant="soft" className="font-bold">
                        {t.admin.superAdminOwner}
                      </Chip>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-indigo-400" />
                          <select
                            value={userItem.householdId || 'FAMILY-COCKER-2026'}
                            onChange={(event) => handleMoveHousehold(userItem.email, event.target.value)}
                            aria-label={t.admin.householdFor.replace('{name}', userItem.name)}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                          >
                            {households.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name} ({h.id})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onPress={() => handleDeactivate(userItem.email)}
                            className="bg-slate-950 border border-slate-800 text-amber-300 font-bold hover:bg-slate-800"
                          >
                            <UserX className="w-3.5 h-3.5 mr-1 inline" />
                            {t.admin.revoke}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(userItem)}
                            aria-label={t.admin.deleteUserAccount}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
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
    </div>
  );
};
