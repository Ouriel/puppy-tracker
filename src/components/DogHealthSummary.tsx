import React, { useState, useEffect } from 'react';
import type { PuppyProfile, Activity, HealthRecord } from '../types';
import { Syringe, Pill, Dog, Scale, ExternalLink } from 'lucide-react';
import { Card, Button, Chip } from '@heroui/react';
import { useI18n, type Language } from '../i18n';
import { formatBreedName } from '../utils/breeds';
import { calculateProjectedAdultWeightRange, getEffectivePuppyWeight } from '../utils/weight';
import { getPuppyAge } from '../utils/predictions';
import { fetchHealthRecords } from '../services/api';
import { calculateNextVaccineBooster, calculateNextDewormingDate } from '../utils/health';
import { formatShortDate } from '../utils/date';

interface DogHealthSummaryProps {
  profile: PuppyProfile;
  activities: Activity[];
  onOpenHealthPassport: () => void;
  lang: string;
}

export const DogHealthSummary: React.FC<DogHealthSummaryProps> = ({
  profile,
  activities,
  onOpenHealthPassport,
  lang,
}) => {
  const { t } = useI18n();

  const [lastVaccine, setLastVaccine] = useState<HealthRecord | null>(null);
  const [lastDeworming, setLastDeworming] = useState<HealthRecord | null>(null);

  useEffect(() => {
    const loadHealth = async () => {
      const [vRes, dRes] = await Promise.all([
        fetchHealthRecords(profile.id, 'vaccination'),
        fetchHealthRecords(profile.id, 'deworming'),
      ]);
      if (vRes && vRes.length > 0) {
        const sorted = [...vRes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLastVaccine(sorted[0]);
      } else {
        setLastVaccine(null);
      }
      if (dRes && dRes.length > 0) {
        const sorted = [...dRes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLastDeworming(sorted[0]);
      } else {
        setLastDeworming(null);
      }
    };

    loadHealth();
  }, [profile.id, activities.length]);

  // Calculate puppy age in weeks & months
  const ageInfo = React.useMemo(() => {
    if (!profile.birthDate) return { weeks: 12, months: 3 };
    return getPuppyAge(profile.birthDate);
  }, [profile.birthDate]);

  // Extract weight metrics (Last Logged, Assumed Current, Probable Adult Range via empirical trajectory)
  const weightData = React.useMemo(() => {
    const weightLogs = activities
      .filter((act) => act.type === 'weight' && act.weightKg && act.weightKg > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const lastLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
    const lastLogDateStr = lastLog ? formatShortDate(lastLog.timestamp, lang as 'en' | 'fr') : null;
    const lastLogAgeWeeks = lastLog && profile.birthDate ? getPuppyAge(profile.birthDate, lastLog.timestamp).weeks : null;

    const projectedWeight = calculateProjectedAdultWeightRange(profile.breed, weightLogs, ageInfo.weeks, profile.weightKg);
    const weightInfo = getEffectivePuppyWeight(profile, activities);

    return {
      lastWeightKg: weightInfo.lastLoggedWeight,
      lastLogDateStr,
      lastLogAgeWeeks,
      assumedCurrentKg: weightInfo.estimatedCurrentWeight,
      adultTargetKg: projectedWeight.projectedAdultKg,
      adultRangeStr: `${projectedWeight.minAdultKg}–${projectedWeight.maxAdultKg} kg`,
    };
  }, [activities, profile, ageInfo.weeks, lang]);

  const localizedBreed = formatBreedName(profile.breed, lang as Language);

  const nextVaccineDueDate = lastVaccine
    ? lastVaccine.boosterDate || calculateNextVaccineBooster(lastVaccine.date, lastVaccine.name, ageInfo.months)
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
            <span>{t.health.summaryTitle}</span>
          </h2>
        </div>

        {/* Dog Profile & Weight Card */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">{profile.name}</span>
            <Chip size="sm" variant="soft" color="accent" className="font-bold">
              {localizedBreed}
            </Chip>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-pink-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">{t.health.weightSummary}</span>
              </div>
              <span className="text-xs font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-md">
                {t.health.estAdult} {weightData.adultRangeStr}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="text-xs text-slate-400 font-semibold">{t.health.lastLogged}</div>
                <div className="font-extrabold text-slate-100">{weightData.lastWeightKg} kg</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  {weightData.lastLogDateStr ? `${weightData.lastLogDateStr} ${weightData.lastLogAgeWeeks ? `(${weightData.lastLogAgeWeeks}w)` : ''}` : t.health.noLogsYet}
                </div>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="text-xs text-slate-400 font-semibold">{t.health.assumedCurrent}</div>
                <div className="font-extrabold text-pink-400">~{weightData.assumedCurrentKg} kg</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  {t.dashboard.today} ({ageInfo.weeks}w)
                </div>
              </div>
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
                  {lastVaccine ? lastVaccine.name : t.health.lastVaccination}
                </div>
                <div className="text-xs text-slate-400">
                  {lastVaccine ? (
                    <>{t.health.given} {lastVaccine.date} &bull; {t.health.nextDue} <strong className="text-teal-300">{nextVaccineDueDate}</strong></>
                  ) : (
                    t.health.noVaccineRecords
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
                  {lastDeworming ? (lastDeworming.productName || lastDeworming.name) : t.health.lastDeworming}
                </div>
                <div className="text-xs text-slate-400">
                  {lastDeworming ? (
                    <>{t.health.given} {lastDeworming.date} &bull; {t.health.nextDue} <strong className="text-amber-300">{nextDewormingDueDate}</strong></>
                  ) : (
                    t.health.noDewormingRecords
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
          <span>{t.health.viewFullHealthPassport}</span>
        </Button>
      </Card.Content>
    </Card>
  );
};
