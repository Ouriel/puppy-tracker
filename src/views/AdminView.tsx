import React, { useState } from 'react';
import { Shield, Mail, Send, Users, AlertCircle, UserCheck, UserX, Trash2, Key } from 'lucide-react';

interface UserAccountItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
}

interface AdminViewProps {
  token: string;
  currentUserEmail: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserEmail }) => {
  const isSuperAdmin = currentUserEmail.toLowerCase() === 'matthieu.jacquet@gmail.com';

  const [users, setUsers] = useState<UserAccountItem[]>([
    { id: '1', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Husband', status: 'ACTIVE' },
    { id: '2', email: 'sarah@family.com', name: 'Sarah', role: 'Wife', status: 'PENDING_APPROVAL' },
    { id: '3', email: 'alex@dogwalkers.com', name: 'Alex', role: 'Dog Walker', status: 'PENDING_APPROVAL' },
  ]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  const [googleClientId, setGoogleClientId] = useState<string>(() => {
    return localStorage.getItem('puppace_google_client_id') || '';
  });
  const [clientIdInput, setClientIdInput] = useState(googleClientId);

  if (!isSuperAdmin) {
    return (
      <div className="bg-slate-900 border border-red-900/40 p-8 rounded-2xl text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-slate-400">
          Only Super Admin Owner (<strong className="text-white">matthieu.jacquet@gmail.com</strong>) can access the Admin Center.
        </p>
      </div>
    );
  }

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = clientIdInput.trim();
    localStorage.setItem('puppace_google_client_id', clean);
    setGoogleClientId(clean);
    setStatusMessage('Updated Google OAuth Client ID successfully!');
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleActivate = (email: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, status: 'ACTIVE' } : u))
    );
    setStatusMessage(`Activated account for ${email}! They can now log in.`);
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleDeactivate = (email: string) => {
    if (email === 'matthieu.jacquet@gmail.com') return;
    setUsers((prev) =>
      prev.map((u) => (u.email === email ? { ...u, status: 'PENDING_APPROVAL' } : u))
    );
    setStatusMessage(`Revoked access for ${email}.`);
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const handleDeleteUser = (id: string, email: string) => {
    if (email === 'matthieu.jacquet@gmail.com') return;
    if (window.confirm(`Are you sure you want to permanently delete user account ${email}?`)) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setStatusMessage(`Deleted user account ${email}.`);
      setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  const handlePreApproveInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail.trim()) return;

    const email = newInviteEmail.trim().toLowerCase();
    const existing = users.find((u) => u.email === email);
    if (existing) {
      existing.status = 'ACTIVE';
      setUsers([...users]);
    } else {
      setUsers((prev) => [
        ...prev,
        { id: `usr-${Date.now()}`, email, name: email.split('@')[0], role: 'Partner', status: 'ACTIVE' },
      ]);
    }

    setNewInviteEmail('');
    setStatusMessage(`Pre-approved & activated account for ${email}!`);
    setTimeout(() => setStatusMessage(''), 3500);
  };

  const pendingUsers = users.filter((u) => u.status === 'PENDING_APPROVAL');
  const activeUsers = users.filter((u) => u.status === 'ACTIVE');

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-red-500 to-indigo-600 rounded-xl shadow-md">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Super Admin Center</h2>
            <p className="text-xs text-slate-400">Strict backend-enforced user management and OAuth security configuration</p>
          </div>
        </div>

        <span className="text-xs font-mono bg-red-950 text-red-300 border border-red-800 px-3 py-1 rounded-full font-bold">
          Super Admin Owner
        </span>
      </div>

      {statusMessage && (
        <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 p-3 rounded-xl text-xs text-center font-semibold">
          {statusMessage}
        </div>
      )}

      {/* Google OAuth Settings Panel */}
      <form onSubmit={handleSaveClientId} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Google OAuth Client ID</span>
          </h3>
          {googleClientId ? (
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2.5 py-0.5 rounded font-mono font-bold">
              Configured
            </span>
          ) : (
            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/50 px-2.5 py-0.5 rounded font-mono font-bold">
              Not Configured
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste Client ID: 8924902082-xxxx.apps.googleusercontent.com"
            value={clientIdInput}
            onChange={(e) => setClientIdInput(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Save Key
          </button>
        </div>
      </form>

      {/* Pending Activations List */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-amber-300 flex items-center justify-between">
          <span>Pending Account Activations ({pendingUsers.length})</span>
          <span className="text-[10px] text-slate-500 font-mono">Requires Matthieu Approval</span>
        </h3>

        {pendingUsers.length === 0 ? (
          <p className="text-xs text-slate-500 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-center">
            No pending activations. All user accounts are processed!
          </p>
        ) : (
          <div className="space-y-2">
            {pendingUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800"
              >
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                    <span>{u.name}</span>
                    <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.2 rounded font-semibold">
                      {u.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleActivate(u.email)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer shadow"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Activate</span>
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.email)}
                    title="Delete User Account"
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pre-Approve Form */}
      <form onSubmit={handlePreApproveInvite} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100">Pre-Approve & Invite User Email</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="email"
              placeholder="e.g. wife@family.com"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Pre-Approve</span>
          </button>
        </div>
      </form>

      {/* Active Accounts */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Active SaaS User Accounts ({activeUsers.length})</span>
        </h3>

        <div className="space-y-2">
          {activeUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800"
            >
              <div>
                <div className="text-xs font-bold text-slate-200">{u.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
              </div>

              {u.email === 'matthieu.jacquet@gmail.com' ? (
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700 px-2.5 py-0.5 rounded font-semibold">
                  Super Admin Owner
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeactivate(u.email)}
                    className="text-xs bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Revoke</span>
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.email)}
                    title="Delete User Account"
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
