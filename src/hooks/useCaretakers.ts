import { useState, useCallback, useMemo } from 'react';
import { toast } from '@heroui/react';
import type { Caretaker, UserAccount } from '../types';
import { getStoredCaretakers, setStoredCaretakers } from '../utils/storage';
import { getCurrentCaretakerName } from '../utils/caretakers';
import { createCaretaker, updateCaretaker as apiUpdateCaretaker, deleteCaretaker as apiDeleteCaretaker } from '../services/api';
import { useI18n } from '../i18n';

export function useCaretakers(
  user: UserAccount | null = null,
  initialCaretakers: Caretaker[] = getStoredCaretakers()
) {
  const { t } = useI18n();
  const [caretakers, setCaretakersState] = useState<Caretaker[]>(initialCaretakers);

  const setCaretakers = useCallback((updaterOrValue: Caretaker[] | ((previous: Caretaker[]) => Caretaker[])) => {
    setCaretakersState((previous) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(previous) : updaterOrValue;
      setStoredCaretakers(next);
      return next;
    });
  }, []);

  const currentUser = useMemo(() => getCurrentCaretakerName(user, caretakers), [user, caretakers]);

  const addCaretaker = useCallback(
    async (caretaker: Caretaker) => {
      setCaretakers((previous) => [...previous, caretaker]);
      const result = await createCaretaker(caretaker);
      if (result.ok) {
        toast.success(t.toasts.memberAdded);
      } else {
        setCaretakers((previous) => previous.filter((item) => item.id !== caretaker.id));
        toast.danger(result.error || t.toasts.errorGeneric);
      }
    },
    [setCaretakers, t.toasts.memberAdded, t.toasts.errorGeneric]
  );

  const updateCaretaker = useCallback(async (id: string, updatedFields: Partial<Caretaker>) => {
    const target = caretakers.find((caretaker) => caretaker.id === id);
    setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? { ...caretaker, ...updatedFields } : caretaker)));
    const result = await apiUpdateCaretaker({ id, ...updatedFields });
    if (result.ok) {
      setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? result.data : caretaker)));
    } else {
      // Only this badge goes back: a later change the server saved stays
      setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? target ?? caretaker : caretaker)));
      toast.danger(result.error || t.toasts.errorGeneric);
    }
  }, [caretakers, setCaretakers, t.toasts.errorGeneric]);

  const deleteCaretaker = useCallback(
    async (id: string) => {
      const index = caretakers.findIndex((caretaker) => caretaker.id === id);
      const removed = caretakers[index];
      setCaretakers((previous) => previous.filter((caretaker) => caretaker.id !== id));
      const result = await apiDeleteCaretaker(id);
      if (result.ok) {
        toast(t.toasts.memberRemoved);
      } else {
        // Back in its place, unless a reload already brought it back
        if (removed) setCaretakers((previous) => (previous.some((caretaker) => caretaker.id === id) ? previous : previous.toSpliced(index, 0, removed)));
        toast.danger(result.error || t.toasts.errorGeneric);
      }
    },
    [caretakers, setCaretakers, t.toasts.memberRemoved, t.toasts.errorGeneric]
  );

  return {
    caretakers,
    setCaretakers,
    currentUser,
    addCaretaker,
    updateCaretaker,
    deleteCaretaker,
  };
}
