import React, { useState } from 'react';
import type { Activity, ActivityType, FoodType, PottyLocation, StoolConsistency } from '../types';
import { Droplet, Footprints, Utensils, Scale, Pill, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useI18n } from '../i18n';
import { getLocalDatetimeString } from '../utils/date';
import { Modal, Button, TextField, Input, Label, Select, ListBox, ListBoxItem } from '@heroui/react';

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

  // Helper to format ISO date string for <input type="datetime-local">
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

  const handleSubmit = (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

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
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                <span>{isEditMode ? t.potty.editActivity : t.potty.logActivity}</span>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
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
                        variant={type === item.type ? 'primary' : 'outline'}
                        onPress={() => setType(item.type)}
                        className="h-auto flex flex-col items-center justify-center py-3.5"
                      >
                        {item.icon}
                        <span className="mt-1.5">{item.label}</span>
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
                          variant={pottyLocation === 'outside' ? 'primary' : 'outline'}
                          size="sm"
                          onPress={() => setPottyLocation('outside')}
                        >
                          🌳 {t.potty.outside}
                        </Button>
                        <Button
                          variant={pottyLocation === 'indoor_accident' ? 'primary' : 'outline'}
                          size="sm"
                          onPress={() => setPottyLocation('indoor_accident')}
                        >
                          🚨 {t.potty.accident}
                        </Button>
                      </div>
                    </div>

                    {type === 'poop' && (
                      <div>
                        <Select value={stoolConsistency} onChange={(val) => setStoolConsistency(val as StoolConsistency)}>
                          <Label>{t.potty.stoolConsistency}</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
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
                      <Label>{t.potty.quantity}</Label>
                      <Input
                        type="number"
                        value={String(quantityGrams)}
                        onChange={(event) => {
                          const grams = Number(event.target.value);
                          setQuantityGrams(grams);
                          setQuantityCups(Math.round((grams / 110) * 100) / 100);
                        }}
                      />
                    </TextField>
                    <Select value={foodType} onChange={(val) => setFoodType(val as FoodType)}>
                      <Label>{t.potty.foodTypeLabel}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
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
                    <Label>{t.potty.weight} ({t.units.kg})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={String(weightKg)}
                      onChange={(event) => setWeightKg(Number(event.target.value))}
                    />
                  </TextField>
                )}

                {type === 'medication' && (
                  <TextField>
                    <Label>{t.potty.medication}</Label>
                    <Input
                      type="text"
                      value={medicationName}
                      onChange={(event) => setMedicationName(event.target.value)}
                    />
                  </TextField>
                )}

                {/* Date & Time Input */}
                <TextField>
                  <Label>{t.potty.dateAndTime}</Label>
                  <Input
                    type="datetime-local"
                    value={timestamp}
                    onChange={(event) => setTimestamp(event.target.value)}
                  />
                </TextField>

                {/* Notes Input */}
                <TextField>
                  <Label>{t.potty.notes}</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Peed within 2 minutes..."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </TextField>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose}>
                {t.potty.cancel}
              </Button>
              <Button variant="primary" onPress={() => handleSubmit()}>
                <Check className="w-4 h-4 mr-2" />
                {t.potty.saveLog}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
