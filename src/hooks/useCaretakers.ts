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
