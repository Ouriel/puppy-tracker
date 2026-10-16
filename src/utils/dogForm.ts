import type { PuppyProfile } from '../types';
import { DOG_BREEDS } from '../data/breedsCatalog';

/** Breeds with no standard to read the adult weight from: the owner types it. */
export const BREEDS_WITH_TYPED_ADULT_WEIGHT = ['Other', 'Mixed Breed', 'Unknown Breed'];

/** The Réglages > Chiens add / edit form. */
export interface DogForm {
  name: string;
  breed: string; // a DOG_BREEDS entry, '' until one is picked
  customBreed: string;
  gender?: 'female' | 'male';
  expectedAdultWeightKg?: number;
  birthDate: string; // YYYY-MM-DD, '' until entered
  hasGramGoal: boolean; // false: 'No gram goal', meals are only counted (stored as 0)
  dailyFoodGramGoal: string; // as typed
  targetMealsPerDay: string; // as typed; a new dog's is set from its birth date
  notes: string;
}

// No breed or birth date until the owner enters them: a made-up one would skew the growth curve and predictions.
export const NEW_DOG_FORM: DogForm = {
  name: '',
  breed: '',
  customBreed: '',
  birthDate: '',
  hasGramGoal: true,
  dailyFoodGramGoal: '',
  targetMealsPerDay: '',
  notes: '',
};

/** The edit form of a stored dog. */
export function dogFormFromProfile(puppy: PuppyProfile): DogForm {
  const isStandard = DOG_BREEDS.includes(puppy.breed);
  return {
    name: puppy.name,
    breed: isStandard ? puppy.breed : 'Other',
    customBreed: isStandard ? '' : puppy.breed,
    gender: puppy.gender || undefined,
    expectedAdultWeightKg: puppy.expectedAdultWeightKg ?? undefined,
    birthDate: puppy.birthDate,
    hasGramGoal: puppy.dailyFoodGramGoal > 0,
    dailyFoodGramGoal: puppy.dailyFoodGramGoal > 0 ? String(puppy.dailyFoodGramGoal) : '',
    targetMealsPerDay: String(puppy.targetMealsPerDay || 3),
    notes: puppy.notes || '',
  };
}

export interface DogFormError {
  field: 'name' | 'breed' | 'birthDate' | 'dailyFoodGramGoal' | 'targetMealsPerDay';
  messageKey: 'nameRequired' | 'breedRequired' | 'birthDateRequired' | 'birthDateInFuture' | 'gramGoalInvalid' | 'mealsPerDayInvalid';
}

const isWholeNumberBetween = (text: string, min: number, max: number) =>
  /^\d+$/.test(text.trim()) && Number(text) >= min && Number(text) <= max;

/** Every field that blocks the save, in the form's order (empty: it saves). `today`: the phone's local date, YYYY-MM-DD. */
export function validateDogForm(form: DogForm, today: string): DogFormError[] {
  const errors: DogFormError[] = [];
  if (!form.name.trim()) errors.push({ field: 'name', messageKey: 'nameRequired' });
  if (!form.breed) errors.push({ field: 'breed', messageKey: 'breedRequired' });
  if (!form.birthDate) errors.push({ field: 'birthDate', messageKey: 'birthDateRequired' });
  else if (form.birthDate > today) errors.push({ field: 'birthDate', messageKey: 'birthDateInFuture' });
  if (form.hasGramGoal && !isWholeNumberBetween(form.dailyFoodGramGoal, 10, 2000)) {
    errors.push({ field: 'dailyFoodGramGoal', messageKey: 'gramGoalInvalid' });
  }
  if (!isWholeNumberBetween(form.targetMealsPerDay, 1, 6)) errors.push({ field: 'targetMealsPerDay', messageKey: 'mealsPerDayInvalid' });
  return errors;
}

/** The dog fields sent to POST / PUT /api/dogs. `storedPuppy`: the dog being edited. */
export function buildDogPayload(form: DogForm, storedPuppy?: PuppyProfile): Omit<PuppyProfile, 'id'> {
  // 'Other' with no name stays 'Other' (shown as 'Autre' in French), never a screen label in one language
  const breed = form.breed === 'Other' ? form.customBreed.trim() || 'Other' : form.breed;
  // The adult weight is typed for Other / Mixed / Unknown only (emptied = cleared). Other breeds use their standard,
  // except a stored dog whose breed is unchanged: it keeps the value it already stores.
  const hasTypedAdultWeight = BREEDS_WITH_TYPED_ADULT_WEIGHT.includes(form.breed);
  const keepsStoredAdultWeight = !hasTypedAdultWeight && storedPuppy?.breed === breed;
  return {
    name: form.name.trim(),
    breed,
    gender: form.gender ?? null, // null, not undefined: an edit that unselects the sex must clear it
    ...(keepsStoredAdultWeight ? {} : { expectedAdultWeightKg: hasTypedAdultWeight ? form.expectedAdultWeightKg ?? null : null }),
    birthDate: form.birthDate,
    dailyFoodGramGoal: form.hasGramGoal ? Number(form.dailyFoodGramGoal) : 0,
    targetMealsPerDay: Number(form.targetMealsPerDay),
    notes: form.notes.trim(), // '' clears a stored note
  };
}
