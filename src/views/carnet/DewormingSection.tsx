import React, { useState } from 'react';
import type { PuppyProfile, HealthRecord, Activity } from '../../types';
import { Pill, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { Card, Button, Input, Select, ListBox, ListBoxItem, Chip } from '@heroui/react';
import { calculateNextAntiparasiticDate, getHealthProtocols, getHealthRecordStatus } from '../../utils/health';
import { StatusBadge } from '../../components/common/StatusBadge';
import { getEffectivePuppyWeight } from '../../utils/weight';
import { getPuppyAge } from '../../utils/predictions';
import { formatLocalDate } from '../../utils/date';
import { showToast } from '../../utils/toast';
import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../../services/api';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface DewormingSectionProps {
  activePuppy: PuppyProfile;
  activities: Activity[];
  dewormingLogs: HealthRecord[];
  setDewormingLogs: React.Dispatch<React.SetStateAction<HealthRecord[]>>;
  t: any;
}

export const DewormingSection: React.FC<DewormingSectionProps> = ({
  activePuppy,
  activities,
  dewormingLogs,
  setDewormingLogs,
  t,
}) => {
  const [isAddingDeworming, setIsAddingDeworming] = useState(false);
  const [productName, setProductName] = useState('Credelio Plus');
  const [dewormAdminDate, setDewormAdminDate] = useState(() => formatLocalDate());
  const [customDewormNextDate, setCustomDewormNextDate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{id: string; type: string} | null>(null);

  // Edit Deworming state
  const [editingDewormingId, setEditingDewormingId] = useState<string | null>(null);
  const [editDewormingName, setEditDewormingName] = useState('');
  const [editDewormingDate, setEditDewormingDate] = useState('');
  const [editDewormingBoosterDate, setEditDewormingBoosterDate] = useState('');
  const [editDewormingWeight, setEditDewormingWeight] = useState('');

  const autoNextDewormDate = React.useMemo(() => {
    if (!dewormAdminDate) return '';
    const ageMonths = activePuppy.birthDate ? getPuppyAge(activePuppy.birthDate).months : 3;
    return calculateNextAntiparasiticDate(dewormAdminDate, productName, ageMonths);
  }, [dewormAdminDate, productName, activePuppy.birthDate]);

  const dewormNextDate = customDewormNextDate !== null ? customDewormNextDate : autoNextDewormDate;

  const sortByDateDesc = (arr: HealthRecord[]): HealthRecord[] => {
    return [...arr].sort((recordA, recordB) => new Date(recordB.date).getTime() - new Date(recordA.date).getTime());
  };

  const getDewormingStatus = (deworming: HealthRecord, allDewormings: HealthRecord[]) => {
    return getHealthRecordStatus(deworming, allDewormings, `✅ ${t.health.statusUpToDate}`, `✅ ${t.health.statusFulfilled}`);
  };

  const handleAddDewormingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dewormAdminDate || !dewormNextDate) return;

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'deworming' as const,
      name: productName.trim() || 'Credelio Plus',
      productName: productName.trim() || 'Credelio Plus',
      date: dewormAdminDate,
      boosterDate: dewormNextDate,
      weightAtTime: getEffectivePuppyWeight(activePuppy, activities).estimatedCurrentWeight,
    };

    const result = await createHealthRecord(newEntry);
    if (result.ok) {
      setDewormingLogs((previous) => sortByDateDesc([result.data, ...previous]));
      setIsAddingDeworming(false);
      setCustomDewormNextDate(null);
    } else {
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  };

  const startEditDeworming = (deworming: HealthRecord) => {
    setEditingDewormingId(deworming.id);
    setEditDewormingName(deworming.productName || deworming.name);
    setEditDewormingDate(deworming.date);
    setEditDewormingBoosterDate(deworming.boosterDate || '');
    setEditDewormingWeight(deworming.weightAtTime ? String(deworming.weightAtTime) : '');
  };

  const handleUpdateDewormingSubmit = async (id: string) => {
    if (!editDewormingDate) return;
    const result = await updateHealthRecord({
      id,
      puppyId: activePuppy.id,
      type: 'deworming',
      name: editDewormingName,
      productName: editDewormingName,
      date: editDewormingDate,
      boosterDate: editDewormingBoosterDate || undefined,
      weightAtTime: editDewormingWeight ? Number(editDewormingWeight) : undefined,
    });

    if (result.ok) {
      setDewormingLogs((previous) =>
        sortByDateDesc(previous.map((deworming) => (deworming.id === id ? { ...deworming, ...result.data } : deworming)))
      );
      setEditingDewormingId(null);
      showToast(t.toasts.dewormingUpdated, 'success');
    } else {
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  };

  const handleDeleteDeworming = async (id: string) => {
    const result = await deleteHealthRecord(id);
    if (result.ok) {
      setDewormingLogs((previous) => previous.filter((deworming) => deworming.id !== id));
    } else {
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  };

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Pill className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <span>{t.health.deworming} ({dewormingLogs.length})</span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => setIsAddingDeworming(!isAddingDeworming)}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {isAddingDeworming ? t.potty.cancel : t.health.addDeworming}
          </Button>
        </div>

        {isAddingDeworming && (
          <Card variant="default" className="bg-slate-950/90 border border-slate-800">
            <form onSubmit={handleAddDewormingSubmit}>
              <Card.Content className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 min-w-0">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.productName}</label>
                    <Select
                      value={productName}
                      onChange={(val) => {
                        setProductName(val as string);
                        setCustomDewormNextDate(null);
                      }}
                    >
                      <Select.Trigger className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                        <Select.Value className="truncate block text-left" />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                        <ListBox>
                          {getHealthProtocols().antiparasitics.map((productOption) => (
                            <ListBoxItem key={productOption.id} id={productOption.name} textValue={productOption.label} className="truncate whitespace-nowrap overflow-hidden">
                              <span className="truncate block text-xs">{productOption.label}</span>
                            </ListBoxItem>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  <div className="sm:col-span-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.administeredDate}</label>
                    <Input
                      type="date"
                      className="bg-slate-900 border-slate-700/80 text-slate-100"
                      value={dewormAdminDate}
                      onChange={(event) => {
                        setDewormAdminDate(event.target.value);
                        setCustomDewormNextDate(null);
                      }}
                      required
                    />
                  </div>

                  <div className="sm:col-span-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                    <Input
                      type="date"
                      className="bg-slate-900 border-slate-700/80 text-slate-100"
                      value={dewormNextDate}
                      onChange={(event) => setCustomDewormNextDate(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                  >
                    {t.health.saveDeworming}
                  </Button>
                </div>
              </Card.Content>
            </form>
          </Card>
        )}

        <div className="space-y-2">
          {dewormingLogs.map((deworming) => {
            const isEditing = editingDewormingId === deworming.id;

            if (isEditing) {
              return (
                <Card key={deworming.id} variant="default" className="bg-slate-950/90 border border-amber-500/60">
                  <Card.Content className="p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2 min-w-0">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.productName}</label>
                        <Select value={editDewormingName} onChange={(val) => setEditDewormingName(val as string)}>
                          <Select.Trigger className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                            <Select.Value className="truncate block text-left" />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                            <ListBox>
                              {(() => {
                                const options = getHealthProtocols().antiparasitics;
                                const hasMatch = options.some((productOption) => productOption.name === editDewormingName);
                                const list = hasMatch || !editDewormingName
                                  ? options
                                  : [{ id: editDewormingName, name: editDewormingName, label: editDewormingName }, ...options];
                                return list.map((productOption) => (
                                  <ListBoxItem key={productOption.id} id={productOption.name} textValue={productOption.label} className="truncate whitespace-nowrap overflow-hidden">
                                    <span className="truncate block text-xs">{productOption.label}</span>
                                  </ListBoxItem>
                                ));
                              })()}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                      <div className="sm:col-span-2 min-w-0">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.weightAtTime}</label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder={t.health.weightPlaceholder}
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editDewormingWeight}
                          onChange={(event) => setEditDewormingWeight(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.injectedOn}</label>
                        <Input
                          type="date"
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editDewormingDate}
                          onChange={(event) => setEditDewormingDate(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.boosterDue}</label>
                        <Input
                          type="date"
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editDewormingBoosterDate}
                          onChange={(event) => setEditDewormingBoosterDate(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        onPress={() => setEditingDewormingId(null)}
                        className="bg-slate-900 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white"
                      >
                        {t.potty.cancel}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => handleUpdateDewormingSubmit(deworming.id)}
                      >
                        <Check className="w-3.5 h-3.5 mr-1 inline" />
                        {t.potty.saveChanges}
                      </Button>
                    </div>
                  </Card.Content>
                </Card>
              );
            }

            const status = getDewormingStatus(deworming, dewormingLogs);

            return (
              <div
                key={deworming.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/40 hover:bg-slate-950/70 transition-colors rounded-xl border border-slate-800/80"
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 sm:p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="truncate">{deworming.productName || deworming.name}</span>
                      {deworming.weightAtTime && (
                        <Chip color="warning" variant="soft" size="sm">
                          {t.health.weightPrefix}: {deworming.weightAtTime} {t.units.kg}
                        </Chip>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {t.health.givenOn} {deworming.date}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-t-0 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-amber-300">{t.health.nextDeworming}: {deworming.boosterDate}</div>
                    <StatusBadge status={status.urgency} label={status.label} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditDeworming(deworming)}
                      aria-label={t.health.editDewormingEntry}
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: deworming.id, type: 'deworming' })}
                      aria-label={t.health.deleteDewormingConfirm}
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapsible Deworming Recommendation Drawer */}
        <details className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 group">
          <summary className="cursor-pointer font-bold text-amber-400 flex items-center gap-1.5 hover:text-amber-300 transition-colors list-none">
            <Pill className="w-4 h-4 shrink-0" />
            <span>{t.health.esccapDewormingProtocol}</span>
            <span className="text-[10px] font-normal text-slate-500 ml-auto group-open:hidden">{t.health.clickToViewProtocol}</span>
          </summary>
          <ul className="mt-2.5 pl-5 text-[11px] text-slate-300 space-y-1 list-disc">
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
