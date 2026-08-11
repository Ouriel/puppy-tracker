import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Activity, Caretaker, PuppyProfile, UserAccount, ActivityType, PottyLocation } from './types';
import {
  getStoredUser,
  getStoredCaretakers,
  getActivePuppyId,
  setActivePuppyId,
  clearAllData,
} from './utils/storage';
import { getAuthToken, setAuthToken, clearAuthToken } from './utils/auth';
import {
  fetchDogs,
  createDog,
  deleteDog,
  fetchActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  fetchHousehold,
  createCaretaker,
  updateCaretaker,
  deleteCaretaker,
  exchangeSessionToken,
} from './services/api';
import { calculatePredictions } from './utils/predictions';
import { isSameLocalDate } from './utils/date';
import { Navbar } from './components/Navbar';
import { QuickLogModal } from './components/QuickLogModal';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { DogHealthSummary } from './components/DogHealthSummary';
import { SettingsView } from './views/SettingsView';
import { CarnetDeSanteView } from './views/CarnetDeSanteView';
import { AuthLockScreen } from './components/AuthLockScreen';
import { Button, Card } from '@heroui/react';
import { useI18n } from './i18n';
import { showToast } from './utils/toast';
import { Dog, Plus } from 'lucide-react';

export function App() {
  const { lang, changeLanguage, t } = useI18n();
  const [, startTransition] = useTransition();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserAccount | null>(getStoredUser());
  const [caretakers, setCaretakers] = useState<Caretaker[]>(getStoredCaretakers());
  const [currentUser] = useState<string>('Matthieu');
  const [puppies, setPuppies] = useState<PuppyProfile[]>([]);
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId());
  const [activities, setActivities] = useState<Activity[]>([]);

  // URL-driven view routing helper (Standard clean pathnames: /, /health-passport, /settings)
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
    startTransition(() => {
      setCurrentView(view);
      const targetPath = view === 'dashboard' ? '/' : view === 'carnetdesante' ? '/health-passport' : `/${view}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    });
  }, []);

  // Listen for browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      startTransition(() => {
        setCurrentView(getViewFromPath());
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initial Auth & Data Load
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('session_token');

      if (tokenFromUrl) {
        setAuthToken(tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const currentToken = getAuthToken();
      if (currentToken) {
        const sessionData = await exchangeSessionToken(currentToken);
        if (sessionData && sessionData.user) {
          const userAccount: UserAccount = {
            id: sessionData.user.id || 'u-1',
            email: sessionData.user.email,
            name: sessionData.user.name,
            role: sessionData.user.role as any,
          };
          setUser(userAccount);
        }
      }

      const remoteDogs = await fetchDogs();
      if (remoteDogs && remoteDogs.length > 0) {
        setPuppies(remoteDogs);
        if (!activePuppyId || !remoteDogs.some((p) => p.id === activePuppyId)) {
          const defaultId = remoteDogs[0].id;
          setActivePuppyIdState(defaultId);
          setActivePuppyId(defaultId);
        }
      }

      const remoteHousehold = await fetchHousehold();
      if (remoteHousehold?.caretakers && remoteHousehold.caretakers.length > 0) {
        setCaretakers(remoteHousehold.caretakers);
      }

      setIsLoading(false);
    }

    init();
  }, []);

  // Fetch activities when active puppy changes
  useEffect(() => {
    if (!activePuppyId) return;

    async function loadActivities() {
      const remoteLogs = await fetchActivities(activePuppyId, { days: 30, limit: 50, offset: 0 });
      if (remoteLogs) {
        setActivities(remoteLogs);
      }
    }

    loadActivities();
  }, [activePuppyId]);

  const activePuppy = puppies.find((p) => p.id === activePuppyId) || puppies[0] || null;

  const activePuppyActivities = useMemo(() => {
    if (!activePuppy) return [];
    return activities.filter((act) => act.puppyId === activePuppy.id);
  }, [activities, activePuppy]);

  const predictions = useMemo(() => {
    if (!activePuppy) return null;
    return calculatePredictions(activePuppyActivities, activePuppy);
  }, [activePuppyActivities, activePuppy]);

  const todayFoodLoggedGrams = useMemo(() => {
    const today = new Date();
    return activePuppyActivities
      .filter((act) => act.type === 'food' && isSameLocalDate(act.timestamp, today))
      .reduce((sum, act) => sum + (act.quantityGrams || 0), 0);
  }, [activePuppyActivities]);

  const todayMealsCount = useMemo(() => {
    const today = new Date();
    return activePuppyActivities.filter(
      (act) => act.type === 'food' && isSameLocalDate(act.timestamp, today)
    ).length;
  }, [activePuppyActivities]);

  const nextMealPortionGrams = useMemo(() => {
    if (!activePuppy) return 80;
    const dailyGoal = activePuppy.dailyFoodGramGoal || 200;
    const mealsPerDay = activePuppy.targetMealsPerDay || 3;
    const remainingGrams = Math.max(0, dailyGoal - todayFoodLoggedGrams);
    const remainingMeals = Math.max(1, mealsPerDay - todayMealsCount);
    return Math.round(remainingGrams / remainingMeals) || Math.round(dailyGoal / mealsPerDay);
  }, [activePuppy, todayFoodLoggedGrams, todayMealsCount]);

  // Handlers
  const handleSelectPuppy = useCallback((id: string) => {
    startTransition(() => {
      setActivePuppyIdState(id);
      setActivePuppyId(id);
    });
  }, []);

  const handleAddPuppy = useCallback(async (newPup: PuppyProfile) => {
    const saved = await createDog(newPup);
    const pupToUse = saved || newPup;
    setPuppies((prev) => [...prev, pupToUse]);
    setActivePuppyIdState(pupToUse.id);
    setActivePuppyId(pupToUse.id);
    showToast(t.toasts.dogRegistered.replace('{name}', pupToUse.name), 'success');
  }, [t.toasts.dogRegistered]);

  const handleUpdatePuppy = useCallback(async (updatedPup: PuppyProfile) => {
    setPuppies((prev) => prev.map((p) => (p.id === updatedPup.id ? updatedPup : p)));
    await createDog(updatedPup);
    showToast(t.toasts.dogUpdated, 'success');
  }, [t.toasts.dogUpdated]);

  const handleDeletePuppy = useCallback(async (id: string) => {
    setPuppies((prev) => prev.filter((p) => p.id !== id));
    await deleteDog(id);
    if (activePuppyId === id) {
      const remaining = puppies.filter((p) => p.id !== id);
      if (remaining.length > 0) {
        setActivePuppyIdState(remaining[0].id);
        setActivePuppyId(remaining[0].id);
      }
    }
    showToast(t.toasts.dogDeleted, 'info');
  }, [activePuppyId, puppies, t.toasts.dogDeleted]);

  const handleAddActivity = useCallback(async (activityData: Omit<Activity, 'id'>) => {
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
  }, [activePuppy, t.toasts.activityLogged, t.toasts.selectPuppyFirst]);

  const handleUpdateActivity = useCallback(async (updatedFields: Partial<Activity> & { id: string }) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === updatedFields.id ? { ...a, ...updatedFields } : a))
    );
    await updateActivity(updatedFields);
  }, []);

  const handleDeleteActivity = useCallback(async (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
    await deleteActivity(id);
    showToast(t.toasts.activityDeleted, 'info');
  }, [t.toasts.activityDeleted]);

  const handleQuickAction = useCallback((type: ActivityType, pottyLocation?: PottyLocation) => {
    if (!activePuppy) return;
    const newAct: Omit<Activity, 'id'> = {
      puppyId: activePuppy.id,
      type,
      timestamp: new Date().toISOString(),
      loggedBy: currentUser,
    };

    if (pottyLocation) {
      newAct.pottyLocation = pottyLocation;
    } else if (type === 'food') {
      newAct.foodType = 'kibble';
      newAct.quantityGrams = nextMealPortionGrams;
      newAct.quantityCups = Math.round((nextMealPortionGrams / 110) * 100) / 100;
    }

    handleAddActivity(newAct);
  }, [activePuppy, currentUser, handleAddActivity, nextMealPortionGrams]);

  const handleOpenQuickLogModal = useCallback((type?: ActivityType) => {
    setQuickLogType(type || 'pee');
    setIsQuickLogOpen(true);
  }, []);

  const handleAddCaretaker = useCallback(async (caretaker: Caretaker) => {
    setCaretakers((prev) => [...prev, caretaker]);
    await createCaretaker(caretaker);
    showToast(t.toasts.memberAdded, 'success');
  }, [t.toasts.memberAdded]);

  const handleUpdateCaretaker = useCallback(async (id: string, updatedFields: Partial<Caretaker>) => {
    setCaretakers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updatedFields } : c)));
    await updateCaretaker({ id, ...updatedFields });
  }, []);

  const handleDeleteCaretaker = useCallback(async (id: string) => {
    setCaretakers((prev) => prev.filter((c) => c.id !== id));
    await deleteCaretaker(id);
    showToast(t.toasts.memberRemoved, 'info');
  }, [t.toasts.memberRemoved]);

  const handleUnlockWithSSO = (email: string, name: string, token: string) => {
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name,
      role: email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? 'SuperAdmin' : 'Member',
    };
    setAuthToken(token);
    setUser(newUser);
    return { success: true };
  };

  const handleUnlockWithPassword = (email: string) => {
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role: email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? 'SuperAdmin' : 'Member',
    };
    setUser(newUser);
    return { success: true };
  };

  const handleRegisterAccount = (email: string, _pass: string, name: string, role: string) => {
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      role: (role as any) || 'Member',
    };
    setUser(newUser);
    return { success: true };
  };

  const handleSignOut = useCallback(() => {
    clearAuthToken();
    clearAllData();
    setUser(null);
    setPuppies([]);
    setActivities([]);
    showToast('Signed out.', 'info');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Syncing PupPace data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthLockScreen
        onUnlockWithSSO={handleUnlockWithSSO}
        onUnlockWithPassword={handleUnlockWithPassword}
        onRegisterAccount={handleRegisterAccount}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Navbar */}
      <Navbar
        puppies={puppies}
        activePuppy={activePuppy}
        onSelectPuppy={handleSelectPuppy}
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
          <CarnetDeSanteView
            activePuppy={activePuppy}
            activities={activities}
            onOpenQuickLogModal={handleOpenQuickLogModal}
            onBackToDashboard={() => handleNavigate('dashboard')}
            onDeleteActivity={handleDeleteActivity}
          />
        ) : currentView === 'settings' ? (
          /* Full Page View for Settings & Administration */
          <SettingsView
            user={user}
            puppies={puppies}
            activePuppyId={activePuppyId}
            onSelectPuppy={handleSelectPuppy}
            onAddPuppy={handleAddPuppy}
            onUpdatePuppy={handleUpdatePuppy}
            onDeletePuppy={handleDeletePuppy}
            caretakers={caretakers}
            currentUser={currentUser}
            onAddCaretaker={handleAddCaretaker}
            onUpdateCaretaker={handleUpdateCaretaker}
            onDeleteCaretaker={handleDeleteCaretaker}
            onBackToDashboard={() => handleNavigate('dashboard')}
          />
        ) : puppies.length === 0 ? (
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
            {predictions && activePuppy && (
              <PredictorWidget
                predictions={predictions}
                profile={activePuppy}
                activities={activePuppyActivities}
                todayFoodLoggedGrams={todayFoodLoggedGrams}
                todayMealsCount={todayMealsCount}
                onQuickAction={handleQuickAction}
                onOpenQuickLogModal={handleOpenQuickLogModal}
              />
            )}

            {/* Dashboard Main Grid (DogHealthSummary first on mobile, right column on desktop) */}
            {activePuppy && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Dog Profile & Health Summary Card (First on mobile, right column on desktop) */}
                <div className="order-1 lg:order-2 lg:col-span-1 space-y-6">
                  <DogHealthSummary
                    profile={activePuppy}
                    activities={activePuppyActivities}
                    onOpenHealthPassport={() => handleNavigate('carnetdesante')}
                    lang={lang}
                  />
                </div>

                {/* Focused Activity Timeline (Second on mobile, 2 cols left on desktop) */}
                <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
                  <ActivityTimeline
                    activities={activePuppyActivities}
                    caretakers={caretakers}
                    onDeleteActivity={handleDeleteActivity}
                    onUpdateActivity={handleUpdateActivity}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>PupPace &bull; Household Puppy Sync Platform</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => handleNavigate('carnetdesante')} className="text-slate-400 hover:text-white transition-colors">Health Passport</button>
            <span>&bull;</span>
            <button type="button" onClick={() => handleNavigate('settings')} className="text-slate-400 hover:text-white transition-colors">Settings</button>
            <span>&bull;</span>
            <button type="button" onClick={handleSignOut} className="text-slate-400 hover:text-white transition-colors">Sign Out</button>
            <span>&bull;</span>
            <a href="/privacy" className="hover:text-slate-400 transition">Privacy</a>
            <span>&bull;</span>
            <a href="/terms" className="hover:text-slate-400 transition">Terms</a>
          </div>
        </div>
      </footer>

      {/* Quick Event Logging Modal */}
      {activePuppy && (
        <QuickLogModal
          key={isQuickLogOpen ? 'open' : 'closed'}
          isOpen={isQuickLogOpen}
          initialType={quickLogType}
          defaultMealPortionGrams={nextMealPortionGrams}
          onClose={() => setIsQuickLogOpen(false)}
          onSave={handleAddActivity}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default App;
