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
import { Button, Input, Card, Chip, Modal, Table } from '@heroui/react';

interface AdminViewProps {
  currentUserEmail: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserEmail }) => {
  const { t } = useI18n();
  const isSuperAdmin = currentUserEmail.toLowerCase() === 'matthieu.jacquet@gmail.com';

  const [users, setUsers] = useState<RegisteredUserItem[]>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<RegisteredUserItem | null>(null);

  useEffect(() => {
    if (isSuperAdmin) {
      loadUsers();
    }
  }, [isSuperAdmin]);

  const loadUsers = async () => {
    const remoteUsers = await fetchUsers();
    if (remoteUsers) {
      setUsers(remoteUsers);
    }
  };

  const handleActivate = async (email: string) => {
    const res = await updateUser({ email, status: 'ACTIVE' });
    if (res) {
      setUsers((previous) => previous.map((registeredUser) => (registeredUser.email === email ? { ...registeredUser, status: 'ACTIVE' as const } : registeredUser)));
      setStatusMessage(t.admin.activatedAccount.replace('{email}', email));
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  const handleDeactivate = async (email: string) => {
    if (email.toLowerCase() === 'matthieu.jacquet@gmail.com') return;
    const res = await updateUser({ email, status: 'PENDING_APPROVAL' });
    if (res) {
      setUsers((previous) => previous.map((registeredUser) => (registeredUser.email === email ? { ...registeredUser, status: 'PENDING_APPROVAL' as const } : registeredUser)));
      setStatusMessage(t.admin.revokedAccess.replace('{email}', email));
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.email.toLowerCase() === 'matthieu.jacquet@gmail.com') {
      setUserToDelete(null);
      return;
    }

    const success = await deleteUser(userToDelete.email);
    if (success) {
      setUsers((previous) => previous.filter((registeredUser) => registeredUser.email !== userToDelete.email));
      setStatusMessage(t.admin.deletedAccount.replace('{email}', userToDelete.email));
    }
    setUserToDelete(null);
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handlePreApproveInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newInviteEmail.trim()) return;

    const email = newInviteEmail.trim().toLowerCase();
    const res = await createUser({
      email,
      name: email.split('@')[0],
      role: 'Member',
      status: 'ACTIVE',
    });

    if (res) {
      await loadUsers();
      setNewInviteEmail('');
      setStatusMessage(t.admin.preApprovedAccount.replace('{email}', email));
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  const pendingUsers = users.filter((registeredUser) => registeredUser.status === 'PENDING_APPROVAL');
  const activeUsers = users.filter((registeredUser) => registeredUser.status === 'ACTIVE');

  if (!isSuperAdmin) {
    return (
      <Card className="border-red-900/40 text-center">
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

          <Chip color="danger" variant="soft" size="sm">
            Super Admin Owner
          </Chip>
        </Card.Content>
      </Card>

      {statusMessage && (
        <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 p-3 rounded-xl text-xs text-center font-semibold">
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
                  {t.admin.deleteConfirmTitle} {userToDelete?.email} ?
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-slate-400">{t.admin.deleteConfirmBody}</p>
              </Modal.Body>
              <Modal.Footer>
                <Button onPress={() => setUserToDelete(null)} className="bg-slate-950 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800">
                  {t.potty.cancel}
                </Button>
                <Button variant="danger" onPress={confirmDeleteUser}>
                  <Trash2 className="w-4 h-4 mr-1.5 inline" />
                  {t.admin.confirmDelete}
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
              {t.admin.requiresApproval}
            </span>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          {pendingUsers.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
              {t.admin.noPendingActivations}
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
                      variant="primary"
                      size="sm"
                      onPress={() => handleActivate(userItem.email)}
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                      {t.admin.activate}
                    </Button>
                    <Button
                      variant="danger-soft"
                      size="sm"
                      isIconOnly
                      onPress={() => setUserToDelete(userItem)}
                      aria-label={t.admin.deleteUserAccount}
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
            <Card.Title>{t.admin.preApproveTitle}</Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex gap-2 items-end">
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
                variant="primary"
              >
                <Send className="w-3.5 h-3.5 mr-1.5 inline" />
                {t.admin.preApprove}
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
            <span>{t.admin.activeAccounts.replace('{count}', String(activeUsers.length))}</span>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <Table aria-label="Active Users">
            <Table.Header>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Email</Table.Column>
              <Table.Column>Actions</Table.Column>
            </Table.Header>
            <Table.Body>
              {activeUsers.map((userItem) => (
                <Table.Row key={userItem.id} id={userItem.id}>
                  <Table.Cell>{userItem.name}</Table.Cell>
                  <Table.Cell>{userItem.email}</Table.Cell>
                  <Table.Cell>
                    {userItem.email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? (
                      <Chip color="accent" size="sm" variant="soft">
                        Super Admin Owner
                      </Chip>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => handleDeactivate(userItem.email)}
                        >
                          <UserX className="w-3.5 h-3.5 mr-1 inline" />
                          {t.admin.revoke}
                        </Button>
                        <Button
                          variant="danger-soft"
                          size="sm"
                          isIconOnly
                          onPress={() => setUserToDelete(userItem)}
                          aria-label={t.admin.deleteUserAccount}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
};
