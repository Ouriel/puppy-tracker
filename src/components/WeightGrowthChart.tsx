import React from 'react';
import { Card, Button } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatRelativeTime } from '../utils/date';
import { getPuppyAge } from '../utils/predictions';
import { calculateProjectedAdultWeightRange, getEffectivePuppyWeight, scaleGrowthBenchmarks } from '../utils/weight';
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

  // Growth benchmarks for the breed
  const benchmarks = React.useMemo(() => {
    return scaleGrowthBenchmarks(projectedWeight.projectedAdultKg);
  }, [projectedWeight.projectedAdultKg]);

  // SVG Chart Dimensions & Scale calculations
  const maxChartKg = Math.max(projectedWeight.maxAdultKg * 1.15, 16);
  const maxWeeks = 52;
  const chartWidth = 540;
  const chartHeight = 180;
  const paddingX = 40;
  const paddingY = 24;

  const getSvgX = React.useCallback((week: number) => {
    const clampedWeek = Math.min(Math.max(week, 4), maxWeeks);
    return paddingX + ((clampedWeek - 4) / (maxWeeks - 4)) * (chartWidth - paddingX * 2);
  }, []);

  const getSvgY = React.useCallback((kg: number) => {
    const clampedKg = Math.min(Math.max(kg, 0), maxChartKg);
    return chartHeight - paddingY - (clampedKg / maxChartKg) * (chartHeight - paddingY * 2);
  }, [maxChartKg]);

  // Build corridor polygon path
  const corridorPath = React.useMemo(() => {
    if (benchmarks.length === 0) return '';
    const upperPoints = benchmarks.map((b) => `${getSvgX(b.weeks)},${getSvgY(b.maxKg)}`);
    const lowerPoints = [...benchmarks].reverse().map((b) => `${getSvgX(b.weeks)},${getSvgY(b.minKg)}`);
    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  }, [benchmarks, getSvgX, getSvgY]);

  // Build expected median line
  const medianLinePath = React.useMemo(() => {
    if (benchmarks.length === 0) return '';
    return `M ${benchmarks.map((b) => `${getSvgX(b.weeks)},${getSvgY(b.expectedKg)}`).join(' L ')}`;
  }, [benchmarks, getSvgX, getSvgY]);

  // Build actual logged weight path
  const chronologicalLogs = React.useMemo(() => sortByTimestampAsc(weightLogs), [weightLogs]);
  const loggedLinePath = React.useMemo(() => {
    if (chronologicalLogs.length === 0 || !profile.birthDate) return '';
    const points = chronologicalLogs.map((log) => {
      const logWeeks = getPuppyAge(profile.birthDate!, log.timestamp).weeks;
      return `${getSvgX(logWeeks)},${getSvgY(log.weightKg!)}`;
    });
    return points.length > 1 ? `M ${points.join(' L ')}` : '';
  }, [chronologicalLogs, profile.birthDate, getSvgX, getSvgY]);

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-5">
        {/* Header: Title + Right Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            <span>{t.weightChart.title}</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
              {weightLogs.length}
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
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{t.weightChart.currentAssumed}</div>
            <div className="text-lg sm:text-xl font-black text-pink-400 mt-1">~{assumedCurrentKg} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">{t.weightChart.adultRangeEst}</div>
            <div className="text-lg sm:text-xl font-black text-indigo-300 mt-1">
              {projectedWeight.minAdultKg}–{projectedWeight.maxAdultKg} kg
            </div>
          </div>
        </div>

        {/* SVG Growth Trajectory Chart */}
        <div className="bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-slate-800/90 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              <span>{t.weightChart.growthTrajectory}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/40 border border-indigo-400 inline-block" />
                {t.weightChart.breedStandard}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
                {profile.name}
              </span>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/70 p-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines & Y-axis labels */}
              {[4, 8, 12, 16].map((kgVal) => {
                if (kgVal > maxChartKg) return null;
                const yPos = getSvgY(kgVal);
                return (
                  <g key={kgVal}>
                    <line
                      x1={paddingX}
                      y1={yPos}
                      x2={chartWidth - paddingX}
                      y2={yPos}
                      stroke="#334155"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 6}
                      y={yPos + 3}
                      textAnchor="end"
                      className="fill-slate-500 text-[9px] font-mono"
                    >
                      {kgVal}kg
                    </text>
                  </g>
                );
              })}

              {/* Vertical Grid Lines & X-axis labels (weeks) */}
              {[8, 16, 26, 40, 52].map((wk) => {
                const xPos = getSvgX(wk);
                return (
                  <g key={wk}>
                    <line
                      x1={xPos}
                      y1={paddingY}
                      x2={xPos}
                      y2={chartHeight - paddingY}
                      stroke="#1E293B"
                      strokeWidth="1"
                    />
                    <text
                      x={xPos}
                      y={chartHeight - paddingY + 12}
                      textAnchor="middle"
                      className="fill-slate-400 text-[9px] font-mono font-bold"
                    >
                      {wk >= 52 ? '1y' : `${wk}w`}
                    </text>
                  </g>
                );
              })}

              {/* Breed Growth Corridor Area */}
              {corridorPath && (
                <path
                  d={corridorPath}
                  fill="url(#growthGradient)"
                  stroke="#6366F1"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  strokeOpacity="0.5"
                />
              )}

              {/* Median Breed Curve */}
              {medianLinePath && (
                <path
                  d={medianLinePath}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  strokeOpacity="0.8"
                />
              )}

              {/* Actual Logged Weight Curve */}
              {loggedLinePath && (
                <path
                  d={loggedLinePath}
                  fill="none"
                  stroke="#EC4899"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Actual Logged Points */}
              {chronologicalLogs.map((log) => {
                const logWeeks = profile.birthDate ? getPuppyAge(profile.birthDate, log.timestamp).weeks : 12;
                const ptX = getSvgX(logWeeks);
                const ptY = getSvgY(log.weightKg!);
                return (
                  <g key={log.id}>
                    <circle
                      cx={ptX}
                      cy={ptY}
                      r="4.5"
                      className="fill-pink-500 stroke-slate-950"
                      strokeWidth="2"
                    />
                    <text
                      x={ptX}
                      y={ptY - 8}
                      textAnchor="middle"
                      className="fill-pink-300 text-[9px] font-extrabold font-mono"
                    >
                      {log.weightKg}k
                    </text>
                  </g>
                );
              })}

              {/* Current Age Indicator Marker */}
              {profile.birthDate && ageWeeks <= 52 && (
                <g>
                  <line
                    x1={getSvgX(ageWeeks)}
                    y1={paddingY}
                    x2={getSvgX(ageWeeks)}
                    y2={chartHeight - paddingY}
                    stroke="#F43F5E"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={getSvgX(ageWeeks)}
                    cy={getSvgY(assumedCurrentKg)}
                    r="4"
                    className="fill-rose-400 stroke-slate-950 animate-ping"
                  />
                  <circle
                    cx={getSvgX(ageWeeks)}
                    cy={getSvgY(assumedCurrentKg)}
                    r="4"
                    className="fill-rose-400 stroke-slate-950"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Logged Weight Entries List */}
        {weightLogs.length === 0 ? (
          <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
            <p className="font-semibold text-slate-300">{t.weightChart.noWeightEntries}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {t.weightChart.recentHistory}
            </div>
            {weightLogs.map((log) => {
              const formattedDate = formatRelativeTime(log.timestamp);
              const logAgeWeeks = profile.birthDate ? getPuppyAge(profile.birthDate, log.timestamp).weeks : null;

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 bg-slate-950/40 hover:bg-slate-950/70 transition-colors rounded-xl border border-slate-800/80 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 sm:p-2.5 bg-pink-500/20 text-pink-400 rounded-xl shrink-0">
                      <Scale className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-pink-400">{log.weightKg} kg</span>
                        {logAgeWeeks && (
                          <span className="text-[10px] text-pink-300 bg-pink-950/60 border border-pink-800/60 px-1.5 py-0.5 rounded-md font-semibold">
                            {logAgeWeeks}w {t.weightChart.old}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {formattedDate} {log.notes ? `• ${log.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  {onDeleteActivity && (
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
