import { useState, useCallback, useMemo } from 'react';
import type { Caretaker, UserAccount } from '../types';
import { getStoredCaretakers } from '../utils/storage';
import { createCaretaker, updateCaretaker as apiUpdateCaretaker, deleteCaretaker as apiDeleteCaretaker } from '../services/api';
import { showToast } from '../utils/toast';
import { useI18n } from '../i18n';

export function useCaretakers(
  user: UserAccount | null = null,
  initialCaretakers: Caretaker[] = getStoredCaretakers()
) {
  const { t } = useI18n();
  const [caretakers, setCaretakers] = useState<Caretaker[]>(initialCaretakers);

  const currentUser = useMemo(() => {
    if (!user) return 'Unknown';
    const matchedCaretaker = caretakers.find(
      (c) =>
        (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase()) ||
        (c.name && user.name && c.name.toLowerCase() === user.name.toLowerCase())
    );
    if (matchedCaretaker) return matchedCaretaker.name;
    return user.name || (user.email ? user.email.split('@')[0] : 'Unknown');
  }, [user, caretakers]);

  const addCaretaker = useCallback(
    async (caretaker: Caretaker) => {
      const previousCaretakers = caretakers;
      setCaretakers((prev) => [...prev, caretaker]);
      try {
        await createCaretaker(caretaker);
        showToast(t.toasts.memberAdded, 'success');
      } catch {
        setCaretakers(previousCaretakers);
        showToast(t.toasts.errorGeneric || 'Failed to add — changes reverted', 'error');
      }
    },
    [caretakers, t.toasts.memberAdded, t.toasts.errorGeneric]
  );

  const updateCaretaker = useCallback(async (id: string, updatedFields: Partial<Caretaker>) => {
    const previousCaretakers = caretakers;
    setCaretakers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updatedFields } : c)));
    try {
      await apiUpdateCaretaker({ id, ...updatedFields });
    } catch {
      setCaretakers(previousCaretakers);
      showToast(t.toasts.errorGeneric || 'Update failed — changes reverted', 'error');
    }
  }, [caretakers, t.toasts.errorGeneric]);

  const deleteCaretaker = useCallback(
    async (id: string) => {
      const previousCaretakers = caretakers;
      setCaretakers((prev) => prev.filter((c) => c.id !== id));
      try {
        await apiDeleteCaretaker(id);
        showToast(t.toasts.memberRemoved, 'info');
      } catch {
        setCaretakers(previousCaretakers);
        showToast(t.toasts.errorGeneric || 'Delete failed — changes reverted', 'error');
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
