import React from 'react';
import { Card, Button } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatRelativeTime } from '../utils/date';
import { getPuppyAge } from '../utils/predictions';

import { calculateProjectedAdultWeightRange, getEffectivePuppyWeight } from '../utils/weight';
import { sortByTimestampDesc, sortByTimestampAsc } from '../utils/activities';

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
    return sortByTimestampDesc(
      activities.filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
    );
  }, [activities]);

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
    const chronologicalLogs = sortByTimestampAsc(weightLogs);
    return calculateProjectedAdultWeightRange(profile.breed, chronologicalLogs, ageWeeks, profile.weightKg);
  }, [profile.breed, weightLogs, ageWeeks, profile.weightKg]);

  // Centralized effective puppy weight from Waltham growth velocity curve
  const effectiveWeight = React.useMemo(() => {
    return getEffectivePuppyWeight(profile, activities);
  }, [profile, activities]);

  const latestWeight = effectiveWeight.lastLoggedWeight;
  const assumedCurrentKg = effectiveWeight.estimatedCurrentWeight;

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100">
      <Card.Content className="p-6 space-y-4">
        {/* Header: Title + Right Action Button */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 text-pink-400" />
            <span>{t.weightChart.weightEntries} ({weightLogs.length})</span>
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
            <div className="text-xs text-slate-400 uppercase font-semibold">{t.weightChart.lastLogged}</div>
            <div className="text-base font-extrabold text-slate-200">{latestWeight} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 uppercase font-semibold">{t.weightChart.currentAssumed}</div>
            <div className="text-base font-extrabold text-pink-400">~{assumedCurrentKg} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400 uppercase font-semibold">{t.weightChart.adultRangeEst}</div>
            <div className="text-base font-extrabold text-indigo-300">{projectedWeight.minAdultKg}–{projectedWeight.maxAdultKg} kg</div>
          </div>
        </div>

        {/* Logged Weight Entries List */}
        {weightLogs.length === 0 ? (
          <div className="p-4 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400">
            {t.weightChart.noWeightEntries}
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
                          <span className="text-xs text-pink-300 bg-pink-950/60 border border-pink-800/60 px-1.5 py-0.2 rounded-md font-semibold">
                            {logAgeWeeks}w {t.weightChart.old}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {formattedDate} {log.notes ? `• ${log.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  {onDeleteActivity && (
                    <button
                      type="button"
                      onClick={() => onDeleteActivity(log.id)}
                      aria-label="Delete weight entry"
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
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
