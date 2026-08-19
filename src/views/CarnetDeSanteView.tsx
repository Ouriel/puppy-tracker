import React, { useState, useEffect } from 'react';
import type { PuppyProfile, Activity, HealthRecord } from '../types';
import { Syringe, ArrowLeft, Printer } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatBreedName } from '../utils/breeds';
import { Card } from '@heroui/react';
import { fetchHealthRecords } from '../services/api';
import { WeightGrowthChart } from '../components/WeightGrowthChart';
import { VaccineSection } from './carnet/VaccineSection';
import { DewormingSection } from './carnet/DewormingSection';
import { printHealthPassportReport } from '../utils/export';

interface CarnetDeSanteViewProps {
  activePuppy: PuppyProfile | null;
  activities?: Activity[];
  onOpenQuickLogModal?: (type: 'weight') => void;
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

  const sortByDateDesc = <T extends { date: string }>(records: T[]): T[] => {
    return [...records].sort(
      (recordA, recordB) => new Date(recordB.date).getTime() - new Date(recordA.date).getTime()
    );
  };

  const loadHealthRecords = React.useCallback(async () => {
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

  useEffect(() => {
    if (activePuppy?.id) {
      loadHealthRecords();
    }
  }, [activePuppy?.id, loadHealthRecords]);

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
      {/* Top Navigation Bar: Back button & compact PDF export button */}
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

        <button
          type="button"
          onClick={() => printHealthPassportReport(activePuppy, vaccinations, dewormingLogs, activities, lang, t)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-teal-300 hover:text-white text-xs font-bold transition-all shadow-sm shrink-0"
          title={t.nav.exportPdf}
        >
          <Printer className="w-3.5 h-3.5 text-teal-400" />
          <span>{t.nav.exportPdf}</span>
        </button>
      </div>

      {/* Header Card with Passport Details */}
      <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
        <Card.Content className="p-3.5 sm:p-5 flex items-start sm:items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-md shrink-0 mt-0.5 sm:mt-0">
            <Syringe className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-100 leading-snug break-words">
              {t.health.healthPassportFor.replace('{name}', activePuppy.name)}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed break-words">
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
    </div>
  );
};
