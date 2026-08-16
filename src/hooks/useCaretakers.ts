import { useState, useCallback } from 'react';
import type { Caretaker } from '../types';
import { getStoredCaretakers } from '../utils/storage';
import { createCaretaker, updateCaretaker as apiUpdateCaretaker, deleteCaretaker as apiDeleteCaretaker } from '../services/api';
import { showToast } from '../utils/toast';
import { useI18n } from '../i18n';

export function useCaretakers(initialCaretakers: Caretaker[] = getStoredCaretakers()) {
  const { t } = useI18n();
  const [caretakers, setCaretakers] = useState<Caretaker[]>(initialCaretakers);
  const [currentUser] = useState<string>('Matthieu');

  const addCaretaker = useCallback(
    async (caretaker: Caretaker) => {
      setCaretakers((prev) => [...prev, caretaker]);
      await createCaretaker(caretaker);
      showToast(t.toasts.memberAdded, 'success');
    },
    [t.toasts.memberAdded]
  );

  const updateCaretaker = useCallback(async (id: string, updatedFields: Partial<Caretaker>) => {
    setCaretakers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updatedFields } : c)));
    await apiUpdateCaretaker({ id, ...updatedFields });
  }, []);

  const deleteCaretaker = useCallback(
    async (id: string) => {
      setCaretakers((prev) => prev.filter((c) => c.id !== id));
      await apiDeleteCaretaker(id);
      showToast(t.toasts.memberRemoved, 'info');
    },
    [t.toasts.memberRemoved]
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
