import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { PuppyProfile, Activity, HealthRecord, HealthRecordsLoadState, ActivityType } from '../types';
import { Syringe, ArrowLeft, Printer, Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatBreedName } from '../data/breedsCatalog';
import { Card } from '@heroui/react';
import { PageHeader } from '../components/common/PageHeader';
import { fetchHealthRecords } from '../services/api';
import { WeightGrowthChart } from '../components/WeightGrowthChart';
import { HealthDueList } from '../components/HealthDueList';
import { VaccineSection } from './carnet/VaccineSection';
import { DewormingSection } from './carnet/DewormingSection';
import { MedicationSection } from './carnet/MedicationSection';
import { printHealthPassportReport, exportHealthPassportToCSV } from '../utils/export';
import { getUnifiedWeightEntries } from '../utils/weight';
import { getPuppyAge } from '../utils/predictions';

interface CarnetDeSanteViewProps {
  activePuppy: PuppyProfile | null;
  medicationActivities?: Activity[]; // every medication of the dog, whatever its date
  weightActivities: Activity[]; // every weigh-in of the dog, whatever its date
  healthRecords: HealthRecord[]; // every dog's, from /api/dashboard: the dashboard card reads the same list
  setHealthRecords: React.Dispatch<React.SetStateAction<HealthRecord[]>>;
  isDashboardDown: boolean;
  healthRecordsState?: HealthRecordsLoadState; // until known: skeletons or one "unavailable" line, never "nothing recorded" or a made-up weight
  currentUser: string;
  onAddActivity: (activity: Omit<Activity, 'id'>) => void;
  onUpdateActivity: (updated: Partial<Activity> & { id: string }) => Promise<boolean>;
  onOpenQuickLogModal?: (type: ActivityType) => void;
  onBackToDashboard?: () => void;
  onDeleteActivity?: (id: string) => void;
}

const sortByDateDesc = (records: HealthRecord[]): HealthRecord[] => {
  return [...records].sort(
    (recordA, recordB) => new Date(recordB.date).getTime() - new Date(recordA.date).getTime()
  );
};

export const CarnetDeSanteView: React.FC<CarnetDeSanteViewProps> = ({
  activePuppy,
  medicationActivities = [],
  weightActivities,
  healthRecords,
  setHealthRecords,
  isDashboardDown,
  healthRecordsState = 'loaded',
  currentUser,
  onAddActivity,
  onUpdateActivity,
  onOpenQuickLogModal,
  onBackToDashboard,
  onDeleteActivity,
}) => {
  const { t, lang } = useI18n();

  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  // The fallback load's answer, while /api/dashboard fails
  const [fallbackAnswer, setFallbackAnswer] = useState<{ puppyId: string; ok: boolean } | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  const age = activePuppy ? getPuppyAge(activePuppy.birthDate) : null;
  const identity = activePuppy && age
    ? [
      activePuppy.name,
      activePuppy.gender && (activePuppy.gender === 'female' ? t.puppies.female : t.puppies.male),
      formatBreedName(activePuppy.breed, lang),
      age.weeks < 16 ? t.weightChart.weeksOld.replace('{weeks}', String(age.weeks)) : t.weightChart.monthsOld.replace('{months}', String(Math.floor(age.months))),
    ].filter(Boolean).join(' · ')
    : '';

  // While /api/dashboard fails, this dog's own load decides: loading until it answers
  const fallbackForDog = fallbackAnswer?.puppyId === activePuppy?.id ? fallbackAnswer : null;
  const recordsState: HealthRecordsLoadState = healthRecordsState !== 'failed' ? healthRecordsState
    : !fallbackForDog ? 'loading' : fallbackForDog.ok ? 'loaded' : 'failed';

  const lastWeighIn = useMemo(() => getUnifiedWeightEntries(weightActivities).at(-1), [weightActivities]);

  const puppyRecords = useMemo(
    () => sortByDateDesc(healthRecords.filter((record) => record.puppyId === activePuppy?.id)),
    [healthRecords, activePuppy?.id]
  );
  const vaccinations = useMemo(() => puppyRecords.filter((record) => record.type === 'vaccination'), [puppyRecords]);
  const dewormingLogs = useMemo(() => puppyRecords.filter((record) => record.type === 'deworming'), [puppyRecords]);

  const handleExportPdf = useCallback(() => {
    setIsExportMenuOpen(false);
    if (!activePuppy) return;
    printHealthPassportReport(activePuppy, vaccinations, dewormingLogs, weightActivities, lang as 'en' | 'fr', t);
  }, [activePuppy, vaccinations, dewormingLogs, weightActivities, lang, t]);

  const handleExportCsv = useCallback(() => {
    setIsExportMenuOpen(false);
    if (!activePuppy) return;
    exportHealthPassportToCSV(activePuppy, vaccinations, dewormingLogs, weightActivities, lang as 'en' | 'fr');
  }, [activePuppy, vaccinations, dewormingLogs, weightActivities, lang]);

  // Fallback only: the records come with /api/dashboard
  useEffect(() => {
    const puppyId = activePuppy?.id;
    if (!isDashboardDown || !puppyId) return;
    let isMounted = true;
    void fetchHealthRecords(puppyId).then((response) => {
      if (!isMounted) return;
      if (response.ok) setHealthRecords((previous) => [...previous.filter((record) => record.puppyId !== puppyId), ...response.data]);
      setFallbackAnswer({ puppyId, ok: response.ok });
    });
    return () => {
      isMounted = false;
    };
  }, [isDashboardDown, activePuppy?.id, setHealthRecords]);

  // Close Export dropdown on outside click or Escape key
  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  if (!activePuppy) {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto">
        <Card.Content className="space-y-3">
          <Syringe className="w-12 h-12 text-slate-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-200">
            {t.health.noPuppySelected}
          </h2>
          <p className="text-xs text-slate-400">
            {t.health.selectPuppyToViewHealth}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Top Navigation Bar: Back button & Unified Export Dropdown */}
      <div className="flex items-center justify-between gap-2">
        {onBackToDashboard ? (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 sm:px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t.nav.backToDashboard}</span>
          </button>
        ) : <div />}

        {/* Unified Export ▾ Dropdown */}
        <div className="relative inline-block text-left" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setIsExportMenuOpen((previous) => !previous)}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 sm:px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm shrink-0"
            aria-expanded={isExportMenuOpen}
            title={t.dashboard.export}
          >
            <Download className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span>{t.dashboard.export}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180 text-teal-400' : ''}`} />
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={handleExportPdf}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-slate-800/80 transition-colors text-slate-200 group"
              >
                <div className="p-1.5 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400 mt-0.5 shrink-0 group-hover:bg-teal-900/90 transition-colors">
                  <Printer className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-teal-300 transition-colors">
                    {t.health.exportHealthPdf}
                  </div>
                  <div className="text-xs text-slate-400 leading-tight mt-0.5">
                    {t.health.exportHealthPdfDesc}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-slate-800/80 transition-colors text-slate-200 border-t border-slate-800/80 group"
              >
                <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mt-0.5 shrink-0 group-hover:bg-emerald-900/90 transition-colors">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                    {t.health.exportHealthCsv}
                  </div>
                  <div className="text-xs text-slate-400 leading-tight mt-0.5">
                    {t.health.exportHealthCsvDesc}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* The heading, then one identity line: name · sex · breed · age today */}
      <PageHeader icon={Syringe} iconClassName="from-teal-500 to-emerald-600" title={t.nav.carnetDeSante} subtitle={identity} />

      {recordsState === 'loading' ? (
        <div aria-busy="true" className="space-y-4 sm:space-y-6">
          <span className="sr-only">{t.common.loading}</span>
          {['h-28', 'h-72', 'h-36', 'h-36'].map((height, index) => (
            <div key={index} className={`${height} rounded-3xl bg-slate-900 border border-slate-800 motion-safe:animate-pulse`} />
          ))}
        </div>
      ) : recordsState === 'failed' ? (
        <p role="status" className="text-xs font-semibold text-amber-300">{t.health.recordsUnavailable}</p>
      ) : (
        <>
          {/* What is due, first: the dashboard card shows the same list */}
          <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
            <Card.Content className="p-4 sm:p-6">
              <HealthDueList records={puppyRecords} dogName={activePuppy.name} />
            </Card.Content>
          </Card>

          {/* Weight & Growth Trajectory Chart */}
          <WeightGrowthChart
            activities={weightActivities}
            profile={activePuppy}
            onOpenQuickLogModal={onOpenQuickLogModal || (() => {})}
            onDeleteActivity={onDeleteActivity}
            onUpdateActivity={onUpdateActivity}
          />

          {/* Modular Vaccinations Section */}
          <VaccineSection
            activePuppy={activePuppy}
            vaccinations={vaccinations}
            setHealthRecords={setHealthRecords}
            lastWeighIn={lastWeighIn}
            currentUser={currentUser}
            onAddActivity={onAddActivity}
            t={t}
          />

          {/* Modular Deworming / Parasitology Section */}
          <DewormingSection
            activePuppy={activePuppy}
            dewormingLogs={dewormingLogs}
            setHealthRecords={setHealthRecords}
            lastWeighIn={lastWeighIn}
            currentUser={currentUser}
            onAddActivity={onAddActivity}
            t={t}
          />

          {/* Modular Medication & Treatments History Section */}
          <MedicationSection
            activities={medicationActivities}
            onOpenQuickLogModal={onOpenQuickLogModal}
            onDeleteActivity={onDeleteActivity}
            onUpdateActivity={onUpdateActivity}
          />
        </>
      )}
    </div>
  );
};
