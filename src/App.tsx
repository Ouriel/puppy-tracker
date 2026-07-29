import React, { useState, useEffect } from 'react';
import type { Activity, Caretaker, FamilyRole, PuppyProfile, UserAccount, ActivityType, PottyLocation } from './types';
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
  deleteActivity,
  fetchHousehold,
  fetchHealthRecords,
  createCaretaker,
  deleteCaretaker,
  exchangeSessionToken,
} from './services/api';
import { calculatePredictions } from './utils/predictions';
import { formatLocalDate, isSameLocalDate } from './utils/date';
import { Navbar, type MainTabType } from './components/Navbar';
import { QuickLogModal } from './components/QuickLogModal';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { StatsAnalytics } from './components/StatsAnalytics';
import { WeightGrowthChart } from './components/WeightGrowthChart';
import { AuthLockScreen } from './components/AuthLockScreen';
import { ToastContainer } from './components/Toast';
import { HouseholdSettingsView } from './views/HouseholdSettingsView';
import { AdminView } from './views/AdminView';
import { CareGuideView } from './views/CareGuideView';
import { CarnetDeSanteView } from './views/CarnetDeSanteView';
import { useI18n } from './i18n';
import { showToast } from './utils/toast';
import { Dog, Plus } from 'lucide-react';

export function App() {
  const { lang, changeLanguage, t } = useI18n();

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authentication & Lock Screen
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!getAuthToken();
  });
  const [user, setUser] = useState<UserAccount>(getStoredUser);
  const [caretakers, setCaretakers] = useState<Caretaker[]>(getStoredCaretakers);
  const [currentUser, setCurrentUser] = useState<string>(() => {
    const initialUser = getStoredUser();
    return initialUser.name;
  });

  // Listen for 401/403 unauthorized events to lock vault & prompt re-auth
  useEffect(() => {
    const onUnauthorized = () => {
      handleSignOut();
      showToast('Session expired. Please sign in with Google.', 'error');
    };
    window.addEventListener('puppace:unauthorized', onUnauthorized);
    return () => window.removeEventListener('puppace:unauthorized', onUnauthorized);
  }, []);

  // Main Page Navigation Tabs with Clean English Technical URL Routing
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('dashboard');

  // URL Path Synchronization
  useEffect(() => {
    const syncRouteWithTab = () => {
      const path = window.location.pathname;
      if (path === '/health-passport' || path === '/carnet-de-sante') {
        setActiveMainTab('carnetdesante');
      } else if (path === '/settings') {
        setActiveMainTab('settings');
      } else if (path === '/care-guide') {
        setActiveMainTab('careguide');
      } else if (path === '/admin') {
        setActiveMainTab('admin');
      } else {
        setActiveMainTab('dashboard');
      }
    };
    syncRouteWithTab();
    window.addEventListener('popstate', syncRouteWithTab);
    return () => window.removeEventListener('popstate', syncRouteWithTab);
  }, []);

  const handleSelectMainTab = (tab: MainTabType) => {
    setActiveMainTab(tab);
    const routeMap: Record<MainTabType, string> = {
      dashboard: '/',
      carnetdesante: '/health-passport',
      settings: '/settings',
      careguide: '/care-guide',
      admin: '/admin',
    };
    if (window.location.pathname !== routeMap[tab]) {
      window.history.pushState({}, '', routeMap[tab]);
    }
  };

  // Multi-Puppy State
  const [puppies, setPuppies] = useState<PuppyProfile[]>([]);
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId);

  // Activities State
  const [activities, setActivities] = useState<Activity[]>([]);

  // Quick Action Modal
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<ActivityType>('pee');



  // Synchronous Parallel Database Load via REST API
  useEffect(() => {
    async function loadDatabaseState() {
      if (!getAuthToken()) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [remoteDogs, remoteActivities, hhRes] = await Promise.all([
          fetchDogs(),
          fetchActivities(),
          fetchHousehold(),
        ]);

        // Background session token upgrade to long-lived 90-day PupPace Session Token
        exchangeSessionToken().then((res) => {
          if (res?.sessionToken) {
            setAuthToken(res.sessionToken);
            if (res.user) {
              setUser((previous) => ({
                ...previous,
                email: res.user.email,
                name: res.user.name,
                role: res.user.role as FamilyRole,
              }));
            }
          }
        }).catch(() => {});

        if (remoteDogs) {
          setPuppies(remoteDogs);
          const targetId = activePuppyId || (remoteDogs.length > 0 ? remoteDogs[0].id : null);
          if (remoteDogs.length > 0 && !activePuppyId) {
            setActivePuppyIdState(remoteDogs[0].id);
          }
          if (targetId) {
            // Warm up SWR cache for instant Carnet de Santé tab switching
            Promise.all([
              fetchHealthRecords(targetId, 'vaccination'),
              fetchHealthRecords(targetId, 'deworming'),
            ]).catch(() => {});
          }
        }

        if (remoteActivities) {
          setActivities(remoteActivities);
        }

        if (hhRes?.caretakers && hhRes.caretakers.length > 0) {
          setCaretakers(hhRes.caretakers);
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadDatabaseState();
  }, [isAuthenticated, activePuppyId]);

  const activePuppy = puppies.find((puppy) => puppy.id === activePuppyId) || (puppies.length > 0 ? puppies[0] : null);

  const handleSelectPuppy = (id: string) => {
    setActivePuppyIdState(id);
    setActivePuppyId(id);
  };

  const handleAddPuppy = async (newPuppy: PuppyProfile) => {
    const created = await createDog(newPuppy);
    if (created) {
      setPuppies((previous) => [...previous, created]);
      handleSelectPuppy(created.id);
      showToast(`${created.name} registered!`, 'success');
    }
  };

  const handleUpdatePuppy = (updatedPuppy: PuppyProfile) => {
    createDog(updatedPuppy).then((updated) => {
      if (updated) {
        setPuppies((previous) => previous.map((puppy) => (puppy.id === updated.id ? updated : puppy)));
        showToast('Dog profile updated.', 'success');
      }
    });
  };

  const handleDeletePuppy = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this puppy profile and its associated logs?')) {
      const ok = await deleteDog(id);
      if (ok) {
        const updated = puppies.filter((puppy) => puppy.id !== id);
        setPuppies(updated);
        setActivities((previous) => previous.filter((activity) => activity.puppyId !== id));
        if (activePuppyId === id && updated.length > 0) {
          handleSelectPuppy(updated[0].id);
        }
        showToast('Dog profile deleted.', 'success');
      }
    }
  };

  const handleAddCaretaker = async (newCaretaker: Caretaker) => {
    const created = await createCaretaker(newCaretaker);
    if (created) {
      setCaretakers((previous) => [...previous, created]);
      showToast('Caretaker added.', 'success');
    }
  };

  const handleDeleteCaretaker = async (id: string) => {
    const ok = await deleteCaretaker(id);
    if (ok) {
      setCaretakers((previous) => previous.filter((caretaker) => caretaker.id !== id));
      showToast('Caretaker removed.', 'success');
    }
  };

  const handleSwitchUserAccount = (name: string, role: FamilyRole) => {
    setCurrentUser(name);
    setUser((previous) => ({ ...previous, name, role }));
  };

  const handleUnlockWithSSO = (email: string, name: string, token: string) => {
    setAuthToken(token);
    setIsAuthenticated(true);
    setUser((previous) => ({ ...previous, email, name }));

    // Exchange Google 1-hour ID Token for long-lived 90-day PupPace Session Token
    exchangeSessionToken(token).then((res) => {
      if (res?.sessionToken) {
        setAuthToken(res.sessionToken);
        if (res.user) {
          setUser((previous) => ({
            ...previous,
            email: res.user.email,
            name: res.user.name,
            role: res.user.role as FamilyRole,
          }));
        }
      }
    }).catch(() => {});

    return { success: true };
  };

  const handleSignOut = () => {
    clearAuthToken();
    setIsAuthenticated(false);
  };

  const handleQuickAction = async (
    type: ActivityType,
    defaultLocation?: PottyLocation
  ) => {
    if (!activePuppy) {
      showToast(t.toasts.selectPuppyFirst, 'error');
      return;
    }

    const defaultPortionGrams = Math.round((activePuppy.dailyFoodGramGoal || 240) / Math.max(1, activePuppy.targetMealsPerDay || 3));

    const newActivity: Omit<Activity, 'id'> = {
      puppyId: activePuppy.id,
      type,
      timestamp: new Date().toISOString(),
      loggedBy: currentUser,
      ...(defaultLocation ? { pottyLocation: defaultLocation } : {}),
      ...(type === 'food' ? { foodType: 'kibble', quantityGrams: defaultPortionGrams } : {}),
    };

    const created = await createActivity(newActivity);
    if (created) {
      setActivities((previous) => [created, ...previous]);
      showToast(t.toasts.activityLogged, 'success');
    }
  };

  const handleOpenQuickLogModal = (type?: ActivityType) => {
    if (type) setQuickLogType(type);
    setIsQuickLogOpen(true);
  };

  const handleAddActivity = async (activityData: Omit<Activity, 'id' | 'puppyId'>) => {
    if (!activePuppy) return;
    const fullActivity: Omit<Activity, 'id'> = {
      ...activityData,
      puppyId: activePuppy.id,
    };
    const created = await createActivity(fullActivity);
    if (created) {
      setActivities((previous) => [created, ...previous]);
      showToast(t.toasts.activityLogged, 'success');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    const ok = await deleteActivity(id);
    if (ok) {
      setActivities((previous) => previous.filter((activity) => activity.id !== id));
      showToast(t.toasts.activityDeleted, 'success');
    }
  };

  const handleClearSampleData = () => {
    if (window.confirm('Clear all local state?')) {
      clearAllData();
      setActivities([]);
    }
  };

  const handleExportVetSummary = () => {
    window.print();
  };

  // Filter activities for active puppy
  const activePuppyActivities = React.useMemo(() => {
    if (!activePuppy) return [];
    return activities.filter((activity) => !activity.puppyId || activity.puppyId === activePuppy.id);
  }, [activities, activePuppy]);

  const predictions = React.useMemo(() => {
    if (!activePuppy) return null;
    return calculatePredictions(activePuppyActivities, activePuppy);
  }, [activePuppyActivities, activePuppy]);

  // Calculate today's logged food grams
  const todayFoodLoggedGrams = React.useMemo(() => {
    const now = new Date();
    return activePuppyActivities
      .filter((activity) => activity.type === 'food' && isSameLocalDate(activity.timestamp, now))
      .reduce((sum, activity) => sum + (activity.quantityGrams || 80), 0);
  }, [activePuppyActivities]);

  // Potty clean streak calculation: count unique calendar days with potty logs without accidents
  const streakDays = React.useMemo(() => {
    const pottyLogs = activePuppyActivities.filter((activity) => activity.type === 'pee' || activity.type === 'poop');
    if (pottyLogs.length === 0) return 0;

    const accidents = pottyLogs.filter((activity) => activity.pottyLocation === 'indoor_accident');
    if (accidents.length > 0) {
      const latestAccidentMs = Math.max(...accidents.map((activity) => new Date(activity.timestamp).getTime()));
      const diffMs = Date.now() - latestAccidentMs;
      if (diffMs < 0) return 0;
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    const uniqueDays = new Set(
      pottyLogs.map((activity) => formatLocalDate(new Date(activity.timestamp)))
    );
    return uniqueDays.size;
  }, [activePuppyActivities]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
        <p className="text-xs font-semibold text-slate-400">Loading PupPace...</p>
      </div>
    );
  }

  // If locked, render Lock Screen
  if (!isAuthenticated) {
    return (
      <>
        <ToastContainer />
        <AuthLockScreen
          onUnlockWithSSO={handleUnlockWithSSO}
          onUnlockWithPassword={() => ({ success: false })}
          onRegisterAccount={() => ({ success: false })}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <ToastContainer />
      {/* Top Navbar */}
      <Navbar
        activeMainTab={activeMainTab}
        onSelectMainTab={handleSelectMainTab}
        puppies={puppies}
        activePuppy={activePuppy}
        onSelectPuppy={handleSelectPuppy}
        user={user}
        onOpenQuickLog={() => handleOpenQuickLogModal('pee')}
        onOpenVetReport={handleExportVetSummary}
        onClearSampleData={handleClearSampleData}
        onSignOut={handleSignOut}
        streakDays={streakDays}
        lang={lang}
        onLanguageChange={changeLanguage}
        t={t}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {/* Render Active Tab Page */}
        {activeMainTab === 'settings' && (
          <HouseholdSettingsView
            puppies={puppies}
            activePuppyId={activePuppyId}
            onSelectPuppy={handleSelectPuppy}
            onAddPuppy={handleAddPuppy}
            onUpdatePuppy={handleUpdatePuppy}
            onDeletePuppy={handleDeletePuppy}
            user={user}
            caretakers={caretakers}
            currentUser={currentUser}
            onAddCaretaker={handleAddCaretaker}
            onDeleteCaretaker={handleDeleteCaretaker}
            onSwitchUserAccount={handleSwitchUserAccount}
          />
        )}

        {activeMainTab === 'carnetdesante' && (
          <CarnetDeSanteView activePuppy={activePuppy} />
        )}

        {activeMainTab === 'admin' && (
          <AdminView
            token="demo-token"
            currentUserEmail={user.email}
          />
        )}

        {activeMainTab === 'careguide' && (
          <CareGuideView onBackToDashboard={() => handleSelectMainTab('dashboard')} />
        )}

        {activeMainTab === 'dashboard' && (
          <>
            {/* If 0 puppies exist, show clean welcome prompt to create first puppy */}
            {puppies.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-2xl max-w-lg mx-auto my-12">
                <div className="p-4 bg-indigo-950 text-indigo-400 rounded-2xl inline-block border border-indigo-800/50">
                  <Dog className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-extrabold text-white">{t.dashboard.welcomeTitle}</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {t.dashboard.welcomeSubtitle}
                </p>
                <button
                  onClick={() => handleSelectMainTab('settings')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg transition active:scale-95 cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.dashboard.registerDog}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Puppy Prediction Card */}
                {predictions && activePuppy && (
                  <PredictorWidget
                    predictions={predictions}
                    profile={activePuppy}
                    todayFoodLoggedGrams={todayFoodLoggedGrams}
                    onQuickAction={handleQuickAction}
                    onOpenQuickLogModal={handleOpenQuickLogModal}
                  />
                )}

                {/* Analytics */}
                {activePuppy && <StatsAnalytics activities={activePuppyActivities} profile={activePuppy} />}

                {/* Interactive Weight Growth Curve Chart */}
                {activePuppy && (
                  <WeightGrowthChart
                    activities={activePuppyActivities}
                    profile={activePuppy}
                    onOpenQuickLogModal={handleOpenQuickLogModal}
                  />
                )}

                {/* Activity Timeline */}
                <ActivityTimeline
                  activities={activePuppyActivities}
                  caretakers={caretakers}
                  onDeleteActivity={handleDeleteActivity}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>PupPace &bull; Household Puppy Sync Platform</span>
          <div className="flex items-center gap-3">
            <button onClick={() => handleSelectMainTab('carnetdesante')} className="hover:text-slate-400 transition cursor-pointer">
              {t.nav.carnetDeSante}
            </button>
            <span>&bull;</span>
            <button onClick={() => handleSelectMainTab('careguide')} className="hover:text-slate-400 transition cursor-pointer">{t.nav.careGuide}</button>
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
          isOpen={isQuickLogOpen}
          initialType={quickLogType}
          defaultMealPortionGrams={Math.round((activePuppy.dailyFoodGramGoal || 240) / Math.max(1, activePuppy.targetMealsPerDay || 3))}
          onClose={() => setIsQuickLogOpen(false)}
          onSave={handleAddActivity}
          caretakers={caretakers}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default App;
