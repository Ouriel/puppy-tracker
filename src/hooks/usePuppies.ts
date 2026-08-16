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

  const activePuppy = puppies.find((p) => p.id === activePuppyId) || puppies[0] || null;

  const selectPuppy = useCallback((id: string) => {
    startTransition(() => {
      setActivePuppyIdState(id);
      saveActivePuppyId(id);
    });
  }, []);

  const addPuppy = useCallback(
    async (newPup: PuppyProfile) => {
      const saved = await createDog(newPup);
      const pupToUse = saved || newPup;
      setPuppies((prev) => [...prev, pupToUse]);
      setActivePuppyIdState(pupToUse.id);
      saveActivePuppyId(pupToUse.id);
      showToast(t.toasts.dogRegistered.replace('{name}', pupToUse.name), 'success');
      return pupToUse;
    },
    [t.toasts.dogRegistered]
  );

  const updatePuppy = useCallback(
    async (updatedPup: PuppyProfile) => {
      setPuppies((prev) => prev.map((p) => (p.id === updatedPup.id ? updatedPup : p)));
      await updateDog(updatedPup);
      showToast(t.toasts.dogUpdated, 'success');
    },
    [t.toasts.dogUpdated]
  );

  const deletePuppy = useCallback(
    async (id: string) => {
      setPuppies((prev) => prev.filter((p) => p.id !== id));
      await deleteDog(id);
      if (activePuppyId === id) {
        const remaining = puppies.filter((p) => p.id !== id);
        if (remaining.length > 0) {
          setActivePuppyIdState(remaining[0].id);
          saveActivePuppyId(remaining[0].id);
        }
      }
      showToast(t.toasts.dogDeleted, 'info');
    },
    [activePuppyId, puppies, t.toasts.dogDeleted]
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
