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
      const previousCaretakers = caretakers;
      setCaretakers((previous) => [...previous, caretaker]);
      const result = await createCaretaker(caretaker);
      if (result.ok) {
        toast.success(t.toasts.memberAdded);
      } else {
        setCaretakers(previousCaretakers);
        toast.danger(t.toasts[result.errorKey]);
      }
    },
    [caretakers, setCaretakers, t.toasts]
  );

  const updateCaretaker = useCallback(async (id: string, updatedFields: Partial<Caretaker>) => {
    const previousCaretakers = caretakers;
    setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? { ...caretaker, ...updatedFields } : caretaker)));
    const result = await apiUpdateCaretaker({ id, ...updatedFields });
    if (result.ok) {
      setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? result.data : caretaker)));
    } else {
      setCaretakers(previousCaretakers);
      toast.danger(t.toasts[result.errorKey]);
    }
  }, [caretakers, setCaretakers, t.toasts]);

  const deleteCaretaker = useCallback(
    async (id: string) => {
      const previousCaretakers = caretakers;
      setCaretakers((previous) => previous.filter((caretaker) => caretaker.id !== id));
      const result = await apiDeleteCaretaker(id);
      if (result.ok) {
        toast(t.toasts.memberRemoved);
      } else {
        setCaretakers(previousCaretakers);
        toast.danger(t.toasts[result.errorKey]);
      }
    },
    [caretakers, setCaretakers, t.toasts]
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
