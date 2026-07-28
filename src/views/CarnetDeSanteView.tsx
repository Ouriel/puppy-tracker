import React, { useState, useEffect } from 'react';
import type { PuppyProfile } from '../types';
import { Syringe, ShieldCheck, Plus, Pill, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
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
  const { lang, t } = useI18n();

  const [vaccinations, setVaccinations] = useState<VaccinationEntry[]>([]);
  const [dewormingLogs, setDewormingLogs] = useState<DewormingEntry[]>([]);

  // Form toggles
  const [isAddingVaccine, setIsAddingVaccine] = useState(false);
  const [isAddingDeworming, setIsAddingDeworming] = useState(false);

  // New Vaccine Form
  const [vaccineType, setVaccineType] = useState<string>('CHPPi + L4');
  const [administeredDate, setAdministeredDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextDueDate, setNextDueDate] = useState('');

  // New Deworming Form
  const [productName, setProductName] = useState('Milbemax Tab / Milprazon');
  const [dewormAdminDate, setDewormAdminDate] = useState(new Date().toISOString().slice(0, 10));
  const [dewormNextDate, setDewormNextDate] = useState('');

  useEffect(() => {
    if (activePuppy?.id) {
      loadHealthRecords();
    }
  }, [activePuppy?.id]);

  const loadHealthRecords = async () => {
    if (!activePuppy?.id) return;
    const vRes = await fetchHealthRecords(activePuppy.id, 'vaccination');
    if (vRes) {
      setVaccinations(vRes);
    }
    const dRes = await fetchHealthRecords(activePuppy.id, 'deworming');
    if (dRes) {
      setDewormingLogs(dRes);
    }
  };

  const handleAddVaccineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!administeredDate || !nextDueDate || !activePuppy) return;

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'vaccination',
      name: vaccineType,
      date: administeredDate,
      boosterDate: nextDueDate,
    };

    const created = await createHealthRecord(newEntry);
    if (created) {
      setVaccinations((prev) => [created, ...prev]);
      setIsAddingVaccine(false);
    }
  };

  const handleDeleteVaccine = async (id: string) => {
    const confirmMsg = lang === 'fr' 
      ? 'Êtes-vous sûr de vouloir supprimer cette ligne de vaccin ?' 
      : 'Are you sure you want to delete this vaccine record?';
    if (window.confirm(confirmMsg)) {
      const ok = await deleteHealthRecord(id);
      if (ok) {
        setVaccinations((prev) => prev.filter((v) => v.id !== id));
      }
    }
  };

  const handleAddDewormingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dewormAdminDate || !dewormNextDate || !activePuppy) return;

    const newEntry = {
      puppyId: activePuppy.id,
      type: 'deworming',
      name: productName.trim() || 'Milbemax Tab / Milprazon',
      productName: productName.trim() || 'Milbemax Tab / Milprazon',
      date: dewormAdminDate,
      boosterDate: dewormNextDate,
      weightAtTime: activePuppy.weightKg,
    };

    const created = await createHealthRecord(newEntry);
    if (created) {
      setDewormingLogs((prev) => [created, ...prev]);
      setIsAddingDeworming(false);
    }
  };

  const handleDeleteDeworming = async (id: string) => {
    const confirmMsg = lang === 'fr'
      ? 'Êtes-vous sûr de vouloir supprimer cette ligne de vermifuge ?'
      : 'Are you sure you want to delete this deworming record?';
    if (window.confirm(confirmMsg)) {
      const ok = await deleteHealthRecord(id);
      if (ok) {
        setDewormingLogs((prev) => prev.filter((d) => d.id !== id));
      }
    }
  };

  if (!activePuppy) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-3 max-w-xl mx-auto">
        <Syringe className="w-12 h-12 text-slate-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-200">
          {lang === 'fr' ? 'Aucun chiot sélectionné' : 'No Puppy Selected'}
        </h2>
        <p className="text-xs text-slate-400">
          {lang === 'fr'
            ? 'Veuillez d\'abord ajouter ou sélectionner un chiot dans le tableau de bord.'
            : 'Please add or select a puppy in the dashboard first.'}
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
              <span>{lang === 'fr' ? 'Carnet de Santé Vétérinaire' : 'Health Passport'} &bull; {activePuppy.name}</span>
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'fr'
                ? `Suivi vaccinal (combinaisons françaises CHPPi+L4) et vermifugation ESCCAP France pour ${activePuppy.name} (${activePuppy.breed})`
                : `Vaccination schedule and deworming passport for ${activePuppy.name} (${activePuppy.breed})`}
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
            <span>{lang === 'fr' ? 'Calendrier Vaccinal Français (CHPPi+L4)' : 'French Puppy Vaccine Guidelines'}</span>
          </h3>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li><strong>{lang === 'fr' ? '8 Semaines (Primo)' : '8 Weeks (Initial)'}</strong>: CHPPi + L4 (1ère injection)</li>
            <li><strong>{lang === 'fr' ? '12 Semaines (Rappel 1)' : '12 Weeks (Booster 1)'}</strong>: CHPPi + L4 (+ KC / Rage R obligatoire si voyage)</li>
            <li><strong>{lang === 'fr' ? '16 Semaines (Rappel 2)' : '16 Weeks (Booster 2)'}</strong>: CHPPi + L4 (Conseillé immunité Parvo)</li>
            <li><strong>{lang === 'fr' ? 'Rappel 1 An' : '1 Year Booster'}</strong>: Rappel CHPPi + L4 (+ Rage R)</li>
          </ul>
        </div>

        {/* French ESCCAP Deworming Protocol Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Pill className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Protocole Vermifuge ESCCAP France' : 'ESCCAP Deworming Protocol'}</span>
          </h3>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li><strong>{lang === 'fr' ? 'De 2 sem. à 2 mois' : '2 wks to 2 mos'}</strong>: {lang === 'fr' ? '1 fois toutes les 2 semaines' : 'Every 2 weeks'}</li>
            <li><strong>{lang === 'fr' ? 'De 2 à 6 mois' : '2 to 6 months'}</strong>: {lang === 'fr' ? '1 fois par mois (Milbemax / Drontal)' : 'Once per month (Milbemax / Drontal)'}</li>
            <li><strong>{lang === 'fr' ? 'Après 6 mois (Adulte)' : 'After 6 months'}</strong>: {lang === 'fr' ? '3 à 4 fois par an (changement de saison)' : '3 to 4 times per year'}</li>
            <li><strong>{lang === 'fr' ? 'Dosage au poids' : 'Weight dosing'}</strong>: {lang === 'fr' ? 'Adapter la dose exacte selon le poids actuel du chiot' : 'Dose precisely according to current puppy weight'}</li>
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
            <span>{isAddingVaccine ? (lang === 'fr' ? 'Annuler' : 'Cancel') : t.health.addVaccine}</span>
          </button>
        </div>

        {isAddingVaccine && (
          <form onSubmit={handleAddVaccineSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.vaccineType}</label>
                <select
                  value={vaccineType}
                  onChange={(e) => setVaccineType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="CHPPi + L4">CHPPi + L4 (Carré, Hépatite, Parvo, Pi + Lepto 4)</option>
                  <option value="CHPPi">CHPPi (Carré, Hépatite, Parvovirose, Para-influenza)</option>
                  <option value="L4 (Leptospirose)">L4 (Leptospirose 4 souches)</option>
                  <option value="Rage (R)">{lang === 'fr' ? 'Rage (R) - Voyage / Obligatoire' : 'Rabies (R) - Travel'}</option>
                  <option value="Toux de Chenil (Bb/Kc)">{lang === 'fr' ? 'Toux de Chenil (Kc / Bordetella)' : 'Kennel Cough (Bordetella / Kc)'}</option>
                  <option value="Piroplasmose">Piroplasmose (Tiques - France)</option>
                  <option value="Leishmaniose">Leishmaniose (Singe / Sud de France)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.administeredDate}</label>
                <input
                  type="date"
                  value={administeredDate}
                  onChange={(e) => setAdministeredDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
              >
                {lang === 'fr' ? 'Enregistrer Vaccin' : 'Save Vaccine Record'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {vaccinations.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                  <Syringe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{v.name}</span>
                    {v.batchNumber && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.2 rounded">
                        Lot: {v.batchNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'fr' ? 'Injecté le' : 'Administered'} {v.date} &bull; {lang === 'fr' ? 'Clinique:' : 'Clinic:'} {v.vetClinic || (lang === 'fr' ? 'Vétérinaire' : 'Veterinary')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-300">{lang === 'fr' ? 'Rappel:' : 'Booster:'} {v.boosterDate}</div>
                  <div className="text-[10px] text-slate-500">{lang === 'fr' ? 'Statut: Conforme' : 'Status: Compliant'}</div>
                </div>
                <button
                  onClick={() => handleDeleteVaccine(v.id)}
                  title={lang === 'fr' ? 'Supprimer la ligne de vaccin' : 'Delete vaccine record'}
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
            <span>{isAddingDeworming ? (lang === 'fr' ? 'Annuler' : 'Cancel') : t.health.addDeworming}</span>
          </button>
        </div>

        {isAddingDeworming && (
          <form onSubmit={handleAddDewormingSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.productName}</label>
                <select
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
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
                  onChange={(e) => setDewormAdminDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">{t.health.boosterDue}</label>
                <input
                  type="date"
                  value={dewormNextDate}
                  onChange={(e) => setDewormNextDate(e.target.value)}
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
                {lang === 'fr' ? 'Enregistrer Vermifuge' : 'Save Deworming Entry'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {dewormingLogs.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{d.productName || d.name}</span>
                    {d.weightAtTime && (
                      <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800 px-2 py-0.2 rounded font-semibold">
                        Poids: {d.weightAtTime} kg
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'fr' ? 'Donné le' : 'Given'} {d.date}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-300">{lang === 'fr' ? 'Prochain:' : 'Next:'} {d.boosterDate}</div>
                  <div className="text-[10px] text-slate-500">{lang === 'fr' ? 'Statut: Vermifugé' : 'Status: Dewormed'}</div>
                </div>
                <button
                  onClick={() => handleDeleteDeworming(d.id)}
                  title={lang === 'fr' ? 'Supprimer la ligne de vermifuge' : 'Delete deworming record'}
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
