import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Syringe, ShieldCheck, Plus, Pill, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';

interface VaccinationEntry {
  id: string;
  vaccineType: 'Rage' | 'DHPP' | 'Leptospirose' | 'Toux_de_Chenil';
  administeredDate: string;
  nextDueDate: string;
  vetClinicName?: string;
  batchNumber?: string;
  notes?: string;
}

interface DewormingEntry {
  id: string;
  productName: string;
  administeredDate: string;
  nextDueDate: string;
  weightAtTimeKg?: number;
  notes?: string;
}

interface CarnetDeSanteViewProps {
  activePuppy: PuppyProfile | null;
}

export const CarnetDeSanteView: React.FC<CarnetDeSanteViewProps> = ({ activePuppy }) => {
  const { lang, t } = useI18n();

  const [vaccinations, setVaccinations] = useState<VaccinationEntry[]>([
    {
      id: 'v1',
      vaccineType: 'DHPP',
      administeredDate: '2026-06-15',
      nextDueDate: '2026-07-15',
      vetClinicName: 'Clinique Vétérinaire Paris 15',
      batchNumber: 'FR-99812',
      notes: 'Primo-vaccination 8 semaines',
    },
    {
      id: 'v2',
      vaccineType: 'Leptospirose',
      administeredDate: '2026-06-15',
      nextDueDate: '2026-07-15',
      vetClinicName: 'Clinique Vétérinaire Paris 15',
      batchNumber: 'LEP-3341',
      notes: 'L4 injection 1',
    },
  ]);

  const [dewormingLogs, setDewormingLogs] = useState<DewormingEntry[]>([
    {
      id: 'd1',
      productName: 'Milbemax Tab',
      administeredDate: '2026-06-01',
      nextDueDate: '2026-07-01',
      weightAtTimeKg: 4.8,
      notes: 'Vermifuge mensuel chiot',
    },
  ]);

  // Form toggles
  const [isAddingVaccine, setIsAddingVaccine] = useState(false);
  const [isAddingDeworming, setIsAddingDeworming] = useState(false);

  // New Vaccine Form
  const [vaccineType, setVaccineType] = useState<'Rage' | 'DHPP' | 'Leptospirose' | 'Toux_de_Chenil'>('DHPP');
  const [administeredDate, setAdministeredDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextDueDate, setNextDueDate] = useState('');

  // New Deworming Form
  const [productName, setProductName] = useState('Milbemax Tab');
  const [dewormAdminDate, setDewormAdminDate] = useState(new Date().toISOString().slice(0, 10));
  const [dewormNextDate, setDewormNextDate] = useState('');

  const handleAddVaccineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!administeredDate || !nextDueDate) return;

    const newEntry: VaccinationEntry = {
      id: `v-${Date.now()}`,
      vaccineType,
      administeredDate,
      nextDueDate,
    };

    setVaccinations((prev) => [newEntry, ...prev]);
    setIsAddingVaccine(false);
  };

  const handleDeleteVaccine = (id: string) => {
    const confirmMsg = lang === 'fr' 
      ? 'Êtes-vous sûr de vouloir supprimer cette ligne de vaccin ?' 
      : 'Are you sure you want to delete this vaccine record?';
    if (window.confirm(confirmMsg)) {
      setVaccinations((prev) => prev.filter((v) => v.id !== id));
    }
  };

  const handleAddDewormingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dewormAdminDate || !dewormNextDate) return;

    const newEntry: DewormingEntry = {
      id: `d-${Date.now()}`,
      productName: productName.trim() || 'Milbemax Tab',
      administeredDate: dewormAdminDate,
      nextDueDate: dewormNextDate,
      weightAtTimeKg: activePuppy?.weightKg,
    };

    setDewormingLogs((prev) => [newEntry, ...prev]);
    setIsAddingDeworming(false);
  };

  const handleDeleteDeworming = (id: string) => {
    const confirmMsg = lang === 'fr' 
      ? 'Êtes-vous sûr de vouloir supprimer cette entrée de vermifuge ?' 
      : 'Are you sure you want to delete this deworming entry?';
    if (window.confirm(confirmMsg)) {
      setDewormingLogs((prev) => prev.filter((d) => d.id !== id));
    }
  };

  if (!activePuppy) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-400 space-y-2">
        <Syringe className="w-10 h-10 text-indigo-400 mx-auto" />
        <h3 className="text-base font-bold text-white">
          {lang === 'fr' ? 'Aucun profil de chien sélectionné' : 'No Active Dog Profile Selected'}
        </h3>
        <p className="text-xs">
          {lang === 'fr' 
            ? 'Enregistrez un chiot dans "Paramètres & Foyer" pour gérer son carnet de santé !' 
            : 'Register a puppy in "Settings & Household" to manage their Health Passport!'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-teal-500 to-indigo-600 rounded-xl shadow-md">
            <Syringe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>{t.health.carnetTitle} — {activePuppy.name}</span>
              <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2.5 py-0.5 rounded-full font-semibold">
                {lang === 'fr' ? 'Protocole Vétérinaire Français' : 'French Veterinary Protocol'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">{t.health.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Protocol Reference Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <h3 className="text-xs font-bold text-teal-400 flex items-center gap-1.5 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Calendrier Vaccinal Chiot' : 'Puppy Vaccination Schedule'}</span>
          </h3>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li><strong>{lang === 'fr' ? '8 Semaines (Primo)' : '8 Weeks (Initial)'}</strong>: DHPP + Leptospirose (L4)</li>
            <li><strong>{lang === 'fr' ? '12 Semaines (Rappel 1)' : '12 Weeks (Booster 1)'}</strong>: DHPP + L4 + {lang === 'fr' ? 'Rage (Obligatoire voyages)' : 'Rabies (Mandatory for travel)'}</li>
            <li><strong>{lang === 'fr' ? '16 Semaines (Rappel 2)' : '16 Weeks (Booster 2)'}</strong>: DHPP final booster</li>
            <li><strong>{lang === 'fr' ? 'Annuel / 3 Ans' : 'Annual Booster'}</strong>: {lang === 'fr' ? 'Rappel annuel vétérinaire' : 'Annual vet checkup booster'}</li>
          </ul>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Pill className="w-4 h-4" />
            <span>{lang === 'fr' ? 'Protocole Vermifuge' : 'Deworming Protocol'}</span>
          </h3>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li><strong>{lang === 'fr' ? 'De 2 à 6 mois' : '2 to 6 months old'}</strong>: {lang === 'fr' ? '1 fois par mois (Milbemax / Drontal)' : 'Once per month (Milbemax / Drontal)'}</li>
            <li><strong>{lang === 'fr' ? 'Après 6 mois' : 'After 6 months old'}</strong>: {lang === 'fr' ? '4 fois par an (changement de saison)' : '4 times per year (quarterly)'}</li>
            <li><strong>{lang === 'fr' ? 'Pesée obligatoire' : 'Weight dosing'}</strong>: {lang === 'fr' ? `Adapter la dose exacte selon le poids (${activePuppy.weightKg}kg)` : `Dose precisely according to weight (${activePuppy.weightKg}kg)`}</li>
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
                  onChange={(e) => setVaccineType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="DHPP">DHPP (Parvo, Distemper, Hepatitis)</option>
                  <option value="Rage">{lang === 'fr' ? 'Rage' : 'Rabies'}</option>
                  <option value="Leptospirose">Leptospirose (L4)</option>
                  <option value="Toux_de_Chenil">{lang === 'fr' ? 'Toux de Chenil (Bordetella)' : 'Kennel Cough (Bordetella)'}</option>
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
                    <span>{v.vaccineType}</span>
                    {v.batchNumber && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.2 rounded">
                        Lot: {v.batchNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'fr' ? 'Injecté le' : 'Administered'} {v.administeredDate} &bull; {lang === 'fr' ? 'Clinique:' : 'Clinic:'} {v.vetClinicName || (lang === 'fr' ? 'Vétérinaire' : 'Veterinary')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold text-amber-300">{lang === 'fr' ? 'Rappel:' : 'Booster:'} {v.nextDueDate}</div>
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
                <input
                  type="text"
                  placeholder="e.g. Milbemax / Drontal"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
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
                  <div className="text-xs font-bold text-white">{d.productName}</div>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'fr' ? 'Pris le' : 'Administered'} {d.administeredDate} &bull; {lang === 'fr' ? 'Poids:' : 'Weight:'} {d.weightAtTimeKg || activePuppy.weightKg} kg
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold text-indigo-300">{lang === 'fr' ? 'Prochain:' : 'Next:'} {d.nextDueDate}</div>
                  <div className="text-[10px] text-slate-500">{lang === 'fr' ? 'Statut: À jour' : 'Status: Up to date'}</div>
                </div>
                <button
                  onClick={() => handleDeleteDeworming(d.id)}
                  title={lang === 'fr' ? 'Supprimer la ligne de vermifuge' : 'Delete deworming entry'}
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
