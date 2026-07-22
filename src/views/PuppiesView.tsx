import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Dog, Plus, Trash2, Scale, Utensils, Calendar } from 'lucide-react';
import { useI18n } from '../i18n';

interface PuppiesViewProps {
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => void;
  onUpdatePuppy: (puppy: PuppyProfile) => void;
  onDeletePuppy: (id: string) => void;
}

export const DOG_BREEDS = [
  'English Cocker Spaniel / Cocker Anglais',
  'American Cocker Spaniel / Cocker Américain',
  'French Bulldog / Bouledogue Français',
  'Golden Retriever',
  'Labrador Retriever',
  'Australian Shepherd / Berger Australien',
  'German Shepherd / Berger Allemand',
  'Beagle',
  'Poodle / Caniche',
  'Cavalier King Charles',
  'Border Collie',
  'Dachshund / Teckel',
  'Jack Russell Terrier',
  'Chihuahua',
  'Siberian Husky',
  'Mixed Breed / Bâtard (Croisé)',
  'Unknown / Inconnu',
  'Other',
];

export const PuppiesView: React.FC<PuppiesViewProps> = ({
  puppies,
  activePuppyId,
  onSelectPuppy,
  onAddPuppy,
  onDeletePuppy,
}) => {
  const { lang, t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);

  // New Puppy Form State
  const [name, setName] = useState('');
  const [breed, setBreed] = useState(DOG_BREEDS[0]);
  const [customBreed, setCustomBreed] = useState('');
  const [birthDate, setBirthDate] = useState('2026-05-01');
  const [weightKg, setWeightKg] = useState<number>(5.5);
  const [dailyFoodGramGoal, setDailyFoodGramGoal] = useState<number>(180);
  const [notes, setNotes] = useState('');

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const finalBreed = breed === 'Other' ? (customBreed.trim() || 'Mixed Breed') : breed;

    const newPup: PuppyProfile = {
      id: `pup-${Date.now()}`,
      name: name.trim(),
      breed: finalBreed,
      birthDate,
      weightKg,
      dailyFoodGramGoal,
      targetMealsPerDay: 3,
      avatarUrl: '/cocker_spaniel_mascot.jpg',
      notes,
    };

    onAddPuppy(newPup);
    setIsAdding(false);
    setName('');
    setNotes('');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-xl shadow-md">
            <Dog className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{t.puppies.title}</h2>
            <p className="text-xs text-slate-400">{t.puppies.subtitle}</p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? (lang === 'fr' ? 'Annuler' : 'Cancel') : t.puppies.addDog}</span>
        </button>
      </div>

      {/* Add Dog Form */}
      {isAdding && (
        <form onSubmit={handleCreateSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-slate-100 border-b border-slate-800 pb-2">
            {lang === 'fr' ? 'Enregistrer un nouveau chien' : 'Register New Dog Profile'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {lang === 'fr' ? 'Nom du Chien' : 'Dog Name'}
              </label>
              <input
                type="text"
                placeholder="e.g. Cookie"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
              <select
                value={breed}
                onChange={(event) => setBreed(event.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {DOG_BREEDS.map((breedOption) => (
                  <option key={breedOption} value={breedOption} className="bg-slate-800 text-slate-200">
                    {breedOption}
                  </option>
                ))}
              </select>

              {breed === 'Other' && (
                <input
                  type="text"
                  placeholder={lang === 'fr' ? 'Spécifiez la race...' : 'Specify custom breed...'}
                  value={customBreed}
                  onChange={(event) => setCustomBreed(event.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 mt-2"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.weight}</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(event) => setWeightKg(Number(event.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.foodGramGoal}</label>
              <input
                type="number"
                value={dailyFoodGramGoal}
                onChange={(event) => setDailyFoodGramGoal(Number(event.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Notes</label>
              <input
                type="text"
                placeholder={lang === 'fr' ? 'Instructions ou notes de soin...' : 'Notes or care instructions...'}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              {lang === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer"
            >
              {lang === 'fr' ? 'Enregistrer le Chien' : 'Save Puppy Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Puppies Grid */}
      {puppies.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <Dog className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">
            {lang === 'fr' ? 'Aucun chien dans le foyer pour le moment' : 'No Dogs in Household Yet'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === 'fr'
              ? 'Cliquez sur "Ajouter un Chien" ci-dessus pour enregistrer votre chiot !'
              : 'Click "Add New Dog" above to register your puppy and start logging activity!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {puppies.map((pup) => {
            const isActive = pup.id === activePuppyId;

            return (
              <div
                key={pup.id}
                className={`bg-slate-900 border ${
                  isActive ? 'border-indigo-500/80 ring-2 ring-indigo-500/20' : 'border-slate-800'
                } rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={pup.avatarUrl || '/cocker_spaniel_mascot.jpg'}
                      alt={pup.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-500/50 shadow"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{pup.name}</h3>
                        {isActive && (
                          <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            Actif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{pup.breed}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!isActive && (
                      <button
                        onClick={() => onSelectPuppy(pup.id)}
                        className="text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        Sélectionner
                      </button>
                    )}
                    <button
                      onClick={() => onDeletePuppy(pup.id)}
                      title="Delete Puppy Profile"
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Scale className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{pup.weightKg} kg</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Utensils className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>{pup.dailyFoodGramGoal}g / jour</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{pup.birthDate}</span>
                  </div>
                </div>

                {pup.notes && (
                  <p className="text-xs text-slate-400 italic bg-slate-950/20 p-2 rounded-lg border border-slate-800/50">
                    "{pup.notes}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
