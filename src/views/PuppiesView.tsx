import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Dog, Plus, Trash2, Edit3, Utensils, Calendar, X } from 'lucide-react';
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
  onUpdatePuppy,
  onDeletePuppy,
}) => {
  const { lang, t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [editingPuppy, setEditingPuppy] = useState<PuppyProfile | null>(null);

  // New Puppy Form State
  const [name, setName] = useState('');
  const [breed, setBreed] = useState(DOG_BREEDS[0]);
  const [customBreed, setCustomBreed] = useState('');
  const [birthDate, setBirthDate] = useState('2026-05-01');
  const [dailyFoodGramGoal, setDailyFoodGramGoal] = useState<number>(200);
  const [targetMealsPerDay, setTargetMealsPerDay] = useState<number>(3);
  const [notes, setNotes] = useState('');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editBreed, setEditBreed] = useState(DOG_BREEDS[0]);
  const [editCustomBreed, setEditCustomBreed] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editFoodGramGoal, setEditFoodGramGoal] = useState<number>(200);
  const [editMealsPerDay, setEditMealsPerDay] = useState<number>(3);
  const [editNotes, setEditNotes] = useState('');

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    const finalBreed = breed === 'Other' ? (customBreed.trim() || 'Mixed Breed') : breed;

    const newPup: PuppyProfile = {
      id: `pup-${Date.now()}`,
      name: name.trim(),
      breed: finalBreed,
      birthDate,
      dailyFoodGramGoal: Math.max(10, dailyFoodGramGoal),
      targetMealsPerDay: Math.max(1, Math.min(6, targetMealsPerDay)),
      avatarUrl: '/cocker_spaniel_mascot.jpg',
      notes,
    };

    onAddPuppy(newPup);
    setIsAdding(false);
    setName('');
    setNotes('');
  };

  const handleStartEdit = (pup: PuppyProfile) => {
    setEditingPuppy(pup);
    setEditName(pup.name);
    if (DOG_BREEDS.includes(pup.breed)) {
      setEditBreed(pup.breed);
      setEditCustomBreed('');
    } else {
      setEditBreed('Other');
      setEditCustomBreed(pup.breed);
    }
    setEditBirthDate(pup.birthDate || '2026-05-01');
    setEditFoodGramGoal(pup.dailyFoodGramGoal || 200);
    setEditMealsPerDay(pup.targetMealsPerDay || 3);
    setEditNotes(pup.notes || '');
  };

  const handleEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPuppy || !editName.trim()) return;

    const finalBreed = editBreed === 'Other' ? (editCustomBreed.trim() || 'Mixed Breed') : editBreed;

    const updatedPup: PuppyProfile = {
      ...editingPuppy,
      name: editName.trim(),
      breed: finalBreed,
      birthDate: editBirthDate,
      dailyFoodGramGoal: Math.max(10, editFoodGramGoal),
      targetMealsPerDay: Math.max(1, Math.min(6, editMealsPerDay)),
      notes: editNotes,
    };

    onUpdatePuppy(updatedPup);
    setEditingPuppy(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md">
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
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {lang === 'fr' ? 'Objectif Nourriture Quotidien (Grammes)' : 'Daily Food Goal (Grams)'}
              </label>
              <input
                type="number"
                value={dailyFoodGramGoal}
                onChange={(event) => setDailyFoodGramGoal(Number(event.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {lang === 'fr' ? 'Nombre de Repas par Jour' : 'Target Meals per Day'}
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={targetMealsPerDay}
                onChange={(event) => setTargetMealsPerDay(Number(event.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                required
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

      {/* Edit Dog Modal */}
      {editingPuppy && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>{lang === 'fr' ? `Modifier le profil de ${editingPuppy.name}` : `Edit Profile: ${editingPuppy.name}`}</span>
              </h3>
              <button
                onClick={() => setEditingPuppy(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.dogName}
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                  <select
                    value={editBreed}
                    onChange={(event) => setEditBreed(event.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {DOG_BREEDS.map((breedOption) => (
                      <option key={breedOption} value={breedOption} className="bg-slate-800 text-slate-200">
                        {breedOption}
                      </option>
                    ))}
                  </select>

                  {editBreed === 'Other' && (
                    <input
                      type="text"
                      placeholder={t.puppies.specifyCustomBreed}
                      value={editCustomBreed}
                      onChange={(event) => setEditCustomBreed(event.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.foodGramGoal}
                  </label>
                  <input
                    type="number"
                    value={editFoodGramGoal}
                    onChange={(event) => setEditFoodGramGoal(Number(event.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.mealsPerDay}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={editMealsPerDay}
                    onChange={(event) => setEditMealsPerDay(Number(event.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(event) => setEditBirthDate(event.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPuppy(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  {t.potty.cancel}
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer"
                >
                  {t.puppies.updateProfile}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Puppies Grid */}
      {puppies.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <Dog className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">
            {t.puppies.noDogsInHousehold}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {t.puppies.clickAddDogAbove}
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
                            {t.puppies.active}
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
                        {t.puppies.select}
                      </button>
                    )}
                    <button
                      onClick={() => handleStartEdit(pup)}
                      title="Edit Dog Profile"
                      className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
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
                <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Utensils className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>{pup.dailyFoodGramGoal}g / jour ({pup.targetMealsPerDay || 3} repas)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Né le {pup.birthDate}</span>
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
