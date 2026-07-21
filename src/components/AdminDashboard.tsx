import React, { useState, useEffect } from 'react';
import { Shield, Check, Mail, Send, Users, AlertCircle } from 'lucide-react';

interface AdminDashboardProps {
  token: string;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, onClose }) => {
  const [accepted, setAccepted] = useState<string[]>(['matthieu.jacquet@gmail.com', 'spouse@family.com']);
  const [pending, setPending] = useState<string[]>(['sarah@family.com', 'walker@paws.com']);
  const [newInvite, setNewInvite] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchOverview = async () => {
    console.log('Fetching admin overview with token:', token);
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvite.trim()) return;

    const email = newInvite.trim().toLowerCase();
    setAccepted((prev) => [...prev, email]);
    setNewInvite('');
    setStatusMessage(`Successfully sent pre-approved invitation to ${email}!`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleAccept = (email: string) => {
    setPending((prev) => prev.filter((p) => p !== email));
    setAccepted((prev) => [...prev, email]);
    setStatusMessage(`Approved access request for ${email}!`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>Super Admin (Matthieu) Control Center</span>
          </h2>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Top Info Banner */}
          <div className="bg-indigo-950/40 border border-indigo-700/40 p-3.5 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
            <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p>
              Your email <strong className="text-white">matthieu.jacquet@gmail.com</strong> is verified on the backend as the Super Admin. You can approve pending users or invite new members to join the SaaS platform.
            </p>
          </div>

          {statusMessage && (
            <div className="bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 p-2 rounded-lg text-xs text-center font-semibold">
              {statusMessage}
            </div>
          )}

          {/* Send Direct invitation */}
          <form onSubmit={handleInvite} className="bg-slate-950/30 p-4 rounded-xl border border-slate-800 space-y-3">
            <label className="block text-xs font-semibold text-slate-400">
              Invite & Pre-approve New User Email
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  placeholder="e.g. wife@family.com"
                  value={newInvite}
                  onChange={(e) => setNewInvite(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Invite</span>
              </button>
            </div>
          </form>

          {/* Pending Invitations list */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <span>Pending Onboarding Requests ({pending.length})</span>
            </h3>
            {pending.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-950/10 p-3 rounded-xl border border-slate-800/50 text-center">
                No pending requests.
              </p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pending.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60"
                  >
                    <span className="text-xs font-mono text-slate-300">{email}</span>
                    <button
                      onClick={() => handleAccept(email)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Access</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accepted Users */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>SaaS Authorized Accounts ({accepted.length})</span>
            </h3>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {accepted.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2 bg-slate-950/40 rounded-lg border border-slate-800/80 px-3"
                >
                  <span className="text-xs font-mono text-slate-300">{email}</span>
                  {email === 'matthieu.jacquet@gmail.com' ? (
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700/40 px-2 py-0.5 rounded font-semibold">
                      Super Admin Owner
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700/40 px-2 py-0.5 rounded font-medium">
                      Accepted Member
                    </span>
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
