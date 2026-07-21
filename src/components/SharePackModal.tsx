import React, { useState } from 'react';
import type { Caretaker } from '../types';
import { X, Copy, Check, Users, Plus } from 'lucide-react';

interface SharePackModalProps {
  isOpen: boolean;
  caretakers: Caretaker[];
  onClose: () => void;
  onAddCaretaker: (caretaker: Caretaker) => void;
}

export const SharePackModal: React.FC<SharePackModalProps> = ({
  isOpen,
  caretakers,
  onClose,
  onAddCaretaker,
}) => {
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'Owner' | 'Partner' | 'Walker' | 'Sitter' | 'Family'>('Walker');
  const packCode = 'PUP-8492';

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://puppace.app/join/${packCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const colors = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];
    onAddCaretaker({
      id: Date.now().toString(),
      name: newName.trim(),
      role: newRole,
      color: colors[caretakers.length % colors.length],
    });
    setNewName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Share & Pack Sync</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-indigo-700/50 p-4 rounded-xl text-center">
            <div className="text-xs font-semibold text-indigo-300 mb-1">Your Pack Sync Code</div>
            <div className="text-2xl font-mono font-extrabold tracking-widest text-white mb-2">
              {packCode}
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Share this code or link with your partner, family members, or dog walker so everyone syncs logs instantly.
            </p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Sync Invite Link'}</span>
            </button>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-2">Current Pack Members</h3>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {caretakers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-xs font-bold text-slate-100">{c.name}</span>
                  </div>
                  <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                    {c.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAdd} className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300">Add New Pack Member</h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Name (e.g. Sarah)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Owner">Owner</option>
                <option value="Partner">Partner</option>
                <option value="Walker">Walker</option>
                <option value="Sitter">Sitter</option>
                <option value="Family">Family</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 font-semibold text-xs py-1.5 rounded-lg transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
