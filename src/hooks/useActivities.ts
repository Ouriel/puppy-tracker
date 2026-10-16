import { useState, useCallback, useEffect, useRef, startTransition } from 'react';
import { toast } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { fetchActivities, createActivity, updateActivity as apiUpdateActivity, deleteActivity as apiDeleteActivity, type ApiErrorKey } from '../services/api';
import { useI18n } from '../i18n';
import type { TranslationKeys } from '../i18n/types';
import { getStoredRecentActivities, setStoredRecentActivities } from '../utils/storage';

// Construct sanitized optimistic activity without stale fields from previous types
export function sanitizeActivityUpdate(target: Activity, updatedFields: Partial<Activity> & { id: string }): Activity {
  const newType = updatedFields.type || target.type;
  const isPotty = newType === 'pee' || newType === 'poop';
  const isFood = newType === 'food';
  const isWeight = newType === 'weight';
  const isMedication = newType === 'medication';

  return {
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
}

/** Types loaded whatever their date: weigh-ins come weeks apart, and the passport lists every medication. */
const ALL_TIME_TYPES: readonly Activity['type'][] = ['weight', 'medication'];

/** `rows` with the row `id` set to `activity`, or without it when `activity` is missing or not an all-time type; the same list when nothing changes. */
function replaceAllTimeRow(rows: Activity[], id: string, activity?: Activity): Activity[] {
  const others = rows.filter((row) => row.id !== id);
  if (activity && ALL_TIME_TYPES.includes(activity.type)) return [activity, ...others];
  return others.length === rows.length ? rows : others;
}

/** `current` followed by the rows of `older` it does not hold yet. */
export function mergeOlderActivities(current: Activity[], older: Activity[]): Activity[] {
  const currentIds = new Set(current.map((activity) => activity.id));
  return [...current, ...older.filter((activity) => !currentIds.has(activity.id))];
}

// The recent window: what /api/dashboard sends (days=14, limit 300) and what a dog switch fetches
const RECENT_LOGS_DAYS = 14;
const RECENT_LOGS_LIMIT = 300;
const LOAD_MORE_LIMIT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
// Owner decision 2026-10-13: a second log of the same type within 5 s of the first is a double tap
const DOUBLE_LOG_WINDOW_MS = 5000;

/** Oldest time a recent window covers: its oldest log when it is full, else the start of its days. */
function recentWindowStart(recentActivities: Activity[]): number {
  return recentActivities.length >= RECENT_LOGS_LIMIT
    ? Date.parse(recentActivities[recentActivities.length - 1].timestamp)
    : Date.now() - RECENT_LOGS_DAYS * DAY_MS;
}

/** A log kept as not saved: why, never "changes reverted" since it is kept, and Retry, since its marked row may be off screen. */
function toastNotSaved(t: TranslationKeys, errorKey: ApiErrorKey, onRetry: () => void) {
  const key = toast.danger(errorKey === 'offline' ? t.toasts.offline : t.potty.saveFailed, {
    actionProps: { children: t.potty.retry, onPress: () => { toast.close(key); onRetry(); } },
  });
}

/** Counts an add, edit or delete from its request to its answer: a dashboard answer read meanwhile may miss it. */
async function trackMutation<T>(mutations: { version: number; pending: number }, request: Promise<T>): Promise<T> {
  mutations.pending += 1;
  try {
    return await request;
  } finally {
    mutations.pending -= 1;
    mutations.version += 1;
  }
}

export function useActivities(
  activePuppy: PuppyProfile | null,
  options?: { skipInitialFetch?: boolean }
) {
  const { t } = useI18n();
  const [activities, setActivities] = useState<Activity[]>(() => {
    if (activePuppy?.id) {
      return getStoredRecentActivities(activePuppy.id) || [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // Skipping the initial fetch: the caller loads the logs and owns the loading state, so a failed load never leaves a skeleton.
    if (!activePuppy?.id || options?.skipInitialFetch) return false;
    const cached = getStoredRecentActivities(activePuppy.id);
    return !cached || cached.length === 0;
  });
  // Every weight and medication event of the loaded dog, whatever its date: the recent window often holds no weigh-in
  const [allTimeActivities, setAllTimeActivities] = useState<Activity[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMoreRemote, setHasMoreRemote] = useState(true);
  // Quick logs the server did not take, kept in the list for Retry or Discard
  const [unsavedIds, setUnsavedIds] = useState<ReadonlySet<string>>(() => new Set());
  const loadedPuppyIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);
  // Tap time of the last log per dog and type, for the double-log guard
  const lastLogTapRef = useRef(new Map<string, number>());
  // version: bumped when an add, edit or delete is answered; pending: requests not answered yet
  const mutationsRef = useRef({ version: 0, pending: 0 });
  const locallyDeletedIdsRef = useRef(new Set<string>());
  // Since when the server's logs of the loaded dog are all here: "load more" pages after the local logs since then
  const historyStartRef = useRef(Infinity);
  // Adds not on the server (not answered yet, or kept as not saved): not counted in the next page's offset, kept by a refresh
  const pendingAddIdsRef = useRef(new Set<string>());

  // Read before requesting the recent window, and given back to setActivitiesForPuppy with the answer
  const getMutationVersion = useCallback(() => mutationsRef.current.version, []);

  // The recent window replaces the rows it covers; the older ones ("load more") stay. `allTimeLogs` replaces the all-time list.
  const setActivitiesForPuppy = useCallback((recentActivities: Activity[], puppyId: string, mutationVersion = mutationsRef.current.version, allTimeLogs?: Activity[]) => {
    // A change answered or still pending while the window was read may be missing from it: only add its new rows
    const isStale = mutationVersion !== mutationsRef.current.version || mutationsRef.current.pending > 0;
    const windowStart = recentWindowStart(recentActivities);
    const isSamePuppy = loadedPuppyIdRef.current === puppyId;
    loadedPuppyIdRef.current = puppyId;
    historyStartRef.current = isSamePuppy ? Math.min(historyStartRef.current, windowStart) : windowStart;
    setStoredRecentActivities(puppyId, recentActivities);
    startTransition(() => {
      setActivities((previous) => (isStale
        ? mergeOlderActivities(previous, recentActivities.filter((activity) => !locallyDeletedIdsRef.current.has(activity.id)))
        : mergeOlderActivities(
          recentActivities,
          previous.filter((activity) => pendingAddIdsRef.current.has(activity.id)
            || (activity.puppyId === puppyId && Date.parse(activity.timestamp) <= windowStart))
        )));
      if (allTimeLogs) {
        setAllTimeActivities((previous) => (isStale
          ? mergeOlderActivities(previous, allTimeLogs.filter((activity) => !locallyDeletedIdsRef.current.has(activity.id)))
          : allTimeLogs));
      }
      setIsLoading(false);
      // A refresh of the same dog never hides "load more"
      setHasMoreRemote((previous) => (isSamePuppy && previous) || recentActivities.length >= RECENT_LOGS_LIMIT);
    });
  }, []);

  // Fetch activities when active puppy changes (skips duplicate fetch if already loaded via dashboard BFF)
  useEffect(() => {
    if (!activePuppy?.id) {
      return;
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (options?.skipInitialFetch) {
        return;
      }
    }

    if (loadedPuppyIdRef.current === activePuppy.id) {
      return;
    }

    let isMounted = true;
    async function loadActivities() {
      setIsLoading(true);
      // Fetch initial 14-day window (matches 10-day decay learning history & 7-day timeline view), and every weigh-in and medication
      const [result, ...allTimeResults] = await Promise.all([
        fetchActivities(activePuppy!.id, { days: RECENT_LOGS_DAYS, limit: RECENT_LOGS_LIMIT, offset: 0 }),
        ...ALL_TIME_TYPES.map((type) => fetchActivities(activePuppy!.id, { type })),
      ]);
      if (isMounted && result.ok) {
        loadedPuppyIdRef.current = activePuppy!.id;
        historyStartRef.current = recentWindowStart(result.data);
        setActivities((previous) => mergeOlderActivities(result.data, previous.filter((activity) => pendingAddIdsRef.current.has(activity.id))));
        setHasMoreRemote(result.data.length >= RECENT_LOGS_LIMIT);
      }
      if (isMounted && allTimeResults.some((allTimeResult) => allTimeResult.ok)) {
        setAllTimeActivities(allTimeResults.flatMap((allTimeResult) => (allTimeResult.ok ? allTimeResult.data : [])));
      }
      if (isMounted) {
        setIsLoading(false);
      }
    }

    loadActivities();
    return () => {
      isMounted = false;
    };
  }, [activePuppy?.id, options?.skipInitialFetch]);

  const activePuppyId = activePuppy?.id;

  const loadMoreActivities = useCallback(async (targetDays?: number) => {
    if (!activePuppyId || isFetchingMore) return;
    setIsFetchingMore(true);

    const isAllTime = targetDays === Infinity;
    const requestedDays = isAllTime ? undefined : (targetDays || 90);

    // The server's logs since historyStart are loaded: the next page starts after them. A log back-dated before it, or not saved yet, is not one of them.
    const result = await fetchActivities(activePuppyId, {
      days: requestedDays,
      limit: LOAD_MORE_LIMIT,
      offset: activities.filter((activity) => activity.puppyId === activePuppyId
        && Date.parse(activity.timestamp) >= historyStartRef.current
        && !pendingAddIdsRef.current.has(activity.id)).length,
    });

    if (result.ok) {
      // A full page reaches its oldest log; a shorter one, every log of the requested days
      const pageStart = result.data.length >= LOAD_MORE_LIMIT
        ? Date.parse(result.data[result.data.length - 1].timestamp)
        : requestedDays ? Date.now() - requestedDays * DAY_MS : -Infinity;
      historyStartRef.current = Math.min(historyStartRef.current, pageStart);
    }
    if (result.ok && result.data.length > 0) {
      setActivities((previous) => mergeOlderActivities(previous, result.data));
      setHasMoreRemote(result.data.length >= LOAD_MORE_LIMIT);
    } else if (result.ok) {
      setHasMoreRemote(false);
    }
    setIsFetchingMore(false);
  }, [activePuppyId, activities, isFetchingMore]);

  /** Sends a log kept as not saved again, under the same id (the server keeps one copy). The saved log, or undefined. */
  const retryActivity = useCallback(async function retry(unsaved: Activity): Promise<Activity | undefined> {
    // Discarded, or saved by an earlier Retry
    if (!pendingAddIdsRef.current.has(unsaved.id)) return;
    // The mark stays until the answer: its row (and its open day) stays in view meanwhile
    const result = await trackMutation(mutationsRef.current, createActivity(unsaved));
    if (!result.ok) {
      toastNotSaved(t, result.errorKey, () => void retry(unsaved));
      return;
    }
    pendingAddIdsRef.current.delete(unsaved.id);
    setUnsavedIds((previous) => new Set([...previous].filter((unsavedId) => unsavedId !== unsaved.id)));
    startTransition(() => {
      setActivities((previous) => previous.map((activity) => (activity.id === unsaved.id ? result.data : activity)));
      setAllTimeActivities((previous) => replaceAllTimeRow(previous, unsaved.id, result.data));
    });
    toast.success(t.toasts.activityLogged);
    return result.data;
  }, [t]);

  /**
   * The saved log; 'alreadyLogged' for a double tap, ignored; undefined when it was not saved.
   * `keepUnsaved`: a refused log stays, marked, for Retry. `id`: the log form's own, the same for each Save of one form.
   */
  const addActivity = useCallback(
    async (activityData: Omit<Activity, 'id'>, options?: { keepUnsaved?: boolean; id?: string }): Promise<Activity | 'alreadyLogged' | undefined> => {
      if (!activePuppy) {
        toast.danger(t.toasts.selectPuppyFirst);
        return;
      }

      // Tap time, not the log's time: a double tap on a quick action, or Save pressed twice
      const tapKey = `${activePuppy.id}:${activityData.type}`;
      const tapTime = Date.now();
      // A clock moved back (network time correction) gives a negative gap: never a double tap
      const elapsedSinceLastTap = tapTime - (lastLogTapRef.current.get(tapKey) ?? -Infinity);
      if (elapsedSinceLastTap >= 0 && elapsedSinceLastTap < DOUBLE_LOG_WINDOW_MS) {
        toast.warning(t.toasts.alreadyLogged);
        return 'alreadyLogged';
      }
      lastLogTapRef.current.set(tapKey, tapTime);

      const newActivity: Activity = {
        ...activityData,
        id: options?.id ?? `act-${crypto.randomUUID()}`,
        puppyId: activePuppy.id,
      };

      startTransition(() => {
        // A form saved again after a lost answer: a refresh may have brought its log in meanwhile
        setActivities((previous) => [newActivity, ...previous.filter((activity) => activity.id !== newActivity.id)]);
        setAllTimeActivities((previous) => replaceAllTimeRow(previous, newActivity.id, newActivity));
      });

      pendingAddIdsRef.current.add(newActivity.id);
      const result = await trackMutation(mutationsRef.current, createActivity(newActivity));
      if (result.ok || !options?.keepUnsaved) pendingAddIdsRef.current.delete(newActivity.id);
      if (result.ok) {
        startTransition(() => {
          setActivities((previous) => previous.map((activity) => (activity.id === newActivity.id ? result.data : activity)));
          setAllTimeActivities((previous) => replaceAllTimeRow(previous, newActivity.id, result.data));
        });
        toast.success(t.toasts.activityLogged);
        return result.data;
      } else if (options?.keepUnsaved) {
        // Still on screen, marked: a second tap within the window stays a double tap
        setUnsavedIds((previous) => new Set(previous).add(newActivity.id));
        // ponytail: the toast's Retry skips App's badge reload (an account's first log); the next dashboard load brings the badge
        toastNotSaved(t, result.errorKey, () => void retryActivity(newActivity));
      } else {
        // Gone from the list: the form can be saved again at once
        if (lastLogTapRef.current.get(tapKey) === tapTime) lastLogTapRef.current.delete(tapKey);
        startTransition(() => {
          setActivities((previous) => previous.filter((activity) => activity.id !== newActivity.id));
          setAllTimeActivities((previous) => replaceAllTimeRow(previous, newActivity.id));
        });
        toast.danger(t.toasts[result.errorKey]);
      }
    },
    [activePuppy, t, retryActivity]
  );

  /** Drops a log kept as not saved, without sending anything. */
  const discardActivity = useCallback((id: string) => {
    pendingAddIdsRef.current.delete(id);
    setUnsavedIds((previous) => new Set([...previous].filter((unsavedId) => unsavedId !== id)));
    setActivities((previous) => previous.filter((activity) => activity.id !== id));
    setAllTimeActivities((previous) => replaceAllTimeRow(previous, id));
  }, []);

  /** Whether the edit was saved; refused, the row gets its old values back. */
  const updateActivity = useCallback(async (updatedFields: Partial<Activity> & { id: string }): Promise<boolean> => {
    // A weigh-in older than the loaded logs is only in the weight list
    const target = activities.find((act) => act.id === updatedFields.id) ?? allTimeActivities.find((weight) => weight.id === updatedFields.id);
    if (!target) return false;

    const optimisticActivity = sanitizeActivityUpdate(target, updatedFields);

    setActivities((previous) => previous.map((activity) => (activity.id === updatedFields.id ? optimisticActivity : activity)));
    setAllTimeActivities((previous) => replaceAllTimeRow(previous, updatedFields.id, optimisticActivity));

    const result = await trackMutation(mutationsRef.current, apiUpdateActivity(updatedFields));
    if (result.ok) {
      setActivities((previous) => previous.map((activity) => (activity.id === updatedFields.id ? result.data : activity)));
      setAllTimeActivities((previous) => replaceAllTimeRow(previous, updatedFields.id, result.data));
      toast.success(t.toasts.activityUpdated);
      return true;
    }
    setActivities((previous) => previous.map((activity) => (activity.id === updatedFields.id ? target : activity)));
    setAllTimeActivities((previous) => replaceAllTimeRow(previous, updatedFields.id, target));
    toast.danger(t.toasts[result.errorKey]);
    return false;
  }, [activities, allTimeActivities, t]);

  const deleteActivity = useCallback(
    async (id: string) => {
      const removed = activities.find((activity) => activity.id === id);
      const removedWeight = allTimeActivities.find((weight) => weight.id === id);
      locallyDeletedIdsRef.current.add(id);
      setActivities((previous) => previous.filter((activity) => activity.id !== id));
      setAllTimeActivities((previous) => replaceAllTimeRow(previous, id));

      const result = await trackMutation(mutationsRef.current, apiDeleteActivity(id));
      if (result.ok) {
        toast(t.toasts.activityDeleted);
      } else {
        locallyDeletedIdsRef.current.delete(id);
        if (removed) setActivities((previous) => [removed, ...previous]);
        if (removedWeight) setAllTimeActivities((previous) => replaceAllTimeRow(previous, id, removedWeight));
        toast.danger(t.toasts[result.errorKey]);
      }
    },
    [activities, allTimeActivities, t]
  );

  return {
    activities,
    allTimeActivities,
    setActivities,
    getMutationVersion,
    setActivitiesForPuppy,
    isLoadingActivities: isLoading,
    hasMoreRemoteActivities: hasMoreRemote,
    isFetchingMoreActivities: isFetchingMore,
    loadMoreActivities,
    addActivity,
    updateActivity,
    deleteActivity,
    unsavedActivityIds: unsavedIds,
    retryActivity,
    discardActivity,
  };
}
