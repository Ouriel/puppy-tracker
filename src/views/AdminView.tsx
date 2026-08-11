import React, { useState, useEffect } from 'react';
import { Shield, Send, Users, AlertCircle, UserCheck, UserX, Trash2 } from 'lucide-react';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../services/api';
import type { RegisteredUserItem } from '../types';
import { useI18n } from '../i18n';
import { Button, Input, Card, Chip, Modal } from '@heroui/react';

interface AdminViewProps {
  currentUserEmail: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserEmail }) => {
  const { t } = useI18n();
  const isSuperAdmin = currentUserEmail.toLowerCase() === 'matthieu.jacquet@gmail.com';

  const [users, setUsers] = useState<RegisteredUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<RegisteredUserItem | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadUsers();
    }
  }, [isSuperAdmin]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const remoteUsers = await fetchUsers();
      if (Array.isArray(remoteUsers)) {
        setUsers(remoteUsers);
      }
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (email: string) => {
    try {
      const res = await updateUser({ email, status: 'ACTIVE' });
      if (res) {
        setUsers((previous) => previous.map((registeredUser) => (registeredUser.email === email ? { ...registeredUser, status: 'ACTIVE' as const } : registeredUser)));
        setStatusMessage(t.admin.activatedAccount ? t.admin.activatedAccount.replace('{email}', email) : `Activated ${email}`);
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err) {
      console.error('Failed to activate user', err);
    }
  };

  const handleDeactivate = async (email: string) => {
    if (email.toLowerCase() === 'matthieu.jacquet@gmail.com') return;
    try {
      const res = await updateUser({ email, status: 'PENDING_APPROVAL' });
      if (res) {
        setUsers((previous) => previous.map((registeredUser) => (registeredUser.email === email ? { ...registeredUser, status: 'PENDING_APPROVAL' as const } : registeredUser)));
        setStatusMessage(t.admin.revokedAccess ? t.admin.revokedAccess.replace('{email}', email) : `Revoked ${email}`);
        setTimeout(() => setStatusMessage(''), 3500);
      }
    } catch (err) {
      console.error('Failed to deactivate user', err);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.email.toLowerCase() === 'matthieu.jacquet@gmail.com') {
      setUserToDelete(null);
      return;
    }

    try {
      const success = await deleteUser(userToDelete.email);
      if (success) {
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
      });

      if (res) {
        await loadUsers();
        setNewInviteEmail('');
        setStatusMessage(t.admin.preApprovedAccount ? t.admin.preApprovedAccount.replace('{email}', email) : `Pre-approved ${email}`);
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
            <strong className="text-white">matthieu.jacquet@gmail.com</strong>
            {t.admin.canAccessCenter}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
            onPress={loadUsers}
            className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800"
          >
            Refresh Accounts
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
                  <span>Confirm deletion for {userToDelete?.email}?</span>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-4">
                <p className="text-sm text-slate-400">This action will revoke access and remove records for this email address.</p>
              </Modal.Body>
              <Modal.Footer className="border-t border-slate-800 pt-3">
                <Button onPress={() => setUserToDelete(null)} className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800">
                  {t.potty.cancel}
                </Button>
                <Button onPress={confirmDeleteUser} className="bg-rose-600 hover:bg-rose-500 text-white font-bold">
                  Delete User
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
            <span>Pending Account Activations ({pendingUsers.length})</span>
            <span className="text-[10px] text-slate-500 font-mono font-normal">
              Requires Approval
            </span>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {pendingUsers.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
              No pending activations. All user accounts are processed!
            </p>
          ) : (
            <div className="space-y-2">
              {pendingUsers.map((userItem) => (
                <div
                  key={userItem.id}
                  className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-100">
                      {userItem.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{userItem.email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onPress={() => handleActivate(userItem.email)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                      Activate
                    </Button>
                    <Button
                      size="sm"
                      isIconOnly
                      onPress={() => setUserToDelete(userItem)}
                      className="bg-slate-950 border border-slate-800 text-red-400 hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
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
          <Card.Content className="p-4">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="e.g. partner@family.com"
                  className="bg-slate-950 border-slate-800 text-slate-100"
                  value={newInviteEmail}
                  onChange={(event) => setNewInviteEmail(event.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                <Send className="w-3.5 h-3.5 mr-1.5 inline" />
                Pre-Approve
              </Button>
            </div>
          </Card.Content>
        </form>
      </Card>

      {/* Active Accounts */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Active Registered Accounts ({activeUsers.length})</span>
          </Card.Title>
        </Card.Header>
        <Card.Content className="p-4">
          {isLoading ? (
            <div className="p-4 text-center text-xs text-slate-400">Loading accounts...</div>
          ) : activeUsers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">No active accounts registered yet.</div>
          ) : (
            <div className="space-y-2">
              {activeUsers.map((userItem) => (
                <div
                  key={userItem.id}
                  className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-100">{userItem.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">{userItem.email}</div>
                  </div>

                  <div>
                    {userItem.email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? (
                      <Chip color="accent" size="sm" variant="soft" className="font-bold">
                        Super Admin Owner
                      </Chip>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onPress={() => handleDeactivate(userItem.email)}
                          className="bg-slate-950 border border-slate-800 text-amber-300 font-bold hover:bg-slate-800"
                        >
                          <UserX className="w-3.5 h-3.5 mr-1 inline" />
                          Revoke
                        </Button>
                        <Button
                          size="sm"
                          isIconOnly
                          onPress={() => setUserToDelete(userItem)}
                          className="bg-slate-950 border border-slate-800 text-red-400 hover:bg-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
