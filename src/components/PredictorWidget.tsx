import React from 'react';
import type { Activity, ActivityType, PottyLocation, PuppyProfile, PredictionResult } from '../types';
import { Droplet, Utensils, CheckCircle2 } from 'lucide-react';
import { PoopIcon } from './common/PoopIcon';
import { Card } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatMinutesToXhXX, isSameLogicalDate, parseIsoDate } from '../utils/date';
import { calculateNextMealPortion } from '../utils/predictions';
import { translatePredictionReason } from '../utils/predictionsTranslation';
import { StatusBadge } from './common/StatusBadge';

function getActivityStats(activities: Activity[], type: string, now: Date) {
  const typeLogs = activities.filter((activity) => activity.type === type).sort(
    (activityA, activityB) => parseIsoDate(activityB.timestamp).getTime() - parseIsoDate(activityA.timestamp).getTime()
  );
  const todayLogs = typeLogs.filter((activity) => isSameLogicalDate(parseIsoDate(activity.timestamp), now));
  const lastMinsAgo = typeLogs.length > 0
    ? Math.max(0, Math.floor((now.getTime() - parseIsoDate(typeLogs[0].timestamp).getTime()) / 60000))
    : null;
  return { typeLogs, todayLogs, lastMinsAgo };
}

interface PredictorWidgetProps {
  predictions: PredictionResult;
  profile: PuppyProfile;
  activities: Activity[];
  todayFoodLoggedGrams: number;
  todayMealsCount: number;
  onQuickAction: (type: ActivityType, pottyLocation?: PottyLocation) => void;
  onOpenQuickLogModal: (type?: ActivityType) => void;
}

export const PredictorWidget: React.FC<PredictorWidgetProps> = React.memo(({
  predictions,
  profile,
  activities,
  todayFoodLoggedGrams,
  todayMealsCount,
  onQuickAction,
  onOpenQuickLogModal,
}) => {
  const { t, lang } = useI18n();

  const now = new Date();

  const { todayLogs: todayPeeLogs, lastMinsAgo: lastPeeMinsAgo } = getActivityStats(activities, 'pee', now);
  const { todayLogs: todayPoopLogs, lastMinsAgo: lastPoopMinsAgo } = getActivityStats(activities, 'poop', now);
  const { lastMinsAgo: lastFoodMinsAgo } = getActivityStats(activities, 'food', now);

  const dailyGoal = profile.dailyFoodGramGoal || 200;
  const targetMeals = profile.targetMealsPerDay || 3;

  const portionLeftForNextMeal = calculateNextMealPortion(
    profile.dailyFoodGramGoal,
    profile.targetMealsPerDay,
    todayFoodLoggedGrams,
    todayMealsCount
  );

  const getUrgencyBadge = (urgency: 'safe' | 'soon' | 'overdue') => {
    return <StatusBadge status={urgency} />;
  };

  const formatCountdown = (dateObj: Date | null) => {
    if (!dateObj) return 'N/A';
    const diffMins = Math.round((dateObj.getTime() - Date.now()) / 60000);

    if (diffMins < 0) {
      const overdueMins = Math.abs(diffMins);
      const formattedOverdue = overdueMins < 60
        ? `${overdueMins}m`
        : `${Math.floor(overdueMins / 60)}h ${overdueMins % 60 > 0 ? (overdueMins % 60) + 'm' : ''}`.trim();
      return <span aria-label={`Overdue by ${formattedOverdue}`}>{`${t.dashboard.overduePrefix}${formattedOverdue}`}</span>;
    }

    if (diffMins === 0) return t.dashboard.dueNowCount;

    if (diffMins < 60) return <span aria-label={`Due in ${diffMins} minutes`}>~{diffMins}m</span>;
    const hours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    const timeStr = remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    return <span aria-label={`Due in ${hours} hours and ${remMins} minutes`}>~{timeStr}</span>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      {/* 1. Next Pee Card */}
      <Card
        className={`transition-all flex flex-col ${
          predictions.peeUrgency === 'overdue'
            ? 'bg-red-950/40 border-red-700/60 shadow-lg shadow-red-950/50'
            : predictions.peeUrgency === 'soon'
            ? 'bg-amber-950/30 border-amber-600/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <Card.Content className="p-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-3">
            {/* Top Title & Urgency Badge Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg shrink-0 border border-sky-500/30">
                  <Droplet className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-300">{t.potty.nextPee}</div>
              </div>
              {getUrgencyBadge(predictions.peeUrgency)}
            </div>

            {/* Countdown & Delta Pill Row */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-slate-100 whitespace-nowrap">
                  {formatCountdown(predictions.nextPeeExpectedAt)}
                </span>
                {predictions.nextPeeExpectedAt && (
                  <span className="text-xs text-slate-400 ml-1">
                    ({new Date(predictions.nextPeeExpectedAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
                <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700/80 px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                  ±{predictions.peeDeltaMins || 20}m
                </span>
              </div>
              {predictions.peeMode === 'post_meal_override' && predictions.standardPeeExpectedAt && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-700/60 text-xs font-semibold text-sky-300">
                  <span>{t.dashboard.withoutMeal}: {formatCountdown(predictions.standardPeeExpectedAt)}</span>
                </div>
              )}
            </div>

            {/* FIRST: Pee Stats Summary (Records of the day) */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1 text-slate-400">
              <div className="flex justify-between font-medium">
                <span>{t.dashboard.peesToday}</span>
                <span className="font-bold text-sky-300">{todayPeeLogs.length}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{t.dashboard.lastPee}</span>
                <span className="font-bold text-slate-300">
                  {lastPeeMinsAgo !== null ? `${formatMinutesToXhXX(lastPeeMinsAgo)} ${t.dashboard.agoText}` : t.dashboard.noneLoggedToday}
                </span>
              </div>
            </div>

            {/* SECOND: Pee Recommendation Description (Calculation details) */}
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed min-h-[52px] flex items-center">
              {translatePredictionReason(predictions.peeReason, lang)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            <button
              type="button"
              onClick={() => onQuickAction('pee', 'outside')}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow transition-colors px-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.potty.peedOutside}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('pee', 'indoor_accident')}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-rose-950/70 border border-rose-700/70 text-rose-300 hover:bg-rose-900/80 font-bold text-xs rounded-xl transition-colors px-2"
            >
              <span className="truncate">{t.potty.accident}</span>
            </button>
          </div>
        </Card.Content>
      </Card>

      {/* 2. Next Poop Card */}
      <Card
        className={`transition-all flex flex-col ${
          predictions.poopUrgency === 'overdue'
            ? 'bg-red-950/40 border-red-700/60 shadow-lg shadow-red-950/50'
            : predictions.poopUrgency === 'soon'
            ? 'bg-amber-950/30 border-amber-600/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <Card.Content className="p-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-3">
            {/* Top Title & Urgency Badge Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-600/20 text-amber-400 rounded-lg shrink-0 border border-amber-500/30">
                  <PoopIcon className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-300">{t.potty.nextPoop}</div>
              </div>
              {getUrgencyBadge(predictions.poopUrgency)}
            </div>

            {/* Countdown & Delta Pill Row */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-slate-100 whitespace-nowrap">
                  {formatCountdown(predictions.nextPoopExpectedAt)}
                </span>
                {predictions.nextPoopExpectedAt && (
                  <span className="text-xs text-slate-400 ml-1">
                    ({new Date(predictions.nextPoopExpectedAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
                <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700/80 px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                  ±{predictions.poopDeltaMins || 25}m
                </span>
              </div>
              {predictions.poopMode === 'post_meal_override' && predictions.standardPoopExpectedAt && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-700/60 text-xs font-semibold text-amber-300">
                  <span>{t.dashboard.withoutMeal}: {formatCountdown(predictions.standardPoopExpectedAt)}</span>
                </div>
              )}
            </div>

            {/* FIRST: Poop Stats Summary (Records of the day) */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1 text-slate-400">
              <div className="flex justify-between font-medium">
                <span>{t.dashboard.poopsToday}</span>
                <span className="font-bold text-amber-300">{todayPoopLogs.length}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{t.dashboard.lastPoop}</span>
                <span className="font-bold text-slate-300">
                  {lastPoopMinsAgo !== null ? `${formatMinutesToXhXX(lastPoopMinsAgo)} ${t.dashboard.agoText}` : t.dashboard.noneLoggedToday}
                </span>
              </div>
            </div>

            {/* SECOND: Poop Recommendation Description (Calculation details) */}
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed min-h-[52px] flex items-center">
              {translatePredictionReason(predictions.poopReason, lang)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            <button
              type="button"
              onClick={() => onQuickAction('poop', 'outside')}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow transition-colors px-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.potty.poopedOutside}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('poop', 'indoor_accident')}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-rose-950/70 border border-rose-700/70 text-rose-300 hover:bg-rose-900/80 font-bold text-xs rounded-xl transition-colors px-2"
            >
              <span className="truncate">{t.potty.accident}</span>
            </button>
          </div>
        </Card.Content>
      </Card>

      {/* 3. Next Meal Card */}
      <Card
        className={`transition-all flex flex-col ${
          predictions.foodUrgency === 'overdue'
            ? 'bg-amber-950/30 border-amber-700/60'
            : predictions.foodUrgency === 'soon'
            ? 'bg-indigo-950/30 border-indigo-600/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <Card.Content className="p-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-3">
            {/* Top Title & Urgency Badge Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg shrink-0 border border-purple-500/30">
                  <Utensils className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-300">{t.potty.nextMeal}</div>
              </div>
              {getUrgencyBadge(predictions.foodUrgency)}
            </div>

            {/* Countdown & Delta Pill Row */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-slate-100 whitespace-nowrap">
                  {formatCountdown(predictions.nextFoodExpectedAt)}
                </span>
                {predictions.nextFoodExpectedAt && (
                  <span className="text-xs text-slate-400 ml-1">
                    ({new Date(predictions.nextFoodExpectedAt).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
                <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700/80 px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                  ±{predictions.foodDeltaMins || 30}m
                </span>
              </div>
            </div>

            {/* FIRST: Food Stats Summary (Records of the day) */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1 text-slate-400">
              <div className="flex justify-between font-medium">
                <span>{t.dashboard.rationIntakeToday}</span>
                <span className="font-bold text-purple-300">{todayFoodLoggedGrams}g / {dailyGoal}g ({todayMealsCount}/{targetMeals})</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{t.dashboard.lastMeal}</span>
                <span className="font-bold text-slate-300">
                  {lastFoodMinsAgo !== null ? `${formatMinutesToXhXX(lastFoodMinsAgo)} ${t.dashboard.agoText}` : t.dashboard.noneLoggedToday}
                </span>
              </div>
            </div>

            {/* SECOND: Food Description (Calculation details) */}
            <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed min-h-[52px] flex items-center">
              {translatePredictionReason(predictions.foodReason, lang)}
            </p>
          </div>

          <div className="w-full pt-1">
            <button
              type="button"
              onClick={() => onOpenQuickLogModal('food')}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition-colors px-3"
            >
              <Utensils className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.dashboard.feedMealNow} ({portionLeftForNextMeal}g)</span>
            </button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
});
