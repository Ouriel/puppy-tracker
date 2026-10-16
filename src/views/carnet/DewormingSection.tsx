import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { PuppyProfile, HealthRecord, Activity } from '../../types';
import { Pill, Plus, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react';
import { Card, Button, Input, Select, ListBox, ListBoxItem, toast } from '@heroui/react';
import { calculateNextAntiparasiticDate, getHealthProtocols, getHealthRecordDateError, getHealthRecordStatus } from '../../utils/health';
import { StatusBadge } from '../../components/common/StatusBadge';
import { AddToCalendarButton } from '../../components/common/AddToCalendarButton';
import type { UnifiedWeightEntry } from '../../utils/weight';
import { buildVetWeighIn } from '../../utils/activityPayloads';
import { formatLocalDate, formatShortDate } from '../../utils/date';
import { useI18n } from '../../i18n';
import type { TranslationKeys } from '../../i18n/types';
import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../../services/api';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { WeightField } from './WeightField';

interface DewormingSectionProps {
  activePuppy: PuppyProfile;
  dewormingLogs: HealthRecord[];
  setHealthRecords: React.Dispatch<React.SetStateAction<HealthRecord[]>>; // every record, not only dewormings
  lastWeighIn?: UnifiedWeightEntry;
  currentUser: string;
  onAddActivity: (activity: Omit<Activity, 'id'>) => void;
  t: TranslationKeys;
}

const labelClass = 'block text-xs font-semibold text-slate-400 mb-1';
const errorClass = 'mt-1.5 text-xs font-semibold text-red-400';
const iconButtonClass = 'min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors';
// Renewed doses shown before "Historique (n)"
const HISTORY_SHOWN = 3;

export const DewormingSection: React.FC<DewormingSectionProps> = ({
  activePuppy,
  dewormingLogs,
  setHealthRecords,
  lastWeighIn,
  currentUser,
  onAddActivity,
  t,
}) => {
  const [isAddingDeworming, setIsAddingDeworming] = useState(false);
  // null: the user has not picked one yet, the form shows the default
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [dewormAdminDate, setDewormAdminDate] = useState(() => formatLocalDate());
  const [customDewormNextDate, setCustomDewormNextDate] = useState<string | null>(null);
  const [weightText, setWeightText] = useState('');
  const [weightError, setWeightError] = useState<'weightInvalid' | 'dateTimeInFuture' | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<{id: string; type: string} | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Edit Deworming state
  const [editingDewormingId, setEditingDewormingId] = useState<string | null>(null);
  const [editDewormingName, setEditDewormingName] = useState('');
  const [editDewormingDate, setEditDewormingDate] = useState('');
  const [editDewormingBoosterDate, setEditDewormingBoosterDate] = useState('');

  const editProductTriggerRef = useRef<HTMLButtonElement>(null);
  const { lang } = useI18n();

  // dewormingLogs is sorted newest first. Default product: the last one given if it is still an option, else Credelio Plus
  const productOptions = getHealthProtocols().antiparasitics;
  const lastProductName = dewormingLogs[0]?.productName || dewormingLogs[0]?.name;
  const defaultProductName = lastProductName && productOptions.some((productOption) => productOption.name === lastProductName)
    ? lastProductName
    : 'Credelio Plus';
  const productName = selectedProductName ?? defaultProductName;

  // From her age on the dose day, not today's: doses are often entered weeks later
  const autoNextDewormDate = React.useMemo(() => {
    if (!dewormAdminDate) return '';
    return calculateNextAntiparasiticDate(dewormAdminDate, productName, activePuppy.birthDate);
  }, [dewormAdminDate, productName, activePuppy.birthDate]);

  const dewormNextDate = customDewormNextDate !== null ? customDewormNextDate : autoNextDewormDate;
  const today = formatLocalDate();
  const addDateError = getHealthRecordDateError(dewormAdminDate, dewormNextDate, today);
  const editDateError = getHealthRecordDateError(editDewormingDate, editDewormingBoosterDate, today);
  // The edit form keeps the stored next date: only a changed date or product offers this one
  const editedDeworming = dewormingLogs.find((deworming) => deworming.id === editingDewormingId);
  const suggestedEditNextDate = editedDeworming && editDewormingDate
    && (editDewormingDate !== editedDeworming.date || editDewormingName !== (editedDeworming.productName || editedDeworming.name))
    ? calculateNextAntiparasiticDate(editDewormingDate, editDewormingName, activePuppy.birthDate)
    : '';
  // A tablet or a pipette is a dose, never an injection: its date error speaks of doses
  const dateErrorText = (error: NonNullable<typeof addDateError>) => (error === 'boosterBeforeDate' ? t.health.nextDoseBeforeDate : t.health[error]);
  // 'Credelio Plus du 10 sept.': names a row's buttons
  const rowName = (deworming: HealthRecord) =>
    t.health.recordOn.replace('{name}', deworming.productName || deworming.name).replace('{date}', formatShortDate(deworming.date, lang));
  // Open doses in full; renewed ones after them as grey lines, the latest 3 until "Historique (n)" opens the rest
  const statusById = new Map(dewormingLogs.map((deworming) => [deworming.id, getHealthRecordStatus(deworming, dewormingLogs)]));
  const renewedDewormings = dewormingLogs.filter((deworming) => statusById.get(deworming.id) === 'fulfilled');
  const shownDewormings = [
    ...dewormingLogs.filter((deworming) => statusById.get(deworming.id) !== 'fulfilled'),
    ...(isHistoryOpen ? renewedDewormings : renewedDewormings.slice(0, HISTORY_SHOWN)),
  ];

  const handleAddDewormingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (addDateError || !dewormNextDate) return;

    const name = productName.trim() || 'Credelio Plus';
    // Optional: empty saves no weight; typed, it is checked before anything is saved
    const weighIn = buildVetWeighIn({ puppyId: activePuppy.id, date: dewormAdminDate, weightText, loggedBy: currentUser });
    if (weighIn.error) {
      setWeightError(weighIn.error);
      return;
    }

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'deworming' as const,
      name,
      productName: name,
      date: dewormAdminDate,
      boosterDate: dewormNextDate,
    };

    const result = await createHealthRecord(newEntry);
    if (result.ok) {
      // A deworming never stores a weight: the weigh-in is a weight event of its own
      if (weighIn.activity) onAddActivity(weighIn.activity);
      // A refresh answered meanwhile may hold it already
      setHealthRecords((previous) => [result.data, ...previous.filter((record) => record.id !== result.data.id)]);
      setIsAddingDeworming(false);
      setSelectedProductName(null);
      setCustomDewormNextDate(null);
      setWeightText('');
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  // Focus moves to the form's first field, the product list: a date box would open the iPhone's date wheel at once
  const startEditDeworming = (deworming: HealthRecord) => {
    flushSync(() => {
      setEditingDewormingId(deworming.id);
      setEditDewormingName(deworming.productName || deworming.name);
      setEditDewormingDate(deworming.date);
      setEditDewormingBoosterDate(deworming.boosterDate || '');
    });
    editProductTriggerRef.current?.focus();
  };

  // Closed by Save or Cancel: focus goes back to the row's pencil, once the row is on screen again
  const closeEditDeworming = (id: string) => {
    flushSync(() => setEditingDewormingId(null));
    document.getElementById(`deworming-pencil-${id}`)?.focus();
  };

  const handleUpdateDewormingSubmit = async (id: string) => {
    if (editDateError) return;
    const result = await updateHealthRecord({
      id,
      puppyId: activePuppy.id,
      type: 'deworming',
      name: editDewormingName,
      productName: editDewormingName,
      date: editDewormingDate,
      // null clears a next date the user emptied
      boosterDate: editDewormingBoosterDate || null,
    });

    if (result.ok) {
      setHealthRecords((previous) => previous.map((record) => (record.id === id ? { ...record, ...result.data } : record)));
      closeEditDeworming(id);
      toast.success(t.toasts.dewormingUpdated);
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  const handleDeleteDeworming = async (id: string) => {
    const result = await deleteHealthRecord(id);
    if (result.ok) {
      setHealthRecords((previous) => previous.filter((record) => record.id !== id));
    } else {
      toast.danger(t.toasts[result.errorKey]);
    }
  };

  // Long labels wrap, so "mensuel" stays visible
  const productListItems = (options: { id: string; name: string; label: string }[]) => options.map((productOption) => (
    <ListBoxItem key={productOption.id} id={productOption.name} textValue={productOption.label}>
      <span className="block text-xs">{productOption.label}</span>
    </ListBoxItem>
  ));

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 min-w-0">
            <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <span className="break-words">{t.health.deworming} ({dewormingLogs.length})</span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => setIsAddingDeworming(!isAddingDeworming)}
            className="min-h-11 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs shadow-sm shrink-0"
          >
            {isAddingDeworming ? <X className="w-4 h-4 mr-1 inline" /> : <Plus className="w-4 h-4 mr-1 inline" />}
            {isAddingDeworming ? t.potty.cancel : t.health.addDeworming}
          </Button>
        </div>

        {isAddingDeworming && (
          <form onSubmit={handleAddDewormingSubmit} className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2 min-w-0">
                <label id="deworming-product-label" className={labelClass}>{t.health.productName}</label>
                <Select
                  aria-labelledby="deworming-product-label"
                  value={productName}
                  onChange={(val) => {
                    setSelectedProductName(val as string);
                    setCustomDewormNextDate(null);
                  }}
                >
                  <Select.Trigger className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                    <Select.Value className="truncate block text-left" />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                    <ListBox>{productListItems(productOptions)}</ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="sm:col-span-1 min-w-0">
                <label htmlFor="deworming-date" className={labelClass}>{t.health.doseDate}</label>
                <Input
                  id="deworming-date"
                  type="date"
                  className="bg-slate-900 border-slate-700/80 text-slate-100"
                  value={dewormAdminDate}
                  max={today}
                  aria-invalid={addDateError && addDateError !== 'boosterBeforeDate' ? true : undefined}
                  aria-describedby={addDateError && addDateError !== 'boosterBeforeDate' ? 'deworming-date-error' : undefined}
                  onChange={(event) => {
                    setDewormAdminDate(event.target.value);
                    setCustomDewormNextDate(null);
                  }}
                  required
                />
                {addDateError && addDateError !== 'boosterBeforeDate' && <p id="deworming-date-error" role="alert" className={errorClass}>{dateErrorText(addDateError)}</p>}
              </div>

              <div className="sm:col-span-1 min-w-0">
                <label htmlFor="deworming-next-date" className={labelClass}>{t.health.nextDeworming}</label>
                <Input
                  id="deworming-next-date"
                  type="date"
                  className="bg-slate-900 border-slate-700/80 text-slate-100"
                  value={dewormNextDate}
                  min={dewormAdminDate}
                  aria-invalid={addDateError === 'boosterBeforeDate' ? true : undefined}
                  aria-describedby={addDateError === 'boosterBeforeDate' ? 'deworming-next-date-error' : undefined}
                  onChange={(event) => setCustomDewormNextDate(event.target.value)}
                  required
                />
                {addDateError === 'boosterBeforeDate' && <p id="deworming-next-date-error" role="alert" className={errorClass}>{dateErrorText(addDateError)}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <WeightField
                id="deworming-weight-kg"
                value={weightText}
                error={weightError}
                lastWeighIn={lastWeighIn}
                date={dewormAdminDate}
                profile={activePuppy}
                onChange={(value) => {
                  setWeightText(value);
                  setWeightError(undefined);
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" className="min-h-11 bg-amber-700 hover:bg-amber-600 text-white font-bold">
                {t.health.saveDeworming}
              </Button>
            </div>
          </form>
        )}

        {dewormingLogs.length === 0 && <p className="text-xs text-slate-400">{t.health.noDewormingRecords}</p>}

        <div id="deworming-list" className="space-y-2">
          {shownDewormings.map((deworming) => {
            const isEditing = editingDewormingId === deworming.id;

            if (isEditing) {
              const editOptions = productOptions.some((productOption) => productOption.name === editDewormingName) || !editDewormingName
                ? productOptions
                : [{ id: editDewormingName, name: editDewormingName, label: editDewormingName }, ...productOptions];
              return (
                // A form, so Enter saves
                <form
                  key={deworming.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleUpdateDewormingSubmit(deworming.id);
                  }}
                  className="rounded-xl bg-slate-950/90 border border-amber-500/60 p-3.5 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2 min-w-0">
                      <label id="deworming-edit-product-label" className={labelClass}>{t.health.productName}</label>
                      <Select aria-labelledby="deworming-edit-product-label" value={editDewormingName} onChange={(val) => setEditDewormingName(val as string)}>
                        <Select.Trigger ref={editProductTriggerRef} className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                          <Select.Value className="truncate block text-left" />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                          <ListBox>{productListItems(editOptions)}</ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <label htmlFor="deworming-edit-date" className={labelClass}>{t.health.givenOn}</label>
                      <Input
                        id="deworming-edit-date"
                        type="date"
                        className="bg-slate-900 border-slate-700/80 text-slate-100"
                        value={editDewormingDate}
                        max={today}
                        aria-invalid={editDateError && editDateError !== 'boosterBeforeDate' ? true : undefined}
                        aria-describedby={editDateError && editDateError !== 'boosterBeforeDate' ? 'deworming-edit-date-error' : undefined}
                        onChange={(event) => setEditDewormingDate(event.target.value)}
                      />
                      {editDateError && editDateError !== 'boosterBeforeDate' && <p id="deworming-edit-date-error" role="alert" className={errorClass}>{dateErrorText(editDateError)}</p>}
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="deworming-edit-next-date" className={labelClass}>{t.health.nextDeworming}</label>
                      <Input
                        id="deworming-edit-next-date"
                        type="date"
                        className="bg-slate-900 border-slate-700/80 text-slate-100"
                        value={editDewormingBoosterDate}
                        min={editDewormingDate}
                        aria-invalid={editDateError === 'boosterBeforeDate' ? true : undefined}
                        aria-describedby={editDateError === 'boosterBeforeDate' ? 'deworming-edit-next-date-error' : undefined}
                        onChange={(event) => setEditDewormingBoosterDate(event.target.value)}
                      />
                      {editDateError === 'boosterBeforeDate' && <p id="deworming-edit-next-date-error" role="alert" className={errorClass}>{dateErrorText(editDateError)}</p>}
                      {suggestedEditNextDate && suggestedEditNextDate !== editDewormingBoosterDate && (
                        <button
                          type="button"
                          onClick={() => setEditDewormingBoosterDate(suggestedEditNextDate)}
                          className="mt-1.5 min-h-11 text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-2"
                        >
                          {t.health.suggestedDate.replace('{date}', formatShortDate(suggestedEditNextDate, lang))}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: deworming.id, type: 'deworming' })}
                      aria-label={t.common.deleteItem.replace('{item}', rowName(deworming))}
                      className={`${iconButtonClass} hover:text-red-400 mr-auto`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      size="sm"
                      onPress={() => closeEditDeworming(deworming.id)}
                      className="min-h-11 bg-slate-900 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white"
                    >
                      {t.potty.cancel}
                    </Button>
                    <Button type="submit" size="sm" className="min-h-11 bg-amber-700 hover:bg-amber-600 text-white font-bold">
                      <Check className="w-3.5 h-3.5 mr-1 inline" />
                      {t.potty.saveChanges}
                    </Button>
                  </div>
                </form>
              );
            }

            const status = statusById.get(deworming.id)!;

            // Renewed: one grey line, no next date, status or calendar button; a tap opens its edit form (Delete included)
            if (status === 'fulfilled') {
              return (
                <button
                  key={deworming.id}
                  id={`deworming-pencil-${deworming.id}`}
                  data-history
                  type="button"
                  onClick={() => startEditDeworming(deworming)}
                  aria-label={t.common.editItem.replace('{item}', rowName(deworming))}
                  className="w-full min-h-11 flex items-center gap-2 px-3.5 rounded-xl text-left text-xs text-slate-400 hover:bg-slate-950/70 transition-colors"
                >
                  <span className="flex-1 min-w-0 line-clamp-2 break-words">
                    {`${formatShortDate(deworming.date, lang)} · ${deworming.productName || deworming.name}`}
                  </span>
                  <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </button>
              );
            }

            return (
              <div
                key={deworming.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/40 hover:bg-slate-950/70 transition-colors rounded-xl border border-slate-800/80"
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  {/* Decorative: hidden on phones, where its room goes to the name */}
                  <div className="hidden sm:block p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0" aria-hidden="true">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="line-clamp-2 break-words">{deworming.productName || deworming.name}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {t.health.givenOn} {formatShortDate(deworming.date, lang)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-t-0 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-amber-300">{t.health.nextDeworming}{t.common.colon} {deworming.boosterDate ? formatShortDate(deworming.boosterDate, lang) : '—'}</div>
                    {deworming.boosterDate && <StatusBadge status={status} />}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <AddToCalendarButton record={deworming} status={status} dogName={activePuppy.name} />
                    <button
                      id={`deworming-pencil-${deworming.id}`}
                      type="button"
                      onClick={() => startEditDeworming(deworming)}
                      aria-label={t.common.editItem.replace('{item}', rowName(deworming))}
                      className={`${iconButtonClass} hover:text-indigo-300`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: deworming.id, type: 'deworming' })}
                      aria-label={t.common.deleteItem.replace('{item}', rowName(deworming))}
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

        {renewedDewormings.length > HISTORY_SHOWN && (
          <button
            type="button"
            aria-expanded={isHistoryOpen}
            aria-controls="deworming-list"
            onClick={() => setIsHistoryOpen((previous) => !previous)}
            className="min-h-11 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/60 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            {t.health.history.replace('{count}', String(renewedDewormings.length))}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}

        {/* Collapsible Deworming Recommendation Drawer */}
        <details className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 group">
          <summary className="cursor-pointer min-h-11 font-bold text-amber-400 flex items-center gap-1.5 hover:text-amber-300 transition-colors list-none">
            <Pill className="w-4 h-4 shrink-0" />
            <span>{t.health.esccapDewormingProtocol}</span>
            <span className="text-xs font-normal text-slate-400 ml-auto group-open:hidden">{t.health.clickToViewProtocol}</span>
          </summary>
          <ul className="mt-2.5 pl-5 text-xs text-slate-300 space-y-1 list-disc">
            <li>{t.health.dewormSchedule1}</li>
            <li>{t.health.dewormSchedule2}</li>
            <li>{t.health.dewormSchedule3}</li>
            <li>{t.health.dewormSchedule4}</li>
          </ul>
        </details>

        <ConfirmationModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete) handleDeleteDeworming(confirmDelete.id);
          }}
          title={t.health.deleteDewormingTitle}
          message={t.health.deleteDewormingConfirm}
        />
      </Card.Content>
    </Card>
  );
};
