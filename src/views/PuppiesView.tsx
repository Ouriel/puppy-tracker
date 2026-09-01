import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Dog, Plus, Trash2, Pencil, Utensils, Calendar } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatBreedName, DOG_BREEDS } from '../utils/breeds';
import { getExpectedAdultWeight } from '../utils/weight';
import { Card, Button, Input, Select, ListBox, ListBoxItem, Chip } from '@heroui/react';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

interface PuppiesViewProps {
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => void;
  onUpdatePuppy: (puppy: PuppyProfile) => void;
  onDeletePuppy: (id: string) => void;
}

const DogGenderAndWeightFields: React.FC<{
  breed: string;
  gender?: 'female' | 'male';
  expectedWeightKg?: number;
  onChange: (patch: { gender?: 'female' | 'male'; expectedAdultWeightKg?: number }) => void;
  t: ReturnType<typeof useI18n>['t'];
}> = ({ breed, gender, expectedWeightKg, onChange, t }) => {
  const isCustomOrMixed =
    breed === 'Other' ||
    breed === 'Mixed Breed' ||
    breed.toLowerCase().includes('crois') ||
    breed.toLowerCase().includes('bâtard') ||
    breed.toLowerCase().includes('batard') ||
    breed.toLowerCase().includes('mutt');

  const standardWeight = getExpectedAdultWeight(breed, gender);

  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.sex}</label>
        <div className="grid grid-cols-2 gap-2">
          {(['female', 'male'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ gender: gender === s ? undefined : s })}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                gender === s
                  ? s === 'female'
                    ? 'bg-pink-950/60 border-pink-500 text-pink-300 ring-2 ring-pink-500/20'
                    : 'bg-blue-950/60 border-blue-500 text-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{s === 'female' ? '♀' : '♂'}</span>
              <span>{s === 'female' ? t.puppies.female : t.puppies.male}</span>
            </button>
          ))}
        </div>
        {!isCustomOrMixed && (
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
            <span>{t.puppies.standardAdultWeight}:</span>
            <span className="font-semibold text-slate-200">~{standardWeight} kg</span>
          </p>
        )}
      </div>

      {isCustomOrMixed && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            {t.puppies.expectedAdultWeight} (kg)
          </label>
          <Input
            type="number"
            step="0.5"
            min="1"
            max="100"
            placeholder="ex: 14"
            className="bg-slate-950 border-slate-800 text-slate-100"
            value={expectedWeightKg ?? ''}
            onChange={(event) => onChange({ expectedAdultWeightKg: event.target.valueAsNumber || undefined })}
          />
          <p className="text-[10px] text-slate-500 mt-1">{t.puppies.expectedWeightHint}</p>
        </div>
      )}
    </>
  );
};

export const PuppiesView: React.FC<PuppiesViewProps> = ({
  puppies,
  activePuppyId,
  onSelectPuppy,
  onAddPuppy,
  onUpdatePuppy,
  onDeletePuppy,
}) => {
  const { t, lang } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [editingPuppy, setEditingPuppy] = useState<PuppyProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{id: string; type: string} | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    breed: DOG_BREEDS[0],
    customBreed: '',
    gender: undefined as 'female' | 'male' | undefined,
    expectedAdultWeightKg: undefined as number | undefined,
    birthDate: '2026-05-01',
    dailyFoodGramGoal: 200,
    targetMealsPerDay: 3,
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      breed: DOG_BREEDS[0],
      customBreed: '',
      gender: undefined,
      expectedAdultWeightKg: undefined,
      birthDate: '2026-05-01',
      dailyFoodGramGoal: 200,
      targetMealsPerDay: 3,
      notes: '',
    });
    setIsAdding(false);
    setEditingPuppy(null);
  };

  const handleStartEdit = (pup: PuppyProfile) => {
    setIsAdding(false);
    setEditingPuppy(pup);
    const isStandard = DOG_BREEDS.includes(pup.breed);
    setFormData({
      name: pup.name,
      breed: isStandard ? pup.breed : 'Other',
      customBreed: isStandard ? '' : pup.breed,
      gender: pup.gender || undefined,
      expectedAdultWeightKg: pup.expectedAdultWeightKg,
      birthDate: pup.birthDate || '2026-05-01',
      dailyFoodGramGoal: pup.dailyFoodGramGoal || 200,
      targetMealsPerDay: pup.targetMealsPerDay || 3,
      notes: pup.notes || '',
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) return;

    const finalBreed = formData.breed === 'Other'
      ? formData.customBreed.trim() || t.puppies.customBreed
      : formData.breed;

    const puppyData = {
      name: formData.name.trim(),
      breed: finalBreed,
      gender: formData.gender,
      expectedAdultWeightKg: formData.expectedAdultWeightKg,
      birthDate: formData.birthDate,
      dailyFoodGramGoal: formData.dailyFoodGramGoal,
      targetMealsPerDay: formData.targetMealsPerDay,
      notes: formData.notes.trim() || undefined,
    };

    if (editingPuppy) {
      onUpdatePuppy({
        ...editingPuppy,
        ...puppyData,
      });
    } else {
      onAddPuppy({
        id: `pup-${Date.now()}`,
        ...puppyData,
      });
    }
    resetForm();
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
        <Card.Content className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md shrink-0">
              <Dog className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-100 truncate">{t.puppies.title}</h2>
              <p className="text-xs text-slate-400 truncate">{t.puppies.subtitle}</p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onPress={() => (isAdding ? resetForm() : (setEditingPuppy(null), setIsAdding(true)))}
            className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {isAdding ? t.potty.cancel : t.puppies.addDog}
          </Button>
        </Card.Content>
      </Card>

      {/* Add Dog Form */}
      {isAdding && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <form onSubmit={handleSubmit}>
            <Card.Header className="p-4 sm:p-6 pb-0">
              <Card.Title className="text-white font-bold text-sm sm:text-base">{t.puppies.registerNewDog}</Card.Title>
            </Card.Header>
            <Card.Content className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    {t.puppies.dogName}
                  </label>
                  <Input
                    type="text"
                    placeholder={t.puppies.namePlaceholder}
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                  <Select value={formData.breed} onChange={(val) => setFormData((prev) => ({ ...prev, breed: val as string }))}>
                    <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100 max-h-60 overflow-y-auto">
                      <ListBox>
                        {DOG_BREEDS.map((breedOption) => (
                          <ListBoxItem key={breedOption} id={breedOption} textValue={formatBreedName(breedOption, lang)}>
                            {formatBreedName(breedOption, lang)}
                          </ListBoxItem>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  {formData.breed === 'Other' && (
                    <Input
                      type="text"
                      placeholder={t.puppies.specifyCustomBreed}
                      value={formData.customBreed}
                      onChange={(event) => setFormData((prev) => ({ ...prev, customBreed: event.target.value }))}
                      className="mt-2 bg-slate-950 border-slate-800 text-slate-100"
                    />
                  )}
                </div>

                <DogGenderAndWeightFields
                  breed={formData.breed === 'Other' ? formData.customBreed || 'Other' : formData.breed}
                  gender={formData.gender}
                  expectedWeightKg={formData.expectedAdultWeightKg}
                  onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                  t={t}
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                  <Input
                    type="date"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={formData.birthDate}
                    onChange={(event) => setFormData((prev) => ({ ...prev, birthDate: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.foodGramGoal}</label>
                  <Input
                    type="number"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={String(formData.dailyFoodGramGoal)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, dailyFoodGramGoal: Number(event.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.dashboard.targetMealsPerDay}</label>
                  <Input
                    type="number"
                    min="1"
                    max="6"
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={String(formData.targetMealsPerDay)}
                    onChange={(event) => setFormData((prev) => ({ ...prev, targetMealsPerDay: Number(event.target.value) }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                  <Input
                    type="text"
                    placeholder={t.puppies.notesPlaceholder}
                    className="bg-slate-950 border-slate-800 text-slate-100"
                    value={formData.notes}
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="tertiary"
                  onPress={resetForm}
                >
                  {t.potty.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  {t.puppies.savePuppyProfile}
                </Button>
              </div>
            </Card.Content>
          </form>
        </Card>
      )}

      {/* Puppies Grid */}
      {puppies.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 border-dashed p-10 text-center text-slate-100">
          <Card.Content className="space-y-3">
            <Dog className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">
              {t.puppies.noDogsInHousehold}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {t.puppies.clickAddDogAbove}
            </p>
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {puppies.map((pup) => {
            const isActive = pup.id === activePuppyId;
            const isEditingThis = editingPuppy?.id === pup.id;

            if (isEditingThis) {
              return (
                <Card key={pup.id} className="bg-slate-900 border-indigo-500/80 text-slate-100 ring-2 ring-indigo-500/20">
                  <Card.Content className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-indigo-400" />
                        <span>{t.puppies.editProfileTitle.replace('{name}', pup.name)}</span>
                      </h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.dogName}</label>
                          <Input
                            type="text"
                            className="bg-slate-950 border-slate-800 text-slate-100"
                            value={formData.name}
                            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
                          <Select value={formData.breed} onChange={(val) => setFormData((prev) => ({ ...prev, breed: val as string }))}>
                            <Select.Trigger className="bg-slate-950 border-slate-800 text-slate-100">
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover className="bg-slate-900 border-slate-800 text-slate-100 max-h-60 overflow-y-auto">
                              <ListBox>
                                {DOG_BREEDS.map((breedOption) => (
                                  <ListBoxItem key={breedOption} id={breedOption} textValue={formatBreedName(breedOption, lang)}>
                                    {formatBreedName(breedOption, lang)}
                                  </ListBoxItem>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>

                          {formData.breed === 'Other' && (
                            <Input
                              type="text"
                              placeholder={t.puppies.specifyCustomBreed}
                              className="bg-slate-950 border-slate-800 text-slate-100 mt-2"
                              value={formData.customBreed}
                              onChange={(event) => setFormData((prev) => ({ ...prev, customBreed: event.target.value }))}
                            />
                          )}
                        </div>

                        <DogGenderAndWeightFields
                          breed={formData.breed === 'Other' ? formData.customBreed || 'Other' : formData.breed}
                          gender={formData.gender}
                          expectedWeightKg={formData.expectedAdultWeightKg}
                          onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                          t={t}
                        />

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
                          <Input
                            type="date"
                            className="bg-slate-950 border-slate-800 text-slate-100"
                            value={formData.birthDate}
                            onChange={(event) => setFormData((prev) => ({ ...prev, birthDate: event.target.value }))}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.foodGramGoal}</label>
                          <Input
                            type="number"
                            className="bg-slate-950 border-slate-800 text-slate-100"
                            value={String(formData.dailyFoodGramGoal)}
                            onChange={(event) => setFormData((prev) => ({ ...prev, dailyFoodGramGoal: Number(event.target.value) }))}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">{t.dashboard.targetMealsPerDay}</label>
                          <Input
                            type="number"
                            min="1"
                            max="6"
                            className="bg-slate-950 border-slate-800 text-slate-100"
                            value={String(formData.targetMealsPerDay)}
                            onChange={(event) => setFormData((prev) => ({ ...prev, targetMealsPerDay: Number(event.target.value) }))}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
                          <Input
                            type="text"
                            className="bg-slate-950 border-slate-800 text-slate-100"
                            value={formData.notes}
                            onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          size="sm"
                          type="button"
                          onPress={resetForm}
                          className="bg-slate-950 border border-slate-800 text-slate-300 font-bold"
                        >
                          {t.potty.cancel}
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          variant="primary"
                        >
                          {t.puppies.updateProfile}
                        </Button>
                      </div>
                    </form>
                  </Card.Content>
                </Card>
              );
            }

            return (
              <Card
                key={pup.id}
                className={`bg-slate-900 border-slate-800 text-slate-100 ${
                  isActive ? 'border-indigo-500/80 ring-2 ring-indigo-500/20' : ''
                }`}
              >
                <Card.Content className="p-3.5 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={pup.avatarUrl || '/cocker_spaniel_mascot.jpg'}
                        alt={pup.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-indigo-500/50 shadow shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-white truncate">{pup.name}</h3>
                          {pup.gender && (
                            <span className={`text-xs font-bold ${pup.gender === 'female' ? 'text-pink-400' : 'text-blue-400'}`}>
                              {pup.gender === 'female' ? '♀' : '♂'}
                            </span>
                          )}
                          {isActive && (
                            <Chip color="success" variant="soft" size="sm">
                              {t.puppies.active}
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{formatBreedName(pup.breed, lang)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-t-0 shrink-0">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => onSelectPuppy(pup.id)}
                          className="font-bold text-xs"
                        >
                          {t.puppies.select}
                        </Button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEdit(pup)}
                        aria-label={t.puppies.editProfileBtn}
                        className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: pup.id, type: 'dog' })}
                        aria-label={t.puppies.deleteDogBtn}
                        className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-950/60 p-2.5 sm:p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-semibold">{t.puppies.foodGramGoal}</div>
                        <div className="font-bold text-slate-200">{pup.dailyFoodGramGoal || 200}{t.units.grams} ({pup.targetMealsPerDay || 3} {t.puppies.meals})</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-slate-500 font-semibold">{t.puppies.birthDate}</div>
                        <div className="font-bold text-slate-200">{pup.birthDate || t.puppies.unknownDate}</div>
                      </div>
                    </div>
                  </div>

                  {pup.notes && (
                    <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 italic font-mono">
                      "{pup.notes}"
                    </p>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) onDeletePuppy(confirmDelete.id);
        }}
        title={t.puppies.deleteDogTitle}
        message={t.puppies.deleteDogMessage}
      />
    </div>
  );
};
