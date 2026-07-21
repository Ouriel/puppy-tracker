import { useState, useEffect } from 'react';
import type { Activity, ActivityType, Caretaker, PottyLocation, PuppyProfile } from './types';
import {
  getInitialActivities,
  saveActivities,
  getStoredProfile,
  saveProfile,
  getStoredCaretakers,
  saveCaretakers,
  getCurrentUser,
  setCurrentUser,
} from './utils/storage';
import { calculatePredictions } from './utils/predictions';
import { printVetReport } from './utils/export';

import { Navbar } from './components/Navbar';
import { PredictorWidget } from './components/PredictorWidget';
import { ActivityTimeline } from './components/ActivityTimeline';
import { StatsAnalytics } from './components/StatsAnalytics';

import { QuickLogModal } from './components/QuickLogModal';
import { PuppyProfileModal } from './components/PuppyProfileModal';
import { SharePackModal } from './components/SharePackModal';
import { CareGuideModal } from './components/CareGuideModal';

export function App() {
  const [activities, setActivities] = useState<Activity[]>(getInitialActivities);
  const [profile, setProfile] = useState<PuppyProfile>(getStoredProfile);
  const [caretakers, setCaretakers] = useState<Caretaker[]>(getStoredCaretakers);
  const [currentUser, setCurrentUserState] = useState<string>(getCurrentUser);

  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogType, setQuickLogType] = useState<ActivityType>('pee');
  const [quickLogLocation, setQuickLogLocation] = useState<PottyLocation>('outside');

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCareGuideOpen, setIsCareGuideOpen] = useState(false);

  useEffect(() => {
    saveActivities(activities);
  }, [activities]);

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    saveCaretakers(caretakers);
  }, [caretakers]);

  const handleSelectUser = (user: string) => {
    setCurrentUserState(user);
    setCurrentUser(user);
  };

  const handleOpenQuickLog = (type: ActivityType = 'pee', defaultLocation: PottyLocation = 'outside') => {
    setQuickLogType(type);
    setQuickLogLocation(defaultLocation);
    setIsQuickLogOpen(true);
  };

  const handleSaveActivity = (newActivity: Omit<Activity, 'id'>) => {
    const created: Activity = {
      ...newActivity,
      id: Date.now().toString(),
    };
    setActivities((prev) => [created, ...prev]);
  };

  const handleDeleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAddCaretaker = (caretaker: Caretaker) => {
    setCaretakers((prev) => [...prev, caretaker]);
  };

  const accidents = activities.filter((a) => a.pottyLocation === 'indoor_accident');
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

  const predictions = calculatePredictions(activities, profile);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        profile={profile}
        caretakers={caretakers}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        onOpenQuickLog={() => handleOpenQuickLog('pee', 'outside')}
        onOpenShareModal={() => setIsShareOpen(true)}
        onOpenVetReport={() => printVetReport(activities, profile)}
        onOpenCareGuide={() => setIsCareGuideOpen(true)}
        onEditProfile={() => setIsProfileOpen(true)}
        streakDays={streakDays}
      />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PredictorWidget
          predictions={predictions}
          onQuickAction={(type, loc) => handleOpenQuickLog(type, loc || 'outside')}
        />

        <StatsAnalytics activities={activities} profile={profile} />

        <ActivityTimeline
          activities={activities}
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
        profile={profile}
        onClose={() => setIsProfileOpen(false)}
        onSave={setProfile}
      />

      <SharePackModal
        isOpen={isShareOpen}
        caretakers={caretakers}
        onClose={() => setIsShareOpen(false)}
        onAddCaretaker={handleAddCaretaker}
      />

      <CareGuideModal
        isOpen={isCareGuideOpen}
        onClose={() => setIsCareGuideOpen(false)}
      />
    </div>
  );
}

export default App;
