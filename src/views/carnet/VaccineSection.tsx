import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { PuppyProfile, HealthRecord, Activity } from '../../types';
import { Syringe, ShieldCheck, Plus, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react';
import { Card, Button, Input, Select, ListBox, ListBoxItem, TextArea, toast } from '@heroui/react';
import { calculateNextVaccineBooster, formatProductAndLot, getHealthProtocols, getHealthRecordDateError, getHealthRecordStatus, getRecordShortName } from '../../utils/health';
import { StatusBadge } from '../../components/common/StatusBadge';
import { AddToCalendarButton } from '../../components/common/AddToCalendarButton';
import { formatLocalDate, formatShortDate } from '../../utils/date';
import { useI18n } from '../../i18n';
import type { TranslationKeys } from '../../i18n/types';
import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../../services/api';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import type { UnifiedWeightEntry } from '../../utils/weight';
import { buildVetWeighIn } from '../../utils/activityPayloads';
import { WeightField } from './WeightField';

interface VaccineSectionProps {
  activePuppy: PuppyProfile;
  vaccinations: HealthRecord[];
  setHealthRecords: React.Dispatch<React.SetStateAction<HealthRecord[]>>; // every record, not only vaccinations
  lastWeighIn?: UnifiedWeightEntry;
  currentUser: string;
  onAddActivity: (activity: Omit<Activity, 'id'>) => void;
  t: TranslationKeys;
}

const labelClass = 'block text-xs font-semibold text-slate-400 mb-1';
const errorClass = 'mt-1.5 text-xs font-semibold text-red-400';
// Typed from the vet's sticker: no autocorrect (the lot box also types capitals)
const stickerInputProps = { autoCorrect: 'off', spellCheck: false, maxLength: 80 } as const;
const iconButtonClass = 'min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors';
// Renewed shots shown before "Historique (n)"
const HISTORY_SHOWN = 3;
// The picker's "Autre…": the name is typed, and an unknown vaccine gets the generic booster
const OTHER = '__other__';

export const VaccineSection: React.FC<VaccineSectionProps> = ({
  activePuppy,
  vaccinations,
  setHealthRecords,
  lastWeighIn,
  currentUser,
  onAddActivity,
  t,
}) => {
  const [isAddingVaccine, setIsAddingVaccine] = useState(false);
  // null: the user has not picked one yet, the form shows the default
  const [selectedVaccineName, setSelectedVaccineName] = useState<string | null>(null);
  const [otherVaccineName, setOtherVaccineName] = useState('');
  const [administeredDate, setAdministeredDate] = useState(() => formatLocalDate());
  const [customNextDueDate, setCustomNextDueDate] = useState<string | null>(null);
  const [customVetClinic, setCustomVetClinic] = useState<string | null>(null);
  const [batchNumber, setBatchNumber] = useState('');
  const [stickerProduct, setStickerProduct] = useState('');
  const [weightText, setWeightText] = useState('');
  const [notes, setNotes] = useState('');
  const [weightError, setWeightError] = useState<'weightInvalid' | 'dateTimeInFuture' | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<{id: string; type: string} | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Edit Vaccine state
  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null);
  const [editVaccineName, setEditVaccineName] = useState('');
  const [editOtherName, setEditOtherName] = useState('');
  const [editVaccineDate, setEditVaccineDate] = useState('');
  const [editVaccineBoosterDate, setEditVaccineBoosterDate] = useState('');
  const [editVaccineVetClinic, setEditVaccineVetClinic] = useState('');
  const [editVaccineBatchNumber, setEditVaccineBatchNumber] = useState('');
  const [editStickerProduct, setEditStickerProduct] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const editVaccineTriggerRef = useRef<HTMLButtonElement>(null);
  const { lang } = useI18n();

  // vaccinations is sorted newest first. Default vaccine: the last one given (an earlier spelling is its list vaccine), else CHPPi + L4.
  // One the list does not have (typed for "Autre…") is a choice of the add form too:
  // falling back to CHPPi + L4 would renew the dog's CHPPi + L4 if saved unnoticed
  const vaccineOptions = getHealthProtocols().vaccines;
  const lastVaccineName = vaccinations[0]?.name;
  const lastListName = lastVaccineName && vaccineOptions.find((vaccineOption) => vaccineOption.name === lastVaccineName || vaccineOption.formerNames?.includes(lastVaccineName))?.name;
  const addOptions = lastVaccineName && !lastListName
    ? [{ id: lastVaccineName, name: lastVaccineName, fullName: lastVaccineName }, ...vaccineOptions]
    : vaccineOptions;
  const defaultVaccineName = lastListName || lastVaccineName || vaccineOptions.find((vaccineOption) => vaccineOption.id === 'chppi_l4')!.name;
  const vaccineType = selectedVaccineName ?? defaultVaccineName;
  // The name saved: the protocol name (the renewal key), or the name typed for "Autre…"
  const savedVaccineName = vaccineType === OTHER ? otherVaccineName.trim() : vaccineType;
  const savedEditName = editVaccineName === OTHER ? editOtherName.trim() : editVaccineName;
  const vetClinic = customVetClinic ?? (vaccinations.find((vaccine) => vaccine.vetClinic?.trim())?.vetClinic || '');

  // From her age on the injection day, not today's: shots are often entered weeks later
  const autoNextVaccineDate = administeredDate && savedVaccineName ? calculateNextVaccineBooster(administeredDate, savedVaccineName, activePuppy.birthDate) : '';

  const nextDueDate = customNextDueDate !== null ? customNextDueDate : autoNextVaccineDate;
  const today = formatLocalDate();
  const addDateError = getHealthRecordDateError(administeredDate, nextDueDate, today);
  const editDateError = getHealthRecordDateError(editVaccineDate, editVaccineBoosterDate, today);
  // The edit form keeps the stored next date (often set by the vet): only a changed date or vaccine offers this one
  const editedVaccine = vaccinations.find((vaccine) => vaccine.id === editingVaccineId);
  const suggestedEditBoosterDate = editedVaccine && editVaccineDate && savedEditName && (editVaccineDate !== editedVaccine.date || savedEditName !== editedVaccine.name)
    ? calculateNextVaccineBooster(editVaccineDate, savedEditName, activePuppy.birthDate)
    : '';
  // 'Rage du 1 juil.': names a row's buttons
  const rowName = (vaccine: HealthRecord) => t.health.recordOn.replace('{name}', getRecordShortName(vaccine, lang)).replace('{date}', formatShortDate(vaccine.date, lang));
  // Open shots in full; renewed ones after them as grey lines, the latest 3 until "Historique (n)" opens the rest
  const statusById = new Map(vaccinations.map((vaccine) => [vaccine.id, getHealthRecordStatus(vaccine, vaccinations)]));
  const renewedVaccines = vaccinations.filter((vaccine) => statusById.get(vaccine.id) === 'fulfilled');
  const shownVaccines = [
    ...vaccinations.filter((vaccine) => statusById.get(vaccine.id) !== 'fulfilled'),
    ...(isHistoryOpen ? renewedVaccines : renewedVaccines.slice(0, HISTORY_SHOWN)),
  ];

  const handleAddVaccineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (addDateError || !nextDueDate || !savedVaccineName) return;
    // Optional: empty saves no weight; typed, it is checked before anything is saved
    const weighIn = buildVetWeighIn({ puppyId: activePuppy.id, date: administeredDate, weightText, loggedBy: currentUser });
    if (weighIn.error) {
      setWeightError(weighIn.error);
      return;
    }

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'vaccination' as const,
      name: savedVaccineName,
      date: administeredDate,
      boosterDate: nextDueDate,
      vetClinic: vetClinic.trim() || undefined,
      batchNumber: batchNumber.trim() || undefined,
      productName: stickerProduct.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const result = await createHealthRecord(newEntry);
    if (result.ok) {
      // A vaccination never stores a weight: the weigh-in is a weight event of its own
      if (weighIn.activity) onAddActivity(weighIn.activity);
      // A refresh answered meanwhile may hold it already
      setHealthRecords((previous) => [result.data, ...previous.filter((record) => record.id !== result.data.id)]);
      setIsAddingVaccine(false);
      setSelectedVaccineName(null);
      setOtherVaccineName('');
      setCustomNextDueDate(null);
      setCustomVetClinic(null);
      setBatchNumber('');
      setStickerProduct('');
      setNotes('');
      setWeightText('');
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  // Focus moves to the form's first field, the vaccine list: a date box would open the iPhone's date wheel at once
  const startEditVaccine = (vaccine: HealthRecord) => {
    flushSync(() => {
      setEditingVaccineId(vaccine.id);
      setEditVaccineName(vaccine.name);
      setEditOtherName('');
      setEditVaccineDate(vaccine.date);
      setEditVaccineBoosterDate(vaccine.boosterDate || '');
      setEditVaccineVetClinic(vaccine.vetClinic || '');
      setEditVaccineBatchNumber(vaccine.batchNumber || '');
      setEditStickerProduct(vaccine.productName || '');
      setEditNotes(vaccine.notes || '');
    });
    editVaccineTriggerRef.current?.focus();
  };

  // Closed by Save or Cancel: focus goes back to the row's pencil, once the row is on screen again
  const closeEditVaccine = (id: string) => {
    flushSync(() => setEditingVaccineId(null));
    document.getElementById(`vaccine-pencil-${id}`)?.focus();
  };

  const handleUpdateVaccineSubmit = async (id: string) => {
    if (editDateError || !savedEditName) return;
    const result = await updateHealthRecord({
      id,
      puppyId: activePuppy.id,
      type: 'vaccination',
      name: savedEditName,
      date: editVaccineDate,
      // null clears a field the user emptied
      boosterDate: editVaccineBoosterDate || null,
      vetClinic: editVaccineVetClinic || null,
      batchNumber: editVaccineBatchNumber.trim() || null,
      productName: editStickerProduct.trim() || null,
      notes: editNotes.trim() || null,
    });

    if (result.ok) {
      setHealthRecords((previous) => previous.map((record) => (record.id === id ? { ...record, ...result.data } : record)));
      closeEditVaccine(id);
      toast.success(t.toasts.vaccineUpdated);
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    const result = await deleteHealthRecord(id);
    if (result.ok) {
      setHealthRecords((previous) => previous.filter((record) => record.id !== id));
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  // Long names wrap rather than being cut; "Autre…" comes last
  const vaccineListItems = (options: { id: string; name: string; fullName: string }[]) => [...options, { id: OTHER, name: OTHER, fullName: t.health.otherOption }].map((vaccineOption) => (
    <ListBoxItem key={vaccineOption.id} id={vaccineOption.name} textValue={vaccineOption.fullName}>
      <span className="block text-xs">{vaccineOption.fullName}</span>
    </ListBoxItem>
  ));

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 min-w-0">
            <Syringe className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400 shrink-0" />
            <span className="break-words">{t.health.vaccinations} ({vaccinations.length})</span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => setIsAddingVaccine(!isAddingVaccine)}
            className="min-h-11 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-sm shrink-0"
          >
            {isAddingVaccine ? <X className="w-4 h-4 mr-1 inline" /> : <Plus className="w-4 h-4 mr-1 inline" />}
            {isAddingVaccine ? t.potty.cancel : t.health.addVaccine}
          </Button>
        </div>

        {isAddingVaccine && (
          <form onSubmit={handleAddVaccineSubmit} className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2 min-w-0">
                <label id="vaccine-name-label" className={labelClass}>{t.health.vaccineType}</label>
                <Select
                  aria-labelledby="vaccine-name-label"
                  value={vaccineType}
                  onChange={(val) => {
                    setSelectedVaccineName(val as string);
                    setCustomNextDueDate(null);
                  }}
                >
                  <Select.Trigger className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                    <Select.Value className="truncate block text-left" />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                    <ListBox>{vaccineListItems(addOptions)}</ListBox>
                  </Select.Popover>
                </Select>
                {vaccineType === OTHER && (
                  <div className="mt-2">
                    <label htmlFor="vaccine-other-name" className={labelClass}>{t.health.otherVaccineName}</label>
                    <Input
                      id="vaccine-other-name"
                      type="text"
                      className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                      value={otherVaccineName}
                      maxLength={80}
                      required
                      onChange={(event) => {
                        setOtherVaccineName(event.target.value);
                        setCustomNextDueDate(null);
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="sm:col-span-1 min-w-0">
                <label htmlFor="vaccine-date" className={labelClass}>{t.health.administeredDate}</label>
                <Input
                  id="vaccine-date"
                  type="date"
                  className="bg-slate-900 border-slate-700/80 text-slate-100"
                  value={administeredDate}
                  max={today}
                  aria-invalid={addDateError && addDateError !== 'boosterBeforeDate' ? true : undefined}
                  aria-describedby={addDateError && addDateError !== 'boosterBeforeDate' ? 'vaccine-date-error' : undefined}
                  onChange={(event) => {
                    setAdministeredDate(event.target.value);
                    setCustomNextDueDate(null);
                  }}
                  required
                />
                {addDateError && addDateError !== 'boosterBeforeDate' && <p id="vaccine-date-error" role="alert" className={errorClass}>{t.health[addDateError]}</p>}
              </div>

              <div className="sm:col-span-1 min-w-0">
                <label htmlFor="vaccine-next-date" className={labelClass}>{t.health.boosterDue}</label>
                <Input
                  id="vaccine-next-date"
                  type="date"
                  className="bg-slate-900 border-slate-700/80 text-slate-100"
                  value={nextDueDate}
                  min={administeredDate}
                  aria-invalid={addDateError === 'boosterBeforeDate' ? true : undefined}
                  aria-describedby={addDateError === 'boosterBeforeDate' ? 'vaccine-next-date-error' : undefined}
                  onChange={(event) => setCustomNextDueDate(event.target.value)}
                  required
                />
                {addDateError === 'boosterBeforeDate' && <p id="vaccine-next-date-error" role="alert" className={errorClass}>{t.health.boosterBeforeDate}</p>}
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="vaccine-clinic" className={labelClass}>{t.health.vetClinic}</label>
              <Input
                id="vaccine-clinic"
                type="text"
                placeholder={t.health.vetClinicPlaceholder}
                className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                value={vetClinic}
                maxLength={80}
                onChange={(event) => setCustomVetClinic(event.target.value)}
              />
            </div>

            {/* The vet's sticker: the product and its lot, side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="vaccine-product" className={labelClass}>{t.health.stickerProduct}</label>
                <Input
                  id="vaccine-product"
                  type="text"
                  placeholder={t.health.stickerProductPlaceholder}
                  className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                  value={stickerProduct}
                  {...stickerInputProps}
                  onChange={(event) => setStickerProduct(event.target.value)}
                />
              </div>

              <div className="min-w-0">
                <label htmlFor="vaccine-batch" className={labelClass}>{t.health.batchNumber}</label>
                <Input
                  id="vaccine-batch"
                  type="text"
                  placeholder={t.health.batchPlaceholder}
                  className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                  value={batchNumber}
                  {...stickerInputProps}
                  autoCapitalize="characters"
                  onChange={(event) => setBatchNumber(event.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <WeightField
                id="vaccine-weight-kg"
                value={weightText}
                error={weightError}
                lastWeighIn={lastWeighIn}
                date={administeredDate}
                profile={activePuppy}
                onChange={(value) => {
                  setWeightText(value);
                  setWeightError(undefined);
                }}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="vaccine-notes" className={labelClass}>{t.potty.notes}</label>
              <TextArea
                id="vaccine-notes"
                rows={2}
                placeholder={t.health.recordNotesPlaceholder}
                className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                value={notes}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" className="min-h-11 bg-teal-700 hover:bg-teal-600 text-white font-bold">
                {t.health.saveVaccine}
              </Button>
            </div>
          </form>
        )}

        {vaccinations.length === 0 && <p className="text-xs text-slate-400">{t.health.noVaccineRecords}</p>}

        <div id="vaccine-list" className="space-y-2">
          {shownVaccines.map((vaccine) => {
            const isEditing = editingVaccineId === vaccine.id;

            if (isEditing) {
              // A name the list does not have (typed for "Autre…", or an older one) stays a choice
              const editOptions = vaccineOptions.some((vaccineOption) => vaccineOption.name === vaccine.name)
                ? vaccineOptions
                : [{ id: vaccine.name, name: vaccine.name, fullName: vaccine.name }, ...vaccineOptions];
              return (
                // A form, so Enter saves
                <form
                  key={vaccine.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleUpdateVaccineSubmit(vaccine.id);
                  }}
                  className="rounded-xl bg-slate-950/90 border border-teal-500/60 p-3.5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2 min-w-0">
                      <label id="vaccine-edit-name-label" className={labelClass}>{t.health.vaccineName}</label>
                      <Select aria-labelledby="vaccine-edit-name-label" value={editVaccineName} onChange={(val) => setEditVaccineName(val as string)}>
                        <Select.Trigger ref={editVaccineTriggerRef} className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                          <Select.Value className="truncate block text-left" />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                          <ListBox>{vaccineListItems(editOptions)}</ListBox>
                        </Select.Popover>
                      </Select>
                      {editVaccineName === OTHER && (
                        <div className="mt-2">
                          <label htmlFor="vaccine-edit-other-name" className={labelClass}>{t.health.otherVaccineName}</label>
                          <Input
                            id="vaccine-edit-other-name"
                            type="text"
                            className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                            value={editOtherName}
                            maxLength={80}
                            required
                            onChange={(event) => setEditOtherName(event.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-1 min-w-0">
                      <label htmlFor="vaccine-edit-date" className={labelClass}>{t.health.injectedOn}</label>
                      <Input
                        id="vaccine-edit-date"
                        type="date"
                        className="bg-slate-900 border-slate-700/80 text-slate-100"
                        value={editVaccineDate}
                        max={today}
                        aria-invalid={editDateError && editDateError !== 'boosterBeforeDate' ? true : undefined}
                        aria-describedby={editDateError && editDateError !== 'boosterBeforeDate' ? 'vaccine-edit-date-error' : undefined}
                        onChange={(event) => setEditVaccineDate(event.target.value)}
                      />
                      {editDateError && editDateError !== 'boosterBeforeDate' && <p id="vaccine-edit-date-error" role="alert" className={errorClass}>{t.health[editDateError]}</p>}
                    </div>
                    <div className="sm:col-span-1 min-w-0">
                      <label htmlFor="vaccine-edit-next-date" className={labelClass}>{t.health.boosterDue}</label>
                      <Input
                        id="vaccine-edit-next-date"
                        type="date"
                        className="bg-slate-900 border-slate-700/80 text-slate-100"
                        value={editVaccineBoosterDate}
                        min={editVaccineDate}
                        aria-invalid={editDateError === 'boosterBeforeDate' ? true : undefined}
                        aria-describedby={editDateError === 'boosterBeforeDate' ? 'vaccine-edit-next-date-error' : undefined}
                        onChange={(event) => setEditVaccineBoosterDate(event.target.value)}
                      />
                      {editDateError === 'boosterBeforeDate' && <p id="vaccine-edit-next-date-error" role="alert" className={errorClass}>{t.health.boosterBeforeDate}</p>}
                      {suggestedEditBoosterDate && suggestedEditBoosterDate !== editVaccineBoosterDate && (
                        <button
                          type="button"
                          onClick={() => setEditVaccineBoosterDate(suggestedEditBoosterDate)}
                          className="mt-1.5 min-h-11 text-xs font-semibold text-teal-300 hover:text-teal-200 underline underline-offset-2"
                        >
                          {t.health.suggestedDate.replace('{date}', formatShortDate(suggestedEditBoosterDate, lang))}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="vaccine-edit-clinic" className={labelClass}>{t.health.vetClinic}</label>
                    <Input
                      id="vaccine-edit-clinic"
                      type="text"
                      className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                      value={editVaccineVetClinic}
                      maxLength={80}
                      onChange={(event) => setEditVaccineVetClinic(event.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label htmlFor="vaccine-edit-product" className={labelClass}>{t.health.stickerProduct}</label>
                      <Input
                        id="vaccine-edit-product"
                        type="text"
                        className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                        value={editStickerProduct}
                        {...stickerInputProps}
                        onChange={(event) => setEditStickerProduct(event.target.value)}
                      />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="vaccine-edit-batch" className={labelClass}>{t.health.batchNumber}</label>
                      <Input
                        id="vaccine-edit-batch"
                        type="text"
                        className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                        value={editVaccineBatchNumber}
                        {...stickerInputProps}
                        autoCapitalize="characters"
                        onChange={(event) => setEditVaccineBatchNumber(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="vaccine-edit-notes" className={labelClass}>{t.potty.notes}</label>
                    <TextArea
                      id="vaccine-edit-notes"
                      rows={2}
                      className="w-full bg-slate-900 border-slate-700/80 text-slate-100"
                      value={editNotes}
                      maxLength={2000}
                      onChange={(event) => setEditNotes(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: vaccine.id, type: 'vaccine' })}
                      aria-label={t.common.deleteItem.replace('{item}', rowName(vaccine))}
                      className={`${iconButtonClass} hover:text-red-400 mr-auto`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      size="sm"
                      onPress={() => closeEditVaccine(vaccine.id)}
                      className="min-h-11 bg-slate-900 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white"
                    >
                      {t.potty.cancel}
                    </Button>
                    <Button type="submit" size="sm" className="min-h-11 bg-teal-700 hover:bg-teal-600 text-white font-bold">
                      <Check className="w-3.5 h-3.5 mr-1 inline" />
                      {t.potty.saveChanges}
                    </Button>
                  </div>
                </form>
              );
            }

            const status = statusById.get(vaccine.id)!;

            // Renewed: one grey line, no next date, status or calendar button; a tap opens its edit form (Delete included)
            if (status === 'fulfilled') {
              return (
                <button
                  key={vaccine.id}
                  id={`vaccine-pencil-${vaccine.id}`}
                  data-history
                  type="button"
                  onClick={() => startEditVaccine(vaccine)}
                  aria-label={t.common.editItem.replace('{item}', rowName(vaccine))}
                  className="w-full min-h-11 flex items-center gap-2 px-3.5 rounded-xl text-left text-xs text-slate-400 hover:bg-slate-950/70 transition-colors"
                >
                  <span className="flex-1 min-w-0 line-clamp-2 break-words">
                    {[formatShortDate(vaccine.date, lang), getRecordShortName(vaccine, lang), formatProductAndLot(vaccine)].filter(Boolean).join(' · ')}
                  </span>
                  <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </button>
              );
            }

            return (
              <div
                key={vaccine.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/40 hover:bg-slate-950/70 transition-colors rounded-xl border border-slate-800/80"
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  {/* Decorative: hidden on phones, where its room goes to the name */}
                  <div className="hidden sm:block p-2.5 bg-teal-500/20 text-teal-400 rounded-xl shrink-0" aria-hidden="true">
                    <Syringe className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="line-clamp-2 break-words">{getRecordShortName(vaccine, lang)}</span>
                    </div>
                    {/* The vet's sticker: 'Nobivac DHPPi+L4 · lot B456' */}
                    {formatProductAndLot(vaccine) && <div className="text-xs text-slate-300 break-words">{formatProductAndLot(vaccine)}</div>}
                    {vaccine.notes && <p className="text-xs italic text-slate-400 break-words line-clamp-3">{vaccine.notes}</p>}
                    <div className="text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center sm:gap-1.5 gap-0.5">
                      <span>{t.health.injectedOn} {formatShortDate(vaccine.date, lang)}</span>
                      <span className="hidden sm:inline">&bull;</span>
                      <span className="truncate text-slate-400/90">{t.health.clinic}{t.common.colon} {vaccine.vetClinic || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-t-0 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-amber-300">{t.health.booster}{t.common.colon} {vaccine.boosterDate ? formatShortDate(vaccine.boosterDate, lang) : '—'}</div>
                    {vaccine.boosterDate && <StatusBadge status={status} />}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <AddToCalendarButton record={vaccine} status={status} dogName={activePuppy.name} />
                    <button
                      id={`vaccine-pencil-${vaccine.id}`}
                      type="button"
                      onClick={() => startEditVaccine(vaccine)}
                      aria-label={t.common.editItem.replace('{item}', rowName(vaccine))}
                      className={`${iconButtonClass} hover:text-indigo-300`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: vaccine.id, type: 'vaccine' })}
                      aria-label={t.common.deleteItem.replace('{item}', rowName(vaccine))}
                      className={`${iconButtonClass} hover:text-red-400`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {renewedVaccines.length > HISTORY_SHOWN && (
          <button
            type="button"
            aria-expanded={isHistoryOpen}
            aria-controls="vaccine-list"
            onClick={() => setIsHistoryOpen((previous) => !previous)}
            className="min-h-11 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            {t.health.history.replace('{count}', String(renewedVaccines.length))}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}

        {/* Collapsible Vaccine Recommendation Drawer */}
        <details className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 group">
          <summary className="cursor-pointer min-h-11 font-bold text-teal-400 flex items-center gap-1.5 hover:text-teal-300 transition-colors list-none">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t.health.frenchVaccineGuidelines}</span>
            <span className="text-xs font-normal text-slate-400 ml-auto group-open:hidden">{t.health.clickToViewSchedule}</span>
          </summary>
          <ul className="mt-2.5 pl-5 text-xs text-slate-300 space-y-1 list-disc">
            <li>{t.health.week8Initial}</li>
            <li>{t.health.week12Booster1}</li>
            <li>{t.health.week16Booster2}</li>
            <li>{t.health.year1Booster}</li>
          </ul>
        </details>

        <ConfirmationModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete) handleDeleteVaccine(confirmDelete.id);
          }}
          title={t.health.deleteVaccineTitle}
          message={t.health.deleteVaccineConfirm}
        />
      </Card.Content>
    </Card>
  );
};
