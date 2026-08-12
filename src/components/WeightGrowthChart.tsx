import React from 'react';
import { Card, Button } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatRelativeTime } from '../utils/date';
import { getPuppyAge } from '../utils/predictions';

import {
  getExpectedAdultWeight,
  calculateProjectedAdultWeightRange,
  estimateCurrentWeightFromLastLog,
  getEffectivePuppyWeight,
} from '../utils/weight';

export {
  getExpectedAdultWeight,
  calculateProjectedAdultWeightRange,
  estimateCurrentWeightFromLastLog,
  getEffectivePuppyWeight,
};


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
              const formattedDate = formatRelativeTime(log.timestamp);
              const logAgeWeeks = profile.birthDate ? getPuppyAge(profile.birthDate, log.timestamp).weeks : null;

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
