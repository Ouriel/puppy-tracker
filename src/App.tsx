import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Activity, UserAccount, ActivityType, PottyLocation, FamilyRole } from './types';
import { getAuthToken, setAuthToken, getStoredAuthUser, setStoredAuthUser } from './utils/auth';
import { isSuperAdminEmail } from './constants/auth';
import {
  fetchDogs,
  fetchHousehold,
  exchangeSessionToken,
} from './services/api';
import { calculatePredictions, calculateNextMealPortion } from './utils/predictions';
import { getEffectivePuppyWeight } from './utils/weight';
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
            role: (['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'SuperAdmin'].includes(sessionData.user.role) ? sessionData.user.role : 'Member') as FamilyRole,
          };
          setUser(userAccount);
          setStoredAuthUser(userAccount);
        } else if (!getStoredAuthUser()) {
          setUser(null);
        }
      } else {
        setUser(null);
        setStoredAuthUser(null);
      }

      const remoteDogs = await fetchDogs();
      if (remoteDogs && remoteDogs.length > 0) {
        puppyState.setPuppies(remoteDogs);
        if (!puppyState.activePuppyId || !remoteDogs.some((p) => p.id === puppyState.activePuppyId)) {
          puppyState.selectPuppy(remoteDogs[0].id);
        }
      }

      const remoteHousehold = await fetchHousehold();
      if (remoteHousehold?.caretakers && remoteHousehold.caretakers.length > 0) {
        caretakerState.setCaretakers(remoteHousehold.caretakers);
      }

      setIsLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [puppyState.activePuppy, caretakerState.currentUser, activityState.addActivity, nextMealPortionGrams]);

  const handleOpenQuickLogModal = useCallback((type?: ActivityType) => {
    setQuickLogType(type || 'pee');
    setIsQuickLogOpen(true);
  }, []);

  const handleUnlockWithSSO = (email: string, name: string, token: string) => {
    setAuthToken(token);
    const isSuper = isSuperAdminEmail(email);
    const newUser: UserAccount = {
      id: `u-${Date.now()}`,
      email,
      name,
      role: isSuper ? 'SuperAdmin' : 'Member',
    };
    setUser(newUser);
    setStoredAuthUser(newUser);

    // Sync session and load dogs in background
    exchangeSessionToken(token).then((sessionData) => {
      if (sessionData?.user) {
        const updatedUser: UserAccount = {
          id: sessionData.user.id || `u-${Date.now()}`,
          email: sessionData.user.email,
          name: sessionData.user.name,
          role: (['Husband', 'Wife', 'Partner', 'Child', 'Dog Walker', 'Sitter', 'Relative', 'Member', 'SuperAdmin'].includes(sessionData.user.role) ? sessionData.user.role : 'Member') as FamilyRole,
        };
        setUser(updatedUser);
        setStoredAuthUser(updatedUser);
      }
      fetchDogs().then((remoteDogs) => {
        if (remoteDogs && remoteDogs.length > 0) {
          puppyState.setPuppies(remoteDogs);
          if (!puppyState.activePuppyId || !remoteDogs.some((p) => p.id === puppyState.activePuppyId)) {
            puppyState.selectPuppy(remoteDogs[0].id);
          }
        }
      });
      fetchHousehold().then((remoteHousehold) => {
        if (remoteHousehold?.caretakers && remoteHousehold.caretakers.length > 0) {
          caretakerState.setCaretakers(remoteHousehold.caretakers);
        }
      });
    });

    return { success: true };
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
          <CarnetDeSanteView
            activePuppy={puppyState.activePuppy}
            activities={activityState.activities}
            onOpenQuickLogModal={handleOpenQuickLogModal}
            onBackToDashboard={() => handleNavigate('dashboard')}
            onDeleteActivity={activityState.deleteActivity}
          />
        ) : currentView === 'settings' ? (
          /* Full Page View for Settings & Administration */
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
                onOpenHealthPassport={() => handleNavigate('carnetdesante')}
                lang={lang}
              />
            )}

            {/* Main Activity Timeline & Log History */}
            <ActivityTimeline
              activities={activePuppyActivities}
              caretakers={caretakerState.caretakers}
              onDeleteActivity={activityState.deleteActivity}
              onUpdateActivity={activityState.updateActivity}
              hasMoreRemote={activityState.hasMoreRemoteActivities}
              onLoadMore={activityState.loadMoreActivities}
              isLoadingMore={activityState.isFetchingMoreActivities}
            />
          </div>
        )}
      </main>

      {/* Quick Log Modal Component */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        initialType={quickLogType}
        onSave={activityState.addActivity}
        currentUser={caretakerState.currentUser}
        defaultMealPortionGrams={nextMealPortionGrams}
        defaultWeightKg={lastWeightLogKg}
      />
    </div>
  );
}

export default App;
