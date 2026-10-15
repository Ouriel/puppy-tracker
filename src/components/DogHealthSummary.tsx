import React, { useMemo } from 'react';
import type { PuppyProfile, Activity, HealthRecord, PredictionResult } from '../types';
import { Syringe, Pill, Dog, Scale, ExternalLink, Moon, Sunrise, Utensils, Clock, Sparkles } from 'lucide-react';
import { Card, Button, Chip } from '@heroui/react';
import { useI18n, type Language } from '../i18n';
import { formatBreedName } from '../data/breedsCatalog';
import {
  calculateProjectedAdultWeightRange,
  getEffectivePuppyWeight,
  getUnifiedWeightEntries,
} from '../utils/weight';
import { getPuppyAge } from '../utils/predictions';
import { getHealthRecordStatus } from '../utils/health';
import { formatShortDate } from '../utils/date';
import { StatusBadge } from './common/StatusBadge';

interface DogHealthSummaryProps {
  profile: PuppyProfile;
  activities: Activity[];
  weightActivities: Activity[]; // every weigh-in of the dog, whatever its date
  predictions?: PredictionResult | null;
  healthRecords?: HealthRecord[];
  onOpenHealthPassport: () => void;
}

/**
 * The record to show for one type: among those no later record renews, the one due first
 * (with no next date anywhere: the latest one), with its status.
 */
function getNextDue(records: HealthRecord[]) {
  const openRecords = records
    .map((record) => ({ record, urgency: getHealthRecordStatus(record, records) }))
    .filter((item) => item.urgency !== 'fulfilled');
  const byBoosterDate = openRecords
    .filter((item) => item.record.boosterDate)
    .sort((first, second) => first.record.boosterDate!.localeCompare(second.record.boosterDate!));
  return byBoosterDate[0] ?? openRecords.sort((first, second) => second.record.date.localeCompare(first.record.date))[0];
}

export const DogHealthSummary: React.FC<DogHealthSummaryProps> = React.memo(({
  profile,
  activities,
  weightActivities,
  predictions,
  healthRecords = [],
  onOpenHealthPassport,
}) => {
  const { t, lang } = useI18n();

  // Derive the next vaccine and deworming due from BFF-provided health records (no secondary fetch needed)
  const puppyRecords = useMemo(() => {
    return healthRecords.filter((record) => record.puppyId === profile.id);
  }, [healthRecords, profile.id]);

  const nextVaccine = useMemo(() => getNextDue(puppyRecords.filter((record) => record.type === 'vaccination')), [puppyRecords]);

  const nextDeworming = useMemo(() => getNextDue(puppyRecords.filter((record) => record.type === 'deworming')), [puppyRecords]);

  // Calculate puppy age in weeks & months
  const ageInfo = useMemo(() => {
    if (!profile.birthDate) return { weeks: 12, months: 3 };
    return getPuppyAge(profile.birthDate);
  }, [profile.birthDate]);

  // Extract weight metrics (Last Logged, Assumed Current, Probable Adult Range via empirical trajectory)
  const weightData = useMemo(() => {
    const unifiedLogs = getUnifiedWeightEntries(weightActivities);
    const lastEntry = unifiedLogs.length > 0 ? unifiedLogs[unifiedLogs.length - 1] : null;
    const lastLogDateStr = lastEntry ? formatShortDate(lastEntry.timestamp, lang as 'en' | 'fr') : null;
    const lastLogAgeWeeks = lastEntry && profile.birthDate ? getPuppyAge(profile.birthDate, lastEntry.timestamp).weeks : null;

    const projectedWeight = calculateProjectedAdultWeightRange(
      profile.breed,
      unifiedLogs,
      profile.birthDate,
      profile.gender,
      profile.expectedAdultWeightKg
    );
    const weightInfo = getEffectivePuppyWeight(profile, weightActivities);

    return {
      lastWeightKg: weightInfo.lastLoggedWeight,
      lastLogDateStr,
      lastLogAgeWeeks,
      assumedCurrentKg: weightInfo.estimatedCurrentWeight,
      adultTargetKg: projectedWeight.projectedAdultKg,
      adultRangeStr: `${projectedWeight.minAdultKg}–${projectedWeight.maxAdultKg} kg`,
      dailyGainGrams: weightInfo.dailyGainGrams,
      walthamCategory: projectedWeight.walthamCategory,
    };
  }, [weightActivities, profile, lang]);

  // Reuses the core prediction metadata (sleep schedule & meal schedule) calculated for the main 3 cards
  const scheduleData = useMemo(() => {
    if (!predictions || !predictions.sleepSchedule || !predictions.mealSchedule) {
      return null;
    }

    const sleep = predictions.sleepSchedule;
    const meals = predictions.mealSchedule;

    const formatMinsToClock = (totalMins: number): string => {
      const h = Math.floor(totalMins / 60) % 24;
      const m = Math.round(totalMins % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Calculate sleep duration in minutes
    const sleepDurationMins = Math.round(
      (sleep.wakeupHour * 60 + 24 * 60 - sleep.bedtimeHour * 60) % (24 * 60)
    );
    const sleepH = Math.floor(sleepDurationMins / 60);
    const sleepM = sleepDurationMins % 60;
    const sleepDurationStr = sleepM > 0 ? `${sleepH}h ${sleepM}m` : `${sleepH}h`;

    const targetMeals = profile.targetMealsPerDay || 3;
    const dailyGrams = profile.dailyFoodGramGoal; // 0: no gram goal, no grams shown
    const portionGrams = dailyGrams > 0 ? Math.round(dailyGrams / targetMeals) : undefined;

    // Build meal items list based on targetMealsPerDay
    const mealItems: { name: string; timeStr: string; grams?: number }[] = [];
    if (targetMeals === 2) {
      mealItems.push({ name: t.health.breakfast, timeStr: formatMinsToClock(meals.breakfastMins), grams: portionGrams });
      mealItems.push({ name: t.health.dinner, timeStr: formatMinsToClock(meals.dinnerMins), grams: portionGrams });
    } else if (targetMeals === 3) {
      mealItems.push({ name: t.health.breakfast, timeStr: formatMinsToClock(meals.breakfastMins), grams: portionGrams });
      mealItems.push({ name: t.health.lunch, timeStr: formatMinsToClock(meals.lunchMins), grams: portionGrams });
      mealItems.push({ name: t.health.dinner, timeStr: formatMinsToClock(meals.dinnerMins), grams: portionGrams });
    } else if (targetMeals === 4) {
      const snackMins = Math.round((meals.lunchMins + meals.dinnerMins) / 2);
      mealItems.push({ name: t.health.breakfast, timeStr: formatMinsToClock(meals.breakfastMins), grams: portionGrams });
      mealItems.push({ name: t.health.lunch, timeStr: formatMinsToClock(meals.lunchMins), grams: portionGrams });
      mealItems.push({ name: t.health.afternoonSnack, timeStr: formatMinsToClock(snackMins), grams: portionGrams });
      mealItems.push({ name: t.health.dinner, timeStr: formatMinsToClock(meals.dinnerMins), grams: portionGrams });
    } else {
      mealItems.push({ name: t.health.breakfast, timeStr: formatMinsToClock(meals.breakfastMins), grams: portionGrams });
      if (targetMeals > 1) {
        mealItems.push({ name: t.health.dinner, timeStr: formatMinsToClock(meals.dinnerMins), grams: portionGrams });
      }
    }

    const foodLogsCount = activities.filter((act) => act.type === 'food').length;
    const isLearned = activities.length >= 5 || foodLogsCount >= 3;

    return {
      bedtimeStr: sleep.bedtimeStr || '22:00',
      wakeupStr: sleep.wakeupStr || '07:00',
      sleepDurationStr,
      mealItems,
      targetMeals,
      dailyGrams,
      isLearned,
    };
  }, [predictions, activities, profile.targetMealsPerDay, profile.dailyFoodGramGoal, t]);

  const localizedBreed = formatBreedName(profile.breed, lang as Language);

  return (
    <Card className="shadow-xl bg-slate-900/90 border-slate-800">
      <Card.Content className="p-3.5 sm:p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
            <Dog className="w-5 h-5 text-indigo-400" />
            <span>{t.health.summaryTitle}</span>
          </h2>
        </div>

        {/* Dog Profile & Weight Card */}
        <div className="bg-slate-950/60 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">{profile.name}</span>
              {profile.gender && (
                <span className={`text-xs font-bold ${profile.gender === 'female' ? 'text-pink-400' : 'text-blue-400'}`}>
                  {profile.gender === 'female' ? '♀' : '♂'}
                </span>
              )}
            </div>
            <Chip size="sm" variant="soft" color="accent" className="font-bold">
              {localizedBreed}
            </Chip>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                <div className="font-extrabold text-slate-100">{weightData.lastWeightKg !== undefined ? `${weightData.lastWeightKg} kg` : '—'}</div>
                <div className="text-xs text-slate-400 mt-0.5 break-words">
                  {weightData.lastLogDateStr ? `${weightData.lastLogDateStr} ${weightData.lastLogAgeWeeks ? t.health.ageInWeeks.replace('{weeks}', String(weightData.lastLogAgeWeeks)) : ''}` : t.health.noLogsYet}
                </div>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span className="text-slate-400 font-semibold">{t.health.assumedCurrent}</span>
                  {weightData.dailyGainGrams ? (
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                      {t.health.dailyGain.replace('{grams}', String(weightData.dailyGainGrams))}
                    </span>
                  ) : null}
                </div>
                <div className="font-extrabold text-pink-400">~{weightData.assumedCurrentKg} kg</div>
                <div className="text-xs text-slate-400 mt-0.5 break-words">
                  {t.dashboard.today} {t.health.ageInWeeks.replace('{weeks}', String(ageInfo.weeks))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calculated Daily Routine (Night Sleep & Meals) Card */}
        {scheduleData && (
          <div className="bg-slate-950/60 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">{t.health.dailySchedule}</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                {scheduleData.isLearned ? t.health.learnedFromLogs : t.health.defaultRoutine}
              </span>
            </div>

            {/* Night Sleep / Wakeup Row */}
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.health.nightSleep}</span>
                </div>
                <span className="text-[11px] font-semibold text-indigo-300/90 bg-indigo-950/50 border border-indigo-800/40 px-2 py-0.5 rounded">
                  ~{scheduleData.sleepDurationStr}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
                  <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                    <Moon className="w-3 h-3 text-indigo-400" />
                    <span>{t.health.bedtime}</span>
                  </div>
                  <div className="font-extrabold text-indigo-300 text-sm mt-0.5">
                    ~{scheduleData.bedtimeStr}
                  </div>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
                  <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                    <Sunrise className="w-3 h-3 text-amber-400" />
                    <span>{t.health.wakeup}</span>
                  </div>
                  <div className="font-extrabold text-amber-300 text-sm mt-0.5">
                    ~{scheduleData.wakeupStr}
                  </div>
                </div>
              </div>
            </div>

            {/* Meals Schedule Row */}
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Utensils className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.health.mealSchedule}</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-300/90 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded">
                  {t.health.mealsPerDay.replace('{count}', String(scheduleData.targetMeals))}
                  {scheduleData.dailyGrams > 0 && ` (${scheduleData.dailyGrams}g)`}
                </span>
              </div>

              <div className={`grid gap-2 text-xs pt-0.5 ${scheduleData.mealItems.length === 2 ? 'grid-cols-2' : scheduleData.mealItems.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {scheduleData.mealItems.map((item, index) => (
                  <div key={index} className="bg-slate-950/70 p-2 sm:p-2.5 rounded-lg border border-slate-800/70 text-center sm:text-left">
                    <div className="text-[11px] text-slate-400 font-medium truncate" title={item.name}>{item.name}</div>
                    <div className="font-extrabold text-emerald-300 text-xs sm:text-sm mt-0.5">~{item.timeStr}</div>
                    {item.grams !== undefined && <div className="text-[10px] text-slate-400 mt-0.5 font-medium">~{item.grams}g</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Health Overview (Vaccine & Deworming) */}
        <div className="space-y-2.5">
          {/* Last Vaccine */}
          <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                <Syringe className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200">
                  {nextVaccine ? nextVaccine.record.name : t.health.lastVaccination}
                </div>
                <div className="text-xs text-slate-400">
                  {nextVaccine ? (
                    <>{t.health.given} {formatShortDate(nextVaccine.record.date, lang)} &bull; {t.health.nextDue} <strong className="text-teal-300">{nextVaccine.record.boosterDate ? formatShortDate(nextVaccine.record.boosterDate, lang) : '—'}</strong></>
                  ) : (
                    t.health.noVaccineRecords
                  )}
                </div>
              </div>
            </div>
            {nextVaccine?.record.boosterDate && <StatusBadge status={nextVaccine.urgency} className="self-start sm:self-auto shrink-0" />}
          </div>

          {/* Last Deworming */}
          <div className="bg-slate-950/60 p-3 sm:p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5 sm:mt-0">
                <Pill className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200">
                  {nextDeworming ? (nextDeworming.record.productName || nextDeworming.record.name) : t.health.lastDeworming}
                </div>
                <div className="text-xs text-slate-400">
                  {nextDeworming ? (
                    <>{t.health.given} {formatShortDate(nextDeworming.record.date, lang)} &bull; {t.health.nextDue} <strong className="text-amber-300">{nextDeworming.record.boosterDate ? formatShortDate(nextDeworming.record.boosterDate, lang) : '—'}</strong></>
                  ) : (
                    t.health.noDewormingRecords
                  )}
                </div>
              </div>
            </div>
            {nextDeworming?.record.boosterDate && <StatusBadge status={nextDeworming.urgency} className="self-start sm:self-auto shrink-0" />}
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
});
