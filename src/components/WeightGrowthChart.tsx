import React from 'react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, TrendingUp, Plus, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { parseIsoDate } from '../utils/date';

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
}

export const WeightGrowthChart: React.FC<WeightGrowthChartProps> = ({
  activities,
  profile,
  onOpenQuickLogModal,
}) => {
  const { t } = useI18n();

  // Extract and sort weight entries chronologically
  const weightLogs = React.useMemo(() => {
    return activities
      .filter((activity) => activity.type === 'weight' && activity.weightKg && activity.weightKg > 0)
      .sort((activityA, activityB) => new Date(activityA.timestamp).getTime() - new Date(activityB.timestamp).getTime());
  }, [activities]);

  const latestWeight = weightLogs.length > 0
    ? weightLogs[weightLogs.length - 1].weightKg!
    : (profile.weightKg || 0);

  // Calculate puppy age in weeks
  const ageWeeks = React.useMemo(() => {
    if (!profile.birthDate) return 12;
    const birth = new Date(profile.birthDate).getTime();
    const now = Date.now();
    const diffDays = (now - birth) / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.floor(diffDays / 7));
  }, [profile.birthDate]);

  // Standard Expected Weight Curve scaled by breed
  const adultTargetKg = getExpectedAdultWeight(profile.breed);
  const growthBenchmarks = scaleGrowthBenchmarks(adultTargetKg);

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{t.weightChart.title}</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{t.weightChart.healthyPace}</span>
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {t.weightChart.puppyAgeInfo.replace('{weeks}', String(ageWeeks)).replace('{weight}', String(latestWeight))}
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenQuickLogModal('weight')}
          className="flex items-center gap-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.weightChart.logWeight}</span>
        </button>
      </div>

      {/* Visual Weight Curve Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
          <span>{t.weightChart.breedStandard}</span>
          <span>{latestWeight} {t.units.kg} / {adultTargetKg} {t.units.kg} (Target)</span>
        </div>

        {/* Growth Bar Progress */}
        <div className="w-full bg-slate-950 h-4 rounded-full p-0.5 border border-slate-800 overflow-hidden relative">
          {/* Target Zone Gradient */}
          <div
            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, Math.round(((isNaN(latestWeight) ? 0 : latestWeight) / (adultTargetKg * 1.08)) * 100)))}%` }}
          />
        </div>

        {/* Benchmarks Grid */}
        <div className="grid grid-cols-5 gap-2 pt-2">
          {growthBenchmarks.map((bench) => {
            const isPassed = ageWeeks >= bench.weeks;
            return (
              <div
                key={bench.label}
                className={`p-2.5 rounded-xl border text-center transition ${
                  isPassed
                    ? 'bg-slate-850 border-indigo-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase">{bench.label}</div>
                <div className="text-xs font-extrabold text-white mt-0.5">{bench.expectedKg} {t.units.kg}</div>
                <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {bench.minKg}-{bench.maxKg}{t.units.kg}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weight History Timeline List */}
      {weightLogs.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
            <span>{t.weightChart.recentHistory}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weightLogs.slice(-5).map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shrink-0"
              >
                <span className="font-bold text-pink-300">{log.weightKg} {t.units.kg}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {parseIsoDate(log.timestamp).toLocaleDateString(t.brand === 'PupPace' ? 'fr-FR' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
