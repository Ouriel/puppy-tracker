import React from 'react';
import type { PuppyProfile, Activity } from '../types';
import { Syringe, Pill, Dog, Calendar, Scale, ExternalLink } from 'lucide-react';
import { Card, Button, Chip } from '@heroui/react';
import { getExpectedAdultWeight } from './WeightGrowthChart';
import { getPuppyAge } from '../utils/predictions';

interface DogHealthSummaryProps {
  profile: PuppyProfile;
  activities: Activity[];
  onOpenHealthPassport: () => void;
}

export const DogHealthSummary: React.FC<DogHealthSummaryProps> = ({
  profile,
  activities,
  onOpenHealthPassport,
}) => {

  // Calculate puppy age in weeks & months
  const ageInfo = React.useMemo(() => {
    if (!profile.birthDate) return { weeks: 12, months: 3 };
    return getPuppyAge(profile.birthDate);
  }, [profile.birthDate]);

  // Extract latest recorded weight
  const latestWeight = React.useMemo(() => {
    const weightLogs = activities
      .filter((act) => act.type === 'weight' && act.weightKg && act.weightKg > 0)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (weightLogs.length > 0) return weightLogs[0].weightKg;
    return profile.weightKg || 4.2;
  }, [activities, profile.weightKg]);

  const adultTargetKg = getExpectedAdultWeight(profile.breed);

  return (
    <Card className="shadow-xl bg-slate-900/90 border-slate-800">
      <Card.Content className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
            <Dog className="w-5 h-5 text-indigo-400" />
            <span>Dog & Health Summary</span>
          </h2>
        </div>

        {/* Dog Profile Info Card */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white text-base">{profile.name}</span>
            <Chip size="sm" variant="soft" color="accent" className="font-bold">
              {profile.breed}
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Age</div>
                <div className="font-bold text-slate-200">{ageInfo.weeks} weeks</div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
              <Scale className="w-4 h-4 text-pink-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Weight</div>
                <div className="font-bold text-slate-200">{latestWeight} kg <span className="text-[10px] text-slate-400 font-normal">(~{adultTargetKg}kg target)</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Overview (Vaccine & Deworming) */}
        <div className="space-y-2.5">
          {/* Last Vaccine */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg shrink-0">
                <Syringe className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Last Vaccination</div>
                <div className="text-[11px] text-slate-400">CHPPi + L4 &bull; Next booster due: <strong className="text-teal-300">In 3 weeks</strong></div>
              </div>
            </div>
          </div>

          {/* Last Deworming */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">Last Deworming</div>
                <div className="text-[11px] text-slate-400">Credelio Plus &bull; Next due: <strong className="text-amber-300">In 1 month</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Button: View Full Health Passport */}
        <Button
          variant="primary"
          size="sm"
          onPress={onOpenHealthPassport}
          className="w-full font-bold text-xs py-2 shadow"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5 inline" />
          <span>View Full Health Passport</span>
        </Button>
      </Card.Content>
    </Card>
  );
};
