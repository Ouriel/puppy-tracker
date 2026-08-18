import { useState, useCallback, useTransition } from 'react';
import type { PuppyProfile } from '../types';
import { getActivePuppyId, setActivePuppyId as saveActivePuppyId } from '../utils/storage';
import { createDog, updateDog, deleteDog } from '../services/api';
import { showToast } from '../utils/toast';
import { useI18n } from '../i18n';

export function usePuppies(initialPuppies: PuppyProfile[] = []) {
  const { t } = useI18n();
  const [, startTransition] = useTransition();
  const [puppies, setPuppies] = useState<PuppyProfile[]>(initialPuppies);
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId());

  const activePuppy = puppies.find((puppy) => puppy.id === activePuppyId) || puppies[0] || null;

  const selectPuppy = useCallback((id: string) => {
    startTransition(() => {
      setActivePuppyIdState(id);
      saveActivePuppyId(id);
    });
  }, []);

  const addPuppy = useCallback(
    async (newPup: PuppyProfile) => {
      const result = await createDog(newPup);
      if (result.ok) {
        const saved = result.data;
        setPuppies((previous) => [...previous, saved]);
        setActivePuppyIdState(saved.id);
        saveActivePuppyId(saved.id);
        showToast(t.toasts.dogRegistered.replace('{name}', saved.name), 'success');
        return saved;
      } else {
        showToast(result.error || t.toasts.errorGeneric, 'error');
        return null;
      }
    },
    [t.toasts.dogRegistered, t.toasts.errorGeneric]
  );

  const updatePuppy = useCallback(
    async (updatedPup: PuppyProfile) => {
      const previousPuppies = puppies;
      setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? updatedPup : puppy)));
      const result = await updateDog(updatedPup);
      if (result.ok) {
        setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? result.data : puppy)));
        showToast(t.toasts.dogUpdated, 'success');
      } else {
        setPuppies(previousPuppies);
        showToast(result.error || t.toasts.errorGeneric, 'error');
      }
    },
    [puppies, t.toasts.dogUpdated, t.toasts.errorGeneric]
  );

  const deletePuppy = useCallback(
    async (id: string) => {
      const previousPuppies = puppies;
      setPuppies((previous) => previous.filter((puppy) => puppy.id !== id));
      const result = await deleteDog(id);
      if (result.ok) {
        if (activePuppyId === id) {
          const remaining = puppies.filter((puppy) => puppy.id !== id);
          if (remaining.length > 0) {
            setActivePuppyIdState(remaining[0].id);
            saveActivePuppyId(remaining[0].id);
          }
        }
        showToast(t.toasts.dogDeleted, 'info');
      } else {
        setPuppies(previousPuppies);
        showToast(result.error || t.toasts.errorGeneric, 'error');
      }
    },
    [activePuppyId, puppies, t.toasts.dogDeleted, t.toasts.errorGeneric]
  );

  return {
    puppies,
    setPuppies,
    activePuppyId,
    setActivePuppyIdState,
    activePuppy,
    selectPuppy,
    addPuppy,
    updatePuppy,
    deletePuppy,
  };
}
