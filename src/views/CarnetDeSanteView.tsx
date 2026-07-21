import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Syringe, ShieldCheck, Plus, Pill } from 'lucide-react';

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

  if (!activePuppy) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center text-slate-400 space-y-2">
        <Syringe className="w-10 h-10 text-indigo-400 mx-auto" />
        <h3 className="text-base font-bold text-white">No Active Dog Profile Selected</h3>
        <p className="text-xs">Register a puppy in the "Dogs" tab to manage their French Carnet de Santé!</p>
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
              <span>Carnet de Santé — {activePuppy.name}</span>
              <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2.5 py-0.5 rounded-full font-semibold">
                Protocole Vétérinaire Français
              </span>
            </h2>
            <p className="text-xs text-slate-400">Vaccinations (Rage, DHPP, Leptospirose) & Calendrier Vermifuge</p>
          </div>
        </div>
      </div>

      {/* Protocol Reference Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <h3 className="text-xs font-bold text-teal-400 flex items-center gap-1.5 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Calendrier Vaccinal Chiot</span>
          </h3>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li><strong>8 Semaines (Primo)</strong>: DHPP + Leptospirose (L4)</li>
            <li><strong>12 Semaines (Rappel 1)</strong>: DHPP + L4 + Rage (Legally mandatory for travel)</li>
            <li><strong>16 Semaines (Rappel 2)</strong>: DHPP final booster</li>
            <li><strong>Annuel / 3 Ans</strong>: Rappel annuel vétérinaire</li>
          </ul>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
          <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Pill className="w-4 h-4" />
            <span>Protocole Vermifuge</span>
          </h3>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li><strong>De 2 à 6 mois</strong>: 1 fois par mois (Milbemax / Drontal)</li>
            <li><strong>Après 6 mois</strong>: 4 fois par an (à chaque changement de saison)</li>
            <li><strong>Pesée obligatoire</strong>: Adapter la dose exacte selon le poids ({activePuppy.weightKg}kg)</li>
          </ul>
        </div>
      </div>

      {/* Vaccinations Section */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Syringe className="w-4 h-4 text-teal-400" />
            <span>Historique des Vaccins ({vaccinations.length})</span>
          </h3>
          <button
            onClick={() => setIsAddingVaccine(!isAddingVaccine)}
            className="flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingVaccine ? 'Annuler' : 'Ajouter un Vaccin'}</span>
          </button>
        </div>

        {isAddingVaccine && (
          <form onSubmit={handleAddVaccineSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Type de Vaccin</label>
                <select
                  value={vaccineType}
                  onChange={(e) => setVaccineType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="DHPP">DHPP (Carré, Hépatite, Parvo)</option>
                  <option value="Rage">Rage</option>
                  <option value="Leptospirose">Leptospirose (L4)</option>
                  <option value="Toux_de_Chenil">Toux de Chenil (Bordetella)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date d'Injection</label>
                <input
                  type="date"
                  value={administeredDate}
                  onChange={(e) => setAdministeredDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Prochain Rappel Due</label>
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
                Enregistrer Vaccin
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
                    Injecté le {v.administeredDate} &bull; Clinique: {v.vetClinicName || 'Vétérinaire'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-amber-300">Rappel: {v.nextDueDate}</div>
                <div className="text-[10px] text-slate-500">Statut: Conforme</div>
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
            <span>Suivi Vermifuge ({dewormingLogs.length})</span>
          </h3>
          <button
            onClick={() => setIsAddingDeworming(!isAddingDeworming)}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAddingDeworming ? 'Annuler' : 'Ajouter Vermifuge'}</span>
          </button>
        </div>

        {isAddingDeworming && (
          <form onSubmit={handleAddDewormingSubmit} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Produit Vermifuge</label>
                <input
                  type="text"
                  placeholder="e.g. Milbemax / Drontal"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date d'Administration</label>
                <input
                  type="date"
                  value={dewormAdminDate}
                  onChange={(e) => setDewormAdminDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Prochaine Prise Due</label>
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
                Enregistrer Vermifuge
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
                    Pris le {d.administeredDate} &bull; Poids: {d.weightAtTimeKg || activePuppy.weightKg} kg
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-indigo-300">Prochain: {d.nextDueDate}</div>
                <div className="text-[10px] text-slate-500">Statut: À jour</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
