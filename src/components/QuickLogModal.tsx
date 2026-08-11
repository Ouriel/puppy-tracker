import React, { useState } from 'react';
import type { Activity, ActivityType, PottyLocation, StoolConsistency } from '../types';
import { Droplet, Footprints, Utensils, Scale, Pill, X, Calendar, FileText } from 'lucide-react';
import { Modal } from '@heroui/react';
import { useI18n } from '../i18n';
import { getLocalDatetimeString } from '../utils/date';

interface QuickLogModalProps {
  isOpen: boolean;
  initialType?: ActivityType;
  activityToEdit?: Activity;
  defaultMealPortionGrams?: number;
  defaultWeightKg?: number;
  onClose: () => void;
  onSave: (activity: Omit<Activity, 'id'>) => void;
  currentUser?: string;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  initialType = 'pee',
  activityToEdit,
  defaultMealPortionGrams = 80,
  defaultWeightKg = 4.2,
  onClose,
  onSave,
  currentUser = 'Matthieu',
}) => {
  const { t } = useI18n();

  const isEditMode = !!activityToEdit;

  const [type, setType] = useState<ActivityType>(
    activityToEdit?.type || initialType
  );
  const [timestamp, setTimestamp] = useState<string>(
    activityToEdit?.timestamp
      ? getLocalDatetimeString(new Date(activityToEdit.timestamp))
      : getLocalDatetimeString(new Date())
  );
  const [pottyLocation, setPottyLocation] = useState<PottyLocation>(
    activityToEdit?.pottyLocation || 'outside'
  );
  const [stoolConsistency, setStoolConsistency] = useState<StoolConsistency>(
    activityToEdit?.stoolConsistency || 'normal'
  );
  const [quantityGrams, setQuantityGrams] = useState<number>(
    activityToEdit?.quantityGrams || defaultMealPortionGrams
  );
  const [quantityCups, setQuantityCups] = useState<number>(
    activityToEdit?.quantityCups || Math.round((defaultMealPortionGrams / 110) * 100) / 100
  );
  const [weightKg, setWeightKg] = useState<number>(
    activityToEdit?.weightKg || defaultWeightKg
  );
  const [medicationName, setMedicationName] = useState<string>(
    activityToEdit?.medicationName || ''
  );
  const [notes, setNotes] = useState<string>(activityToEdit?.notes || '');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const isoTimestamp = new Date(timestamp).toISOString();

    const activityData: Omit<Activity, 'id'> = {
      puppyId: activityToEdit?.puppyId || '',
      type,
      timestamp: isoTimestamp,
      loggedBy: activityToEdit?.loggedBy || currentUser,
      notes: notes.trim() || undefined,
    };

    if (type === 'pee' || type === 'poop') {
      activityData.pottyLocation = pottyLocation;
      if (type === 'poop') {
        activityData.stoolConsistency = stoolConsistency;
      }
    } else if (type === 'food') {
      activityData.quantityGrams = quantityGrams;
      activityData.quantityCups = quantityCups;
    } else if (type === 'weight') {
      activityData.weightKg = weightKg;
    } else if (type === 'medication') {
      activityData.medicationName = medicationName;
    }

    onSave(activityData);
    onClose();
  };

  const activityTypes: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'pee', label: t.potty.pee, icon: <Droplet className="w-5 h-5" />, color: 'text-amber-400' },
    { type: 'poop', label: t.potty.poop, icon: <Footprints className="w-5 h-5" />, color: 'text-amber-600' },
    { type: 'food', label: t.potty.food, icon: <Utensils className="w-5 h-5" />, color: 'text-purple-400' },
    { type: 'weight', label: t.potty.weight, icon: <Scale className="w-5 h-5" />, color: 'text-pink-400' },
    { type: 'medication', label: t.potty.medication, icon: <Pill className="w-5 h-5" />, color: 'text-teal-400' },
  ];

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop className="bg-slate-950/80 backdrop-blur-sm">
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl rounded-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {isEditMode ? t.potty.editActivity : t.potty.logActivity}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Record care event for your puppy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <form id="quicklog-form" onSubmit={handleSubmit} className="space-y-5">
                {/* Activity Type Segmented Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
                    {t.potty.activityType}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {activityTypes.map((item) => {
                      const isSelected = type === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setType(item.type)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg ring-2 ring-indigo-400/40 font-bold'
                              : 'bg-slate-950/80 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          <span className={isSelected ? 'text-white' : item.color}>{item.icon}</span>
                          <span className="mt-1.5 text-xs font-medium truncate w-full text-center">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location & Consistency Selection (Pee & Poop) */}
                {(type === 'pee' || type === 'poop') && (
                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        {t.potty.location}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPottyLocation('outside')}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-xs transition-all ${
                            pottyLocation === 'outside'
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-md ring-2 ring-emerald-400/30'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base">🌳</span>
                          <span>{t.potty.outside}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPottyLocation('indoor_accident')}
                          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-xs transition-all ${
                            pottyLocation === 'indoor_accident'
                              ? 'bg-rose-950 border-rose-700 text-rose-300 shadow-md ring-2 ring-rose-500/30'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-base">🚨</span>
                          <span>{t.potty.accident}</span>
                        </button>
                      </div>
                    </div>

                    {/* Stool Consistency Segmented Pills (Poop only: Hard, Normal, Diarrhea) */}
                    {type === 'poop' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          {t.potty.stoolConsistency}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['hard', 'normal', 'diarrhea'] as StoolConsistency[]).map((c) => {
                            const isSelected = stoolConsistency === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setStoolConsistency(c)}
                                className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center capitalize ${
                                  isSelected
                                    ? 'bg-amber-600 border-amber-500 text-white shadow ring-2 ring-amber-400/30'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                {t.potty[c as keyof typeof t.potty] || c}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Food Quantity Input */}
                {type === 'food' && (
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      {t.potty.quantity} (g)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      value={String(quantityGrams)}
                      onChange={(event) => {
                        const grams = Number(event.target.value);
                        setQuantityGrams(grams);
                        setQuantityCups(Math.round((grams / 110) * 100) / 100);
                      }}
                    />
                  </div>
                )}

                {/* Weight Input */}
                {type === 'weight' && (
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      {t.potty.weight} ({t.units.kg})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      value={String(weightKg)}
                      onChange={(event) => setWeightKg(Number(event.target.value))}
                    />
                  </div>
                )}

                {/* Medication Input */}
                {type === 'medication' && (
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      {t.potty.medication}
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      value={medicationName}
                      onChange={(event) => setMedicationName(event.target.value)}
                    />
                  </div>
                )}

                {/* Date & Time Input (Full Width, System Native Picker) */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.potty.dateAndTime}</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] cursor-pointer hover:bg-slate-900"
                    value={timestamp}
                    onChange={(event) => setTimestamp(event.target.value)}
                  />
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.potty.notes}</span>
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="e.g., Peed on grass after 15m walk"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800/80 bg-slate-900/60">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 hover:text-white transition-colors"
              >
                {t.potty.cancel}
              </button>
              <button
                type="submit"
                form="quicklog-form"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
              >
                {isEditMode ? 'Save Changes' : t.potty.saveLog}
              </button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
