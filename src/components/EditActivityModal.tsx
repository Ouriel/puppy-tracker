import React, { useState } from 'react';
import type { Activity, PottyLocation, StoolConsistency, FoodType } from '../types';
import { X, Check } from 'lucide-react';

interface EditActivityModalProps {
  activity: Activity;
  onSave: (updated: Partial<Activity> & { id: string }) => void;
  onClose: () => void;
}

export const EditActivityModal: React.FC<EditActivityModalProps> = ({
  activity,
  onSave,
  onClose,
}) => {
  // Convert ISO string to format suitable for <input type="datetime-local">
  const formatDatetimeLocal = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [type, setType] = useState(activity.type);
  const [timestamp, setTimestamp] = useState(() => formatDatetimeLocal(activity.timestamp));
  const [pottyLocation, setPottyLocation] = useState<PottyLocation | ''>(activity.pottyLocation || 'outside');
  const [stoolConsistency, setStoolConsistency] = useState<StoolConsistency | ''>(activity.stoolConsistency || 'normal');
  const [foodType, setFoodType] = useState<FoodType | ''>(activity.foodType || 'kibble');
  const [quantityGrams, setQuantityGrams] = useState<number | ''>(activity.quantityGrams ?? '');
  const [weightKg, setWeightKg] = useState<number | ''>(activity.weightKg ?? '');
  const [notes, setNotes] = useState(activity.notes || '');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!timestamp) return;

    const isoTimestamp = new Date(timestamp).toISOString();

    onSave({
      id: activity.id,
      puppyId: activity.puppyId,
      type,
      timestamp: isoTimestamp,
      loggedBy: activity.loggedBy,
      pottyLocation: type === 'pee' || type === 'poop' ? (pottyLocation as PottyLocation) : undefined,
      stoolConsistency: type === 'poop' ? (stoolConsistency as StoolConsistency) : undefined,
      foodType: type === 'food' ? (foodType as FoodType) : undefined,
      quantityGrams: type === 'food' && quantityGrams !== '' ? Number(quantityGrams) : undefined,
      weightKg: type === 'weight' && weightKg !== '' ? Number(weightKg) : undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            ✏️ Edit Activity Log
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Activity Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Activity Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="pee">💧 Pee / Pipi</option>
              <option value="poop">💩 Poop / Caca</option>
              <option value="food">🥣 Food / Repas</option>
              <option value="weight">⚖️ Weight / Poids</option>
              <option value="medication">💊 Medication / Soin</option>
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              required
            />
          </div>

          {/* Potty Options */}
          {(type === 'pee' || type === 'poop') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Location</label>
                <select
                  value={pottyLocation}
                  onChange={(e) => setPottyLocation(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="outside">🌳 Outside / Dehors</option>
                  <option value="indoor_accident">🚨 Accident / Intérieur</option>
                </select>
              </div>

              {type === 'poop' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Stool Consistency</label>
                  <select
                    value={stoolConsistency}
                    onChange={(e) => setStoolConsistency(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="hard">Hard / Dure</option>
                    <option value="soft">Soft / Molle</option>
                    <option value="runny">Runny / Diarrhée</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Food Options */}
          {type === 'food' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity (Grams)</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={quantityGrams}
                  onChange={(e) => setQuantityGrams(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Food Type</label>
                <select
                  value={foodType}
                  onChange={(e) => setFoodType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="kibble">Kibble / Croquettes</option>
                  <option value="wet">Wet / Pâtée</option>
                  <option value="raw">BARF / Raw</option>
                  <option value="treats">Friandises / Treats</option>
                </select>
              </div>
            </div>
          )}

          {/* Weight Option */}
          {type === 'weight' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 7.8"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Peed twice, high appetite..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
