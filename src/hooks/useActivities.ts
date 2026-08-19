import { useState, useCallback, useEffect } from 'react';
import type { Activity, PuppyProfile } from '../types';
import { fetchActivities, createActivity, updateActivity as apiUpdateActivity, deleteActivity as apiDeleteActivity } from '../services/api';
import { showToast } from '../utils/toast';
import { useI18n } from '../i18n';

export function useActivities(activePuppy: PuppyProfile | null) {
  const { t } = useI18n();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(true);

  // Fetch activities when active puppy changes
  useEffect(() => {
    if (!activePuppy?.id) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadActivities() {
      setIsLoading(true);
      // Fetch initial 30-day window (matches prediction learning history & 7-day timeline view)
      const result = await fetchActivities(activePuppy!.id, { days: 30, limit: 300, offset: 0 });
      if (isMounted && result.ok) {
        setActivities(result.data);
        setHasMoreRemote(result.data.length >= 300);
      }
      if (isMounted) {
        setIsLoading(false);
      }
    }

    loadActivities();
    return () => {
      isMounted = false;
    };
  }, [activePuppy?.id]);

  const loadMoreActivities = useCallback(async (targetDays?: number) => {
    if (!activePuppy?.id || isFetchingMore) return;
    setIsFetchingMore(true);

    const isAllTime = targetDays === Infinity;
    const requestedDays = isAllTime ? undefined : (targetDays || 90);

    const result = await fetchActivities(activePuppy.id, {
      days: requestedDays,
      limit: 500,
      offset: 0,
    });

    if (result.ok && result.data.length > 0) {
      setActivities((previous) => {
        const existingIds = new Set(previous.map((activity) => activity.id));
        const newUnique = result.data.filter((activity) => !existingIds.has(activity.id));
        return [...previous, ...newUnique];
      });
      setHasMoreRemote(result.data.length >= 500);
    } else if (result.ok) {
      setHasMoreRemote(false);
    }
    setIsFetchingMore(false);
  }, [activePuppy?.id, isFetchingMore]);

  const addActivity = useCallback(
    async (activityData: Omit<Activity, 'id'>) => {
      if (!activePuppy) {
        showToast(t.toasts.selectPuppyFirst, 'error');
        return;
      }

      const previousActivities = activities;
      const newActivity: Activity = {
        ...activityData,
        id: `act-${Date.now()}`,
        puppyId: activePuppy.id,
      };

      setActivities((previous) => [newActivity, ...previous]);

      const result = await createActivity(newActivity);
      if (result.ok) {
        setActivities((previous) => previous.map((activity) => (activity.id === newActivity.id ? result.data : activity)));
        showToast(t.toasts.activityLogged, 'success');
      } else {
        setActivities(previousActivities);
        showToast(result.error || t.toasts.errorGeneric, 'error');
      }
    },
    [activePuppy, activities, t]
  );

  const updateActivity = useCallback(async (updatedFields: Partial<Activity> & { id: string }) => {
    const previousActivities = activities;
    const target = activities.find((act) => act.id === updatedFields.id);
    if (!target) return;

    const newType = updatedFields.type || target.type;
    const isPotty = newType === 'pee' || newType === 'poop';
    const isFood = newType === 'food';
    const isWeight = newType === 'weight';
    const isMedication = newType === 'medication';

    // Construct sanitized optimistic activity without stale fields from previous types
    const optimisticActivity: Activity = {
      ...target,
      ...updatedFields,
      type: newType,
      pottyLocation: isPotty ? (updatedFields.pottyLocation ?? target.pottyLocation) : undefined,
      stoolConsistency: newType === 'poop' ? (updatedFields.stoolConsistency ?? target.stoolConsistency) : undefined,
      foodType: isFood ? (updatedFields.foodType ?? target.foodType) : undefined,
      quantityGrams: isFood ? (updatedFields.quantityGrams ?? target.quantityGrams) : undefined,
      quantityCups: isFood ? (updatedFields.quantityCups ?? target.quantityCups) : undefined,
      weightKg: isWeight ? (updatedFields.weightKg ?? target.weightKg) : undefined,
      medicationName: isMedication ? (updatedFields.medicationName ?? target.medicationName) : undefined,
    };

    setActivities((previous) => previous.map((activity) => (activity.id === updatedFields.id ? optimisticActivity : activity)));

    const result = await apiUpdateActivity(updatedFields);
    if (result.ok) {
      setActivities((previous) => previous.map((activity) => (activity.id === updatedFields.id ? result.data : activity)));
      showToast(t.toasts.activityUpdated, 'success');
    } else {
      setActivities(previousActivities);
      showToast(result.error || t.toasts.errorGeneric, 'error');
    }
  }, [activities, t]);

  const deleteActivity = useCallback(
    async (id: string) => {
      const previousActivities = activities;
      setActivities((previous) => previous.filter((activity) => activity.id !== id));

      const result = await apiDeleteActivity(id);
      if (result.ok) {
        showToast(t.toasts.activityDeleted, 'info');
      } else {
        setActivities(previousActivities);
        showToast(result.error || t.toasts.errorGeneric, 'error');
      }
    },
    [activities, t]
  );

  return {
    activities,
    setActivities,
    isLoadingActivities: isLoading,
    hasMoreRemoteActivities: hasMoreRemote,
    isFetchingMoreActivities: isFetchingMore,
    loadMoreActivities,
    addActivity,
    updateActivity,
    deleteActivity,
  };
}
