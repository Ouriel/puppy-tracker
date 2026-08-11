import { useState, useEffect } from 'react';
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
import { SettingsAdminModal } from './components/SettingsAdminModal';
import { CarnetDeSanteView } from './views/CarnetDeSanteView';
import { AuthLockScreen } from './components/AuthLockScreen';
import { Button, Card } from '@heroui/react';
import { useI18n } from './i18n';
import { showToast } from './utils/toast';
import { Dog, Plus } from 'lucide-react';

export function App() {
  const { lang, changeLanguage, t } = useI18n();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserAccount | null>(getStoredUser());
  const [caretakers, setCaretakers] = useState<Caretaker[]>(getStoredCaretakers());
  const [currentUser, setCurrentUser] = useState<string>('Matthieu');
  const [puppies, setPuppies] = useState<PuppyProfile[]>([]);
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId());
  const [activities, setActivities] = useState<Activity[]>([]);

  // Navigation View State ('dashboard' or 'carnetdesante')
  const [currentView, setCurrentView] = useState<'dashboard' | 'carnetdesante'>('dashboard');

  // Modal Open States
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<ActivityType | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync token check on launch
  useEffect(() => {
    async function initAuth() {
      const token = getAuthToken();
      if (token && !user) {
        const res = await exchangeSessionToken(token);
        if (res && res.user) {
          const authenticatedUser: UserAccount = {
            id: res.user.id || `u-${Date.now()}`,
            email: res.user.email,
            name: res.user.name || res.user.email.split('@')[0],
            role: res.user.email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? 'SuperAdmin' : 'Member',
            status: res.user.status,
          };
          setUser(authenticatedUser);
          setCurrentUser(authenticatedUser.name);
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, [user]);

  // Load dogs & household caretakers
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      const [remoteDogs, householdData] = await Promise.all([
        fetchDogs(),
        fetchHousehold(),
      ]);

      if (remoteDogs && remoteDogs.length > 0) {
        setPuppies(remoteDogs);
        const currentActive = getActivePuppyId();
        if (!currentActive || !remoteDogs.some((pup) => pup.id === currentActive)) {
          setActivePuppyIdState(remoteDogs[0].id);
          setActivePuppyId(remoteDogs[0].id);
        }
      }

      if (householdData && householdData.caretakers) {
        setCaretakers(householdData.caretakers);
      }
    }

    loadData();
  }, [user]);

  // Load activities for active puppy
  useEffect(() => {
    if (!user || !activePuppyId) return;

    async function loadPuppyActivities() {
      const remoteLogs = await fetchActivities(activePuppyId);
      if (remoteLogs) {
        setActivities(remoteLogs);
      }
    }

    loadPuppyActivities();
  }, [user, activePuppyId]);

  const activePuppy = puppies.find((pup) => pup.id === activePuppyId) || (puppies.length > 0 ? puppies[0] : null);

  const activePuppyActivities = activities.filter((act) => act.puppyId === activePuppyId);

  // Calculate today food totals
  const todayFoodLoggedGrams = activePuppyActivities
    .filter((act) => act.type === 'food' && isSameLocalDate(act.timestamp, new Date()))
    .reduce((sum, act) => sum + (act.quantityGrams || 0), 0);

  const todayMealsCount = activePuppyActivities.filter(
    (act) => act.type === 'food' && isSameLocalDate(act.timestamp, new Date())
  ).length;

  const targetMeals = Math.max(1, activePuppy?.targetMealsPerDay || 3);
  const dailyGoal = activePuppy?.dailyFoodGramGoal || 240;
  const remainingFoodGrams = Math.max(0, dailyGoal - todayFoodLoggedGrams);
  const remainingMealsToday = Math.max(1, targetMeals - todayMealsCount);

  const nextMealPortionGrams = remainingFoodGrams > 0
    ? Math.max(10, Math.round(remainingFoodGrams / remainingMealsToday))
    : Math.round(dailyGoal / targetMeals);

  const predictions = activePuppy
    ? calculatePredictions(activePuppyActivities, activePuppy)
    : null;

  const handleUnlockWithSSO = (email: string, name: string, token: string) => {
    setAuthToken(token);
    const authenticatedUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name,
      role: email.toLowerCase() === 'matthieu.jacquet@gmail.com' ? 'SuperAdmin' : 'Member',
      status: 'ACTIVE',
    };
    setUser(authenticatedUser);
    setCurrentUser(name);
    return { success: true };
  };

  const handleSignOut = () => {
    clearAuthToken();
    clearAllData();
    setUser(null);
  };

  const handleSelectPuppy = (puppyId: string) => {
    setActivePuppyIdState(puppyId);
    setActivePuppyId(puppyId);
  };

  const handleAddPuppy = async (newPup: PuppyProfile) => {
    const created = await createDog(newPup);
    if (created) {
      setPuppies((prev) => [...prev, created]);
      handleSelectPuppy(created.id);
      showToast(t.toasts.dogRegistered.replace('{name}', created.name), 'success');
    }
  };

  const handleUpdatePuppy = (updatedPup: PuppyProfile) => {
    setPuppies((prev) => prev.map((p) => (p.id === updatedPup.id ? updatedPup : p)));
    showToast(t.toasts.dogUpdated, 'success');
  };

  const handleDeletePuppy = async (id: string) => {
    const success = await deleteDog(id);
    if (success) {
      const remaining = puppies.filter((p) => p.id !== id);
      setPuppies(remaining);
      if (activePuppyId === id && remaining.length > 0) {
        handleSelectPuppy(remaining[0].id);
      }
      showToast(t.toasts.dogDeleted, 'success');
    }
  };

  const handleAddCaretaker = async (newCaretaker: Caretaker) => {
    const created = await createCaretaker(newCaretaker);
    if (created) {
      setCaretakers((prev) => [...prev, created]);
      showToast(t.toasts.memberAdded, 'success');
    }
  };

  const handleUpdateCaretaker = async (id: string, updatedFields: Partial<Caretaker>) => {
    const res = await updateCaretaker({ id, ...updatedFields });
    if (res) {
      setCaretakers((prev) => prev.map((c) => (c.id === id ? { ...c, ...res } : c)));
    }
  };

  const handleDeleteCaretaker = async (id: string) => {
    const success = await deleteCaretaker(id);
    if (success) {
      setCaretakers((prev) => prev.filter((c) => c.id !== id));
      showToast(t.toasts.memberRemoved, 'success');
    }
  };

  const handleAddActivity = async (newActivity: Omit<Activity, 'id'>) => {
    const created = await createActivity(newActivity);
    if (created) {
      setActivities((prev) => [created, ...prev]);
      showToast(t.toasts.activityLogged, 'success');
    }
  };

  const handleUpdateActivity = async (updated: Partial<Activity> & { id: string }) => {
    const res = await updateActivity(updated);
    if (res) {
      setActivities((prev) => prev.map((act) => (act.id === updated.id ? { ...act, ...res } : act)));
    }
  };

  const handleDeleteActivity = async (id: string) => {
    const success = await deleteActivity(id);
    if (success) {
      setActivities((prev) => prev.filter((act) => act.id !== id));
      showToast(t.toasts.activityDeleted, 'success');
    }
  };

  const handleOpenQuickLogModal = (type?: ActivityType) => {
    if (!activePuppy) {
      showToast(t.toasts.selectPuppyFirst, 'danger');
      return;
    }
    setQuickLogType(type);
    setIsQuickLogOpen(true);
  };

  const handleQuickAction = async (type: ActivityType, defaultLocation?: PottyLocation) => {
    if (!activePuppy) {
      showToast(t.toasts.selectPuppyFirst, 'danger');
      return;
    }

    const newActivity: Omit<Activity, 'id'> = {
      puppyId: activePuppy.id,
      type,
      timestamp: new Date().toISOString(),
      pottyLocation: defaultLocation,
      loggedBy: currentUser,
    };

    await handleAddActivity(newActivity);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm font-bold text-slate-400 animate-pulse">Loading PupPace...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthLockScreen
        onUnlockWithSSO={handleUnlockWithSSO}
        onUnlockWithPassword={() => ({ success: false })}
        onRegisterAccount={() => ({ success: false })}
      />
    );
  }

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Streamlined Top Navbar */}
      <Navbar
        puppies={puppies}
        activePuppy={activePuppy}
        onSelectPuppy={handleSelectPuppy}
        user={user}
        onOpenQuickLog={() => handleOpenQuickLogModal('pee')}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
            onBackToDashboard={() => setCurrentView('dashboard')}
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
              <Button variant="primary" size="lg" onPress={() => setIsSettingsOpen(true)} className="inline-flex items-center gap-2 font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
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

            {/* Dashboard Main Grid (2 Columns on Desktop, 1 Column on Mobile) */}
            {activePuppy && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2 cols wide): Focused Activity Timeline (Pee, Poop, Food only) */}
                <div className="lg:col-span-2 space-y-6">
                  <ActivityTimeline
                    activities={activePuppyActivities}
                    caretakers={caretakers}
                    onDeleteActivity={handleDeleteActivity}
                    onUpdateActivity={handleUpdateActivity}
                  />
                </div>

                {/* Right Column (1 col wide): Dog Profile & Health Summary Card */}
                <div className="space-y-6">
                  <DogHealthSummary
                    profile={activePuppy}
                    activities={activePuppyActivities}
                    onOpenHealthPassport={() => setCurrentView('carnetdesante')}
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
            <Button variant="tertiary" size="sm" onPress={() => setCurrentView('carnetdesante')} className="text-slate-400 hover:text-white">Health Passport</Button>
            <span>&bull;</span>
            <Button variant="tertiary" size="sm" onPress={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-white">Settings</Button>
            <span>&bull;</span>
            <Button variant="tertiary" size="sm" onPress={handleSignOut} className="text-slate-400 hover:text-white">Sign Out</Button>
            <span>&bull;</span>
            <a href="/privacy" className="hover:text-slate-400 transition">Privacy</a>
            <span>&bull;</span>
            <a href="/terms" className="hover:text-slate-400 transition">Terms</a>
          </div>
        </div>
      </footer>

      {/* Settings & Administration Modal */}
      <SettingsAdminModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
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
      />

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
