import React from 'react';
import { Card, Button, Chip } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, Plus, ShieldCheck } from 'lucide-react';
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

  const lastLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const latestWeight = lastLog ? lastLog.weightKg! : (profile.weightKg || 4.2);

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
  const minAdultKg = Math.round(adultTargetKg * 0.88 * 10) / 10;
  const maxAdultKg = Math.round(adultTargetKg * 1.15 * 10) / 10;

  let assumedCurrentKg = latestWeight;
  if (lastLog) {
    const daysDiff = Math.max(0, (Date.now() - new Date(lastLog.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 2) {
      const weeklyGainKg = adultTargetKg * 0.035;
      const estimatedGainKg = (daysDiff / 7) * weeklyGainKg;
      assumedCurrentKg = Math.round((latestWeight + estimatedGainKg) * 10) / 10;
    }
  }

  const growthBenchmarks = scaleGrowthBenchmarks(adultTargetKg);

  return (
    <Card className="shadow-xl bg-slate-900 border-slate-800 text-slate-100">
      {/* Header */}
      <Card.Header className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{t.weightChart.title}</span>
              <Chip color="success" variant="soft" size="sm" className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{t.weightChart.healthyPace}</span>
              </Chip>
            </h3>
            <p className="text-xs text-slate-400">
              {t.weightChart.puppyAgeInfo.replace('{weeks}', String(ageWeeks)).replace('{weight}', String(latestWeight))}
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          onPress={() => onOpenQuickLogModal('weight')}
          className="font-bold shadow"
        >
          <Plus className="w-4 h-4 mr-1 inline" />
          {t.weightChart.logWeight}
        </Button>
      </Card.Header>

      <Card.Content className="p-5 pt-0">
        {/* Growth Statistics Row: Last Logged, Assumed Current, Probable Adult Range, Age */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Last Logged</div>
            <div className="text-base font-extrabold text-slate-200">{latestWeight} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Current (Assumed)</div>
            <div className="text-base font-extrabold text-pink-400">~{assumedCurrentKg} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Adult Range</div>
            <div className="text-base font-extrabold text-indigo-300">{minAdultKg}–{maxAdultKg} kg</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Current Age</div>
            <div className="text-base font-extrabold text-amber-300">{ageWeeks} weeks</div>
          </div>
        </div>

        {/* Visual Benchmark Curve */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold border-b border-slate-800/80 pb-2">
            <span>{t.weightChart.standardWeightByAge.replace('{breed}', profile.breed)}</span>
            <span className="text-[10px] text-slate-500">{t.weightChart.fciReference}</span>
          </div>

          <div className="space-y-2">
            {growthBenchmarks.map((bench) => {
              const isCurrentRange = ageWeeks >= bench.weeks - 2 && ageWeeks <= bench.weeks + 2;
              return (
                <div key={bench.label} className="flex items-center text-xs gap-3">
                  <span className={`w-10 text-right font-mono font-bold ${isCurrentRange ? 'text-pink-400' : 'text-slate-400'}`}>
                    {bench.label}
                  </span>
                  <div className="flex-1 bg-slate-900 h-4 rounded-full overflow-hidden border border-slate-800 relative flex items-center px-2">
                    <div
                      className={`h-2 rounded-full ${isCurrentRange ? 'bg-gradient-to-r from-pink-500 to-indigo-500' : 'bg-slate-700'}`}
                      style={{ width: `${(bench.expectedKg / (adultTargetKg * 1.15)) * 100}%` }}
                    />
                  </div>
                  <span className={`w-16 font-mono text-right text-[11px] ${isCurrentRange ? 'font-extrabold text-pink-300' : 'text-slate-400'}`}>
                    ~{bench.expectedKg} kg
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card.Content>
    </Card>
  );
};
