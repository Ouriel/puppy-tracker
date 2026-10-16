import React, { useState } from 'react';
import type { Activity, ActivityType, PottyLocation, PuppyProfile, PredictionResult } from '../types';
import { Droplet, Utensils, CheckCircle2, ChevronDown } from 'lucide-react';
import { PoopIcon } from './common/PoopIcon';
import { Card } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatDuration, isSameLogicalDate, parseIsoDate } from '../utils/date';
import { formatGrams } from '../utils/weight';
import { translatePredictionReason } from '../utils/predictionsTranslation';
import { useMemo } from 'react';
import { StatusBadge } from './common/StatusBadge';

interface PredictorWidgetProps {
  predictions: PredictionResult;
  profile: PuppyProfile;
  activities: Activity[];
  todayFoodLoggedGrams: number;
  todayMealsCount: number;
  /** Undefined once today's goal is reached: the button then shows no grams. */
  nextMealPortionGrams?: number;
  onQuickAction: (type: ActivityType, pottyLocation?: PottyLocation) => void;
  onOpenQuickLogModal: (type?: ActivityType) => void;
  referenceTime?: Date;
  /** The dog's logs are not here (a dog switch, or a load that failed): no "nothing yet" line and no counts, which would present it as new. */
  isHistoryUnknown?: boolean;
}

type CardKind = 'pee' | 'poop' | 'food';

// App review decision 5: a 2 px outline on urgency, red when overdue and amber when soon, the same on all three cards
const URGENCY_CARD_CLASSES: Record<PredictionResult['peeUrgency'], string> = {
  overdue: 'border-2 border-red-500/80 bg-red-950/40 shadow-lg shadow-red-950/50',
  soon: 'border-2 border-amber-400/70 bg-amber-950/30',
  safe: 'bg-slate-900/90 border-slate-800',
};

export const PredictorWidget: React.FC<PredictorWidgetProps> = React.memo(({
  predictions,
  profile,
  activities,
  todayFoodLoggedGrams,
  todayMealsCount,
  nextMealPortionGrams,
  onQuickAction,
  onOpenQuickLogModal,
  referenceTime,
  isHistoryUnknown = false,
}) => {
  // Decision 10: below md a card folds its counts and explanation; the cards opened by a tap
  const [openDetails, setOpenDetails] = useState<ReadonlySet<CardKind>>(() => new Set());
  const { t, lang } = useI18n();

  const now = useMemo(() => referenceTime || new Date(), [referenceTime]);

  const { todayPeeCount, lastPeeMinsAgo, todayPoopCount, lastPoopMinsAgo, lastFoodMinsAgo } = useMemo(() => {
    let todayPee = 0;
    let lastPee = Infinity;
    let todayPoop = 0;
    let lastPoop = Infinity;
    let lastFood = Infinity;
    const nowTime = now.getTime();

    for (const activity of activities) {
      const actTime = parseIsoDate(activity.timestamp).getTime();
      const isToday = isSameLogicalDate(parseIsoDate(activity.timestamp), now);
      // The newest log at most 1 min ahead, whatever the list order (a back-dated log is prepended, "Load more" appends)
      const minsAgo = actTime <= nowTime + 60000 ? Math.max(0, Math.floor((nowTime - actTime) / 60000)) : Infinity;

      if (activity.type === 'pee') {
        if (isToday) todayPee++;
        lastPee = Math.min(lastPee, minsAgo);
      } else if (activity.type === 'poop') {
        if (isToday) todayPoop++;
        lastPoop = Math.min(lastPoop, minsAgo);
      } else if (activity.type === 'food') {
        lastFood = Math.min(lastFood, minsAgo);
      }
    }

    const orNone = (minutes: number) => (Number.isFinite(minutes) ? minutes : null);
    return {
      todayPeeCount: todayPee,
      lastPeeMinsAgo: orNone(lastPee),
      todayPoopCount: todayPoop,
      lastPoopMinsAgo: orNone(lastPoop),
      lastFoodMinsAgo: orNone(lastFood),
    };
  }, [activities, now]);

  const dailyGoal = profile.dailyFoodGramGoal; // 0: no gram goal, the card counts meals only
  // When to call the vet, under the stool alerts
  const poopVetAdvice = predictions.poopReason.startsWith('Digestive alert')
    ? t.dashboard.vetDiarrhea
    : predictions.poopReason.startsWith('Digestive recovery') ? t.dashboard.vetHardStool : null;
  const targetMeals = profile.targetMealsPerDay || 3;
  // Nothing logged yet (the engine has no last pee or poop): one line instead of a countdown, no chip, no ±
  const hasNoPee = predictions.nextPeeExpectedAt === null;
  const hasNoPoop = predictions.nextPoopExpectedAt === null;
  // Decision 9: before the dog's first meal the meal card names breakfast and never turns amber or red
  const isBeforeFirstMeal = lastFoodMinsAgo === null;
  const foodUrgency = isBeforeFirstMeal ? 'safe' : predictions.foodUrgency;
  // Its time only while it is ahead and in the morning: for a dog added at 15:00 the engine's breakfast is 07:30, past,
  // and after an evening first pee it is 15 min later
  const firstMealAt = predictions.nextFoodExpectedAt ? new Date(predictions.nextFoodExpectedAt) : null;
  const isBreakfastAhead = firstMealAt !== null && firstMealAt > now && firstMealAt.getHours() < 12;

  const getUrgencyBadge = (urgency: 'safe' | 'soon' | 'overdue') => {
    return <StatusBadge status={urgency} />;
  };

  // "1 hour 30 minutes" / "1 heure 30 minutes", for screen readers
  const formatSpokenDuration = (totalMinutes: number) => {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    const formatUnit = (value: number, unit: 'hour' | 'minute') => new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return [hours > 0 ? formatUnit(hours, 'hour') : '', minutes > 0 || hours === 0 ? formatUnit(minutes, 'minute') : ''].filter(Boolean).join(' ');
  };

  // The short visual text ("~1h 30m") is hidden from screen readers, which read the spoken sentence instead
  const renderCountdown = (visualText: string, spokenTemplate: string, totalMinutes: number) => (
    <>
      <span aria-hidden="true">{visualText}</span>
      <span className="sr-only">{spokenTemplate.replace('{time}', formatSpokenDuration(totalMinutes))}</span>
    </>
  );

  const formatCountdown = (dateObj: Date | null) => {
    if (!dateObj) return '—';
    const diffMins = Math.round((dateObj.getTime() - now.getTime()) / 60000);

    if (diffMins < 0) {
      const overdueMins = Math.abs(diffMins);
      return renderCountdown(`${t.dashboard.overduePrefix}${formatDuration(overdueMins, lang)}`, t.dashboard.overdueBy, overdueMins);
    }

    if (diffMins === 0) return t.dashboard.dueNowCount;
    return renderCountdown(`~${formatDuration(diffMins, lang)}`, t.dashboard.dueIn, diffMins);
  };

  // "il y a 2 h 56" / "2h 56m ago"; under a minute, "à l'instant"
  const formatAgo = (minutes: number | null) => {
    if (minutes === null) return t.dashboard.noneLoggedToday;
    return minutes < 1 ? t.dashboard.justNow : t.dashboard.timeAgo.replace('{time}', formatDuration(minutes, lang));
  };

  const toggleDetails = (card: CardKind) => {
    setOpenDetails((previous) => {
      const next = new Set(previous);
      if (next.has(card)) next.delete(card);
      else next.add(card);
      return next;
    });
  };

  // Below md: one line ("6 today · 31m ago") that opens the counts and the explanation
  const renderDetailsToggle = (card: CardKind, summary: string) => (
    <button
      type="button"
      onClick={() => toggleDetails(card)}
      aria-expanded={openDetails.has(card)}
      aria-controls={`predictor-${card}-details`}
      className="md:hidden w-full min-h-11 flex items-center justify-between gap-2 px-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs font-semibold text-slate-300"
    >
      <span>{summary}</span>
      <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${openDetails.has(card) ? 'rotate-180' : ''}`} />
    </button>
  );
  // The toggle and its details share one wrapper, so the card's spacing comes after both (the poop card's vet line follows them)
  const detailsClass = (card: CardKind) => `space-y-3 ${openDetails.has(card) ? 'mt-3 md:mt-0' : 'hidden md:block'}`;
  // "2 today · 10m ago"; no "ago" before the first log
  const joinSummary = (first: string, minutesAgo: number | null) => (minutesAgo === null ? first : `${first} · ${formatAgo(minutesAgo)}`);
  const rationText = dailyGoal > 0
    ? `${formatGrams(todayFoodLoggedGrams, lang)} / ${formatGrams(dailyGoal, lang)} (${todayMealsCount}/${targetMeals})`
    : `${todayMealsCount}/${targetMeals} ${targetMeals === 1 ? t.puppies.meal : t.puppies.meals}`;

  // "15:50" in French, "3:50 PM" in English (not "03:50 PM")
  const formatClock = (date: Date) =>
    date.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: lang === 'fr' ? '2-digit' : 'numeric', minute: '2-digit' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      {/* 1. Next Pee Card */}
      <Card
        className={`transition-all flex flex-col ${URGENCY_CARD_CLASSES[predictions.peeUrgency]}`}
      >
        <Card.Content className="p-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-3">
            {/* Top Title & Urgency Badge Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg shrink-0 border border-sky-500/30">
                  <Droplet className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-300">{t.potty.nextPee}</h2>
              </div>
              {!hasNoPee && getUrgencyBadge(predictions.peeUrgency)}
            </div>

            {/* Countdown & Delta Pill Row */}
            {hasNoPee ? (
              <p className="text-sm font-semibold text-slate-200">{isHistoryUnknown ? '—' : t.dashboard.noPeeYet}</p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-100 whitespace-nowrap">
                    {formatCountdown(predictions.nextPeeExpectedAt)}
                  </span>
                  {predictions.nextPeeExpectedAt && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({formatClock(new Date(predictions.nextPeeExpectedAt))})
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700/80 px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                    ±{formatDuration(predictions.peeDeltaMins || 20, lang)}
                  </span>
                </div>
                {predictions.peeMode === 'post_meal_override' && predictions.standardPeeExpectedAt && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/80 border border-sky-700/60 text-xs font-semibold text-sky-300">
                    <span>{t.dashboard.withoutMeal}{t.common.colon} {formatCountdown(predictions.standardPeeExpectedAt)}</span>
                  </div>
                )}
              </div>
            )}

            {!isHistoryUnknown && (
              <div>
                {renderDetailsToggle('pee', joinSummary(t.dashboard.todayCount.replace('{count}', String(todayPeeCount)), lastPeeMinsAgo))}
                <div id="predictor-pee-details" className={detailsClass('pee')}>
                  {/* FIRST: Pee Stats Summary (Records of the day) */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1 text-slate-400">
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{t.dashboard.peesToday}</span>
                      <span className="font-bold text-sky-300">{todayPeeCount}</span>
                    </div>
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{t.dashboard.lastPee}</span>
                      <span className="font-bold text-slate-300">
                        {formatAgo(lastPeeMinsAgo)}
                      </span>
                    </div>
                  </div>

                  {/* SECOND: Pee Recommendation Description (Calculation details) */}
                  {!hasNoPee && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed min-h-[52px] flex items-center">
                      {translatePredictionReason(predictions.peeReason, lang)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            <button
              type="button"
              onClick={() => onQuickAction('pee', 'outside')}
              aria-label={t.potty.peedOutside}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow transition-all px-2 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.potty.outside}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('pee', 'indoor_accident')}
              aria-label={t.potty.peeAccident}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-red-950/70 border border-red-700/70 text-red-300 hover:bg-red-900/80 active:scale-[0.98] font-bold text-xs rounded-xl transition-all px-2 cursor-pointer"
            >
              <span className="truncate">{t.potty.accidentShort}</span>
            </button>
          </div>
        </Card.Content>
      </Card>

      {/* 2. Next Poop Card */}
      <Card
        className={`transition-all flex flex-col ${URGENCY_CARD_CLASSES[predictions.poopUrgency]}`}
      >
        <Card.Content className="p-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-3">
            {/* Top Title & Urgency Badge Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-600/20 text-amber-400 rounded-lg shrink-0 border border-amber-500/30">
                  <PoopIcon className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-300">{t.potty.nextPoop}</h2>
              </div>
              {!hasNoPoop && getUrgencyBadge(predictions.poopUrgency)}
            </div>

            {/* Countdown & Delta Pill Row */}
            {hasNoPoop ? (
              <p className="text-sm font-semibold text-slate-200">{isHistoryUnknown ? '—' : t.dashboard.noPoopYet}</p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-100 whitespace-nowrap">
                    {formatCountdown(predictions.nextPoopExpectedAt)}
                  </span>
                  {predictions.nextPoopExpectedAt && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({formatClock(new Date(predictions.nextPoopExpectedAt))})
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700/80 px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                    ±{formatDuration(predictions.poopDeltaMins || 25, lang)}
                  </span>
                </div>
                {predictions.poopMode === 'post_meal_override' && predictions.standardPoopExpectedAt && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-700/60 text-xs font-semibold text-amber-300">
                    <span>{t.dashboard.withoutMeal}{t.common.colon} {formatCountdown(predictions.standardPoopExpectedAt)}</span>
                  </div>
                )}
              </div>
            )}

            {!isHistoryUnknown && (
              <div>
                {renderDetailsToggle('poop', joinSummary(t.dashboard.todayCount.replace('{count}', String(todayPoopCount)), lastPoopMinsAgo))}
                <div id="predictor-poop-details" className={detailsClass('poop')}>
                  {/* FIRST: Poop Stats Summary (Records of the day) */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1 text-slate-400">
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{t.dashboard.poopsToday}</span>
                      <span className="font-bold text-amber-300">{todayPoopCount}</span>
                    </div>
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{t.dashboard.lastPoop}</span>
                      <span className="font-bold text-slate-300">
                        {formatAgo(lastPoopMinsAgo)}
                      </span>
                    </div>
                  </div>

                  {/* SECOND: Poop Recommendation Description (Calculation details) */}
                  {!hasNoPoop && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed min-h-[52px] flex items-center">
                      {translatePredictionReason(predictions.poopReason, lang)}
                    </p>
                  )}
                </div>
              </div>
            )}
            {poopVetAdvice && (
              <p className="text-xs text-amber-200 bg-amber-950/40 p-2.5 rounded-xl border border-amber-700/50 leading-relaxed">
                {poopVetAdvice}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
            <button
              type="button"
              onClick={() => onQuickAction('poop', 'outside')}
              aria-label={t.potty.poopedOutside}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow transition-all px-2 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.potty.outside}</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('poop', 'indoor_accident')}
              aria-label={t.potty.poopAccident}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-red-950/70 border border-red-700/70 text-red-300 hover:bg-red-900/80 active:scale-[0.98] font-bold text-xs rounded-xl transition-all px-2 cursor-pointer"
            >
              <span className="truncate">{t.potty.accidentShort}</span>
            </button>
          </div>
        </Card.Content>
      </Card>

      {/* 3. Next Meal Card */}
      <Card
        className={`transition-all flex flex-col ${URGENCY_CARD_CLASSES[foodUrgency]}`}
      >
        <Card.Content className="p-4 flex flex-col justify-between h-full space-y-3">
          <div className="space-y-3">
            {/* Top Title & Urgency Badge Header Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg shrink-0 border border-purple-500/30">
                  <Utensils className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-300">{t.potty.nextMeal}</h2>
              </div>
              {!isBeforeFirstMeal && getUrgencyBadge(foodUrgency)}
            </div>

            {/* Countdown & Delta Pill Row */}
            {isBeforeFirstMeal && predictions.nextFoodExpectedAt ? (
              <p className="text-sm font-semibold text-slate-200">
                {isHistoryUnknown
                  ? '—'
                  : isBreakfastAhead ? t.dashboard.firstMealNext.replace('{time}', formatClock(firstMealAt)) : t.dashboard.firstMealNoTime}
              </p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-100 whitespace-nowrap">
                    {formatCountdown(predictions.nextFoodExpectedAt)}
                  </span>
                  {predictions.nextFoodExpectedAt && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({formatClock(new Date(predictions.nextFoodExpectedAt))})
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-300 bg-slate-950 border border-slate-700/80 px-2 py-0.5 rounded-lg shrink-0 shadow-sm">
                    ±{formatDuration(predictions.foodDeltaMins || 30, lang)}
                  </span>
                </div>
              </div>
            )}

            {!isHistoryUnknown && (
              <div>
                {renderDetailsToggle('food', joinSummary(rationText, lastFoodMinsAgo))}
                <div id="predictor-food-details" className={detailsClass('food')}>
                  {/* FIRST: Food Stats Summary (Records of the day) */}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1 text-slate-400">
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{t.dashboard.rationIntakeToday}</span>
                      <span className="font-bold text-purple-300">{rationText}</span>
                    </div>
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{t.dashboard.lastMeal}</span>
                      <span className="font-bold text-slate-300">
                        {formatAgo(lastFoodMinsAgo)}
                      </span>
                    </div>
                  </div>

                  {/* SECOND: Food Description (Calculation details) */}
                  {!isBeforeFirstMeal && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed min-h-[52px] flex items-center">
                      {translatePredictionReason(predictions.foodReason, lang)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-full pt-1">
            <button
              type="button"
              onClick={() => onOpenQuickLogModal('food')}
              className="w-full h-11 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition-colors px-3"
            >
              <Utensils className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {nextMealPortionGrams === undefined ? t.dashboard.feedMealNow : `${t.dashboard.feedMealNow} (${formatGrams(nextMealPortionGrams, lang)})`}
              </span>
            </button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
});
