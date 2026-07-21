import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { X, Plus, Dog } from 'lucide-react';

interface AddPuppyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPuppy: (puppy: PuppyProfile) => void;
}

export const AddPuppyModal: React.FC<AddPuppyModalProps> = ({
  isOpen,
  onClose,
  onAddPuppy,
}) => {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Cocker Spaniel');
  const [birthDate, setBirthDate] = useState('2026-05-01');
  const [weightKg, setWeightKg] = useState(6.0);
  const [targetMealsPerDay, setTargetMealsPerDay] = useState(3);
  const [dailyFoodGramGoal, setDailyFoodGramGoal] = useState(200);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newPuppy: PuppyProfile = {
      id: `pup-${Date.now()}`,
      name: name.trim(),
      breed: breed.trim() || 'Cocker Spaniel',
      birthDate,
      weightKg,
      avatarUrl: '/cocker_spaniel_mascot.jpg',
      targetMealsPerDay,
      dailyFoodGramGoal,
    };

    onAddPuppy(newPuppy);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Dog className="w-5 h-5 text-indigo-400" />
            <span>Add New Puppy Profile</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Puppy Name</label>
            <input
              type="text"
              placeholder="e.g. Milo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Breed</label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Birth Date</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Meals / Day</label>
              <input
                type="number"
                value={targetMealsPerDay}
                onChange={(e) => setTargetMealsPerDay(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Kibble Goal (g)</label>
              <input
                type="number"
                value={dailyFoodGramGoal}
                onChange={(e) => setDailyFoodGramGoal(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-5 rounded-xl shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Puppy Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
