import React, { useState } from 'react';
import type { Caretaker, FamilyRole, UserAccount } from '../types';
import { X, Copy, Check, Plus, ShieldCheck, Heart, UserCheck } from 'lucide-react';

interface SharePackModalProps {
  isOpen: boolean;
  user: UserAccount;
  caretakers: Caretaker[];
  onClose: () => void;
  onAddCaretaker: (caretaker: Caretaker) => void;
  onSwitchUserAccount: (name: string, role: FamilyRole) => void;
}

export const SharePackModal: React.FC<SharePackModalProps> = ({
  isOpen,
  user,
  caretakers,
  onClose,
  onAddCaretaker,
  onSwitchUserAccount,
}) => {
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<FamilyRole>('Wife');
  const [newEmail, setNewEmail] = useState('');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://puppace.app/family/join/${user.familyPackId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const colors = ['#EC4899', '#6366F1', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];
    onAddCaretaker({
      id: Date.now().toString(),
      name: newName.trim(),
      role: newRole,
      color: colors[caretakers.length % colors.length],
      email: newEmail.trim() || undefined,
    });
    setNewName('');
    setNewEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400 fill-pink-400/20" />
            <span>Family & Caretaker Sharing</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="bg-gradient-to-br from-indigo-950/70 via-purple-950/50 to-slate-900 border border-indigo-700/50 p-4 rounded-xl text-center shadow-inner">
            <div className="text-xs font-semibold text-indigo-300 mb-1 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Family Sync Code</span>
            </div>
            <div className="text-2xl font-mono font-extrabold tracking-widest text-white mb-1">
              {user.familyPackId}
            </div>
            <p className="text-[11px] text-slate-300 mb-3">
              Share this code with your wife, husband, family members, or dog walker so everyone sees real-time updates!
            </p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer shadow-md"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Invite Link Copied!' : 'Copy Family Invite Link'}</span>
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>Family & Caretakers</span>
              <span className="text-[10px] text-emerald-400 font-mono">● Real-time Sync Active</span>
            </h3>
            <div className="space-y-2">
              {caretakers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 hover:bg-slate-800 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                      style={{ backgroundColor: c.color }}
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{c.name}</span>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-medium">
                          {c.role}
                        </span>
                      </div>
                      {c.email && <div className="text-[10px] text-slate-400 font-mono">{c.email}</div>}
                    </div>
                  </div>

                  <button
                    onClick={() => onSwitchUserAccount(c.name, c.role)}
                    className="text-[11px] bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white px-2.5 py-1 rounded-lg transition font-medium cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>Switch To</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAdd} className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300">Invite New Family Member</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Name (e.g. Sarah)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as FamilyRole)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Wife">Wife</option>
                <option value="Husband">Husband</option>
                <option value="Partner">Partner</option>
                <option value="Child">Child / Family</option>
                <option value="Dog Walker">Dog Walker</option>
                <option value="Sitter">Sitter</option>
              </select>
            </div>
            <input
              type="email"
              placeholder="Email (optional for sync invite)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 rounded-lg transition shadow cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Send Family Invite & Sync</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
