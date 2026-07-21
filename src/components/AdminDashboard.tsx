import React, { useState, useEffect } from 'react';
import { Shield, Mail, Send, Users, AlertCircle, UserCheck, UserX } from 'lucide-react';

interface UserAccountItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL';
}

interface AdminDashboardProps {
  token: string;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onClose }) => {
  const [users, setUsers] = useState<UserAccountItem[]>([
    { id: '1', email: 'matthieu.jacquet@gmail.com', name: 'Matthieu', role: 'Husband', status: 'ACTIVE' },
    { id: '2', email: 'sarah@family.com', name: 'Sarah', role: 'Wife', status: 'PENDING_APPROVAL' },
    { id: '3', email: 'alex@dogwalkers.com', name: 'Alex', role: 'Dog Walker', status: 'PENDING_APPROVAL' },
  ]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    console.log('Fetching overview with token:', token);
  }, [token]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>Super Admin (Matthieu) Activation Center</span>
          </h2>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-slate-800 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Top Banner */}
          <div className="bg-indigo-950/40 border border-indigo-700/40 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              Signed in as <strong className="text-white">matthieu.jacquet@gmail.com</strong>. You must activate new accounts before users can log in to the SaaS platform.
            </p>
          </div>

          {statusMessage && (
            <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 p-2.5 rounded-xl text-xs text-center font-semibold">
              {statusMessage}
            </div>
          )}

          {/* Pending Activations List */}
          <div>
            <h3 className="text-xs font-bold text-amber-300 mb-2 flex items-center justify-between">
              <span>Pending Account Activations ({pendingUsers.length})</span>
              <span className="text-[10px] text-slate-500 font-mono">Requires Matthieu Approval</span>
            </h3>
            {pendingUsers.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-center">
                No pending activations. All user accounts are processed!
              </p>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {pendingUsers.map((u) => (
                  <div
                    key={u.email}
                    className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl border border-slate-700/80"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{u.name}</span>
                        <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800/50 px-1.5 py-0.2 rounded font-semibold">
                          {u.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </div>

                    <button
                      onClick={() => handleActivate(u.email)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer shadow"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Activate Account</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pre-approve & Invite User Email */}
          <form onSubmit={handlePreApproveInvite} className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <label className="block text-xs font-semibold text-slate-400">
              Pre-Approve & Invite User Email
            </label>
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
          <div>
            <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Activated Accounts ({activeUsers.length})</span>
            </h3>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {activeUsers.map((u) => (
                <div
                  key={u.email}
                  className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800 px-3"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-200">{u.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                  </div>

                  {u.email === 'matthieu.jacquet@gmail.com' ? (
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/40 px-2 py-0.5 rounded font-semibold">
                      Super Admin Owner
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeactivate(u.email)}
                      className="text-[10px] bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-800 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                    >
                      <UserX className="w-3 h-3" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
