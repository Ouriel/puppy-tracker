import { useState, useEffect } from 'react';
import type { Activity, ActivityType, Caretaker, FamilyRole, PottyLocation, PuppyProfile, UserAccount } from './types';
import {
  getInitialActivities,
  saveActivities,
  clearAllData,
  getStoredPuppies,
  savePuppies,
  getActivePuppyId,
  setActivePuppyId,
  getStoredUser,
  saveUser,
  getStoredCaretakers,
  saveCaretakers,
} from './utils/storage';
import { calculatePredictions } from './utils/predictions';
import { printVetReport } from './utils/export';

import { Navbar } from './components/Navbar';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { StatsAnalytics } from './components/StatsAnalytics';

import { QuickLogModal } from './components/QuickLogModal';
import { PuppyProfileModal } from './components/PuppyProfileModal';
import { AddPuppyModal } from './components/AddPuppyModal';
import { SharePackModal } from './components/SharePackModal';
import { CareGuideModal } from './components/CareGuideModal';

export function App() {
  const [puppies, setPuppies] = useState<PuppyProfile[]>(getStoredPuppies);
  const [activePuppyId, setActivePuppyIdState] = useState<string>(getActivePuppyId);

  const [activities, setActivities] = useState<Activity[]>(getInitialActivities);
  const [user, setUser] = useState<UserAccount>(getStoredUser);
  const [caretakers, setCaretakers] = useState<Caretaker[]>(getStoredCaretakers);
  const [currentUser, setCurrentUser] = useState<string>('Matthieu (Husband)');

  // Modals state
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<ActivityType>('pee');
  const [quickLogLocation, setQuickLogLocation] = useState<PottyLocation>('outside');

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddPuppyOpen, setIsAddPuppyOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCareGuideOpen, setIsCareGuideOpen] = useState(false);

  const activePuppy = puppies.find((p) => p.id === activePuppyId) || puppies[0];

  useEffect(() => {
    saveActivities(activities);
  }, [activities]);

  useEffect(() => {
    savePuppies(puppies);
  }, [puppies]);

  useEffect(() => {
    saveUser(user);
  }, [user]);

  useEffect(() => {
    saveCaretakers(caretakers);
  }, [caretakers]);

  const handleSelectPuppy = (id: string) => {
    setActivePuppyIdState(id);
    setActivePuppyId(id);
  };

  const handleAddPuppy = (newPuppy: PuppyProfile) => {
    setPuppies((prev) => [...prev, newPuppy]);
    setActivePuppyIdState(newPuppy.id);
    setActivePuppyId(newPuppy.id);
  };

  const handleOpenQuickLog = (type: ActivityType = 'pee', defaultLocation: PottyLocation = 'outside') => {
    setQuickLogType(type);
    setQuickLogLocation(defaultLocation);
    setIsQuickLogOpen(true);
  };

  const handleSaveActivity = (newActivity: Omit<Activity, 'id' | 'puppyId'>) => {
    const created: Activity = {
      ...newActivity,
      id: Date.now().toString(),
      puppyId: activePuppy.id,
    };
    setActivities((prev) => [created, ...prev]);
  };

  const handleDeleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearSampleData = () => {
    if (window.confirm('Are you sure you want to clear sample logs and start with a fresh blank timeline?')) {
      clearAllData();
      setActivities([]);
    }
  };

  const handleAddCaretaker = (caretaker: Caretaker) => {
    setCaretakers((prev) => [...prev, caretaker]);
  };

  const handleSwitchUserAccount = (name: string, role: FamilyRole) => {
    const formatted = `${name} (${role})`;
    setCurrentUser(formatted);
    setUser((prev) => ({ ...prev, name, role }));
  };

  const handleSaveProfile = (updatedProfile: PuppyProfile) => {
    setPuppies((prev) => prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p)));
  };

  const activePuppyActivities = activities.filter(
    (a) => !a.puppyId || a.puppyId === activePuppy.id
  );

  const accidents = activePuppyActivities.filter((a) => a.pottyLocation === 'indoor_accident');
  let streakDays = 0;
  if (accidents.length === 0) {
    streakDays = 5;
  } else {
    const latestAccidentDate = new Date(
      Math.max(...accidents.map((a) => new Date(a.timestamp).getTime()))
    );
    const diffMs = Date.now() - latestAccidentDate.getTime();
    streakDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  const predictions = calculatePredictions(activePuppyActivities, activePuppy);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        puppies={puppies}
        activePuppy={activePuppy}
        onSelectPuppy={handleSelectPuppy}
        onOpenAddPuppy={() => setIsAddPuppyOpen(true)}
        user={user}
        caretakers={caretakers}
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
        onOpenQuickLog={() => handleOpenQuickLog('pee', 'outside')}
        onOpenShareModal={() => setIsShareOpen(true)}
        onOpenVetReport={() => printVetReport(activePuppyActivities, activePuppy)}
        onOpenCareGuide={() => setIsCareGuideOpen(true)}
        onEditProfile={() => setIsProfileOpen(true)}
        onClearSampleData={handleClearSampleData}
        streakDays={streakDays}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PredictorWidget
          predictions={predictions}
          onQuickAction={(type, loc) => handleOpenQuickLog(type, loc || 'outside')}
        />

        <StatsAnalytics activities={activePuppyActivities} profile={activePuppy} />

        <ActivityTimeline
          activities={activePuppyActivities}
          caretakers={caretakers}
          onDeleteActivity={handleDeleteActivity}
        />
      </main>

      <QuickLogModal
        isOpen={isQuickLogOpen}
        initialType={quickLogType}
        initialLocation={quickLogLocation}
        caretakers={caretakers}
        currentUser={currentUser}
        onClose={() => setIsQuickLogOpen(false)}
        onSave={handleSaveActivity}
      />

      <PuppyProfileModal
        isOpen={isProfileOpen}
        profile={activePuppy}
        onClose={() => setIsProfileOpen(false)}
        onSave={handleSaveProfile}
      />

      <AddPuppyModal
        isOpen={isAddPuppyOpen}
        onClose={() => setIsAddPuppyOpen(false)}
        onAddPuppy={handleAddPuppy}
      />

      <SharePackModal
        isOpen={isShareOpen}
        user={user}
        caretakers={caretakers}
        onClose={() => setIsShareOpen(false)}
        onAddCaretaker={handleAddCaretaker}
        onSwitchUserAccount={handleSwitchUserAccount}
      />

      <CareGuideModal
        isOpen={isCareGuideOpen}
        onClose={() => setIsCareGuideOpen(false)}
      />
    </div>
  );
}

export default App;
