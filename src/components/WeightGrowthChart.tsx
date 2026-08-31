import React from 'react';
import { Card, Button } from '@heroui/react';
import type { Activity, PuppyProfile, HealthRecord } from '../types';
import { Scale, Plus, Trash2, Stethoscope, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatRelativeTime } from '../utils/date';
import { getPuppyAge } from '../utils/predictions';
import {
  calculateProjectedAdultWeightRange,
  getEffectivePuppyWeight,
  getUnifiedWeightEntries,
  scaleGrowthBenchmarks,
} from '../utils/weight';

interface WeightGrowthChartProps {
  activities: Activity[];
  profile: PuppyProfile;
  healthRecords?: HealthRecord[];
  onOpenQuickLogModal: (type: 'weight') => void;
  onDeleteActivity?: (id: string) => void;
}

export const WeightGrowthChart: React.FC<WeightGrowthChartProps> = ({
  activities,
  profile,
  healthRecords = [],
  onOpenQuickLogModal,
  onDeleteActivity,
}) => {
  const { t } = useI18n();

  // Extract and unify weight entries (activities + veterinary health records)
  const unifiedLogs = React.useMemo(() => {
    return getUnifiedWeightEntries(activities, healthRecords);
  }, [activities, healthRecords]);

  // Display logs (newest first)
  const displayLogs = React.useMemo(() => {
    return [...unifiedLogs].reverse();
  }, [unifiedLogs]);

  // Standard & Trajectory-based Expected Adult Weight (WALTHAM multi-point regression)
  const projectedWeight = React.useMemo(() => {
    return calculateProjectedAdultWeightRange(
      profile.breed,
      unifiedLogs,
      profile.birthDate,
      profile.weightKg,
      profile.gender,
      profile.expectedAdultWeightKg
    );
  }, [profile.breed, unifiedLogs, profile.birthDate, profile.weightKg, profile.gender, profile.expectedAdultWeightKg]);

  // Centralized effective puppy weight from WALTHAM growth velocity curve
  const effectiveWeight = React.useMemo(() => {
    return getEffectivePuppyWeight(profile, activities, undefined, healthRecords);
  }, [profile, activities, healthRecords]);

  // WALTHAM Category Milestones
  const benchmarks = React.useMemo(() => {
    return scaleGrowthBenchmarks(projectedWeight.projectedAdultKg, profile.breed);
  }, [projectedWeight.projectedAdultKg, profile.breed]);

  const latestWeight = effectiveWeight.lastLoggedWeight;
  const assumedCurrentKg = effectiveWeight.estimatedCurrentWeight;

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-5">
        {/* Header: Title + Right Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            <span>{t.weightChart.title}</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              {unifiedLogs.length}
            </span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => onOpenQuickLogModal('weight')}
            className="bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {t.weightChart.logWeight}
          </Button>
        </div>

        {/* Growth Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{t.weightChart.lastLogged}</div>
            <div className="text-lg sm:text-xl font-black text-slate-100 mt-1">{latestWeight} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{t.weightChart.currentAssumed}</span>
              {effectiveWeight.dailyGainGrams ? (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                  +{effectiveWeight.dailyGainGrams}g/j
                </span>
              ) : null}
            </div>
            <div className="text-lg sm:text-xl font-black text-pink-400 mt-1">~{assumedCurrentKg} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{t.weightChart.adultRangeEst}</span>
              {projectedWeight.walthamCategory ? (
                <span className="text-[10px] text-indigo-300 font-bold bg-indigo-950/60 border border-indigo-800/50 px-1.5 py-0.5 rounded">
                  Cat. {projectedWeight.walthamCategory}
                </span>
              ) : null}
            </div>
            <div className="text-lg sm:text-xl font-black text-indigo-300 mt-1">
              {projectedWeight.minAdultKg}–{projectedWeight.maxAdultKg} kg
            </div>
          </div>
        </div>

        {/* WALTHAM Scientific Milestones Bar */}
        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-pink-400" />
              {t.weightChart.benchmarks}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              WALTHAM™ Category {projectedWeight.walthamCategory}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center">
            {benchmarks.map((b) => (
              <div key={b.label} className="bg-slate-900/90 p-1.5 sm:p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] font-bold text-slate-400">{b.label}</div>
                <div className="text-xs sm:text-sm font-extrabold text-slate-200 mt-0.5">~{b.expectedKg} kg</div>
                <div className="text-[9px] text-slate-500 hidden sm:block mt-0.5">{b.minKg}–{b.maxKg}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Logged Weight Entries List */}
        {displayLogs.length === 0 ? (
          <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
            <p className="font-semibold text-slate-300">{t.weightChart.noWeightEntries}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {t.weightChart.recentHistory}
            </div>
            {displayLogs.map((log) => {
              const formattedDate = formatRelativeTime(log.timestamp);
              const logAgeWeeks = profile.birthDate ? getPuppyAge(profile.birthDate, log.timestamp).weeks : null;
              const isVetRecord = log.source === 'vet';

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 bg-slate-950/40 hover:bg-slate-950/70 transition-colors rounded-xl border border-slate-800/80 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${isVetRecord ? 'bg-indigo-500/20 text-indigo-400' : 'bg-pink-500/20 text-pink-400'}`}>
                      {isVetRecord ? <Stethoscope className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-extrabold ${isVetRecord ? 'text-indigo-300' : 'text-pink-400'}`}>
                          {log.weightKg} kg
                        </span>
                        {logAgeWeeks && (
                          <span className="text-[10px] text-pink-300 bg-pink-950/60 border border-pink-800/60 px-1.5 py-0.5 rounded-md font-semibold">
                            {logAgeWeeks}w {t.weightChart.old}
                          </span>
                        )}
                        {isVetRecord && (
                          <span className="text-[10px] text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1">
                            <Stethoscope className="w-3 h-3" />
                            {t.weightChart.vetRecord}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {formattedDate} {log.name ? `• ${log.name}` : ''} {log.notes ? `• ${log.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  {!isVetRecord && onDeleteActivity && (
                    <button
                      type="button"
                      onClick={() => onDeleteActivity(log.id)}
                      aria-label="Delete weight entry"
                      className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card.Content>
    </Card>
  );
};
