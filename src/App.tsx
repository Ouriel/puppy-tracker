import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, type SetStateAction } from 'react';
import type { Activity, UserAccount, ActivityType, PottyLocation, FamilyRole, HealthRecord, HealthRecordsLoadState, PuppyProfile, SignInOutcome } from './types';
import { getAuthToken, setAuthToken, getStoredAuthUser, setStoredAuthUser } from './utils/auth';
import { isSuperAdminEmail } from './utils/auth';
import {
  fetchDashboard,
  fetchDogs,
  fetchHousehold,
  exchangeSessionToken,
  clearApiCache,
} from './services/api';
import { calculatePredictions, excludeFutureLogs, suggestNextMealGrams } from './utils/predictions';
import { buildQuickActionActivity } from './utils/activityPayloads';
import { formatLocalTime, isSameLogicalDate } from './utils/date';
import { Navbar } from './components/Navbar';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { DogHealthSummary } from './components/DogHealthSummary';
import { ConfirmationModal } from './components/common/ConfirmationModal';

const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const CarnetDeSanteView = lazy(() => import('./views/CarnetDeSanteView').then((m) => ({ default: m.CarnetDeSanteView })));
const AuthLockScreen = lazy(() => import('./components/AuthLockScreen').then((m) => ({ default: m.AuthLockScreen })));
const QuickLogModal = lazy(() => import('./components/QuickLogModal').then((m) => ({ default: m.QuickLogModal })));
import { Button, Card, toast } from '@heroui/react';
import { useI18n, formatCount } from './i18n';
import { AlertTriangle, Dog, Plus } from 'lucide-react';
import { usePuppies } from './hooks/usePuppies';
import { useCaretakers } from './hooks/useCaretakers';
import { useActivities, mergeOlderActivities } from './hooks/useActivities';
import { getUnifiedWeightEntries } from './utils/weight';

import { getStoredRecentActivities, getStoredRecentActivitiesTime } from './utils/storage';

// One list for the sign-in and the deferred session exchange, so a returning Admin keeps the role the sign-in test pins.
const FAMILY_ROLES: readonly string[] = ['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'Admin', 'SuperAdmin'];
// A screen left open (a tablet in the kitchen) reloads data this old, so it shows the others' logs
const DASHBOARD_RELOAD_MS = 15 * 60 * 1000;

function App() {
  const { t, lang } = useI18n();

  const [user, setUser] = useState<UserAccount | null>(() => {
    const token = getAuthToken();
    return token ? getStoredAuthUser() : null;
  });

  // Domain state hooks
  const puppyState = usePuppies();
  const caretakerState = useCaretakers(user);
  const activityState = useActivities(puppyState.activePuppy, { skipInitialFetch: true });
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  // While /api/dashboard fails, the health passport loads the dog's records itself
  const [isDashboardDown, setIsDashboardDown] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(() => new Date());
  // The dashboard could not be reached: when the data shown was loaded (ms); null otherwise
  const [offlineDataTime, setOfflineDataTime] = useState<number | null>(null);
  // The health records came with a dashboard answer: until then the passport and the health summary never say "nothing recorded"
  const [areHealthRecordsLoaded, setAreHealthRecordsLoaded] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!getAuthToken()) return false;
    const cached = puppyState.activePuppy?.id ? getStoredRecentActivities(puppyState.activePuppy.id) : null;
    return !cached || cached.length === 0;
  });

  // URL-driven view routing helper
  const getViewFromPath = (): 'dashboard' | 'carnetdesante' | 'settings' => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('health-passport') || path.includes('passport') || path.includes('carnetdesante')) return 'carnetdesante';
    if (path.includes('settings')) return 'settings';
    return 'dashboard';
  };

  // Navigation & Modals
  const [currentView, setCurrentView] = useState<'dashboard' | 'carnetdesante' | 'settings'>(getViewFromPath);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState<boolean>(false);
  const [quickLogType, setQuickLogType] = useState<ActivityType>('pee');
  const [isDiscardUnsentOpen, setIsDiscardUnsentOpen] = useState<boolean>(false);

  const { activePuppyId, setPuppies, setDeletedPuppies, selectPuppy, addPuppy } = puppyState;
  const { setCaretakers } = caretakerState;
  const { setActivitiesForPuppy, getMutationVersion, addActivity, retryActivity, discardActivity } = activityState;
  const hasNoDog = puppyState.puppies.length === 0;
  // A dog switch keeps the dashboard, dimmed, until the dog's logs arrive (app review flow 4); the skeleton is for the first load only
  const isSwitchingDog = activityState.isLoadingActivities;

  // Counts the health passport's changes: a dashboard answer read before one may miss it
  const healthRecordsVersionRef = useRef(0);
  // Records the passport deleted: a dashboard answer read before the delete must not bring them back
  const deletedHealthRecordIdsRef = useRef(new Set<string>());
  // /api/dashboard requests running, and when the last one ended (ms), failed or not
  const dashboardRequestsRef = useRef(0);
  const lastDashboardLoadRef = useRef(0);

  const updateHealthRecords = useCallback((update: SetStateAction<HealthRecord[]>) => {
    healthRecordsVersionRef.current += 1;
    setHealthRecords((previous) => {
      const next = typeof update === 'function' ? update(previous) : update;
      const nextIds = new Set(next.map((record) => record.id));
      previous.forEach((record) => {
        if (!nextIds.has(record.id)) deletedHealthRecordIdsRef.current.add(record.id);
      });
      return next;
    });
  }, []);

  const handleNavigate = useCallback((view: 'dashboard' | 'carnetdesante' | 'settings') => {
    setCurrentView(view);
    const targetPath = view === 'dashboard' ? '/' : view === 'carnetdesante' ? '/health-passport' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view }, '', targetPath);
    }
  }, []);

  const loadDogsAndHousehold = useCallback(async () => {
    const [dogsRes, householdRes] = await Promise.all([
      fetchDogs(),
      fetchHousehold(),
    ]);

    if (dogsRes.ok && dogsRes.data.length > 0) {
      puppyState.setPuppies(dogsRes.data);
      if (!puppyState.activePuppyId || !dogsRes.data.some((puppy) => puppy.id === puppyState.activePuppyId)) {
        puppyState.selectPuppy(dogsRes.data[0].id);
      }
    }

    if (householdRes.ok && Array.isArray(householdRes.data?.caretakers)) {
      caretakerState.setCaretakers(householdRes.data.caretakers);
    }
  }, [puppyState, caretakerState]);

  // One request for puppies, caretakers, the last 14 days of logs and health records; false when it fails
  const loadDashboard = useCallback(async (puppyId: string = activePuppyId): Promise<boolean> => {
    // Read first: a log added, edited or deleted before the answer arrives may be missing from it
    const mutationVersion = getMutationVersion();
    const healthRecordsVersion = healthRecordsVersionRef.current;
    dashboardRequestsRef.current += 1;
    const dashboardRes = await fetchDashboard(puppyId || undefined, 14).finally(() => {
      dashboardRequestsRef.current -= 1;
      lastDashboardLoadRef.current = Date.now();
    });
    setOfflineDataTime(!dashboardRes.ok && dashboardRes.errorKey === 'offline' ? getStoredRecentActivitiesTime(puppyId) : null);
    setIsDashboardDown(!dashboardRes.ok);
    if (!dashboardRes.ok) return false;
    const { puppies, deletedPuppies, caretakers, activities, healthRecords: records, weightActivities } = dashboardRes.data;
    // The owner's deleted dogs (none for anyone else), even when every dog is deleted
    setDeletedPuppies(deletedPuppies ?? []);
    if (puppies && puppies.length > 0) {
      // The stored dog is gone, so these are its logs (none): load the first dog's instead
      if (puppyId && !puppies.some((puppy) => puppy.id === puppyId)) return loadDashboard(puppies[0].id);
      setPuppies(puppies);
      selectPuppy(puppyId || puppies[0].id);
      setActivitiesForPuppy(activities, puppyId || puppies[0].id, mutationVersion, weightActivities);
    } else if (puppies) {
      // No dog left (the owner deleted the last one): drop the cached ones too
      setPuppies([]);
    }
    if (Array.isArray(caretakers)) {
      setCaretakers(caretakers);
    }
    // An empty list too: the last record may have been deleted. One read before a passport change only adds the records missing here.
    if (records) {
      const isStale = healthRecordsVersion !== healthRecordsVersionRef.current;
      setHealthRecords((previous) => {
        if (!isStale) return records;
        const keptIds = new Set(previous.map((record) => record.id));
        return [...previous, ...records.filter((record) => !keptIds.has(record.id) && !deletedHealthRecordIdsRef.current.has(record.id))];
      });
      setAreHealthRecordsLoaded(true);
    }
    return true;
  }, [activePuppyId, getMutationVersion, setPuppies, setDeletedPuppies, selectPuppy, setCaretakers, setActivitiesForPuppy]);

  // Dogs and household when the dashboard request failed. Not after a 401: it removed the token, so they could only get 401 too.
  const loadDogsAndHouseholdIfSignedIn = useCallback(async () => {
    if (getAuthToken()) await loadDogsAndHousehold();
  }, [loadDogsAndHousehold]);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // A revoked session (401/403 from the API) returns to the lock screen
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('puppace:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('puppace:unauthorized', handleUnauthorized);
  }, []);

  // Initial Auth & Parallel Coordinated Data Load
  useEffect(() => {
    async function init() {
      const currentToken = getAuthToken();
      const storedUser = getStoredAuthUser();

      if (currentToken && storedUser) {
        setUser(storedUser);
      } else if (!currentToken) {
        setUser(null);
        setStoredAuthUser(null);
        setIsLoading(false);
        return;
      }

      const isDashboardView = getViewFromPath() === 'dashboard';
      let isDashboardLoaded = false;
      try {
        if (isDashboardView) {
          // Single BFF roundtrip: puppies, caretakers, recent 14d activities, and health records in 1 cold start
          isDashboardLoaded = await loadDashboard();
        }
      } catch (err) {
        console.error('Failed to load initial PupPace data', err);
      } finally {
        setIsLoading(false);

        // Health Passport and Settings paint first, then load the same payload, so the dashboard opened next has fresh logs.
        // A failed dashboard falls back to dogs and household, never before first paint.
        if (!isDashboardView) {
          loadDashboard()
            .then((isLoaded) => (isLoaded ? undefined : loadDogsAndHouseholdIfSignedIn()))
            .catch((error) => console.error('Failed to load PupPace data', error));
        } else if (!isDashboardLoaded) {
          loadDogsAndHouseholdIfSignedIn();
        }

        // Deferred non-blocking session extension — runs after dashboard is interactive
        // Avoids cold-starting a 2nd Vercel function during the critical boot path
        if (currentToken) {
          setTimeout(() => {
            exchangeSessionToken(currentToken).then((sessionResult) => {
              if (sessionResult.ok && sessionResult.data?.user) {
                const userAccount: UserAccount = {
                  email: sessionResult.data.user.email,
                  name: sessionResult.data.user.name,
                  role: (FAMILY_ROLES.includes(sessionResult.data.user.role) ? sessionResult.data.user.role : 'Member') as FamilyRole,
                };
                setUser(userAccount);
                setStoredAuthUser(userAccount);
              }
            }).catch(() => {});
          }, 3000);
        }
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh dashboard data when PWA returns to foreground + heartbeat ticker
  useEffect(() => {
    const refreshData = () => {
      setNow(new Date());
      if (document.visibilityState === 'visible' && getAuthToken()) {
        clearApiCache();
        loadDashboard().catch((error) => console.error('Failed to refresh PupPace data', error));
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setNow(new Date());
      // Never next to a running request, however old: the in-flight dedupe joins only one under 2 s old
      if (dashboardRequestsRef.current === 0 && Date.now() - lastDashboardLoadRef.current >= DASHBOARD_RELOAD_MS && getAuthToken()) {
        loadDashboard().catch((error) => console.error('Failed to refresh PupPace data', error));
      }
    }, 60000);

    document.addEventListener('visibilitychange', refreshData);
    window.addEventListener('focus', refreshData);
    window.addEventListener('pageshow', refreshData);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshData);
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('pageshow', refreshData);
    };
  }, [loadDashboard]);

  // Prefetch QuickLogModal chunk after dashboard is interactive — eliminates INP spike on first "+" tap
  useEffect(() => {
    if (!isLoading && user && puppyState.puppies.length > 0) {
      const timer = setTimeout(() => { import('./components/QuickLogModal'); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, puppyState.puppies.length]);

  // The tab title names the screen, in the app language
  useEffect(() => {
    const screenTitle = { dashboard: t.nav.dashboard, carnetdesante: t.nav.carnetDeSante, settings: t.nav.settings }[currentView];
    document.title = `${screenTitle} — ${t.brand}`;
  }, [currentView, t]);

  const activePuppyActivities = useMemo(() => {
    if (!puppyState.activePuppy) return [];
    return activityState.activities.filter((act) => act.puppyId === puppyState.activePuppy!.id);
  }, [activityState.activities, puppyState.activePuppy]);

  // Every weigh-in and medication of the dog, whatever its date: weigh-ins come weeks apart, so the recent window often holds
  // none, and the passport lists every medication. The recent window stands in until the full list has loaded; the feed keeps its own.
  const activePuppyAllTime = useMemo(() => {
    if (!puppyState.activePuppy) return [];
    const puppyId = puppyState.activePuppy.id;
    return mergeOlderActivities(activityState.allTimeActivities, activePuppyActivities).filter((activity) => activity.puppyId === puppyId);
  }, [activityState.allTimeActivities, activePuppyActivities, puppyState.activePuppy]);

  const activePuppyWeights = useMemo(() => activePuppyAllTime.filter((activity) => activity.type === 'weight'), [activePuppyAllTime]);

  const activePuppyMedications = useMemo(() => activePuppyAllTime.filter((activity) => activity.type === 'medication'), [activePuppyAllTime]);

  // Quick logs the server did not take, every dog's: one line above the cards keeps them in sight
  const unsavedActivities = useMemo(
    () => activityState.activities.filter((activity) => activityState.unsavedActivityIds.has(activity.id)),
    [activityState.activities, activityState.unsavedActivityIds]
  );

  const lastWeighIn = useMemo(() => getUnifiedWeightEntries(activePuppyWeights).at(-1), [activePuppyWeights]);

  const predictions = useMemo(() => {
    if (!puppyState.activePuppy) return null;
    return calculatePredictions(activePuppyActivities, puppyState.activePuppy, now);
  }, [activePuppyActivities, puppyState.activePuppy, now]);

  // Today's meals as the engine counts them: a meal dated later is not eaten yet
  const todayMeals = useMemo(() => {
    return excludeFutureLogs(activePuppyActivities, now).filter(
      (activity) => activity.type === 'food' && isSameLogicalDate(activity.timestamp, now)
    );
  }, [activePuppyActivities, now]);

  const todayFoodLoggedGrams = useMemo(() => {
    return Math.round(todayMeals.reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0));
  }, [todayMeals]);

  const todayMealsCount = todayMeals.length;

  // Shared by the feed button label and the meal box: undefined once today's goal is reached.
  const nextMealPortionGrams = useMemo(() => {
    if (!puppyState.activePuppy) return 70;
    return suggestNextMealGrams(
      puppyState.activePuppy.dailyFoodGramGoal,
      puppyState.activePuppy.targetMealsPerDay,
      todayFoodLoggedGrams,
      todayMealsCount
    );
  }, [puppyState.activePuppy, todayFoodLoggedGrams, todayMealsCount]);

  // Owner decision 2026-10-15: the server gives an account without a linked badge one on its first log, and stores
  // the log under it. A saved name that no badge here carries means the badges here are stale: reload them.
  const reloadBadgesIfUnknown = useCallback(async (saved: Activity) => {
    if (caretakerState.caretakers.some((item) => item.name === saved.loggedBy)) return;
    const householdRes = await fetchHousehold();
    if (householdRes.ok && Array.isArray(householdRes.data?.caretakers)) setCaretakers(householdRes.data.caretakers);
  }, [caretakerState.caretakers, setCaretakers]);

  // Resolves to whether the log form may close: the log was saved, or ignored as a double tap ("Already logged")
  const logActivity = useCallback(async (activity: Omit<Activity, 'id'>, options?: { keepUnsaved?: boolean; id?: string }): Promise<boolean> => {
    const saved = await addActivity(activity, options);
    if (saved === 'alreadyLogged') return true;
    if (saved) await reloadBadgesIfUnknown(saved);
    return Boolean(saved);
  }, [addActivity, reloadBadgesIfUnknown]);

  const retryLog = useCallback(async (unsaved: Activity) => {
    const saved = await retryActivity(unsaved);
    if (saved) await reloadBadgesIfUnknown(saved);
  }, [retryActivity, reloadBadgesIfUnknown]);

  const handleQuickAction = useCallback((type: ActivityType, pottyLocation?: PottyLocation) => {
    if (!puppyState.activePuppy) return;
    const actionTime = new Date();
    setNow(actionTime);
    const newAct = buildQuickActionActivity({
      puppyId: puppyState.activePuppy.id,
      type,
      pottyLocation,
      loggedBy: caretakerState.currentUser,
      actionTime,
    });

    // One tap, nothing typed to keep: a log the server did not take stays in the feed, marked, for Retry
    void logActivity(newAct, { keepUnsaved: true });
  }, [puppyState.activePuppy, caretakerState.currentUser, logActivity]);

  const retryUnsavedLogs = useCallback(() => {
    unsavedActivities.forEach((unsaved) => void retryLog(unsaved));
  }, [unsavedActivities, retryLog]);

  const discardUnsavedLogs = useCallback(() => {
    unsavedActivities.forEach((unsaved) => discardActivity(unsaved.id));
  }, [unsavedActivities, discardActivity]);

  // The one log of the dog shown goes at once, as with its row's Discard; more, or another dog's (its row is not on screen), ask first.
  // The toasts go: on a phone their "not saved" toasts would cover the dialog's buttons.
  const handleDiscardUnsavedLogs = useCallback(() => {
    if (unsavedActivities.length === 1 && unsavedActivities[0].puppyId === activePuppyId) {
      discardUnsavedLogs();
      return;
    }
    toast.clear();
    setIsDiscardUnsentOpen(true);
  }, [unsavedActivities, activePuppyId, discardUnsavedLogs]);

  const handleOpenQuickLogModal = useCallback((type?: ActivityType) => {
    setQuickLogType(type || 'pee');
    setIsQuickLogOpen(true);
  }, []);

  // App review decision 9: the first dog saved opens the dashboard, where its cards are; a later dog keeps Settings open
  const handleAddPuppy = useCallback(async (newPuppy: PuppyProfile) => {
    const isSaved = await addPuppy(newPuppy);
    if (isSaved && hasNoDog) handleNavigate('dashboard');
    return isSaved;
  }, [addPuppy, hasNoDog, handleNavigate]);

  const handleOpenHealthPassport = useCallback(() => handleNavigate('carnetdesante'), [handleNavigate]);

  // The lock screen shows its own busy state during the exchange, so a refused sign-in keeps its message there
  const handleUnlockWithSSO = async (email: string, name: string, token: string): Promise<SignInOutcome> => {
    const sessionRes = await exchangeSessionToken(token);
    if (sessionRes.ok && sessionRes.data?.user && sessionRes.data.sessionToken) {
      setAuthToken(sessionRes.data.sessionToken);
      const userAccount: UserAccount = {
        email: sessionRes.data.user.email,
        name: sessionRes.data.user.name,
        role: (FAMILY_ROLES.includes(sessionRes.data.user.role) ? sessionRes.data.user.role : 'Member') as FamilyRole,
      };
      setIsLoading(true);
      setUser(userAccount);
      setStoredAuthUser(userAccount);

      if (!(await loadDashboard())) {
        await loadDogsAndHouseholdIfSignedIn();
      }

      setIsLoading(false);
      return 'signedIn';
    }

    // Fallback for Super Admin on initial cold setup
    if (isSuperAdminEmail(email)) {
      const superUser: UserAccount = {
        email,
        name,
        role: 'SuperAdmin',
      };
      setAuthToken(token);
      setUser(superUser);
      setStoredAuthUser(superUser);
      return 'signedIn';
    }

    // Only a 403 means the account waits for approval; no network, a 5xx or a refused token is a failed sign-in
    return !sessionRes.ok && sessionRes.status === 403 ? 'pending' : 'failed';
  };

  // Skeletons while the first dashboard answer is awaited; "unavailable" once it failed with no records known (the passport tries its own load first)
  const healthRecordsState: HealthRecordsLoadState = areHealthRecordsLoaded ? 'loaded' : isDashboardDown ? 'failed' : 'loading';

  // Shown on the dashboard and the passport: the data on screen is from the last load that worked
  const offlineLine = offlineDataTime !== null && (
    <p role="status" className="text-xs font-semibold text-amber-300">
      {t.dashboard.offlineDataFrom.replace('{time}', formatLocalTime(new Date(offlineDataTime)))}
    </p>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
        {/* Real Navbar if cached profile present, otherwise Skeleton Navbar */}
        {puppyState.puppies.length > 0 && user ? (
          <Navbar
            puppies={puppyState.puppies}
            activePuppy={puppyState.activePuppy}
            onSelectPuppy={puppyState.selectPuppy}
            onOpenSettings={() => handleNavigate('settings')}
            onOpenQuickLog={() => handleOpenQuickLogModal('pee')}
          />
        ) : (
          <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-4 gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 motion-safe:animate-pulse" />
            <div className="w-24 h-4 rounded bg-slate-800 motion-safe:animate-pulse" />
          </div>
        )}
        {/* Skeleton PredictorWidget — 3 hero card placeholders, as tall as the cards (about 240 px compact on a phone, 300 px from md), so the page does not jump when they arrive */}
        <main role="status" aria-label={t.dashboard.loading} className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-60 md:h-76 rounded-3xl bg-slate-900 border border-slate-800 motion-safe:animate-pulse" />
            ))}
          </div>
          {/* Skeleton Health Summary (the real one is 850-1050 px; 600 px fills the first screen) */}
          <div className="h-150 rounded-3xl bg-slate-900 border border-slate-800 motion-safe:animate-pulse" />
          {/* Skeleton Timeline */}
          <div className="space-y-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-16 rounded-xl bg-slate-900 border border-slate-800 motion-safe:animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        }
      >
        <AuthLockScreen onUnlockWithSSO={handleUnlockWithSSO} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Navbar */}
      <Navbar
        puppies={puppyState.puppies}
        activePuppy={puppyState.activePuppy}
        onSelectPuppy={puppyState.selectPuppy}
        onOpenSettings={() => handleNavigate('settings')}
        onOpenQuickLog={() => handleOpenQuickLogModal('pee')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {currentView === 'carnetdesante' ? (
          /* Full Page View for Health Passport */
          <div className="space-y-4">
            {offlineLine}
            <Suspense
              fallback={
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              }
            >
              <CarnetDeSanteView
                activePuppy={puppyState.activePuppy}
                medicationActivities={activePuppyMedications}
                weightActivities={activePuppyWeights}
                healthRecords={healthRecords}
                setHealthRecords={updateHealthRecords}
                isDashboardDown={isDashboardDown}
                healthRecordsState={healthRecordsState}
                currentUser={caretakerState.currentUser}
                onAddActivity={logActivity}
                onUpdateActivity={activityState.updateActivity}
                onOpenQuickLogModal={handleOpenQuickLogModal}
                onBackToDashboard={() => handleNavigate('dashboard')}
                onDeleteActivity={activityState.deleteActivity}
              />
            </Suspense>
          </div>
        ) : currentView === 'settings' ? (
          /* Full Page View for Settings & Administration */
          <Suspense
            fallback={
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            }
          >
            <SettingsView
              user={user}
              puppies={puppyState.puppies}
              activePuppyId={puppyState.activePuppyId}
              onSelectPuppy={puppyState.selectPuppy}
              onAddPuppy={handleAddPuppy}
              onUpdatePuppy={puppyState.updatePuppy}
              onDeletePuppy={puppyState.deletePuppy}
              deletedPuppies={puppyState.deletedPuppies}
              onRestorePuppy={puppyState.restorePuppy}
              caretakers={caretakerState.caretakers}
              onAddCaretaker={caretakerState.addCaretaker}
              onUpdateCaretaker={caretakerState.updateCaretaker}
              onDeleteCaretaker={caretakerState.deleteCaretaker}
              onBackToDashboard={() => handleNavigate('dashboard')}
            />
          </Suspense>
        ) : puppyState.puppies.length === 0 ? (
          <Card className="p-10 text-center max-w-lg mx-auto my-12 bg-slate-900 border border-slate-800">
            <Card.Content className="items-center space-y-4">
              <div className="p-4 bg-indigo-950 text-indigo-400 rounded-2xl inline-block border border-indigo-800/50">
                <Dog className="w-12 h-12" />
              </div>
              <h2 className="text-xl font-extrabold text-white">{t.dashboard.welcomeTitle}</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {t.dashboard.welcomeSubtitle}
              </p>
              <Button variant="primary" size="lg" onPress={() => handleNavigate('settings')} className="inline-flex items-center gap-2 font-bold">
                <Plus className="w-4 h-4" />
                <span>{t.dashboard.registerDog}</span>
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <div aria-busy={isSwitchingDog || undefined} className={`space-y-6 motion-safe:transition-opacity ${isSwitchingDog ? 'opacity-50' : ''}`}>
            <h1 className="sr-only">{puppyState.activePuppy?.name}</h1>
            {offlineLine}
            {/* App review decision 8: a failed log stays in sight after its toast closed (its row may be screens below) */}
            {unsavedActivities.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 pr-1 py-1 rounded-xl border border-amber-700/60 bg-amber-950/40 text-xs font-semibold text-amber-300">
                <span role="status" className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {formatCount(t.dashboard.unsentLogs, unsavedActivities.length, lang)}
                </span>
                <div className="flex items-center gap-3 ml-auto">
                  <button type="button" onClick={retryUnsavedLogs} className="min-h-11 px-3 rounded-lg font-bold text-amber-200 hover:bg-amber-900/50 transition-colors">
                    {t.potty.retry}
                  </button>
                  <button type="button" onClick={handleDiscardUnsavedLogs} className="min-h-11 px-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors">
                    {t.potty.discard}
                  </button>
                </div>
              </div>
            )}

            {/* Active Puppy Predictor Hero Bar (3 Cards: Next Pee, Next Poop, Next Meal) */}
            {predictions && puppyState.activePuppy && (
              <PredictorWidget
                predictions={predictions}
                profile={puppyState.activePuppy}
                activities={activePuppyActivities}
                todayFoodLoggedGrams={todayFoodLoggedGrams}
                todayMealsCount={todayMealsCount}
                nextMealPortionGrams={nextMealPortionGrams}
                onQuickAction={handleQuickAction}
                onOpenQuickLogModal={handleOpenQuickLogModal}
                referenceTime={now}
                isHistoryUnknown={!activityState.areActivitiesKnown}
              />
            )}

            {/* Health Passport Quick Summary & Growth Trajectory Banner */}
            {puppyState.activePuppy && (
              <DogHealthSummary
                profile={puppyState.activePuppy}
                activities={activePuppyActivities}
                weightActivities={activePuppyWeights}
                predictions={predictions}
                healthRecords={healthRecords}
                healthRecordsState={healthRecordsState}
                onOpenHealthPassport={handleOpenHealthPassport}
              />
            )}

            {/* Main Activity Timeline & Log History */}
            <ActivityTimeline
              activities={activePuppyActivities}
              caretakers={caretakerState.caretakers}
              activePuppy={puppyState.activePuppy}
              onDeleteActivity={activityState.deleteActivity}
              onUpdateActivity={activityState.updateActivity}
              unsavedIds={activityState.unsavedActivityIds}
              onRetry={retryLog}
              onDiscard={activityState.discardActivity}
              hasMoreRemote={activityState.hasMoreRemoteActivities}
              onLoadMore={activityState.loadMoreActivities}
              isLoadingMore={activityState.isFetchingMoreActivities}
              referenceTime={now}
            />
          </div>
        )}
      </main>

      <ConfirmationModal
        isOpen={isDiscardUnsentOpen}
        onClose={() => setIsDiscardUnsentOpen(false)}
        onConfirm={discardUnsavedLogs}
        title={formatCount(t.dashboard.discardUnsentTitle, unsavedActivities.length, lang)}
        message={formatCount(t.dashboard.discardUnsentMessage, unsavedActivities.length, lang)}
        confirmLabel={t.potty.discard}
      />

      {/* Quick Log Modal: mounted on open, unmounted on close, so it never resets while open */}
      {isQuickLogOpen && (
        <Suspense fallback={null}>
          <QuickLogModal
            isOpen={true}
            onClose={() => setIsQuickLogOpen(false)}
            initialType={quickLogType}
            onSave={logActivity}
            currentUser={caretakerState.currentUser}
            defaultMealPortionGrams={nextMealPortionGrams}
            dailyFoodGramGoal={puppyState.activePuppy?.dailyFoodGramGoal}
            lastWeighIn={lastWeighIn}
            profile={puppyState.activePuppy ?? undefined}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
