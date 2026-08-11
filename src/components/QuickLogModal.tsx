import React, { useState } from 'react';
import type { Activity, ActivityType, FoodType, PottyLocation, StoolConsistency } from '../types';
import { Droplet, Footprints, Utensils, Scale, Pill } from 'lucide-react';
import { Button, Input, Modal, Select, ListBox, ListBoxItem, Label, TextField } from '@heroui/react';
import { useI18n } from '../i18n';
import { getLocalDatetimeString } from '../utils/date';

interface QuickLogModalProps {
  isOpen: boolean;
  initialType?: ActivityType;
  activityToEdit?: Activity;
  defaultMealPortionGrams?: number;
  onClose: () => void;
  onSave: (activity: Omit<Activity, 'id'>) => void;
  currentUser?: string;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  initialType = 'pee',
  activityToEdit,
  defaultMealPortionGrams = 80,
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
  const [foodType, setFoodType] = useState<FoodType>(
    activityToEdit?.foodType || 'kibble'
  );
  const [quantityGrams, setQuantityGrams] = useState<number>(
    activityToEdit?.quantityGrams || defaultMealPortionGrams
  );
  const [quantityCups, setQuantityCups] = useState<number>(
    activityToEdit?.quantityCups || Math.round((defaultMealPortionGrams / 110) * 100) / 100
  );
  const [weightKg, setWeightKg] = useState<number>(
    activityToEdit?.weightKg || 4.5
  );
  const [medicationName, setMedicationName] = useState<string>(
    activityToEdit?.medicationName || ''
  );
  const [notes, setNotes] = useState<string>(activityToEdit?.notes || '');
  const [loggedBy, setLoggedBy] = useState<string>(
    activityToEdit?.loggedBy || currentUser
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const isoTimestamp = new Date(timestamp).toISOString();

    const activityData: Omit<Activity, 'id'> = {
      puppyId: activityToEdit?.puppyId || '',
      type,
      timestamp: isoTimestamp,
      loggedBy,
      notes: notes.trim() || undefined,
    };

    if (type === 'pee' || type === 'poop') {
      activityData.pottyLocation = pottyLocation;
      if (type === 'poop') {
        activityData.stoolConsistency = stoolConsistency;
      }
    } else if (type === 'food') {
      activityData.foodType = foodType;
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

  const activityTypes: { type: ActivityType; label: string; icon: React.ReactNode }[] = [
    { type: 'pee', label: t.potty.pee, icon: <Droplet className="w-5 h-5" /> },
    { type: 'poop', label: t.potty.poop, icon: <Footprints className="w-5 h-5" /> },
    { type: 'food', label: t.potty.food, icon: <Utensils className="w-5 h-5" /> },
    { type: 'weight', label: t.potty.weight, icon: <Scale className="w-5 h-5" /> },
    { type: 'medication', label: t.potty.medication, icon: <Pill className="w-5 h-5" /> },
  ];

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-base font-extrabold text-white">
                <span>{isEditMode ? t.potty.editActivity : t.potty.logActivity}</span>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-4">
              <form id="quicklog-form" onSubmit={handleSubmit} className="space-y-5">
                {/* Activity Type Selector Grid */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">
                    {t.potty.activityType}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {activityTypes.map((item) => (
                      <Button
                        key={item.type}
                        variant={type === item.type ? 'primary' : 'tertiary'}
                        onPress={() => setType(item.type)}
                        className={`h-auto flex flex-col items-center justify-center py-3 ${
                          type === item.type ? 'bg-indigo-600 font-bold text-white' : 'bg-slate-950/80 border border-slate-800 text-slate-300'
                        }`}
                      >
                        {item.icon}
                        <span className="mt-1.5 text-xs">{item.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Conditional Input Fields */}
                {(type === 'pee' || type === 'poop') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-2">
                        {t.potty.location}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          onPress={() => setPottyLocation('outside')}
                          className={pottyLocation === 'outside' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-950/80 border border-slate-800 text-slate-300'}
                        >
                          🌳 {t.potty.outside}
                        </Button>
                        <Button
                          size="sm"
                          onPress={() => setPottyLocation('indoor_accident')}
                          className={pottyLocation === 'indoor_accident' ? 'bg-rose-950/80 border border-rose-700 text-rose-300 font-bold' : 'bg-slate-950/80 border border-slate-800 text-slate-300'}
                        >
                          🚨 {t.potty.accident}
                        </Button>
                      </div>
                    </div>

                    {type === 'poop' && (
                      <div>
                        <Select value={stoolConsistency} onChange={(val) => setStoolConsistency(val as StoolConsistency)}>
                          <Label className="text-xs font-semibold text-slate-400">{t.potty.stoolConsistency}</Label>
                          <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                            <ListBox>
                              <ListBoxItem id="normal" textValue={t.potty.normal}>{t.potty.normal}</ListBoxItem>
                              <ListBoxItem id="firm" textValue={t.potty.firm}>{t.potty.firm}</ListBoxItem>
                              <ListBoxItem id="soft" textValue={t.potty.soft}>{t.potty.soft}</ListBoxItem>
                              <ListBoxItem id="runny" textValue={t.potty.runny}>{t.potty.runny}</ListBoxItem>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {type === 'food' && (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField>
                      <Label className="text-xs font-semibold text-slate-400">{t.potty.quantity} (g)</Label>
                      <Input
                        type="number"
                        className="bg-slate-950 border-slate-800 text-slate-100"
                        value={String(quantityGrams)}
                        onChange={(event) => {
                          const grams = Number(event.target.value);
                          setQuantityGrams(grams);
                          setQuantityCups(Math.round((grams / 110) * 100) / 100);
                        }}
                      />
                    </TextField>
                    <Select value={foodType} onChange={(val) => setFoodType(val as FoodType)}>
                      <Label className="text-xs font-semibold text-slate-400">{t.potty.foodTypeLabel}</Label>
                      <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                        <ListBox>
                          <ListBoxItem id="kibble" textValue={t.potty.kibble}>{t.potty.kibble}</ListBoxItem>
                          <ListBoxItem id="wet" textValue={t.potty.wet}>{t.potty.wet}</ListBoxItem>
                          <ListBoxItem id="raw" textValue={t.potty.raw}>{t.potty.raw}</ListBoxItem>
                          <ListBoxItem id="treats" textValue={t.potty.treats}>{t.potty.treats}</ListBoxItem>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                )}

                {type === 'weight' && (
                  <TextField>
                    <Label className="text-xs font-semibold text-slate-400">{t.potty.weight} ({t.units.kg})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="bg-slate-950 border-slate-800 text-slate-100"
                      value={String(weightKg)}
                      onChange={(event) => setWeightKg(Number(event.target.value))}
                    />
                  </TextField>
                )}

                {type === 'medication' && (
                  <TextField>
                    <Label className="text-xs font-semibold text-slate-400">{t.potty.medication}</Label>
                    <Input
                      type="text"
                      className="bg-slate-950 border-slate-800 text-slate-100"
                      value={medicationName}
                      onChange={(event) => setMedicationName(event.target.value)}
                    />
                  </TextField>
                )}

                {/* Date & Time Input */}
                <TextField>
                  <Label className="text-xs font-semibold text-slate-400">{t.potty.dateAndTime}</Label>
                  <Input
                    type="datetime-local"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={timestamp}
                    onChange={(event) => setTimestamp(event.target.value)}
                  />
                </TextField>

                {/* Notes Input */}
                <TextField>
                  <Label className="text-xs font-semibold text-slate-400">{t.potty.notes}</Label>
                  <Input
                    type="text"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    placeholder="e.g., Peed on grass after 15m walk"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </TextField>

                {/* Logged by Input */}
                <TextField>
                  <Label className="text-xs font-semibold text-slate-400">Logged By</Label>
                  <Input
                    type="text"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={loggedBy}
                    onChange={(event) => setLoggedBy(event.target.value)}
                  />
                </TextField>
              </form>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose} size="sm">
                {t.potty.cancel}
              </Button>
              <Button form="quicklog-form" type="submit" variant="primary" size="sm" className="font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
                {isEditMode ? 'Save Changes' : t.potty.saveLog}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
