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
      const remoteLogs = await fetchActivities(activePuppy!.id, { days: 180, limit: 250, offset: 0 });
      if (remoteLogs) {
        setActivities(remoteLogs);
        setHasMoreRemote(remoteLogs.length >= 250);
      }
    }

    loadActivities();
  }, [activePuppy?.id]);

  const loadMoreActivities = useCallback(async () => {
    if (!activePuppy?.id || isFetchingMore) return;
    setIsFetchingMore(true);
    const currentPuppyLogs = activities.filter((a) => a.puppyId === activePuppy.id);
    const olderLogs = await fetchActivities(activePuppy.id, {
      days: 365,
      limit: 100,
      offset: currentPuppyLogs.length,
    });

    if (olderLogs && olderLogs.length > 0) {
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newUnique = olderLogs.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newUnique];
      });
      setHasMoreRemote(olderLogs.length >= 100);
    } else {
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

      const newActivity: Activity = {
        ...activityData,
        id: `act-${Date.now()}`,
        puppyId: activePuppy.id,
      };

      setActivities((prev) => [newActivity, ...prev]);

      const created = await createActivity(newActivity);
      if (created) {
        setActivities((prev) => prev.map((a) => (a.id === newActivity.id ? created : a)));
      }
      showToast(t.toasts.activityLogged, 'success');
    },
    [activePuppy, t.toasts.activityLogged, t.toasts.selectPuppyFirst]
  );

  const updateActivity = useCallback(async (updatedFields: Partial<Activity> & { id: string }) => {
    setActivities((prev) => prev.map((a) => (a.id === updatedFields.id ? { ...a, ...updatedFields } : a)));
    await apiUpdateActivity(updatedFields);
  }, []);

  const deleteActivity = useCallback(
    async (id: string) => {
      setActivities((prev) => prev.filter((a) => a.id !== id));
      await apiDeleteActivity(id);
      showToast(t.toasts.activityDeleted, 'info');
    },
    [t.toasts.activityDeleted]
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
