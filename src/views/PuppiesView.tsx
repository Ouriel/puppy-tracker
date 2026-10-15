import React, { useState } from 'react';
import type { PuppyProfile } from '../types';
import { Dog, Plus, Trash2, Pencil, Utensils, Calendar } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatBreedName, DOG_BREEDS } from '../data/breedsCatalog';
import { BREEDS_WITH_TYPED_ADULT_WEIGHT, NEW_DOG_FORM, buildDogPayload, dogFormFromProfile, validateDogForm, type DogForm, type DogFormError } from '../utils/dogForm';
import { formatLocalDate } from '../utils/date';
import { getRecommendedMealsPerDay } from '../utils/predictions';
import { getExpectedAdultWeight } from '../utils/weight';
import { Card, Button, Input, Select, ListBox, ListBoxItem, Chip } from '@heroui/react';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

const inputErrorClass = 'mt-1.5 text-xs font-semibold text-rose-400';

interface PuppiesViewProps {
  puppies: PuppyProfile[];
  activePuppyId: string;
  onSelectPuppy: (id: string) => void;
  onAddPuppy: (puppy: PuppyProfile) => Promise<boolean>;
  onUpdatePuppy: (puppy: PuppyProfile) => Promise<boolean>;
  onDeletePuppy: (id: string) => void;
}

const DogGenderAndWeightFields: React.FC<{
  breed: string;
  gender?: 'female' | 'male';
  expectedWeightKg?: number;
  onChange: (patch: { gender?: 'female' | 'male'; expectedAdultWeightKg?: number }) => void;
  t: ReturnType<typeof useI18n>['t'];
}> = ({ breed, gender, expectedWeightKg, onChange, t }) => {
  const isCustomOrMixed = BREEDS_WITH_TYPED_ADULT_WEIGHT.includes(breed);

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
        {!isCustomOrMixed && breed && (
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
            <span>{t.puppies.standardAdultWeight}:</span>
            <span className="font-semibold text-slate-200">~{standardWeight} kg</span>
          </p>
        )}
      </div>

      {isCustomOrMixed && (
        <div>
          <label htmlFor="dog-adult-weight" className="block text-xs font-semibold text-slate-400 mb-1">
            {t.puppies.expectedAdultWeight} (kg)
          </label>
          <Input
            id="dog-adult-weight"
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
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<DogForm>(NEW_DOG_FORM);
  const [formError, setFormError] = useState<DogFormError | null>(null);

  const resetForm = () => {
    setFormData(NEW_DOG_FORM);
    setFormError(null);
    setIsAdding(false);
    setEditingPuppy(null);
  };

  // Always blank, even when pressed while a dog is being edited
  const handleStartAdd = () => {
    setFormData(NEW_DOG_FORM);
    setFormError(null);
    setEditingPuppy(null);
    setIsAdding(true);
  };

  const handleStartEdit = (pup: PuppyProfile) => {
    setIsAdding(false);
    setEditingPuppy(pup);
    setFormData(dogFormFromProfile(pup));
    setFormError(null);
  };

  // A new dog's meals per day follow its age (4 / 3 / 2, as the engine assumes), still editable; a stored dog keeps its own.
  const handleBirthDateChange = (birthDate: string) => {
    setFormData((prev) => ({
      ...prev,
      birthDate,
      ...(isAdding && birthDate ? { targetMealsPerDay: String(getRecommendedMealsPerDay(birthDate)) } : {}),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Checked before sending, so a refusal never costs what was typed
    const error = validateDogForm(formData, formatLocalDate());
    setFormError(error);
    if (error) return;

    const puppyData = buildDogPayload(formData, editingPuppy ?? undefined);
    setIsSaving(true);
    const isSaved = editingPuppy
      ? await onUpdatePuppy({ ...editingPuppy, ...puppyData })
      : await onAddPuppy({ id: `pup-${Date.now()}`, ...puppyData });
    setIsSaving(false);
    // Refused by the server: keep the form open with what was typed (the toast says why)
    if (isSaved) resetForm();
  };

  const errorFor = (field: DogFormError['field']) =>
    formError?.field === field ? t.puppies[formError.messageKey] : null;
  const nameError = errorFor('name');
  const breedError = errorFor('breed');
  const birthDateError = errorFor('birthDate');
  // Not once "No gram goal" is ticked: the box it was about is gone
  const goalError = formData.hasGramGoal ? errorFor('dailyFoodGramGoal') : null;
  const mealsError = errorFor('targetMealsPerDay');

  // The add and edit forms show the same fields (only one form is open at a time).
  const formFields = (
    <>
      <div>
        <label htmlFor="dog-name" className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.dogName}</label>
        <Input
          id="dog-name"
          type="text"
          placeholder={t.puppies.namePlaceholder}
          className="bg-slate-950 border-slate-800 text-slate-100"
          value={formData.name}
          onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'dog-name-error' : undefined}
        />
        {nameError && <p id="dog-name-error" role="alert" className={inputErrorClass}>{nameError}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.breed}</label>
        <Select
          value={formData.breed || null}
          onChange={(value) => setFormData((prev) => ({ ...prev, breed: (value as string | null) ?? '' }))}
          placeholder={t.puppies.chooseBreed}
          aria-label={t.puppies.breed}
          isInvalid={!!breedError}
          aria-describedby={breedError ? 'dog-breed-error' : undefined}
        >
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
            id="dog-custom-breed"
            type="text"
            placeholder={t.puppies.specifyCustomBreed}
            value={formData.customBreed}
            onChange={(event) => setFormData((prev) => ({ ...prev, customBreed: event.target.value }))}
            className="mt-2 bg-slate-950 border-slate-800 text-slate-100"
          />
        )}
        {breedError && <p id="dog-breed-error" role="alert" className={inputErrorClass}>{breedError}</p>}
      </div>

      <DogGenderAndWeightFields
        breed={formData.breed}
        gender={formData.gender}
        expectedWeightKg={formData.expectedAdultWeightKg}
        onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
        t={t}
      />

      <div>
        <label htmlFor="dog-birth-date" className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.birthDate}</label>
        <Input
          id="dog-birth-date"
          type="date"
          className="bg-slate-950 border-slate-800 text-slate-100"
          max={formatLocalDate()}
          value={formData.birthDate}
          onChange={(event) => handleBirthDateChange(event.target.value)}
          required
          aria-invalid={birthDateError ? true : undefined}
          aria-describedby={birthDateError ? 'dog-birth-date-error' : undefined}
        />
        {birthDateError && <p id="dog-birth-date-error" role="alert" className={inputErrorClass}>{birthDateError}</p>}
      </div>

      <div>
        <label htmlFor="dog-food-goal" className="block text-xs font-semibold text-slate-400 mb-1">{t.puppies.foodGramGoal}</label>
        {formData.hasGramGoal && (
          <Input
            id="dog-food-goal"
            type="number"
            inputMode="numeric"
            min="10"
            max="2000"
            className="bg-slate-950 border-slate-800 text-slate-100"
            value={formData.dailyFoodGramGoal}
            onChange={(event) => setFormData((prev) => ({ ...prev, dailyFoodGramGoal: event.target.value }))}
            aria-invalid={goalError ? true : undefined}
            aria-describedby={goalError ? 'dog-food-goal-error' : undefined}
          />
        )}
        <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-300">
          <input
            id="dog-no-gram-goal"
            type="checkbox"
            className="accent-indigo-500"
            checked={!formData.hasGramGoal}
            onChange={(event) => setFormData((prev) => ({ ...prev, hasGramGoal: !event.target.checked }))}
          />
          {t.puppies.noGramGoal}
        </label>
        {goalError && <p id="dog-food-goal-error" role="alert" className={inputErrorClass}>{goalError}</p>}
      </div>

      <div>
        <label htmlFor="dog-meals-per-day" className="block text-xs font-semibold text-slate-400 mb-1">{t.dashboard.targetMealsPerDay}</label>
        <Input
          id="dog-meals-per-day"
          type="number"
          min="1"
          max="6"
          className="bg-slate-950 border-slate-800 text-slate-100"
          inputMode="numeric"
          value={formData.targetMealsPerDay}
          onChange={(event) => setFormData((prev) => ({ ...prev, targetMealsPerDay: event.target.value }))}
          aria-invalid={mealsError ? true : undefined}
          aria-describedby={mealsError ? 'dog-meals-per-day-error' : undefined}
        />
        {mealsError && <p id="dog-meals-per-day-error" role="alert" className={inputErrorClass}>{mealsError}</p>}
      </div>

      <div>
        <label htmlFor="dog-notes" className="block text-xs font-semibold text-slate-400 mb-1">{t.potty.notes}</label>
        <Input
          id="dog-notes"
          type="text"
          placeholder={t.puppies.notesPlaceholder}
          className="bg-slate-950 border-slate-800 text-slate-100"
          value={formData.notes}
          onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
        />
      </div>
    </>
  );

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
            onPress={isAdding ? resetForm : handleStartAdd}
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
          <form onSubmit={handleSubmit} noValidate>
            <Card.Header className="p-4 sm:p-6 pb-0">
              <Card.Title className="text-white font-bold text-sm sm:text-base">{t.puppies.registerNewDog}</Card.Title>
            </Card.Header>
            <Card.Content className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formFields}
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
                  isDisabled={isSaving}
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

                    <form onSubmit={handleSubmit} noValidate className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {formFields}
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
                          isDisabled={isSaving}
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
                      {pup.avatarUrl ? (
                        <img
                          src={pup.avatarUrl}
                          alt={pup.name}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-indigo-500/50 shadow shrink-0"
                        />
                      ) : (
                        // No photo: the dog's initial (the cocker mascot looked like every dog's photo)
                        <div
                          id={`dog-avatar-${pup.id}`}
                          aria-hidden="true"
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-black ring-2 ring-indigo-500/50 shadow shrink-0"
                        >
                          {pup.name.charAt(0).toUpperCase()}
                        </div>
                      )}
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
                        <div className="text-[10px] text-slate-500 font-semibold">
                          {pup.dailyFoodGramGoal > 0 ? t.puppies.foodGramGoal : t.puppies.mealsPerDay}
                        </div>
                        <div className="font-bold text-slate-200">
                          {pup.dailyFoodGramGoal > 0
                            ? `${pup.dailyFoodGramGoal}${t.units.grams} (${pup.targetMealsPerDay || 3} ${t.puppies.meals})`
                            : `${pup.targetMealsPerDay || 3} ${t.puppies.meals}`}
                        </div>
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
