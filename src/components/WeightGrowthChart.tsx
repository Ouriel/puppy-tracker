import React from 'react';
import { Card, Button } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';

export function getExpectedAdultWeight(breed: string): number {
  const breedLower = breed.toLowerCase();
  // Small breeds (3-9 kg adult)
  if (breedLower.includes('chihuahua')) return 3;
  if (breedLower.includes('jack russell')) return 7;
  if (breedLower.includes('cavalier')) return 7.5;
  if (breedLower.includes('dachshund') || breedLower.includes('teckel')) return 9;
  // Medium breeds (10-18 kg adult)
  if (breedLower.includes('cocker')) return 13;
  if (breedLower.includes('beagle')) return 12;
  if (breedLower.includes('poodle') || breedLower.includes('caniche')) return 14;
  if (breedLower.includes('french bulldog') || breedLower.includes('bouledogue')) return 12;
  if (breedLower.includes('border collie')) return 18;
  // Large breeds (20-35 kg adult)
  if (breedLower.includes('australian shepherd') || breedLower.includes('berger australien')) return 25;
  if (breedLower.includes('german shepherd') || breedLower.includes('berger allemand')) return 32;
  if (breedLower.includes('labrador')) return 30;
  if (breedLower.includes('golden')) return 30;
  if (breedLower.includes('husky')) return 23;
  // Default medium
  return 13;
}

export function calculateProjectedAdultWeightRange(
  breed: string,
  weightLogs: Activity[],
  ageWeeks: number,
  fallbackProfileWeight?: number
): { projectedAdultKg: number; minAdultKg: number; maxAdultKg: number; isTrajectoryBased: boolean } {
  const breedBaselineKg = getExpectedAdultWeight(breed);

  const lastLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const lastWeightKg = lastLog?.weightKg || fallbackProfileWeight;

  if (!lastWeightKg || weightLogs.length === 0) {
    const minAdultKg = Math.round(breedBaselineKg * 0.88 * 10) / 10;
    const maxAdultKg = Math.round(breedBaselineKg * 1.15 * 10) / 10;
    return { projectedAdultKg: breedBaselineKg, minAdultKg, maxAdultKg, isTrajectoryBased: false };
  }

  // Logistic growth model expected completion percentage by week
  let expectedFraction = 0.20;
  if (ageWeeks <= 8) {
    expectedFraction = Math.max(0.15, 0.20 * (ageWeeks / 8));
  } else if (ageWeeks <= 12) {
    expectedFraction = 0.20 + (0.18 * ((ageWeeks - 8) / 4));
  } else if (ageWeeks <= 16) {
    expectedFraction = 0.38 + (0.17 * ((ageWeeks - 12) / 4));
  } else if (ageWeeks <= 26) {
    expectedFraction = 0.55 + (0.20 * ((ageWeeks - 16) / 10));
  } else if (ageWeeks <= 36) {
    expectedFraction = 0.75 + (0.15 * ((ageWeeks - 26) / 10));
  } else if (ageWeeks <= 52) {
    expectedFraction = 0.90 + (0.10 * ((ageWeeks - 36) / 16));
  } else {
    expectedFraction = 1.0;
  }

  const empiricalAdultKg = Math.max(lastWeightKg, lastWeightKg / expectedFraction);
  // Blend breed baseline (30%) + empirical trajectory (70%)
  const blendedAdultKg = Math.round(((breedBaselineKg * 0.3) + (empiricalAdultKg * 0.7)) * 10) / 10;

  const minAdultKg = Math.round(blendedAdultKg * 0.90 * 10) / 10;
  const maxAdultKg = Math.round(blendedAdultKg * 1.12 * 10) / 10;

  return {
    projectedAdultKg: blendedAdultKg,
    minAdultKg,
    maxAdultKg,
    isTrajectoryBased: true,
  };
}

export function scaleGrowthBenchmarks(adultWeightKg: number): Array<{ label: string; expectedKg: number; minKg: number; maxKg: number; weeks: number }> {
  const scale = adultWeightKg / 13; // 13 kg is the Cocker reference
  return [
    { label: '8w', expectedKg: Math.round(2.5 * scale * 10) / 10, minKg: Math.round(2.0 * scale * 10) / 10, maxKg: Math.round(3.2 * scale * 10) / 10, weeks: 8 },
    { label: '12w', expectedKg: Math.round(5.0 * scale * 10) / 10, minKg: Math.round(4.2 * scale * 10) / 10, maxKg: Math.round(6.0 * scale * 10) / 10, weeks: 12 },
    { label: '16w', expectedKg: Math.round(7.2 * scale * 10) / 10, minKg: Math.round(6.0 * scale * 10) / 10, maxKg: Math.round(8.5 * scale * 10) / 10, weeks: 16 },
    { label: '6m', expectedKg: Math.round(9.5 * scale * 10) / 10, minKg: Math.round(8.0 * scale * 10) / 10, maxKg: Math.round(11.0 * scale * 10) / 10, weeks: 26 },
    { label: '12m', expectedKg: Math.round(adultWeightKg * 10) / 10, minKg: Math.round(adultWeightKg * 0.88 * 10) / 10, maxKg: Math.round(adultWeightKg * 1.15 * 10) / 10, weeks: 52 },
  ];
}

interface WeightGrowthChartProps {
  activities: Activity[];
  profile: PuppyProfile;
  onOpenQuickLogModal: (type: 'weight') => void;
  onDeleteActivity?: (id: string) => void;
}

export const WeightGrowthChart: React.FC<WeightGrowthChartProps> = ({
  activities,
  profile,
  onOpenQuickLogModal,
  onDeleteActivity,
}) => {
  const { t } = useI18n();

  // Extract and sort weight entries (newest first for listing)
  const weightLogs = React.useMemo(() => {
    return activities
      .filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
      .sort((activityA, activityB) => new Date(activityB.timestamp).getTime() - new Date(activityA.timestamp).getTime());
  }, [activities]);

  const lastLog = weightLogs.length > 0 ? weightLogs[0] : null;
  const latestWeight = lastLog ? lastLog.weightKg! : (profile.weightKg || 4.2);

  // Calculate puppy age in weeks
  const ageWeeks = React.useMemo(() => {
    if (!profile.birthDate) return 12;
    const birth = new Date(profile.birthDate).getTime();
    const now = Date.now();
    const diffDays = (now - birth) / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.floor(diffDays / 7));
  }, [profile.birthDate]);

  // Standard & Trajectory-based Expected Adult Weight
  const projectedWeight = React.useMemo(() => {
    const chronologicalLogs = [...weightLogs].reverse();
    return calculateProjectedAdultWeightRange(profile.breed, chronologicalLogs, ageWeeks, profile.weightKg);
  }, [profile.breed, weightLogs, ageWeeks, profile.weightKg]);

  let assumedCurrentKg = latestWeight;
  if (lastLog) {
    const daysDiff = Math.max(0, (Date.now() - new Date(lastLog.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 2) {
      const weeklyGainKg = projectedWeight.projectedAdultKg * 0.035;
      const estimatedGainKg = (daysDiff / 7) * weeklyGainKg;
      assumedCurrentKg = Math.round((latestWeight + estimatedGainKg) * 10) / 10;
    }
  }

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100">
      <Card.Content className="p-6 space-y-4">
        {/* Header: Title + Right Action Button */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 text-pink-400" />
            <span>Weight Entries ({weightLogs.length})</span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => onOpenQuickLogModal('weight')}
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {t.weightChart.logWeight}
          </Button>
        </div>

        {/* Growth Statistics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Last Logged</div>
            <div className="text-base font-extrabold text-slate-200">{latestWeight} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Current (Assumed)</div>
            <div className="text-base font-extrabold text-pink-400">~{assumedCurrentKg} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Adult Range (Est.)</div>
            <div className="text-base font-extrabold text-indigo-300">{projectedWeight.minAdultKg}–{projectedWeight.maxAdultKg} kg</div>
          </div>
        </div>

        {/* Logged Weight Entries List */}
        {weightLogs.length === 0 ? (
          <div className="p-4 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400">
            No weight entries logged yet. Click "+ Log Weight" to record your puppy's first weight.
          </div>
        ) : (
          <div className="space-y-2">
            {weightLogs.map((log) => {
              const logDate = new Date(log.timestamp);
              const formattedDate = logDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const logAgeWeeks = profile.birthDate
                ? Math.max(1, Math.floor((logDate.getTime() - new Date(profile.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 7)))
                : null;

              return (
                <div key={log.id} className="flex items-center justify-between p-3.5 bg-slate-950/40 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-500/20 text-pink-400 rounded-lg">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{log.weightKg} kg</span>
                        {logAgeWeeks && (
                          <span className="text-[10px] text-pink-300 bg-pink-950/60 border border-pink-800/60 px-1.5 py-0.2 rounded-md font-semibold">
                            {logAgeWeeks}w old
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formattedDate} {log.notes ? `• ${log.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  {onDeleteActivity && (
                    <button
                      type="button"
                      onClick={() => onDeleteActivity(log.id)}
                      aria-label="Delete weight entry"
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
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
