import React, { useState } from 'react';
import type { PuppyProfile, HealthRecord } from '../../types';
import { Syringe, ShieldCheck, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { Card, Button, Input, Select, ListBox, ListBoxItem, Chip } from '@heroui/react';
import { calculateNextVaccineBooster, getHealthProtocols, getHealthRecordStatus } from '../../utils/health';
import { StatusBadge } from '../../components/common/StatusBadge';
import { getPuppyAge } from '../../utils/predictions';
import { formatLocalDate } from '../../utils/date';
import { showToast } from '../../utils/toast';
import { createHealthRecord, updateHealthRecord, deleteHealthRecord } from '../../services/api';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

interface VaccineSectionProps {
  activePuppy: PuppyProfile;
  vaccinations: HealthRecord[];
  setVaccinations: React.Dispatch<React.SetStateAction<HealthRecord[]>>;
  t: any;
}

export const VaccineSection: React.FC<VaccineSectionProps> = ({
  activePuppy,
  vaccinations,
  setVaccinations,
  t,
}) => {
  const [isAddingVaccine, setIsAddingVaccine] = useState(false);
  const [vaccineType, setVaccineType] = useState<string>('CHPPi + L4');
  const [administeredDate, setAdministeredDate] = useState(() => formatLocalDate());
  const [customNextDueDate, setCustomNextDueDate] = useState<string | null>(null);
  const [vetClinic, setVetClinic] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{id: string; type: string} | null>(null);

  // Edit Vaccine state
  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null);
  const [editVaccineName, setEditVaccineName] = useState('');
  const [editVaccineDate, setEditVaccineDate] = useState('');
  const [editVaccineBoosterDate, setEditVaccineBoosterDate] = useState('');
  const [editVaccineVetClinic, setEditVaccineVetClinic] = useState('');
  const [editVaccineBatchNumber, setEditVaccineBatchNumber] = useState('');

  const autoNextVaccineDate = React.useMemo(() => {
    if (!administeredDate) return '';
    const ageMonths = activePuppy.birthDate ? getPuppyAge(activePuppy.birthDate).months : 6;
    return calculateNextVaccineBooster(administeredDate, vaccineType, ageMonths);
  }, [administeredDate, vaccineType, activePuppy.birthDate]);

  const nextDueDate = customNextDueDate !== null ? customNextDueDate : autoNextVaccineDate;

  const sortByDateDesc = (arr: HealthRecord[]): HealthRecord[] => {
    return [...arr].sort((recordA, recordB) => new Date(recordB.date).getTime() - new Date(recordA.date).getTime());
  };

  const getVaccineStatus = (vaccine: HealthRecord, allVaccines: HealthRecord[]) => {
    return getHealthRecordStatus(vaccine, allVaccines, `✅ ${t.health.statusUpToDate}`, `✅ ${t.health.statusFulfilled}`);
  };

  const handleAddVaccineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!administeredDate || !nextDueDate) return;

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'vaccination' as const,
      name: vaccineType,
      date: administeredDate,
      boosterDate: nextDueDate,
      vetClinic: vetClinic.trim() || undefined,
      batchNumber: batchNumber.trim() || undefined,
    };

    const result = await createHealthRecord(newEntry);
    if (result.ok) {
      setVaccinations((previous) => sortByDateDesc([result.data, ...previous]));
      setIsAddingVaccine(false);
      setCustomNextDueDate(null);
      setVetClinic('');
      setBatchNumber('');
    } else {
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  };

  const startEditVaccine = (vaccine: HealthRecord) => {
    setEditingVaccineId(vaccine.id);
    setEditVaccineName(vaccine.name);
    setEditVaccineDate(vaccine.date);
    setEditVaccineBoosterDate(vaccine.boosterDate || '');
    setEditVaccineVetClinic(vaccine.vetClinic || '');
    setEditVaccineBatchNumber(vaccine.batchNumber || '');
  };

  const handleUpdateVaccineSubmit = async (id: string) => {
    if (!editVaccineDate) return;
    const result = await updateHealthRecord({
      id,
      puppyId: activePuppy.id,
      type: 'vaccination',
      name: editVaccineName,
      date: editVaccineDate,
      boosterDate: editVaccineBoosterDate || undefined,
      vetClinic: editVaccineVetClinic || undefined,
      batchNumber: editVaccineBatchNumber || undefined,
    });

    if (result.ok) {
      setVaccinations((previous) =>
        sortByDateDesc(previous.map((vaccine) => (vaccine.id === id ? { ...vaccine, ...result.data } : vaccine)))
      );
      setEditingVaccineId(null);
      showToast(t.toasts.vaccineUpdated, 'success');
    } else {
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    const result = await deleteHealthRecord(id);
    if (result.ok) {
      setVaccinations((previous) => previous.filter((vaccine) => vaccine.id !== id));
    } else {
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  };

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <Syringe className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
            <span>{t.health.vaccinations} ({vaccinations.length})</span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => setIsAddingVaccine(!isAddingVaccine)}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {isAddingVaccine ? t.potty.cancel : t.health.addVaccine}
          </Button>
        </div>

        {isAddingVaccine && (
          <Card variant="default" className="bg-slate-950/90 border border-slate-800">
            <form onSubmit={handleAddVaccineSubmit}>
              <Card.Content className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 min-w-0">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vaccineType}</label>
                    <Select
                      value={vaccineType}
                      onChange={(val) => {
                        setVaccineType(val as string);
                        setCustomNextDueDate(null);
                      }}
                    >
                      <Select.Trigger className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                        <Select.Value className="truncate block text-left" />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                        <ListBox>
                          {getHealthProtocols().vaccines.map((vaccineOption) => (
                            <ListBoxItem key={vaccineOption.id} id={vaccineOption.name} textValue={vaccineOption.fullName} className="truncate whitespace-nowrap overflow-hidden">
                              <span className="truncate block text-xs">{vaccineOption.fullName}</span>
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
                      value={administeredDate}
                      onChange={(event) => {
                        setAdministeredDate(event.target.value);
                        setCustomNextDueDate(null);
                      }}
                      required
                    />
                  </div>

                  <div className="sm:col-span-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                    <Input
                      type="date"
                      className="bg-slate-900 border-slate-700/80 text-slate-100"
                      value={nextDueDate}
                      onChange={(event) => setCustomNextDueDate(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vetClinic}</label>
                    <Input
                      type="text"
                      placeholder={t.health.vetClinicPlaceholder}
                      className="bg-slate-900 border-slate-700/80 text-slate-100"
                      value={vetClinic}
                      onChange={(event) => setVetClinic(event.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.batchNumber}</label>
                    <Input
                      type="text"
                      placeholder={t.health.batchPlaceholder}
                      className="bg-slate-900 border-slate-700/80 text-slate-100"
                      value={batchNumber}
                      onChange={(event) => setBatchNumber(event.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                  >
                    {t.health.saveVaccine}
                  </Button>
                </div>
              </Card.Content>
            </form>
          </Card>
        )}

        <div className="space-y-2">
          {vaccinations.map((vaccine) => {
            const isEditing = editingVaccineId === vaccine.id;

            if (isEditing) {
              return (
                <Card key={vaccine.id} variant="default" className="bg-slate-950/90 border border-teal-500/60">
                  <Card.Content className="p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2 min-w-0">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.vaccineName}</label>
                        <Select value={editVaccineName} onChange={(val) => setEditVaccineName(val as string)}>
                          <Select.Trigger className="w-full bg-slate-900 border-slate-700/80 text-slate-100 min-w-0 flex items-center justify-between">
                            <Select.Value className="truncate block text-left" />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover className="bg-slate-900 border border-slate-800 text-slate-100 max-w-xl w-full">
                            <ListBox>
                              {(() => {
                                const options = getHealthProtocols().vaccines;
                                const hasMatch = options.some((vaccineOption) => vaccineOption.name === editVaccineName);
                                const list = hasMatch || !editVaccineName
                                  ? options
                                  : [{ id: editVaccineName, name: editVaccineName, fullName: editVaccineName }, ...options];
                                return list.map((vaccineOption) => (
                                  <ListBoxItem key={vaccineOption.id} id={vaccineOption.name} textValue={vaccineOption.fullName} className="truncate whitespace-nowrap overflow-hidden">
                                    <span className="truncate block text-xs">{vaccineOption.fullName}</span>
                                  </ListBoxItem>
                                ));
                              })()}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                      <div className="sm:col-span-1 min-w-0">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.injectedOn}</label>
                        <Input
                          type="date"
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editVaccineDate}
                          onChange={(event) => setEditVaccineDate(event.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-1 min-w-0">
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.boosterDue}</label>
                        <Input
                          type="date"
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editVaccineBoosterDate}
                          onChange={(event) => setEditVaccineBoosterDate(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.vetClinic}</label>
                        <Input
                          type="text"
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editVaccineVetClinic}
                          onChange={(event) => setEditVaccineVetClinic(event.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-semibold mb-1">{t.health.batchNumber}</label>
                        <Input
                          type="text"
                          className="bg-slate-900 border-slate-700/80 text-slate-100"
                          value={editVaccineBatchNumber}
                          onChange={(event) => setEditVaccineBatchNumber(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        onPress={() => setEditingVaccineId(null)}
                        className="bg-slate-900 border border-slate-800 text-slate-300 font-bold hover:bg-slate-800 hover:text-white"
                      >
                        {t.potty.cancel}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => handleUpdateVaccineSubmit(vaccine.id)}
                      >
                        <Check className="w-3.5 h-3.5 mr-1 inline" />
                        {t.potty.saveChanges}
                      </Button>
                    </div>
                  </Card.Content>
                </Card>
              );
            }

            const status = getVaccineStatus(vaccine, vaccinations);

            return (
              <div
                key={vaccine.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-950/40 hover:bg-slate-950/70 transition-colors rounded-xl border border-slate-800/80"
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 sm:p-2.5 bg-teal-500/20 text-teal-400 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                    <Syringe className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                      <span className="truncate">{vaccine.name}</span>
                      {vaccine.batchNumber && (
                        <Chip size="sm" variant="soft">
                          {t.health.lotPrefix}: {vaccine.batchNumber}
                        </Chip>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {t.health.injectedOn} {vaccine.date} &bull; {t.health.clinic}: {vaccine.vetClinic || t.health.veterinary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-t-0 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-amber-300">{t.health.booster}: {vaccine.boosterDate}</div>
                    <StatusBadge status={status.urgency} label={status.label} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEditVaccine(vaccine)}
                      aria-label={t.health.editVaccineEntry}
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete({ id: vaccine.id, type: 'vaccine' })}
                      aria-label={t.health.deleteVaccineConfirm}
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

        {/* Collapsible Vaccine Recommendation Drawer */}
        <details className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 group">
          <summary className="cursor-pointer font-bold text-teal-400 flex items-center gap-1.5 hover:text-teal-300 transition-colors list-none">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t.health.frenchVaccineGuidelines}</span>
            <span className="text-[10px] font-normal text-slate-500 ml-auto group-open:hidden">{t.health.clickToViewSchedule}</span>
          </summary>
          <ul className="mt-2.5 pl-5 text-[11px] text-slate-300 space-y-1 list-disc">
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
