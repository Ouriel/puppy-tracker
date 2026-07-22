import React, { useState, useEffect } from 'react';
import type { Activity, Caretaker, FamilyRole, PuppyProfile, UserAccount, ActivityType, PottyLocation } from './types';
import {
  getInitialActivities,
  saveActivities,
  getStoredPuppies,
  savePuppies,
  getActivePuppyId,
  setActivePuppyId,
  getStoredUser,
  saveUser,
  getStoredCaretakers,
  saveCaretakers,
  clearAllData,
} from './utils/storage';
import { calculatePredictions } from './utils/predictions';
import { Navbar, type MainTabType } from './components/Navbar';
import { QuickLogModal } from './components/QuickLogModal';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { StatsAnalytics } from './components/StatsAnalytics';
import { AuthLockScreen } from './components/AuthLockScreen';
import { HouseholdSettingsView } from './views/HouseholdSettingsView';
import { AdminView } from './views/AdminView';
import { CareGuideView } from './views/CareGuideView';
import { CarnetDeSanteView } from './views/CarnetDeSanteView';
import { useI18n } from './i18n';
import { Dog, Plus } from 'lucide-react';

export function App() {
  const { lang, changeLanguage, t } = useI18n();

  // Authentication & Lock Screen
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('puppace_unlocked_v4') === 'true';
  });
  const [user, setUser] = useState<UserAccount>(getStoredUser);
  const [caretakers, setCaretakers] = useState<Caretaker[]>(getStoredCaretakers);
  const [currentUser, setCurrentUser] = useState<string>(() => {
    const initialUser = getStoredUser();
    return initialUser.name;
  });

  // Main Page Navigation Tabs with Clean English Technical URL Routing
  const [activeMainTab, setActiveMainTab] = useState<MainTabType>('dashboard');

  // URL Path Synchronization (Technical URLs are strictly English)
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
    // Strict English Technical URLs
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
  const [puppies, setPuppies] = useState<PuppyProfile[]>(getStoredPuppies);
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId);

  // Activities State
  const [activities, setActivities] = useState<Activity[]>(getInitialActivities);

  // Quick Action Modal with selectable initial activity type
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<ActivityType>('pee');

  // Save changes to localStorage
  useEffect(() => {
    savePuppies(puppies);
  }, [puppies]);

  useEffect(() => {
    saveActivities(activities);
  }, [activities]);

  useEffect(() => {
    saveUser(user);
  }, [user]);

  useEffect(() => {
    saveCaretakers(caretakers);
  }, [caretakers]);

  const activePuppy = puppies.find((p) => p.id === activePuppyId) || (puppies.length > 0 ? puppies[0] : null);

  const handleSelectPuppy = (id: string) => {
    setActivePuppyIdState(id);
    setActivePuppyId(id);
  };

  const handleAddPuppy = (newPuppy: PuppyProfile) => {
    const updated = [...puppies, newPuppy];
    setPuppies(updated);
    handleSelectPuppy(newPuppy.id);
  };

  const handleUpdatePuppy = (updatedPuppy: PuppyProfile) => {
    setPuppies((prev) => prev.map((p) => (p.id === updatedPuppy.id ? updatedPuppy : p)));
  };

  const handleDeletePuppy = (id: string) => {
    if (window.confirm('Are you sure you want to delete this puppy profile and its associated logs?')) {
      const updated = puppies.filter((p) => p.id !== id);
      setPuppies(updated);
      setActivities((prev) => prev.filter((a) => a.puppyId !== id));
      if (activePuppyId === id && updated.length > 0) {
        handleSelectPuppy(updated[0].id);
      }
    }
  };

  const handleAddCaretaker = (newCaretaker: Caretaker) => {
    setCaretakers((prev) => [...prev, newCaretaker]);
  };

  const handleDeleteCaretaker = (id: string) => {
    setCaretakers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSwitchUserAccount = (name: string, role: FamilyRole) => {
    setCurrentUser(name);
    setUser((prev) => ({ ...prev, name, role }));
  };

  const handleUnlockWithSSO = (email: string, name: string) => {
    localStorage.setItem('puppace_unlocked_v4', 'true');
    setIsAuthenticated(true);
    setUser((prev) => ({ ...prev, email, name }));
    return { success: true };
  };

  const handleUnlockWithPassword = (email: string) => {
    localStorage.setItem('puppace_unlocked_v4', 'true');
    setIsAuthenticated(true);
    setUser((prev) => ({ ...prev, email }));
    return { success: true };
  };

  const handleRegisterAccount = (email: string, _pass: string, name: string, role: string) => {
    const isSuperAdmin = email.toLowerCase() === 'matthieu.jacquet@gmail.com';
    if (isSuperAdmin) {
      localStorage.setItem('puppace_unlocked_v4', 'true');
      setIsAuthenticated(true);
      setUser((prev) => ({ ...prev, email, name, role: role as FamilyRole }));
      return { success: true };
    }
    return { success: false, isPending: true };
  };

  const handleLockVault = () => {
    localStorage.removeItem('puppace_unlocked_v4');
    setIsAuthenticated(false);
  };

  const handleAddActivity = (newActivity: Omit<Activity, 'id' | 'puppyId'>) => {
    if (!activePuppy) return;
    const fullActivity: Activity = {
      ...newActivity,
      id: `act-${Date.now()}`,
      puppyId: activePuppy.id,
    };
    setActivities((prev) => [fullActivity, ...prev]);
  };

  const handleOpenQuickLogModal = (type: ActivityType = 'pee') => {
    setQuickLogType(type);
    setIsQuickLogOpen(true);
  };

  const handleQuickAction = (type: ActivityType, defaultLocation?: PottyLocation) => {
    if (type === 'food') {
      handleOpenQuickLogModal('food');
      return;
    }
    if (!activePuppy) return;
    const newAct: Omit<Activity, 'id' | 'puppyId'> = {
      type,
      timestamp: new Date().toISOString(),
      loggedBy: currentUser,
      pottyLocation: defaultLocation || (type === 'pee' || type === 'poop' ? 'outside' : undefined),
    };
    handleAddActivity(newAct);
  };

  const handleDeleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearSampleData = () => {
    if (window.confirm('Clear all activity logs?')) {
      clearAllData();
      setActivities([]);
    }
  };

  const handleExportVetSummary = () => {
    window.print();
  };

  // Filter activities for active puppy
  const activePuppyActivities = activePuppy
    ? activities.filter((a) => !a.puppyId || a.puppyId === activePuppy.id)
    : [];

  const predictions = React.useMemo(() => {
    if (!activePuppy) return null;
    return calculatePredictions(activePuppyActivities, activePuppy);
  }, [activePuppyActivities, activePuppy]);

  // Calculate today's logged food grams
  const todayFoodLoggedGrams = React.useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return activePuppyActivities
      .filter((a) => a.type === 'food' && a.timestamp.slice(0, 10) === todayStr)
      .reduce((sum, a) => sum + (a.quantityGrams || 80), 0);
  }, [activePuppyActivities]);

  // Potty clean streak calculation fix: 0 days if no activities!
  const streakDays = React.useMemo(() => {
    if (activePuppyActivities.length === 0) return 0;
    const accidents = activePuppyActivities.filter((a) => a.pottyLocation === 'indoor_accident');
    if (accidents.length === 0) {
      const oldestTimestamp = Math.min(...activePuppyActivities.map((a) => new Date(a.timestamp).getTime()));
      const diffHours = (Date.now() - oldestTimestamp) / (1000 * 60 * 60);
      return Math.max(1, Math.floor(diffHours / 24) + 1);
    }
    const latestAccident = Math.max(...accidents.map((a) => new Date(a.timestamp).getTime()));
    const diffHours = (Date.now() - latestAccident) / (1000 * 60 * 60);
    return Math.floor(diffHours / 24);
  }, [activePuppyActivities]);

  // If locked, render Lock Screen
  if (!isAuthenticated) {
    return (
      <AuthLockScreen
        onUnlockWithSSO={handleUnlockWithSSO}
        onUnlockWithPassword={handleUnlockWithPassword}
        onRegisterAccount={handleRegisterAccount}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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
        onLockVault={handleLockVault}
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
            <button onClick={() => handleSelectMainTab('carnetdesante')} className="hover:text-slate-400 transition">
              {lang === 'fr' ? 'Carnet de Santé' : 'Health Passport'}
            </button>
            <span>&bull;</span>
            <button onClick={() => handleSelectMainTab('careguide')} className="hover:text-slate-400 transition">Care Guide</button>
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
