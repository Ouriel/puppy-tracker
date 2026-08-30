import { useState, useCallback, useMemo } from 'react';
import type { Caretaker, UserAccount } from '../types';
import { getStoredCaretakers, setStoredCaretakers } from '../utils/storage';
import { createCaretaker, updateCaretaker as apiUpdateCaretaker, deleteCaretaker as apiDeleteCaretaker } from '../services/api';
import { showToast } from '../utils/toast';
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

  const currentUser = useMemo(() => {
    if (!user) return 'Unknown';
    const matchedCaretaker = caretakers.find(
      (item) =>
        (item.email && user.email && item.email.toLowerCase() === user.email.toLowerCase()) ||
        (item.name && user.name && item.name.toLowerCase() === user.name.toLowerCase())
    );
    if (matchedCaretaker) return matchedCaretaker.name;
    return user.name || (user.email ? user.email.split('@')[0] : 'Unknown');
  }, [user, caretakers]);

  const addCaretaker = useCallback(
    async (caretaker: Caretaker) => {
      const previousCaretakers = caretakers;
      setCaretakers((previous) => [...previous, caretaker]);
      const result = await createCaretaker(caretaker);
      if (result.ok) {
        showToast(t.toasts.memberAdded, 'success');
      } else {
        setCaretakers(previousCaretakers);
        showToast(result.error || t.toasts.errorGeneric, 'error');
      }
    },
    [caretakers, t.toasts.memberAdded, t.toasts.errorGeneric]
  );

  const updateCaretaker = useCallback(async (id: string, updatedFields: Partial<Caretaker>) => {
    const previousCaretakers = caretakers;
    setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? { ...caretaker, ...updatedFields } : caretaker)));
    const result = await apiUpdateCaretaker({ id, ...updatedFields });
    if (result.ok) {
      setCaretakers((previous) => previous.map((caretaker) => (caretaker.id === id ? result.data : caretaker)));
    } else {
      setCaretakers(previousCaretakers);
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  }, [caretakers, t.toasts.errorGeneric]);

  const deleteCaretaker = useCallback(
    async (id: string) => {
      const previousCaretakers = caretakers;
      setCaretakers((previous) => previous.filter((caretaker) => caretaker.id !== id));
      const result = await apiDeleteCaretaker(id);
      if (result.ok) {
        showToast(t.toasts.memberRemoved, 'info');
      } else {
        setCaretakers(previousCaretakers);
        showToast(result.error || t.toasts.errorGeneric, 'error');
      }
    },
    [caretakers, t.toasts.memberRemoved, t.toasts.errorGeneric]
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
