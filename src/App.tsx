import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import type { Activity, UserAccount, ActivityType, PottyLocation, FamilyRole, HealthRecord, SignInOutcome } from './types';
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
import { isSameLogicalDate } from './utils/date';
import { Navbar } from './components/Navbar';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { DogHealthSummary } from './components/DogHealthSummary';

const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const CarnetDeSanteView = lazy(() => import('./views/CarnetDeSanteView').then((m) => ({ default: m.CarnetDeSanteView })));
const AuthLockScreen = lazy(() => import('./components/AuthLockScreen').then((m) => ({ default: m.AuthLockScreen })));
const QuickLogModal = lazy(() => import('./components/QuickLogModal').then((m) => ({ default: m.QuickLogModal })));
import { Button, Card } from '@heroui/react';
import { useI18n } from './i18n';
import { Dog, Plus } from 'lucide-react';
import { usePuppies } from './hooks/usePuppies';
import { useCaretakers } from './hooks/useCaretakers';
import { useActivities, mergeOlderActivities } from './hooks/useActivities';
import { getUnifiedWeightEntries } from './utils/weight';

import { getStoredRecentActivities } from './utils/storage';

function App() {
  const { t } = useI18n();

  const [user, setUser] = useState<UserAccount | null>(() => {
    const token = getAuthToken();
    return token ? getStoredAuthUser() : null;
  });

  // Domain state hooks
  const puppyState = usePuppies();
  const caretakerState = useCaretakers(user);
  const activityState = useActivities(puppyState.activePuppy, { skipInitialFetch: true });
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [now, setNow] = useState<Date>(() => new Date());

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

  const { activePuppyId, setPuppies, selectPuppy } = puppyState;
  const { setCaretakers } = caretakerState;
  const { setActivitiesForPuppy, getMutationVersion, addActivity } = activityState;

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
    const dashboardRes = await fetchDashboard(puppyId || undefined, 14);
    if (!dashboardRes.ok) return false;
    const { puppies, caretakers, activities, healthRecords: records, weightActivities } = dashboardRes.data;
    if (puppies && puppies.length > 0) {
      // The stored dog is gone, so these are its logs (none): load the first dog's instead
      if (puppyId && !puppies.some((puppy) => puppy.id === puppyId)) return loadDashboard(puppies[0].id);
      setPuppies(puppies);
      selectPuppy(puppyId || puppies[0].id);
      setActivitiesForPuppy(activities, puppyId || puppies[0].id, mutationVersion, weightActivities);
    }
    if (Array.isArray(caretakers)) {
      setCaretakers(caretakers);
    }
    // An empty list too: the last record may have been deleted
    if (records) {
      setHealthRecords(records);
    }
    return true;
  }, [activePuppyId, getMutationVersion, setPuppies, selectPuppy, setCaretakers, setActivitiesForPuppy]);

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
                  id: sessionResult.data.user.id || 'u-1',
                  email: sessionResult.data.user.email,
                  name: sessionResult.data.user.name,
                  role: (['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'SuperAdmin'].includes(sessionResult.data.user.role) ? sessionResult.data.user.role : 'Member') as FamilyRole,
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
      if (document.visibilityState === 'visible') setNow(new Date());
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

  const activePuppyActivities = useMemo(() => {
    if (!puppyState.activePuppy) return [];
    return activityState.activities.filter((act) => act.puppyId === puppyState.activePuppy!.id);
  }, [activityState.activities, puppyState.activePuppy]);

  // Every weigh-in of the dog, whatever its date: weigh-ins come weeks apart, so the recent window often holds none.
  // The recent window stands in until the full list has loaded.
  const activePuppyWeights = useMemo(() => {
    if (!puppyState.activePuppy) return [];
    const puppyId = puppyState.activePuppy.id;
    return mergeOlderActivities(activityState.weightActivities, activePuppyActivities)
      .filter((activity) => activity.type === 'weight' && activity.puppyId === puppyId);
  }, [activityState.weightActivities, activePuppyActivities, puppyState.activePuppy]);

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
    return todayMeals.reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0);
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
  const logActivity = useCallback(async (activity: Omit<Activity, 'id'>) => {
    const saved = await addActivity(activity);
    if (!saved || caretakerState.caretakers.some((item) => item.name === saved.loggedBy)) return;
    const householdRes = await fetchHousehold();
    if (householdRes.ok && Array.isArray(householdRes.data?.caretakers)) setCaretakers(householdRes.data.caretakers);
  }, [addActivity, caretakerState.caretakers, setCaretakers]);

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

    void logActivity(newAct);
  }, [puppyState.activePuppy, caretakerState.currentUser, logActivity]);

  const handleOpenQuickLogModal = useCallback((type?: ActivityType) => {
    setQuickLogType(type || 'pee');
    setIsQuickLogOpen(true);
  }, []);

  const handleOpenHealthPassport = useCallback(() => handleNavigate('carnetdesante'), [handleNavigate]);

  // The lock screen shows its own busy state during the exchange, so a refused sign-in keeps its message there
  const handleUnlockWithSSO = async (email: string, name: string, token: string): Promise<SignInOutcome> => {
    const sessionRes = await exchangeSessionToken(token);
    if (sessionRes.ok && sessionRes.data?.user && sessionRes.data.sessionToken) {
      setAuthToken(sessionRes.data.sessionToken);
      const userAccount: UserAccount = {
        id: sessionRes.data.user.id || `u-${Date.now()}`,
        email: sessionRes.data.user.email,
        name: sessionRes.data.user.name,
        role: (['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'SuperAdmin'].includes(sessionRes.data.user.role) ? sessionRes.data.user.role : 'Member') as FamilyRole,
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
        id: `u-${Date.now()}`,
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

  if (isLoading || (currentView === 'dashboard' && user && activityState.isLoadingActivities && puppyState.puppies.length > 0)) {
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
            <div className="w-9 h-9 rounded-full bg-slate-800 animate-pulse" />
            <div className="w-24 h-4 rounded bg-slate-800 animate-pulse" />
          </div>
        )}
        {/* Skeleton PredictorWidget — 3 hero card placeholders */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-48 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
            ))}
          </div>
          {/* Skeleton Health Summary */}
          <div className="h-32 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
          {/* Skeleton Timeline */}
          <div className="space-y-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="h-16 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
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
          <Suspense
            fallback={
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            }
          >
            <CarnetDeSanteView
              activePuppy={puppyState.activePuppy}
              activities={activePuppyActivities}
              weightActivities={activePuppyWeights}
              currentUser={caretakerState.currentUser}
              onAddActivity={logActivity}
              onUpdateActivity={activityState.updateActivity}
              onOpenQuickLogModal={handleOpenQuickLogModal}
              onBackToDashboard={() => handleNavigate('dashboard')}
              onDeleteActivity={activityState.deleteActivity}
            />
          </Suspense>
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
              onAddPuppy={puppyState.addPuppy}
              onUpdatePuppy={puppyState.updatePuppy}
              onDeletePuppy={puppyState.deletePuppy}
              caretakers={caretakerState.caretakers}
              onAddCaretaker={caretakerState.addCaretaker}
              onUpdateCaretaker={caretakerState.updateCaretaker}
              onDeleteCaretaker={caretakerState.deleteCaretaker}
              onBackToDashboard={() => handleNavigate('dashboard')}
            />
          </Suspense>
        ) : puppyState.puppies.length === 0 ? (
          <Card className="p-10 text-center max-w-lg mx-auto my-12 bg-slate-900 border border-slate-800">
            <Card.Content className="space-y-4">
              <div className="p-4 bg-indigo-950 text-indigo-400 rounded-2xl inline-block border border-indigo-800/50">
                <Dog className="w-12 h-12" />
              </div>
              <h2 className="text-xl font-extrabold text-white">{t.dashboard.welcomeTitle}</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {t.dashboard.welcomeSubtitle}
              </p>
              <Button variant="primary" size="lg" onPress={() => handleNavigate('settings')} className="inline-flex items-center gap-2 font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
                <Plus className="w-4 h-4" />
                <span>{t.dashboard.registerDog}</span>
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <div className="space-y-6">
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
              hasMoreRemote={activityState.hasMoreRemoteActivities}
              onLoadMore={activityState.loadMoreActivities}
              isLoadingMore={activityState.isFetchingMoreActivities}
              referenceTime={now}
            />
          </div>
        )}
      </main>

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
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
