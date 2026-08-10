import React, { useState } from 'react';
import {
  ModalRoot,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
  Button,
  Input,
} from '@heroui/react';
import type { Activity, ActivityType, FoodType, PottyLocation, StoolConsistency } from '../types';
import { Droplet, Footprints, Utensils, Scale, Pill, Check, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useI18n } from '../i18n';
import { getLocalDatetimeString } from '../utils/date';

interface QuickLogModalProps {
  isOpen: boolean;
  activityToEdit?: Activity;
  initialType?: ActivityType;
  initialLocation?: PottyLocation;
  defaultMealPortionGrams?: number;
  currentUser: string;
  onClose: () => void;
  onSave: (activityData: any) => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  activityToEdit,
  initialType = 'pee',
  initialLocation = 'outside',
  defaultMealPortionGrams = 80,
  currentUser,
  onClose,
  onSave,
}) => {
  const { t } = useI18n();

  const formatDatetimeLocal = (isoString?: string) => {
    if (!isoString) return getLocalDatetimeString();
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return getLocalDatetimeString();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const isEditMode = !!activityToEdit;

  const [type, setType] = useState<ActivityType>(activityToEdit?.type || initialType);
  const [timestamp, setTimestamp] = useState<string>(() => formatDatetimeLocal(activityToEdit?.timestamp));
  const [notes, setNotes] = useState(activityToEdit?.notes || '');

  const [pottyLocation, setPottyLocation] = useState<PottyLocation>(activityToEdit?.pottyLocation || initialLocation);
  const [stoolConsistency, setStoolConsistency] = useState<StoolConsistency>(activityToEdit?.stoolConsistency || 'normal');

  const [foodType, setFoodType] = useState<FoodType>(activityToEdit?.foodType || 'kibble');
  const [quantityGrams, setQuantityGrams] = useState<number>(activityToEdit?.quantityGrams ?? defaultMealPortionGrams);
  const [quantityCups, setQuantityCups] = useState<number>(activityToEdit?.quantityCups ?? 0.75);

  const [weightKg, setWeightKg] = useState<number>(activityToEdit?.weightKg ?? 8.5);
  const [medicationName, setMedicationName] = useState<string>(activityToEdit?.medicationName || 'Flea & Tick Prevention');

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!isEditMode && (type === 'pee' || type === 'poop')) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    }

    const payload: any = {
      ...(isEditMode ? { id: activityToEdit.id, puppyId: activityToEdit.puppyId } : {}),
      type,
      timestamp: new Date(timestamp).toISOString(),
      loggedBy: activityToEdit?.loggedBy || currentUser,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    if (type === 'pee') {
      payload.pottyLocation = pottyLocation;
    } else if (type === 'poop') {
      payload.pottyLocation = pottyLocation;
      payload.stoolConsistency = stoolConsistency;
    } else if (type === 'food') {
      payload.foodType = foodType;
      payload.quantityGrams = quantityGrams;
      payload.quantityCups = quantityCups;
    } else if (type === 'weight') {
      payload.weightKg = weightKg;
    } else if (type === 'medication') {
      payload.medicationName = medicationName;
    }

    onSave(payload);
    onClose();
  };

  const activityTypes: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'pee', label: t.potty.pee, icon: <Droplet className="w-5 h-5" />, color: 'hover:bg-sky-500/20 hover:text-sky-400' },
    { type: 'poop', label: t.potty.poop, icon: <Footprints className="w-5 h-5" />, color: 'hover:bg-amber-500/20 hover:text-amber-400' },
    { type: 'food', label: t.potty.food, icon: <Utensils className="w-5 h-5" />, color: 'hover:bg-purple-500/20 hover:text-purple-400' },
    { type: 'weight', label: t.potty.weight, icon: <Scale className="w-5 h-5" />, color: 'hover:bg-pink-500/20 hover:text-pink-400' },
    { type: 'medication', label: t.potty.medication, icon: <Pill className="w-5 h-5" />, color: 'hover:bg-red-500/20 hover:text-red-400' },
  ];

  return (
    <ModalRoot>
      <ModalBackdrop className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
        <ModalContainer placement="center" className="w-full max-w-lg">
          <ModalDialog className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full overflow-hidden shadow-2xl pb-safe my-auto outline-none text-slate-100">
            <form onSubmit={handleSubmit}>
              <ModalHeader className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                <h2 className="text-lg font-bold text-slate-100">
                  {isEditMode ? t.potty.editActivity : t.potty.logActivity}
                </h2>
                <ModalCloseTrigger onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
                  <X className="w-5 h-5" />
                </ModalCloseTrigger>
              </ModalHeader>

              <ModalBody className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Activity Type Selector Grid */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    {t.potty.activityType}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {activityTypes.map((item) => (
                      <Button
                        key={item.type}
                        type="button"
                        onClick={() => setType(item.type)}
                        variant={type === item.type ? 'primary' : 'tertiary'}
                        className={`flex flex-col items-center justify-center py-3.5 h-auto rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          type === item.type
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                            : `bg-slate-800/80 border-slate-700 text-slate-300 ${item.color}`
                        }`}
                      >
                        {item.icon}
                        <span className="mt-1 text-[11px] font-bold">{item.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Conditional Input Fields */}
                {(type === 'pee' || type === 'poop') && (
                  <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">
                        {t.potty.location}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          onClick={() => setPottyLocation('outside')}
                          variant={pottyLocation === 'outside' ? 'primary' : 'tertiary'}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            pottyLocation === 'outside'
                              ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          🌳 {t.potty.outside}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setPottyLocation('indoor_accident')}
                          variant={pottyLocation === 'indoor_accident' ? 'danger' : 'tertiary'}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            pottyLocation === 'indoor_accident'
                              ? 'bg-red-600/30 border-red-500 text-red-300 font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          🚨 {t.potty.accident}
                        </Button>
                      </div>
                    </div>

                    {type === 'poop' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          {t.potty.stoolConsistency}
                        </label>
                        <select
                          value={stoolConsistency}
                          onChange={(e) => setStoolConsistency(e.target.value as StoolConsistency)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                        >
                          <option value="normal">{t.potty.normal}</option>
                          <option value="firm">{t.potty.firm}</option>
                          <option value="soft">{t.potty.soft}</option>
                          <option value="runny">{t.potty.runny}</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {type === 'food' && (
                  <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          {t.potty.quantity}
                        </label>
                        <Input
                          type="number"
                          value={String(quantityGrams)}
                          onChange={(e) => {
                            const grams = Number(e.target.value);
                            setQuantityGrams(grams);
                            setQuantityCups(Math.round((grams / 110) * 100) / 100);
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">
                          {t.potty.foodTypeLabel}
                        </label>
                        <select
                          value={foodType}
                          onChange={(e) => setFoodType(e.target.value as FoodType)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                        >
                          <option value="kibble">{t.potty.kibble}</option>
                          <option value="wet">{t.potty.wet}</option>
                          <option value="raw">{t.potty.raw}</option>
                          <option value="treats">{t.potty.treats}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {type === 'weight' && (
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {t.potty.weight} ({t.units.kg})
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={String(weightKg)}
                      onChange={(e) => setWeightKg(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {type === 'medication' && (
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      {t.potty.medication}
                    </label>
                    <Input
                      type="text"
                      value={medicationName}
                      onChange={(e) => setMedicationName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Date & Time Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.potty.dateAndTime}
                  </label>
                  <Input
                    type="datetime-local"
                    value={timestamp}
                    onChange={(e) => setTimestamp(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.potty.notes}
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Peed within 2 minutes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </ModalBody>
              <ModalFooter className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-slate-800">
                <Button variant="tertiary" onClick={onClose} className="px-5 py-3 text-xs font-bold text-slate-400 hover:text-slate-200 transition cursor-pointer">
                  {t.potty.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 px-6 rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.potty.saveLog}</span>
                </Button>
              </ModalFooter>
            </form>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </ModalRoot>
  );
};
