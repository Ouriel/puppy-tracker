import React, { useState, useEffect } from 'react';
import type { Activity, ActivityType, Caretaker, FoodType, PottyLocation, StoolConsistency } from '../types';
import { X, Droplet, Footprints, Utensils, GlassWater, Moon, Activity as WalkIcon, Scale, Pill, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickLogModalProps {
  isOpen: boolean;
  initialType?: ActivityType;
  initialLocation?: PottyLocation;
  caretakers: Caretaker[];
  currentUser: string;
  onClose: () => void;
  onSave: (activity: Omit<Activity, 'id'>) => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  initialType = 'pee',
  initialLocation = 'outside',
  caretakers,
  currentUser,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<ActivityType>(initialType);
  const [loggedBy, setLoggedBy] = useState<string>(currentUser);
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');

  const [pottyLocation, setPottyLocation] = useState<PottyLocation>(initialLocation);
  const [stoolConsistency, setStoolConsistency] = useState<StoolConsistency>('normal');

  const [foodType, setFoodType] = useState<FoodType>('kibble');
  const [quantityGrams, setQuantityGrams] = useState<number>(80);
  const [quantityCups, setQuantityCups] = useState<number>(0.75);

  const [waterAmountMl, setWaterAmountMl] = useState<number>(100);

  const [durationMinutes, setDurationMinutes] = useState<number>(30);

  const [weightKg, setWeightKg] = useState<number>(8.5);
  const [medicationName, setMedicationName] = useState<string>('Flea & Tick Prevention');

  useEffect(() => {
    setType(initialType);
    setPottyLocation(initialLocation);
    setTimestamp(new Date().toISOString().slice(0, 16));
    setLoggedBy(currentUser);
  }, [initialType, initialLocation, currentUser, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newActivity: Omit<Activity, 'id'> = {
      type,
      timestamp: new Date(timestamp).toISOString(),
      loggedBy,
      notes: notes.trim() || undefined,
    };

    if (type === 'pee' || type === 'poop') {
      newActivity.pottyLocation = pottyLocation;
      if (type === 'poop') {
        newActivity.stoolConsistency = stoolConsistency;
      }
      if (pottyLocation === 'outside') {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    } else if (type === 'food') {
      newActivity.foodType = foodType;
      newActivity.quantityGrams = quantityGrams;
      newActivity.quantityCups = quantityCups;
    } else if (type === 'water') {
      newActivity.waterAmountMl = waterAmountMl;
    } else if (type === 'nap' || type === 'walk') {
      newActivity.durationMinutes = durationMinutes;
    } else if (type === 'weight') {
      newActivity.weightKg = weightKg;
    } else if (type === 'medication') {
      newActivity.medicationName = medicationName;
    }

    onSave(newActivity);
    onClose();
  };

  const activityTypes: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'pee', label: 'Pee', icon: <Droplet className="w-4 h-4" />, color: 'hover:bg-sky-500/20 hover:text-sky-400' },
    { type: 'poop', label: 'Poop', icon: <Footprints className="w-4 h-4" />, color: 'hover:bg-amber-500/20 hover:text-amber-400' },
    { type: 'food', label: 'Food', icon: <Utensils className="w-4 h-4" />, color: 'hover:bg-purple-500/20 hover:text-purple-400' },
    { type: 'water', label: 'Water', icon: <GlassWater className="w-4 h-4" />, color: 'hover:bg-cyan-500/20 hover:text-cyan-400' },
    { type: 'nap', label: 'Nap', icon: <Moon className="w-4 h-4" />, color: 'hover:bg-indigo-500/20 hover:text-indigo-400' },
    { type: 'walk', label: 'Walk', icon: <WalkIcon className="w-4 h-4" />, color: 'hover:bg-emerald-500/20 hover:text-emerald-400' },
    { type: 'weight', label: 'Weight', icon: <Scale className="w-4 h-4" />, color: 'hover:bg-pink-500/20 hover:text-pink-400' },
    { type: 'medication', label: 'Meds', icon: <Pill className="w-4 h-4" />, color: 'hover:bg-red-500/20 hover:text-red-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>Log Puppy Activity</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Select Activity Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {activityTypes.map((item) => (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => setType(item.type)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    type === item.type
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : `bg-slate-800/60 border-slate-700/60 text-slate-300 ${item.color}`
                  }`}
                >
                  <div className="mb-1">{item.icon}</div>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(type === 'pee' || type === 'poop') && (
            <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Potty Location
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPottyLocation('outside')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      pottyLocation === 'outside'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🌳 Outside Success
                  </button>
                  <button
                    type="button"
                    onClick={() => setPottyLocation('indoor_pad')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      pottyLocation === 'indoor_pad'
                        ? 'bg-amber-600 text-white border-amber-500 shadow'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🟨 Pee Pad
                  </button>
                  <button
                    type="button"
                    onClick={() => setPottyLocation('indoor_accident')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      pottyLocation === 'indoor_accident'
                        ? 'bg-red-600 text-white border-red-500 shadow'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    🚨 Accident
                  </button>
                </div>
              </div>

              {type === 'poop' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    Stool Consistency (Bristol Scale)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['hard', 'normal', 'soft', 'runny'] as StoolConsistency[]).map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setStoolConsistency(c)}
                        className={`py-1.5 px-2 rounded-lg text-xs capitalize border cursor-pointer ${
                          stoolConsistency === c
                            ? 'bg-amber-600 text-white border-amber-500 font-bold'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {type === 'food' && (
            <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Food Type
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['kibble', 'wet', 'raw', 'treats', 'topper'] as FoodType[]).map((ft) => (
                    <button
                      type="button"
                      key={ft}
                      onClick={() => setFoodType(ft)}
                      className={`py-1.5 px-3 rounded-lg text-xs capitalize border cursor-pointer ${
                        foodType === ft
                          ? 'bg-purple-600 text-white border-purple-500 font-bold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Quantity (Grams)
                  </label>
                  <input
                    type="number"
                    value={quantityGrams}
                    onChange={(e) => {
                      const g = Number(e.target.value);
                      setQuantityGrams(g);
                      setQuantityCups(Number((g / 110).toFixed(2)));
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[50, 75, 100, 120].map((g) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => {
                          setQuantityGrams(g);
                          setQuantityCups(Number((g / 110).toFixed(2)));
                        }}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 cursor-pointer"
                      >
                        {g}g
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Quantity (Cups)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={quantityCups}
                    onChange={(e) => setQuantityCups(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {type === 'water' && (
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Water Amount (ml)
              </label>
              <input
                type="number"
                value={waterAmountMl}
                onChange={(e) => setWaterAmountMl(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2 mt-2">
                {[50, 100, 150, 250].map((ml) => (
                  <button
                    type="button"
                    key={ml}
                    onClick={() => setWaterAmountMl(ml)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                  >
                    {ml} ml
                  </button>
                ))}
              </div>
            </div>
          )}

          {(type === 'nap' || type === 'walk') && (
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2 mt-2">
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'weight' && (
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Current Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {type === 'medication' && (
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Medication / Treatment Name
              </label>
              <input
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Time of Activity
              </label>
              <input
                type="datetime-local"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Logged By
              </label>
              <select
                value={loggedBy}
                onChange={(e) => setLoggedBy(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {caretakers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Peed within 2 minutes after treat praise..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-5 rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Activity Log</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
