import React, { useState, useEffect } from 'react';
import type { PuppyProfile, Activity, HealthRecord } from '../types';
import { Syringe, Pill, Dog, Calendar, Scale, ExternalLink } from 'lucide-react';
import { Card, Button, Chip } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatBreedName } from '../utils/breeds';
import { getExpectedAdultWeight } from './WeightGrowthChart';
import { getPuppyAge } from '../utils/predictions';
import { fetchHealthRecords } from '../services/api';
import { calculateNextVaccineBooster, calculateNextDewormingDate } from '../utils/health';

interface DogHealthSummaryProps {
  profile: PuppyProfile;
  activities: Activity[];
  onOpenHealthPassport: () => void;
}

export const DogHealthSummary: React.FC<DogHealthSummaryProps> = React.memo(({
  profile,
  activities,
  onOpenHealthPassport,
}) => {
  const { lang } = useI18n();

  const [lastVaccine, setLastVaccine] = useState<HealthRecord | null>(null);
  const [lastDeworming, setLastDeworming] = useState<HealthRecord | null>(null);

  useEffect(() => {
    if (!profile.id) return;
    async function loadHealth() {
      const [vRes, dRes] = await Promise.all([
        fetchHealthRecords(profile.id, 'vaccination'),
        fetchHealthRecords(profile.id, 'deworming'),
      ]);

      if (vRes && vRes.length > 0) {
        const sortedV = [...vRes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLastVaccine(sortedV[0]);
      } else {
        setLastVaccine(null);
      }

      if (dRes && dRes.length > 0) {
        const sortedD = [...dRes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLastDeworming(sortedD[0]);
      } else {
        setLastDeworming(null);
      }
    }

    loadHealth();
  }, [profile.id]);

  // Calculate puppy age in weeks & months
  const ageInfo = React.useMemo(() => {
    if (!profile.birthDate) return { weeks: 12, months: 3 };
    return getPuppyAge(profile.birthDate);
  }, [profile.birthDate]);

  // Extract weight metrics (Last Logged, Assumed Current, Probable Adult Range)
  const weightData = React.useMemo(() => {
    const weightLogs = activities
      .filter((act) => act.type === 'weight' && act.weightKg && act.weightKg > 0)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const lastLog = weightLogs.length > 0 ? weightLogs[0] : null;
    const lastWeightKg = lastLog ? lastLog.weightKg! : profile.weightKg || 4.2;
    const lastLogDateStr = lastLog ? new Date(lastLog.timestamp).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }) : null;

    const adultTargetKg = getExpectedAdultWeight(profile.breed);
    const minAdultKg = Math.round(adultTargetKg * 0.88 * 10) / 10;
    const maxAdultKg = Math.round(adultTargetKg * 1.15 * 10) / 10;

    let assumedCurrentKg = lastWeightKg;
    if (lastLog) {
      const daysDiff = Math.max(0, (Date.now() - new Date(lastLog.timestamp).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 2) {
        const weeklyGainKg = adultTargetKg * 0.035;
        const estimatedGainKg = (daysDiff / 7) * weeklyGainKg;
        assumedCurrentKg = Math.round((lastWeightKg + estimatedGainKg) * 10) / 10;
      }
    }

    return {
      lastWeightKg,
      lastLogDateStr,
      assumedCurrentKg,
      adultTargetKg,
      adultRangeStr: `${minAdultKg}–${maxAdultKg} kg`,
    };
  }, [activities, profile.weightKg, profile.breed, lang]);

  const localizedBreed = formatBreedName(profile.breed, lang);

  const nextVaccineDueDate = lastVaccine
    ? lastVaccine.boosterDate || calculateNextVaccineBooster(lastVaccine.date, lastVaccine.name)
    : null;

  const nextDewormingDueDate = lastDeworming
    ? lastDeworming.boosterDate || calculateNextDewormingDate(lastDeworming.date, Math.max(1, Math.floor(ageInfo.weeks / 4)))
    : null;

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
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white text-base">{profile.name}</span>
            <Chip size="sm" variant="soft" color="accent" className="font-bold">
              {localizedBreed}
            </Chip>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Age</div>
                <div className="font-bold text-slate-200">{ageInfo.weeks} weeks</div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <Scale className="w-4 h-4 text-pink-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold">Assumed Current</div>
                <div className="font-bold text-pink-300">~{weightData.assumedCurrentKg} kg</div>
              </div>
            </div>
          </div>

          {/* Weight Details Row: Last Logged & Probable Adult Range */}
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold">Last Weight Logged</span>
              <span className="font-bold text-slate-200">
                {weightData.lastWeightKg} kg {weightData.lastLogDateStr && <span className="text-slate-400 font-normal">({weightData.lastLogDateStr})</span>}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold">Adult Weight Range</span>
              <span className="font-bold text-indigo-300">{weightData.adultRangeStr}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Health Overview (Vaccine & Deworming) */}
        <div className="space-y-2.5">
          {/* Last Vaccine */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg shrink-0">
                <Syringe className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  {lastVaccine ? lastVaccine.name : 'Last Vaccination'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {lastVaccine ? (
                    <>Given: {lastVaccine.date} &bull; Next due: <strong className="text-teal-300">{nextVaccineDueDate}</strong></>
                  ) : (
                    'No vaccine records logged yet.'
                  )}
                </div>
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
                <div className="text-xs font-bold text-slate-200">
                  {lastDeworming ? (lastDeworming.productName || lastDeworming.name) : 'Last Deworming'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {lastDeworming ? (
                    <>Given: {lastDeworming.date} &bull; Next due: <strong className="text-amber-300">{nextDewormingDueDate}</strong></>
                  ) : (
                    'No deworming records logged yet.'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Button: View Full Health Passport */}
        <Button
          variant="primary"
          size="sm"
          onPress={onOpenHealthPassport}
          className="w-full font-bold text-xs py-2 shadow bg-indigo-600 hover:bg-indigo-500 text-white border-0"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1.5 inline" />
          <span>View Full Health Passport</span>
        </Button>
      </Card.Content>
    </Card>
  );
});
