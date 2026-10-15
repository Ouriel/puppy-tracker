import { useState, useCallback, useTransition } from 'react';
import { toast } from '@heroui/react';
import type { PuppyProfile } from '../types';
import { getActivePuppyId, setActivePuppyId as saveActivePuppyId, getStoredPuppies, setStoredPuppies } from '../utils/storage';
import { createDog, updateDog, deleteDog, restoreDog } from '../services/api';
import { useI18n } from '../i18n';

export function usePuppies(initialPuppies?: PuppyProfile[]) {
  const { t } = useI18n();
  const [, startTransition] = useTransition();
  const [puppies, setPuppiesState] = useState<PuppyProfile[]>(() => {
    if (initialPuppies && initialPuppies.length > 0) return initialPuppies;
    return getStoredPuppies();
  });
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId());
  // The owner's deleted dogs (the server hides them from everyone), listed in Settings to restore one
  const [deletedPuppies, setDeletedPuppies] = useState<PuppyProfile[]>([]);

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
      const target = puppies.find((puppy) => puppy.id === updatedPup.id);
      setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? updatedPup : puppy)));
      const result = await updateDog(updatedPup);
      if (result.ok) {
        setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? result.data : puppy)));
        toast.success(t.toasts.dogUpdated);
        return true;
      }
      // Only this dog goes back: a later change the server saved stays
      setPuppies((previous) => previous.map((puppy) => (puppy.id === updatedPup.id ? target ?? puppy : puppy)));
      toast.danger(t.toasts[result.errorKey]);
      return false;
    },
    [puppies, setPuppies, t.toasts]
  );

  const deletePuppy = useCallback(
    async (id: string) => {
      const index = puppies.findIndex((puppy) => puppy.id === id);
      const removed = puppies[index];
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
        if (removed) setDeletedPuppies((previous) => [...previous.filter((puppy) => puppy.id !== id), removed]);
        toast(t.toasts.dogDeleted);
      } else {
        // Back in its place, unless a reload already brought it back
        if (removed) setPuppies((previous) => (previous.some((puppy) => puppy.id === id) ? previous : previous.toSpliced(index, 0, removed)));
        toast.danger(t.toasts[result.errorKey]);
      }
    },
    [activePuppyId, puppies, setPuppies, t.toasts]
  );

  // Not optimistic: the dog comes back once the server restored it
  const restorePuppy = useCallback(
    async (id: string) => {
      const result = await restoreDog(id);
      if (!result.ok) {
        toast.danger(t.toasts[result.errorKey]);
        return;
      }
      const restored = result.data;
      setDeletedPuppies((previous) => previous.filter((puppy) => puppy.id !== id));
      setPuppies((previous) => [...previous.filter((puppy) => puppy.id !== id), restored]);
      toast.success(t.toasts.dogRestored.replace('{name}', restored.name));
    },
    [setPuppies, t.toasts]
  );

  return {
    puppies,
    setPuppies,
    deletedPuppies,
    setDeletedPuppies,
    activePuppyId,
    setActivePuppyIdState,
    activePuppy,
    selectPuppy,
    addPuppy,
    updatePuppy,
    deletePuppy,
    restorePuppy,
  };
}
