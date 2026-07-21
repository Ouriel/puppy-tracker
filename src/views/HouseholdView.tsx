import React, { useState } from 'react';
import type { Caretaker, UserAccount, FamilyRole } from '../types';
import { Home, Users, UserPlus, Trash2, Copy, Check, UserCheck } from 'lucide-react';

interface HouseholdViewProps {
  user: UserAccount;
  caretakers: Caretaker[];
  currentUser: string;
  onAddCaretaker: (caretaker: Caretaker) => void;
  onDeleteCaretaker: (id: string) => void;
  onSwitchUserAccount: (name: string, role: FamilyRole) => void;
}

export const HouseholdView: React.FC<HouseholdViewProps> = ({
  user,
  caretakers,
  currentUser,
  onAddCaretaker,
  onDeleteCaretaker,
  onSwitchUserAccount,
}) => {
  const [copied, setCopied] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<FamilyRole>('Wife');
  const [color, setColor] = useState('#EC4899');

  const handleCopyPackId = () => {
    navigator.clipboard.writeText(user.familyPackId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCaretaker: Caretaker = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      role,
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
            <h2 className="text-xl font-bold text-slate-100">Household & Pack Members</h2>
            <p className="text-xs text-slate-400">Dogs belong to a Household that contains multiple authorized family users</p>
          </div>
        </div>

        {/* Sync Code Box */}
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center gap-3">
          <div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Family Sync Code</div>
            <div className="text-sm font-mono font-bold text-indigo-300">{user.familyPackId}</div>
          </div>
          <button
            onClick={handleCopyPackId}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
            title="Copy Family Sync Code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Add Caretaker Button / Form */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Household Caretakers ({caretakers.length})</span>
          </h3>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAdding ? 'Cancel' : 'Add Family Member'}</span>
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAddSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as FamilyRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Wife">Wife</option>
                  <option value="Husband">Husband</option>
                  <option value="Partner">Partner</option>
                  <option value="Child">Child</option>
                  <option value="Dog Walker">Dog Walker</option>
                  <option value="Sitter">Sitter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Badge Color</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl h-9 px-1 py-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                Add Member
              </button>
            </div>
          </form>
        )}

        {/* Caretakers List with Deletion */}
        <div className="space-y-2">
          {caretakers.map((c) => {
            const formatted = `${c.name} (${c.role})`;
            const isSelected = currentUser === formatted;

            return (
              <div
                key={c.id}
                className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full ring-2 ring-white/20 shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <span>{c.name}</span>
                      <span className="text-[10px] bg-slate-800 text-indigo-300 border border-slate-700 px-2 py-0.2 rounded font-medium">
                        {c.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isSelected ? (
                    <button
                      onClick={() => onSwitchUserAccount(c.name, c.role)}
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

                  {c.name !== 'Matthieu' && (
                    <button
                      onClick={() => onDeleteCaretaker(c.id)}
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
