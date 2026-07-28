import React, { useState } from 'react';
import type { Caretaker, UserAccount, FamilyRole } from '../types';
import { Home, Users, UserPlus, Trash2, Mail, Send, CheckCircle2, UserCheck, Copy } from 'lucide-react';
import { createUser } from '../services/api';
import { showToast } from '../utils/toast';

interface HouseholdViewProps {
  user: UserAccount;
  caretakers: Caretaker[];
  currentUser: string;
  onAddCaretaker: (caretaker: Caretaker) => void;
  onDeleteCaretaker: (id: string) => void;
  onSwitchUserAccount: (name: string, role: FamilyRole) => void;
}

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  caretakers,
  currentUser,
  onAddCaretaker,
  onDeleteCaretaker,
  onSwitchUserAccount,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isInvitingEmail, setIsInvitingEmail] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [name, setName] = useState('');
  const [color, setColor] = useState('#EC4899');

  const handlePreApproveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;

    const email = inviteEmail.trim().toLowerCase();
    const created = await createUser({
      email,
      name: email.split('@')[0],
      role: 'Member',
      status: 'ACTIVE',
    });

    if (created) {
      setInviteSuccess(`${email} pre-approved! Share link below for them to log in.`);
      setInviteEmail('');
      // Also add caretaker badge if not present
      if (!caretakers.some((c) => c.name.toLowerCase() === email.split('@')[0])) {
        onAddCaretaker({
          id: `c-${Date.now()}`,
          name: email.split('@')[0],
          role: 'Member',
          color: '#6366F1',
          email,
        });
      }
    }
  };

  const copyAppUrl = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    showToast('PupPace link copied to clipboard!', 'success');
  };

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const newCaretaker: Caretaker = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      role: 'Member',
      color,
    };

    onAddCaretaker(newCaretaker);
    setName('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Household & Family Members</h2>
            <p className="text-xs text-slate-400">Dogs belong to a Household that contains multiple authorized family users</p>
          </div>
        </div>

        {/* Pre-Approve Action Button */}
        <button
          onClick={() => setIsInvitingEmail(!isInvitingEmail)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer"
        >
          <Mail className="w-4 h-4" />
          <span>Pre-Approve Family Member Email</span>
        </button>
      </div>

      {/* Email Registration Box */}
      {isInvitingEmail && (
        <form onSubmit={handlePreApproveMember} className="bg-slate-900 border border-indigo-800/60 p-6 rounded-2xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-400" />
            <span>Authorize Google Account Email</span>
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed">
            Enter your family member's Google email address to pre-authorize them. Once authorized, send them the link below so they can sign in with Google.
          </p>

          {inviteSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 p-3.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 font-semibold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{inviteSuccess}</span>
              </div>
              <button
                type="button"
                onClick={copyAppUrl}
                className="bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy App Link</span>
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter Google email address (e.g. partner@gmail.com)"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Authorize Email</span>
            </button>
          </div>
        </form>
      )}

      {/* Caretakers Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Household Caretakers ({caretakers.length})</span>
          </h3>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer border border-slate-700"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAdding ? 'Cancel' : 'Add Family Member Badge'}</span>
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAddSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Badge Color</label>
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl h-9 px-1 py-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Add Member Badge
              </button>
            </div>
          </form>
        )}

        {/* Caretakers List */}
        <div className="space-y-2">
          {caretakers.map((caretaker) => {
            const isSelected = currentUser === caretaker.name;

            return (
              <div
                key={caretaker.id}
                className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full ring-2 ring-white/20 shrink-0"
                    style={{ backgroundColor: caretaker.color }}
                  />
                  <div className="text-xs font-bold text-slate-100">
                    {caretaker.name}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isSelected ? (
                    <button
                      onClick={() => onSwitchUserAccount(caretaker.name, caretaker.role)}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg transition cursor-pointer"
                    >
                      Switch Active
                    </button>
                  ) : (
                    <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  )}

                  {caretaker.name !== 'Matthieu' && (
                    <button
                      onClick={() => onDeleteCaretaker(caretaker.id)}
                      title="Delete User from Household"
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
