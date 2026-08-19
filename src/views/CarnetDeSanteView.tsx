import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { PuppyProfile, Activity, HealthRecord, ActivityType } from '../types';
import { Syringe, ArrowLeft, Printer, Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatBreedName } from '../utils/breeds';
import { Card } from '@heroui/react';
import { fetchHealthRecords } from '../services/api';
import { WeightGrowthChart } from '../components/WeightGrowthChart';
import { VaccineSection } from './carnet/VaccineSection';
import { DewormingSection } from './carnet/DewormingSection';
import { MedicationSection } from './carnet/MedicationSection';
import { printHealthPassportReport, exportHealthPassportToCSV } from '../utils/export';

interface CarnetDeSanteViewProps {
  activePuppy: PuppyProfile | null;
  activities?: Activity[];
  onOpenQuickLogModal?: (type: ActivityType) => void;
  onBackToDashboard?: () => void;
  onDeleteActivity?: (id: string) => void;
}

export const CarnetDeSanteView: React.FC<CarnetDeSanteViewProps> = ({
  activePuppy,
  activities = [],
  onOpenQuickLogModal,
  onBackToDashboard,
  onDeleteActivity,
}) => {
  const { t, lang } = useI18n();

  const [vaccinations, setVaccinations] = useState<HealthRecord[]>([]);
  const [dewormingLogs, setDewormingLogs] = useState<HealthRecord[]>([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  const sortByDateDesc = <T extends { date: string }>(records: T[]): T[] => {
    return [...records].sort(
      (recordA, recordB) => new Date(recordB.date).getTime() - new Date(recordA.date).getTime()
    );
  };

  const loadHealthRecords = useCallback(async () => {
    if (!activePuppy?.id) return;
    const [vaccineResponse, dewormingResponse] = await Promise.all([
      fetchHealthRecords(activePuppy.id, 'vaccination'),
      fetchHealthRecords(activePuppy.id, 'deworming'),
    ]);
    if (vaccineResponse.ok) {
      setVaccinations(sortByDateDesc(vaccineResponse.data));
    }
    if (dewormingResponse.ok) {
      setDewormingLogs(sortByDateDesc(dewormingResponse.data));
    }
  }, [activePuppy?.id]);

  const handleExportPdf = useCallback(() => {
    setIsExportMenuOpen(false);
    if (!activePuppy) return;
    printHealthPassportReport(activePuppy, vaccinations, dewormingLogs, activities, lang as 'en' | 'fr', t);
  }, [activePuppy, vaccinations, dewormingLogs, activities, lang, t]);

  const handleExportCsv = useCallback(() => {
    setIsExportMenuOpen(false);
    if (!activePuppy) return;
    exportHealthPassportToCSV(activePuppy, vaccinations, dewormingLogs, activities, lang as 'en' | 'fr');
  }, [activePuppy, vaccinations, dewormingLogs, activities, lang]);

  useEffect(() => {
    if (activePuppy?.id) {
      loadHealthRecords();
    }
  }, [activePuppy?.id, loadHealthRecords]);

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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm group"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all shadow-sm shrink-0"
            aria-expanded={isExportMenuOpen}
            aria-haspopup="true"
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
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
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
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    {t.health.exportHealthCsvDesc}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header Card with Passport Details */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl overflow-hidden">
        <Card.Content className="flex items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-md shrink-0">
            <Syringe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-100 leading-tight sm:leading-snug break-words">
              {t.health.healthPassportFor.replace('{name}', activePuppy.name)}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 sm:mt-1 leading-normal break-words">
              {t.health.carnetSubtitle} &bull; <span className="text-slate-300 font-semibold">{activePuppy.name}</span> ({formatBreedName(activePuppy.breed, lang)})
            </p>
          </div>
        </Card.Content>
      </Card>

      {/* Weight & Growth Trajectory Chart */}
      <WeightGrowthChart
        activities={activities}
        profile={activePuppy}
        onOpenQuickLogModal={onOpenQuickLogModal || (() => {})}
        onDeleteActivity={onDeleteActivity}
      />

      {/* Modular Vaccinations Section */}
      <VaccineSection
        activePuppy={activePuppy}
        vaccinations={vaccinations}
        setVaccinations={setVaccinations}
        t={t}
      />

      {/* Modular Deworming / Parasitology Section */}
      <DewormingSection
        activePuppy={activePuppy}
        activities={activities}
        dewormingLogs={dewormingLogs}
        setDewormingLogs={setDewormingLogs}
        t={t}
      />

      {/* Modular Medication & Treatments History Section */}
      <MedicationSection
        activities={activities}
        onOpenQuickLogModal={onOpenQuickLogModal}
        onDeleteActivity={onDeleteActivity}
      />
    </div>
  );
};
