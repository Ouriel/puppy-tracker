import { useState, useCallback, useTransition } from 'react';
import { toast } from '@heroui/react';
import type { PuppyProfile } from '../types';
import { getActivePuppyId, setActivePuppyId as saveActivePuppyId, getStoredPuppies, setStoredPuppies } from '../utils/storage';
import { createDog, updateDog, deleteDog } from '../services/api';
import { useI18n } from '../i18n';

export function usePuppies(initialPuppies?: PuppyProfile[]) {
  const { t } = useI18n();
  const [, startTransition] = useTransition();
  const [puppies, setPuppiesState] = useState<PuppyProfile[]>(() => {
    if (initialPuppies && initialPuppies.length > 0) return initialPuppies;
    return getStoredPuppies();
  });
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId());

  const setPuppies = useCallback((updaterOrValue: PuppyProfile[] | ((previous: PuppyProfile[]) => PuppyProfile[])) => {
    setPuppiesState((previous) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(previous) : updaterOrValue;
      setStoredPuppies(next);
      return next;
    });
  }, []);

  const activePuppy = puppies.find((puppy) => puppy.id === activePuppyId) || puppies[0] || null;

  const selectPuppy = useCallback((id: string) => {
    startTransition(() => {
      setActivePuppyIdState(id);
      saveActivePuppyId(id);
    });
  }, []);

  // Both resolve to whether the server saved the dog: the form stays open with what was typed when it did not.
  const addPuppy = useCallback(
    async (newPup: PuppyProfile): Promise<boolean> => {
      const result = await createDog(newPup);
      if (result.ok) {
        const saved = result.data;
        setPuppiesState((previous) => {
          const updated = [...previous, saved];
          setStoredPuppies(updated);
          return updated;
        });
        setActivePuppyIdState(saved.id);
        saveActivePuppyId(saved.id);
        toast.success(t.toasts.dogRegistered.replace('{name}', saved.name));
        return true;
      } else {
        toast.danger(t.toasts[result.errorKey]);
        return false;
      }
    },
    [t.toasts]
  );

  const updatePuppy = useCallback(
    async (updatedPup: PuppyProfile): Promise<boolean> => {
      const previousPuppies = puppies;
      setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? updatedPup : puppy)));
      const result = await updateDog(updatedPup);
      if (result.ok) {
        setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? result.data : puppy)));
        toast.success(t.toasts.dogUpdated);
        return true;
      }
      setPuppies(previousPuppies);
      toast.danger(t.toasts[result.errorKey]);
      return false;
    },
    [puppies, setPuppies, t.toasts]
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
        toast(t.toasts.dogDeleted);
      } else {
        setPuppies(previousPuppies);
        toast.danger(t.toasts[result.errorKey]);
      }
    },
    [activePuppyId, puppies, setPuppies, t.toasts]
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
