import React, { useState, useEffect } from 'react';
import type { PuppyProfile } from '../types';
import { Syringe, ShieldCheck, Plus, Pill, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatLocalDate } from '../utils/date';
import {
  fetchHealthRecords,
  createHealthRecord,
  deleteHealthRecord,
} from '../services/api';

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
  date: string;
  boosterDate?: string;
  productName?: string;
  weightAtTime?: number;
  notes?: string;
}

interface CarnetDeSanteViewProps {
  activePuppy: PuppyProfile | null;
}

export const CarnetDeSanteView: React.FC<CarnetDeSanteViewProps> = ({ activePuppy }) => {
  const { t } = useI18n();

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

  // New Deworming Form
  const [productName, setProductName] = useState('Milbemax Tab / Milprazon');
  const [dewormAdminDate, setDewormAdminDate] = useState(() => formatLocalDate());
  const [dewormNextDate, setDewormNextDate] = useState('');

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
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-3 max-w-xl mx-auto">
        <Syringe className="w-12 h-12 text-slate-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-200">
          {t.health.noPuppySelected}
        </h2>
        <p className="text-xs text-slate-400">
          {t.health.selectPuppyToViewHealth}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-md">
            <Syringe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>{t.health.healthPassportFor.replace('{name}', activePuppy.name)}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {t.health.subtitle} &bull; {activePuppy.name} ({activePuppy.breed})
            </p>
          </div>
        </div>
      </div>

      {/* Guidelines Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* French Vaccine Schedule Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
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
        </div>

        {/* French ESCCAP Deworming Protocol Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
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
        </div>
      </div>

      {/* Vaccinations Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Syringe className="w-4 h-4 text-teal-400" />
            <span>{t.health.vaccinations} ({vaccinations.length})</span>
          </h3>
          <button
            onClick={() => setIsAddingVaccine(!isAddingVaccine)}
            className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingVaccine ? t.potty.cancel : t.health.addVaccine}</span>
          </button>
        </div>

        {isAddingVaccine && (
          <form onSubmit={handleAddVaccineSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vaccineType}</label>
                <select
                  value={vaccineType}
                  onChange={(event) => setVaccineType(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="CHPPi + L4">CHPPi + L4 (Carré, Hépatite, Parvo, Pi + Lepto 4)</option>
                  <option value="CHPPi">CHPPi (Carré, Hépatite, Parvovirose, Para-influenza)</option>
                  <option value="L4 (Leptospirose)">L4 (Leptospirose 4 souches)</option>
                  <option value="Rage (R)">{t.health.rabiesOption}</option>
                  <option value="Toux de Chenil (Bb/Kc)">{t.health.kennelCoughOption}</option>
                  <option value="Piroplasmose">Piroplasmose (Tiques - France)</option>
                  <option value="Leishmaniose">Leishmaniose (Singe / Sud de France)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.administeredDate}</label>
                <input
                  type="date"
                  value={administeredDate}
                  onChange={(event) => setAdministeredDate(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(event) => setNextDueDate(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vetClinic}</label>
                <input
                  type="text"
                  placeholder="e.g. Clinique Vétérinaire Saint-Roch"
                  value={vetClinic}
                  onChange={(event) => setVetClinic(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.batchNumber}</label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-X99"
                  value={batchNumber}
                  onChange={(event) => setBatchNumber(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                {t.health.saveVaccine}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {vaccinations.map((vaccine) => (
            <div key={vaccine.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                  <Syringe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{vaccine.name}</span>
                    {vaccine.batchNumber && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.2 rounded">
                        Lot: {vaccine.batchNumber}
                      </span>
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
                  <div className="text-[10px] text-slate-500">{t.health.statusConform}</div>
                </div>
                <button
                  onClick={() => handleDeleteVaccine(vaccine.id)}
                  title={t.health.deleteVaccineConfirm}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deworming / Vermifuge Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Pill className="w-4 h-4 text-amber-400" />
            <span>{t.health.deworming} ({dewormingLogs.length})</span>
          </h3>
          <button
            onClick={() => setIsAddingDeworming(!isAddingDeworming)}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingDeworming ? t.potty.cancel : t.health.addDeworming}</span>
          </button>
        </div>

        {isAddingDeworming && (
          <form onSubmit={handleAddDewormingSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.productName}</label>
                <select
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="Credelio Plus">Credelio Plus (Milbémycine + Lotilaner - Puces/Tiques/Vers)</option>
                  <option value="Milbemax Tab / Milprazon">Milbemax Tab / Milprazon (N°1 France)</option>
                  <option value="Nexgard Spectra">Nexgard Spectra (Vermifuge + Tiques/Puces)</option>
                  <option value="Drontal Chien">Drontal Chien (Praziquantel / Fébantel)</option>
                  <option value="Panacur (Fenbendazole)">Panacur (Chiots / Giardiose)</option>
                  <option value="Dolpac / Procox">Dolpac / Procox</option>
                  <option value="Autre vermifuge">Autre produit vermifuge</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.administeredDate}</label>
                <input
                  type="date"
                  value={dewormAdminDate}
                  onChange={(event) => setDewormAdminDate(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                <input
                  type="date"
                  value={dewormNextDate}
                  onChange={(event) => setDewormNextDate(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                {t.health.saveDeworming}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {dewormingLogs.map((deworming) => (
            <div key={deworming.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{deworming.productName || deworming.name}</span>
                    {deworming.weightAtTime && (
                      <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-0.2 rounded font-semibold">
                        Poids: {deworming.weightAtTime} kg
                      </span>
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
                  <div className="text-[10px] text-slate-500">{t.health.statusDewormed}</div>
                </div>
                <button
                  onClick={() => handleDeleteDeworming(deworming.id)}
                  title={t.health.deleteDewormingConfirm}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
