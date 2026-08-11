import React, { useState, useEffect } from 'react';
import type { PuppyProfile } from '../types';
import { Syringe, ShieldCheck, Plus, Pill, Trash2, Pencil, Check, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatLocalDate } from '../utils/date';
import { showToast } from '../utils/toast';
import { formatBreedName } from '../utils/breeds';
import { Card, Button, Input, Select, ListBox, ListBoxItem, Chip } from '@heroui/react';
import {
  fetchHealthRecords,
  createHealthRecord,
  updateHealthRecord,
  deleteHealthRecord,
} from '../services/api';
import { calculateNextAntiparasiticDate, calculateNextVaccineBooster, getHealthProtocols } from '../utils/health';
import { getPuppyAge } from '../utils/predictions';

interface VaccinationEntry {
  id: string;
  puppyId?: string;
  type?: string;
  name: string;
  date: string;
  boosterDate?: string;
  vetClinic?: string;
  batchNumber?: string;
  notes?: string;
}

interface DewormingEntry {
  id: string;
  puppyId?: string;
  type?: string;
  name: string;
  productName?: string;
  date: string;
  boosterDate?: string;
  weightAtTime?: number;
  notes?: string;
}

interface CarnetDeSanteViewProps {
  activePuppy: PuppyProfile | null;
  onBackToDashboard?: () => void;
}

export const CarnetDeSanteView: React.FC<CarnetDeSanteViewProps> = ({ activePuppy, onBackToDashboard }) => {
  const { t, lang } = useI18n();

  const getVaccineStatus = (
    vaccine: VaccinationEntry,
    allVaccines: VaccinationEntry[]
  ): { label: string; color: "success" | "warning" | "danger" | "default" } => {
    if (!vaccine.boosterDate) {
      return { label: `✅ ${t.health.statusUpToDate}`, color: "success" };
    }

    const sorted = [...allVaccines].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const isLatest = sorted.length > 0 && sorted[0].id === vaccine.id;
    const hasSubsequent = allVaccines.some(
      (other) => other.id !== vaccine.id && new Date(other.date).getTime() >= new Date(vaccine.date).getTime()
    );

    if (!isLatest || hasSubsequent) {
      return {
        label: `✅ ${t.health.statusFulfilled}`,
        color: "default",
      };
    }

    const due = new Date(vaccine.boosterDate);
    const now = new Date();
    const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return { label: '⚠️ Overdue', color: "danger" };
    } else if (daysUntilDue <= 14) {
      return { label: '⏰ Due Soon', color: "warning" };
    }
    return { label: `✅ ${t.health.statusUpToDate}`, color: "success" };
  };

  const getDewormingStatus = (
    deworming: DewormingEntry,
    allDewormings: DewormingEntry[]
  ): { label: string; color: "success" | "warning" | "danger" | "default" } => {
    if (!deworming.boosterDate) {
      return { label: `✅ ${t.health.statusUpToDate}`, color: "success" };
    }

    const sorted = [...allDewormings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const isLatest = sorted.length > 0 && sorted[0].id === deworming.id;
    const hasSubsequent = allDewormings.some(
      (other) => other.id !== deworming.id && new Date(other.date).getTime() >= new Date(deworming.date).getTime()
    );

    if (!isLatest || hasSubsequent) {
      return {
        label: `✅ ${t.health.statusFulfilled}`,
        color: "default",
      };
    }

    const due = new Date(deworming.boosterDate);
    const now = new Date();
    const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return { label: '⚠️ Overdue', color: "danger" };
    } else if (daysUntilDue <= 14) {
      return { label: '⏰ Due Soon', color: "warning" };
    }
    return { label: `✅ ${t.health.statusUpToDate}`, color: "success" };
  };

  const [vaccinations, setVaccinations] = useState<VaccinationEntry[]>([]);
  const [dewormingLogs, setDewormingLogs] = useState<DewormingEntry[]>([]);

  // Form toggles
  const [isAddingVaccine, setIsAddingVaccine] = useState(false);
  const [isAddingDeworming, setIsAddingDeworming] = useState(false);

  // New Vaccine Form
  const [vaccineType, setVaccineType] = useState<string>('CHPPi + L4');
  const [administeredDate, setAdministeredDate] = useState(() => formatLocalDate());
  const [nextDueDate, setNextDueDate] = useState('');
  const [vetClinic, setVetClinic] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  // Auto-calculate next vaccine booster due date based on dataset rules
  useEffect(() => {
    if (!administeredDate) return;
    const calculated = calculateNextVaccineBooster(administeredDate, vaccineType);
    setNextDueDate(calculated);
  }, [administeredDate, vaccineType]);

  // New Deworming Form
  const [productName, setProductName] = useState('Credelio Plus');
  const [dewormAdminDate, setDewormAdminDate] = useState(() => formatLocalDate());
  const [dewormNextDate, setDewormNextDate] = useState('');

  // Auto-calculate next deworming / antiparasitic booster date based on product SPC & ESCCAP
  useEffect(() => {
    if (!dewormAdminDate) return;
    const ageMonths = activePuppy?.birthDate ? getPuppyAge(activePuppy.birthDate).months : 3;
    const calculated = calculateNextAntiparasiticDate(dewormAdminDate, productName, ageMonths);
    setDewormNextDate(calculated);
  }, [dewormAdminDate, productName, activePuppy?.birthDate]);

  // Edit Vaccine state
  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null);
  const [editVaccineName, setEditVaccineName] = useState('');
  const [editVaccineDate, setEditVaccineDate] = useState('');
  const [editVaccineBoosterDate, setEditVaccineBoosterDate] = useState('');
  const [editVaccineVetClinic, setEditVaccineVetClinic] = useState('');
  const [editVaccineBatchNumber, setEditVaccineBatchNumber] = useState('');

  // Edit Deworming state
  const [editingDewormingId, setEditingDewormingId] = useState<string | null>(null);
  const [editDewormingName, setEditDewormingName] = useState('');
  const [editDewormingDate, setEditDewormingDate] = useState('');
  const [editDewormingBoosterDate, setEditDewormingBoosterDate] = useState('');
  const [editDewormingWeight, setEditDewormingWeight] = useState('');

  const startEditVaccine = (vaccine: VaccinationEntry) => {
    setEditingVaccineId(vaccine.id);
    setEditVaccineName(vaccine.name);
    setEditVaccineDate(vaccine.date);
    setEditVaccineBoosterDate(vaccine.boosterDate || '');
    setEditVaccineVetClinic(vaccine.vetClinic || '');
    setEditVaccineBatchNumber(vaccine.batchNumber || '');
  };

  const startEditDeworming = (deworming: DewormingEntry) => {
    setEditingDewormingId(deworming.id);
    setEditDewormingName(deworming.productName || deworming.name);
    setEditDewormingDate(deworming.date);
    setEditDewormingBoosterDate(deworming.boosterDate || '');
    setEditDewormingWeight(deworming.weightAtTime ? String(deworming.weightAtTime) : '');
  };

  const handleUpdateVaccineSubmit = async (id: string) => {
    if (!editVaccineDate || !activePuppy) return;
    const updated = await updateHealthRecord({
      id,
      puppyId: activePuppy.id,
      type: 'vaccination',
      name: editVaccineName,
      date: editVaccineDate,
      boosterDate: editVaccineBoosterDate || undefined,
      vetClinic: editVaccineVetClinic || undefined,
      batchNumber: editVaccineBatchNumber || undefined,
    });

    if (updated) {
      setVaccinations((prev) =>
        sortByDateDesc(prev.map((v) => (v.id === id ? { ...v, ...updated } : v)))
      );
      setEditingVaccineId(null);
      showToast('Vaccination entry updated.', 'success');
    }
  };

  const handleUpdateDewormingSubmit = async (id: string) => {
    if (!editDewormingDate || !activePuppy) return;
    const updated = await updateHealthRecord({
      id,
      puppyId: activePuppy.id,
      type: 'deworming',
      name: editDewormingName,
      productName: editDewormingName,
      date: editDewormingDate,
      boosterDate: editDewormingBoosterDate || undefined,
      weightAtTime: editDewormingWeight ? Number(editDewormingWeight) : undefined,
    });

    if (updated) {
      setDewormingLogs((prev) =>
        sortByDateDesc(prev.map((d) => (d.id === id ? { ...d, ...updated } : d)))
      );
      setEditingDewormingId(null);
      showToast('Deworming entry updated.', 'success');
    }
  };

  const sortByDateDesc = <T extends { date: string }>(arr: T[]): T[] => {
    return [...arr].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const loadHealthRecords = React.useCallback(async () => {
    if (!activePuppy?.id) return;
    const [vRes, dRes] = await Promise.all([
      fetchHealthRecords(activePuppy.id, 'vaccination'),
      fetchHealthRecords(activePuppy.id, 'deworming'),
    ]);
    if (vRes) {
      setVaccinations(sortByDateDesc(vRes));
    }
    if (dRes) {
      setDewormingLogs(sortByDateDesc(dRes));
    }
  }, [activePuppy?.id]);

  useEffect(() => {
    if (activePuppy?.id) {
      loadHealthRecords();
    }
  }, [activePuppy?.id, loadHealthRecords]);

  const handleAddVaccineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!administeredDate || !nextDueDate || !activePuppy) return;

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'vaccination' as const,
      name: vaccineType,
      date: administeredDate,
      boosterDate: nextDueDate,
      vetClinic: vetClinic.trim() || undefined,
      batchNumber: batchNumber.trim() || undefined,
    };

    const created = await createHealthRecord(newEntry);
    if (created) {
      setVaccinations((previous) => sortByDateDesc([created, ...previous]));
      setIsAddingVaccine(false);
      setVetClinic('');
      setBatchNumber('');
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    if (window.confirm(t.health.deleteVaccineConfirm)) {
      const ok = await deleteHealthRecord(id);
      if (ok) {
        setVaccinations((previous) => previous.filter((vaccine) => vaccine.id !== id));
      }
    }
  };

  const handleAddDewormingSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dewormAdminDate || !dewormNextDate || !activePuppy) return;

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'deworming' as const,
      name: productName.trim() || 'Credelio Plus',
      productName: productName.trim() || 'Credelio Plus',
      date: dewormAdminDate,
      boosterDate: dewormNextDate,
      weightAtTime: activePuppy.weightKg,
    };

    const created = await createHealthRecord(newEntry);
    if (created) {
      setDewormingLogs((previous) => sortByDateDesc([created, ...previous]));
      setIsAddingDeworming(false);
    }
  };

  const handleDeleteDeworming = async (id: string) => {
    if (window.confirm(t.health.deleteDewormingConfirm)) {
      const ok = await deleteHealthRecord(id);
      if (ok) {
        setDewormingLogs((previous) => previous.filter((deworming) => deworming.id !== id));
      }
    }
  };

  if (!activePuppy) {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto">
        <Card.Content className="space-y-3">
          <Syringe className="w-12 h-12 text-slate-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-200">
            {t.health.noPuppySelected}
          </h2>
          <p className="text-xs text-slate-400">
            {t.health.selectPuppyToViewHealth}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800">
        <Card.Content className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-md">
              <Syringe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>{t.health.healthPassportFor.replace('{name}', activePuppy.name)}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {t.health.subtitle} &bull; {activePuppy.name} ({formatBreedName(activePuppy.breed, lang)})
              </p>
            </div>
          </div>

          {onBackToDashboard && (
            <Button
              variant="outline"
              size="sm"
              onPress={onBackToDashboard}
              className="font-bold text-xs border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-1 inline" />
              <span>Back to Dashboard</span>
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Guidelines Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* French Vaccine Schedule Card */}
        <Card className="bg-slate-900 border border-slate-800 text-slate-100">
          <Card.Content className="p-4 space-y-2">
            <h3 className="text-xs font-bold text-teal-400 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>{t.health.frenchVaccineGuidelines}</span>
            </h3>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li>{t.health.week8Initial}</li>
              <li>{t.health.week12Booster1}</li>
              <li>{t.health.week16Booster2}</li>
              <li>{t.health.year1Booster}</li>
            </ul>
          </Card.Content>
        </Card>

        {/* French ESCCAP Deworming Protocol Card */}
        <Card className="bg-slate-900 border border-slate-800 text-slate-100">
          <Card.Content className="p-4 space-y-2">
            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Pill className="w-4 h-4" />
              <span>{t.health.esccapDewormingProtocol}</span>
            </h3>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li>{t.health.dewormSchedule1}</li>
              <li>{t.health.dewormSchedule2}</li>
              <li>{t.health.dewormSchedule3}</li>
              <li>{t.health.dewormSchedule4}</li>
            </ul>
          </Card.Content>
        </Card>
      </div>

      {/* Vaccinations Section */}
      <Card className="bg-slate-900 border border-slate-800 text-slate-100">
        <Card.Content className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Syringe className="w-4 h-4 text-teal-400" />
              <span>{t.health.vaccinations} ({vaccinations.length})</span>
            </h3>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsAddingVaccine(!isAddingVaccine)}
            >
              <Plus className="w-4 h-4 mr-1 inline" />
              {isAddingVaccine ? t.potty.cancel : t.health.addVaccine}
            </Button>
          </div>

          {isAddingVaccine && (
            <Card variant="default" className="bg-slate-950/60">
              <form onSubmit={handleAddVaccineSubmit}>
                <Card.Content className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vaccineType}</label>
                      <Select value={vaccineType} onChange={(val) => setVaccineType(val as string)}>
                        <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                          <ListBox>
                            {getHealthProtocols().vaccines.map((v) => (
                              <ListBoxItem key={v.id} id={v.name} textValue={v.fullName}>
                                {v.fullName}
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.administeredDate}</label>
                      <Input
                        type="date"
                        value={administeredDate}
                        onChange={(event) => setAdministeredDate(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                      <Input
                        type="date"
                        value={nextDueDate}
                        onChange={(event) => setNextDueDate(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vetClinic}</label>
                      <Input
                        type="text"
                        placeholder="e.g. Clinique Vétérinaire Saint-Roch"
                        value={vetClinic}
                        onChange={(event) => setVetClinic(event.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.batchNumber}</label>
                      <Input
                        type="text"
                        placeholder="e.g. BATCH-2026-X99"
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
                  <Card key={vaccine.id} variant="default" className="bg-slate-950 border-teal-500/60">
                    <Card.Content className="p-3.5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Vaccine Name</label>
                          <Input
                            type="text"
                            value={editVaccineName}
                            onChange={(e) => setEditVaccineName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Injected Date</label>
                          <Input
                            type="date"
                            value={editVaccineDate}
                            onChange={(e) => setEditVaccineDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Booster Due Date</label>
                          <Input
                            type="date"
                            value={editVaccineBoosterDate}
                            onChange={(e) => setEditVaccineBoosterDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Vet Clinic</label>
                          <Input
                            type="text"
                            value={editVaccineVetClinic}
                            onChange={(e) => setEditVaccineVetClinic(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Batch / Lot N°</label>
                          <Input
                            type="text"
                            value={editVaccineBatchNumber}
                            onChange={(e) => setEditVaccineBatchNumber(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="tertiary"
                          size="sm"
                          onPress={() => setEditingVaccineId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={() => handleUpdateVaccineSubmit(vaccine.id)}
                        >
                          <Check className="w-3.5 h-3.5 mr-1 inline" />
                          Save
                        </Button>
                      </div>
                    </Card.Content>
                  </Card>
                );
              }

              const status = getVaccineStatus(vaccine, vaccinations);

              return (
                <div key={vaccine.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                      <Syringe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{vaccine.name}</span>
                        {vaccine.batchNumber && (
                          <Chip size="sm" variant="soft">
                            Lot: {vaccine.batchNumber}
                          </Chip>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.health.injectedOn} {vaccine.date} &bull; {t.health.clinic}: {vaccine.vetClinic || t.health.veterinary}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-300">{t.health.booster}: {vaccine.boosterDate}</div>
                      <Chip color={status.color} variant="soft" size="sm">
                        {status.label}
                      </Chip>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditVaccine(vaccine)}
                        aria-label="Edit vaccine entry"
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVaccine(vaccine.id)}
                        aria-label={t.health.deleteVaccineConfirm}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card.Content>
      </Card>

      {/* Deworming / Vermifuge Section */}
      <Card className="bg-slate-900 border border-slate-800 text-slate-100">
        <Card.Content className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Pill className="w-4 h-4 text-amber-400" />
              <span>{t.health.deworming} ({dewormingLogs.length})</span>
            </h3>
            <Button
              variant="primary"
              size="sm"
              onPress={() => setIsAddingDeworming(!isAddingDeworming)}
            >
              <Plus className="w-4 h-4 mr-1 inline" />
              {isAddingDeworming ? t.potty.cancel : t.health.addDeworming}
            </Button>
          </div>

          {isAddingDeworming && (
            <Card variant="default" className="bg-slate-950/60">
              <form onSubmit={handleAddDewormingSubmit}>
                <Card.Content className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.productName}</label>
                      <Select value={productName} onChange={(val) => setProductName(val as string)}>
                        <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100">
                          <ListBox>
                            {getHealthProtocols().antiparasitics.map((p) => (
                              <ListBoxItem key={p.id} id={p.name} textValue={p.label}>
                                {p.label}
                              </ListBoxItem>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.administeredDate}</label>
                      <Input
                        type="date"
                        value={dewormAdminDate}
                        onChange={(event) => setDewormAdminDate(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                      <Input
                        type="date"
                        value={dewormNextDate}
                        onChange={(event) => setDewormNextDate(event.target.value)}
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
                  <Card key={deworming.id} variant="default" className="bg-slate-950 border-amber-500/60">
                    <Card.Content className="p-3.5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Product Name</label>
                          <Input
                            type="text"
                            value={editDewormingName}
                            onChange={(e) => setEditDewormingName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Weight at time (kg)</label>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 7.5"
                            value={editDewormingWeight}
                            onChange={(e) => setEditDewormingWeight(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Given Date</label>
                          <Input
                            type="date"
                            value={editDewormingDate}
                            onChange={(e) => setEditDewormingDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-1">Next Due Date</label>
                          <Input
                            type="date"
                            value={editDewormingBoosterDate}
                            onChange={(e) => setEditDewormingBoosterDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="tertiary"
                          size="sm"
                          onPress={() => setEditingDewormingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={() => handleUpdateDewormingSubmit(deworming.id)}
                        >
                          <Check className="w-3.5 h-3.5 mr-1 inline" />
                          Save
                        </Button>
                      </div>
                    </Card.Content>
                  </Card>
                );
              }

              const status = getDewormingStatus(deworming, dewormingLogs);

              return (
                <div key={deworming.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                      <Pill className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{deworming.productName || deworming.name}</span>
                        {deworming.weightAtTime && (
                          <Chip color="warning" variant="soft" size="sm">
                            Poids: {deworming.weightAtTime} kg
                          </Chip>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.health.givenOn} {deworming.date}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-amber-300">{t.health.nextDeworming}: {deworming.boosterDate}</div>
                      <Chip color={status.color} variant="soft" size="sm">
                        {status.label}
                      </Chip>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditDeworming(deworming)}
                        aria-label="Edit deworming entry"
                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDeworming(deworming.id)}
                        aria-label={t.health.deleteDewormingConfirm}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
