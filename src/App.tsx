import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import type { Activity, UserAccount, ActivityType, PottyLocation, FamilyRole, HealthRecord } from './types';
import { getAuthToken, setAuthToken, getStoredAuthUser, setStoredAuthUser } from './utils/auth';
import { isSuperAdminEmail } from './constants/auth';
import {
  fetchDashboard,
  fetchDogs,
  fetchHousehold,
  exchangeSessionToken,
} from './services/api';
import { calculatePredictions, calculateNextMealPortion } from './utils/predictions';
import { getEffectivePuppyWeight } from './utils/weight';
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
import { useActivities } from './hooks/useActivities';

export function App() {
  const { lang, changeLanguage, t } = useI18n();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserAccount | null>(() => {
    const token = getAuthToken();
    return token ? getStoredAuthUser() : null;
  });

  // Domain state hooks
  const puppyState = usePuppies();
  const caretakerState = useCaretakers(user);
  const activityState = useActivities(puppyState.activePuppy);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);

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

  const handleNavigate = useCallback((view: 'dashboard' | 'carnetdesante' | 'settings') => {
    setCurrentView(view);
    const targetPath = view === 'dashboard' ? '/' : view === 'carnetdesante' ? '/health-passport' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view }, '', targetPath);
    }
  }, []);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initial Auth & Parallel Coordinated Data Load
  useEffect(() => {
    async function init() {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('session_token');

      if (tokenFromUrl) {
        setAuthToken(tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

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

      try {
        const initialView = getViewFromPath();
        if (initialView === 'dashboard') {
          // Single BFF roundtrip: puppies, caretakers, recent 14d activities, and health records in 1 cold start
          const dashboardRes = await fetchDashboard(puppyState.activePuppyId || undefined, 14);
          if (dashboardRes.ok) {
            const { puppies, caretakers, activities, healthRecords: records } = dashboardRes.data;
            if (puppies && puppies.length > 0) {
              puppyState.setPuppies(puppies);
              const targetPuppyId = (puppyState.activePuppyId && puppies.some((puppy) => puppy.id === puppyState.activePuppyId))
                ? puppyState.activePuppyId
                : puppies[0].id;
              puppyState.selectPuppy(targetPuppyId);
              activityState.setActivitiesForPuppy(activities, targetPuppyId);
            }
            if (caretakers && caretakers.length > 0) {
              caretakerState.setCaretakers(caretakers);
            }
            if (records && records.length > 0) {
              setHealthRecords(records);
            }
          }
        } else {
          // Secondary views (Health Passport, Settings): load dogs and household only, never wait for potty logs
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

          if (householdRes.ok && householdRes.data?.caretakers && householdRes.data.caretakers.length > 0) {
            caretakerState.setCaretakers(householdRes.data.caretakers);
          }
        }
      } catch (err) {
        console.error('Failed to load initial PupPace data', err);
      } finally {
        setIsLoading(false);

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

  const predictions = useMemo(() => {
    if (!puppyState.activePuppy) return null;
    return calculatePredictions(activePuppyActivities, puppyState.activePuppy);
  }, [activePuppyActivities, puppyState.activePuppy]);

  const todayFoodLoggedGrams = useMemo(() => {
    const today = new Date();
    return activePuppyActivities
      .filter((activity) => activity.type === 'food' && isSameLogicalDate(activity.timestamp, today))
      .reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0);
  }, [activePuppyActivities]);

  const todayMealsCount = useMemo(() => {
    const today = new Date();
    return activePuppyActivities.filter(
      (activity) => activity.type === 'food' && isSameLogicalDate(activity.timestamp, today)
    ).length;
  }, [activePuppyActivities]);

  const nextMealPortionGrams = useMemo(() => {
    if (!puppyState.activePuppy) return 70;
    return calculateNextMealPortion(
      puppyState.activePuppy.dailyFoodGramGoal,
      puppyState.activePuppy.targetMealsPerDay,
      todayFoodLoggedGrams,
      todayMealsCount
    );
  }, [puppyState.activePuppy, todayFoodLoggedGrams, todayMealsCount]);

  const activePuppyEffectiveWeightInfo = useMemo(() => {
    return getEffectivePuppyWeight(puppyState.activePuppy, activePuppyActivities || []);
  }, [puppyState.activePuppy, activePuppyActivities]);

  const lastWeightLogKg = activePuppyEffectiveWeightInfo.estimatedCurrentWeight;

  const handleQuickAction = useCallback((type: ActivityType, pottyLocation?: PottyLocation) => {
    if (!puppyState.activePuppy) return;
    const newAct: Omit<Activity, 'id'> = {
      puppyId: puppyState.activePuppy.id,
      type,
      timestamp: new Date().toISOString(),
      loggedBy: caretakerState.currentUser,
    };

    if (pottyLocation) {
      newAct.pottyLocation = pottyLocation;
    }
    
    if (type === 'poop') {
      newAct.stoolConsistency = 'normal';
    } else if (type === 'food') {
      newAct.foodType = 'kibble';
      newAct.quantityGrams = nextMealPortionGrams;
      newAct.quantityCups = Math.round((nextMealPortionGrams / 110) * 100) / 100;
    }

    activityState.addActivity(newAct);
  }, [puppyState.activePuppy, caretakerState.currentUser, activityState, nextMealPortionGrams]);

  const handleOpenQuickLogModal = useCallback((type?: ActivityType) => {
    setQuickLogType(type || 'pee');
    setIsQuickLogOpen(true);
  }, []);

  const handleUnlockWithSSO = async (email: string, name: string, token: string) => {
    setIsLoading(true);
    const sessionRes = await exchangeSessionToken(token);
    if (sessionRes.ok && sessionRes.data?.user && sessionRes.data.sessionToken) {
      setAuthToken(sessionRes.data.sessionToken);
      const userAccount: UserAccount = {
        id: sessionRes.data.user.id || `u-${Date.now()}`,
        email: sessionRes.data.user.email,
        name: sessionRes.data.user.name,
        role: (['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'SuperAdmin'].includes(sessionRes.data.user.role) ? sessionRes.data.user.role : 'Member') as FamilyRole,
      };
      setUser(userAccount);
      setStoredAuthUser(userAccount);

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

      if (householdRes.ok && householdRes.data?.caretakers && householdRes.data.caretakers.length > 0) {
        caretakerState.setCaretakers(householdRes.data.caretakers);
      }

      setIsLoading(false);
      return { success: true };
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
      setIsLoading(false);
      return { success: true };
    }

    setIsLoading(false);
    return { success: false, message: 'Account pending activation by Super Admin.' };
  };

  const handleUnlockWithPassword = (email: string) => {
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role: isSuperAdminEmail(email) ? 'SuperAdmin' : 'Member',
    };
    setUser(newUser);
    return { success: true };
  };

  const handleRegisterAccount = (email: string, _pass: string, name: string, role: string) => {
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      role: (['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'SuperAdmin'].includes(role) ? role : 'Member') as FamilyRole,
    };
    setUser(newUser);
    return { success: true };
  };

  if (isLoading || (currentView === 'dashboard' && user && activityState.isLoadingActivities && puppyState.puppies.length > 0)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
        {/* Skeleton Navbar */}
        <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center px-4 gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 animate-pulse" />
          <div className="w-24 h-4 rounded bg-slate-800 animate-pulse" />
        </div>
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
        <AuthLockScreen
          onUnlockWithSSO={handleUnlockWithSSO}
          onUnlockWithPassword={handleUnlockWithPassword}
          onRegisterAccount={handleRegisterAccount}
        />
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
        user={user}
        onOpenSettings={() => handleNavigate('settings')}
        onOpenQuickLog={() => handleOpenQuickLogModal('pee')}
        lang={lang}
        onLanguageChange={changeLanguage}
        t={t}
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
              activities={activityState.activities}
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
              currentUser={caretakerState.currentUser}
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
                onQuickAction={handleQuickAction}
                onOpenQuickLogModal={handleOpenQuickLogModal}
              />
            )}

            {/* Health Passport Quick Summary & Growth Trajectory Banner */}
            {puppyState.activePuppy && (
              <DogHealthSummary
                profile={puppyState.activePuppy}
                activities={activePuppyActivities}
                predictions={predictions}
                healthRecords={healthRecords}
                onOpenHealthPassport={() => handleNavigate('carnetdesante')}
                lang={lang}
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
            />
          </div>
        )}
      </main>

      {/* Quick Log Modal Component (Conditionally mounted with key for clean lifecycle) */}
      {isQuickLogOpen && (
        <Suspense fallback={null}>
          <QuickLogModal
            key={`quicklog-${quickLogType}-${Date.now()}`}
            isOpen={true}
            onClose={() => setIsQuickLogOpen(false)}
            initialType={quickLogType}
            onSave={activityState.addActivity}
            currentUser={caretakerState.currentUser}
            defaultMealPortionGrams={nextMealPortionGrams}
            defaultWeightKg={lastWeightLogKg}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
