import { useState, useCallback, useEffect } from 'react';
import type { Activity, PuppyProfile } from '../types';
import { fetchActivities, createActivity, updateActivity as apiUpdateActivity, deleteActivity as apiDeleteActivity } from '../services/api';
import { showToast } from '../utils/toast';
import { useI18n } from '../i18n';

export function useActivities(activePuppy: PuppyProfile | null) {
  const { t } = useI18n();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(true);

  // Fetch activities when active puppy changes
  useEffect(() => {
    if (!activePuppy?.id) return;

    async function loadActivities() {
      const result = await fetchActivities(activePuppy!.id, { days: 90, limit: 100, offset: 0 });
      if (result.ok) {
        setActivities(result.data);
        setHasMoreRemote(result.data.length >= 100);
      }
    }

    loadActivities();
  }, [activePuppy?.id]);

  const loadMoreActivities = useCallback(async () => {
    if (!activePuppy?.id || isFetchingMore) return;
    setIsFetchingMore(true);
    const currentPuppyLogs = activities.filter((activity) => activity.puppyId === activePuppy.id);
    const result = await fetchActivities(activePuppy.id, {
      days: 365,
      limit: 100,
      offset: currentPuppyLogs.length,
    });

    if (result.ok && result.data.length > 0) {
      setActivities((previous) => {
        const existingIds = new Set(previous.map((activity) => activity.id));
        const newUnique = result.data.filter((activity) => !existingIds.has(activity.id));
        return [...previous, ...newUnique];
      });
      setHasMoreRemote(result.data.length >= 100);
    } else if (result.ok) {
      setHasMoreRemote(false);
    }
    setIsFetchingMore(false);
  }, [activePuppy?.id, activities, isFetchingMore]);

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
    hasMoreRemoteActivities: hasMoreRemote,
    isFetchingMoreActivities: isFetchingMore,
    loadMoreActivities,
    addActivity,
    updateActivity,
    deleteActivity,
  };
}
