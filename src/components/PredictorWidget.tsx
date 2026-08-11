import React, { useState, useEffect } from 'react';
import type { PredictionResult, ActivityType, PuppyProfile, Activity } from '../types';
import { Droplet, Utensils, AlertCircle, Clock, CheckCircle2, Footprints } from 'lucide-react';
import { Button, Card, Chip, ProgressBar } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatMinutesToXhXX, isSameLocalDate, parseIsoDate } from '../utils/date';

interface PredictorWidgetProps {
  predictions: PredictionResult;
  profile: PuppyProfile;
  activities: Activity[];
  todayFoodLoggedGrams: number;
  todayMealsCount?: number;
  onQuickAction: (type: ActivityType, defaultLocation?: 'outside' | 'indoor_accident') => void;
  onOpenQuickLogModal: (type?: ActivityType) => void;
}

export const PredictorWidget: React.FC<PredictorWidgetProps> = ({
  predictions,
  profile,
  activities,
  todayFoodLoggedGrams,
  todayMealsCount = 0,
  onQuickAction,
  onOpenQuickLogModal,
}) => {
  const { t } = useI18n();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();

  // Pee stats today & last pee
  const todayPeeLogs = activities.filter(
    (act) => act.type === 'pee' && isSameLocalDate(act.timestamp, now)
  );

  const allPeeLogs = activities
    .filter((act) => act.type === 'pee')
    .sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());
  
  const lastPeeMinsAgo = allPeeLogs.length > 0
    ? Math.max(0, Math.floor((now.getTime() - parseIsoDate(allPeeLogs[0].timestamp).getTime()) / (1000 * 60)))
    : null;

  // Poop stats today & last poop
  const todayPoopLogs = activities.filter(
    (act) => act.type === 'poop' && isSameLocalDate(act.timestamp, now)
  );

  const allPoopLogs = activities
    .filter((act) => act.type === 'poop')
    .sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());

  const lastPoopMinsAgo = allPoopLogs.length > 0
    ? Math.max(0, Math.floor((now.getTime() - parseIsoDate(allPoopLogs[0].timestamp).getTime()) / (1000 * 60)))
    : null;

  const targetMeals = Math.max(1, profile.targetMealsPerDay || 3);
  const dailyGoal = profile.dailyFoodGramGoal || 240;
  const remainingFoodGrams = Math.max(0, dailyGoal - todayFoodLoggedGrams);
  const remainingMealsToday = Math.max(1, targetMeals - todayMealsCount);

  const portionLeftForNextMeal = remainingFoodGrams > 0
    ? Math.max(10, Math.round(remainingFoodGrams / remainingMealsToday))
    : Math.round(dailyGoal / targetMeals);

  const formatCountdown = (targetDate: Date | null) => {
    if (!targetDate) return t.dashboard.noLogYet;
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) {
      const overdueMins = Math.abs(diffMins);
      return `${formatMinutesToXhXX(overdueMins)} ${t.dashboard.overdueText}`;
    } else if (diffMins === 0) {
      return t.dashboard.dueNow;
    } else {
      return `~${formatMinutesToXhXX(diffMins)}`;
    }
  };

  const formatTimeLeft = (targetDate: Date | null) => {
    if (!targetDate) return '';
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) {
      const overdueMins = Math.abs(diffMins);
      return `${formatMinutesToXhXX(overdueMins)} ${t.dashboard.overdueText}`;
    } else if (diffMins === 0) {
      return t.dashboard.dueNow;
    } else {
      return formatMinutesToXhXX(diffMins);
    }
  };

  const getUrgencyBadge = (urgency: 'safe' | 'soon' | 'overdue') => {
    if (urgency === 'overdue') {
      return (
        <Chip color="danger" variant="soft" size="sm" className="animate-pulse font-bold">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> {t.potty.overdue}
          </div>
        </Chip>
      );
    }
    if (urgency === 'soon') {
      return (
        <Chip color="warning" variant="soft" size="sm" className="font-bold">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {t.potty.dueSoon}
          </div>
        </Chip>
      );
    }
    return (
      <Chip color="success" variant="soft" size="sm" className="font-bold">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> {t.potty.allGood}
        </div>
      </Chip>
    );
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
          <div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl shrink-0 mt-0.5 border border-sky-500/30">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">{t.potty.nextPee}</div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl font-black text-slate-100">
                      {formatCountdown(predictions.nextPeeExpectedAt)}
                    </span>
                    {predictions.peeMode === 'post_meal_override' && predictions.standardPeeExpectedAt && (
                      <span className="text-[11px] font-semibold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded-lg">
                        ({t.dashboard.withoutMeal} ~{formatTimeLeft(predictions.standardPeeExpectedAt)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {getUrgencyBadge(predictions.peeUrgency)}
            </div>

            {/* Pee Recommendation Description */}
            <p className="text-xs text-slate-300 my-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
              {predictions.peeReason}
            </p>

            {/* Pee Stats Summary */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1 text-slate-400">
              <div className="flex justify-between font-medium">
                <span>Pees today:</span>
                <span className="font-bold text-sky-300">{todayPeeLogs.length}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Last pee:</span>
                <span className="font-bold text-slate-300">
                  {lastPeeMinsAgo !== null ? `${formatMinutesToXhXX(lastPeeMinsAgo)} ago` : 'None logged today'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              onPress={() => onQuickAction('pee', 'outside')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 shadow border-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
              <span>{t.potty.peedOutside}</span>
            </Button>
            <Button
              size="sm"
              onPress={() => onQuickAction('pee', 'indoor_accident')}
              className="bg-rose-950/60 border border-rose-700/60 text-rose-300 hover:bg-rose-900/60 text-xs py-2 font-bold"
            >
              <span>{t.potty.accident}</span>
            </Button>
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
          <div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-amber-600/20 text-amber-400 rounded-xl shrink-0 mt-0.5 border border-amber-500/30">
                  <Footprints className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">{t.potty.nextPoop}</div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-2xl font-black text-slate-100">
                      {formatCountdown(predictions.nextPoopExpectedAt)}
                    </span>
                    {predictions.poopMode === 'post_meal_override' && predictions.standardPoopExpectedAt && (
                      <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded-lg">
                        ({t.dashboard.withoutMeal} ~{formatTimeLeft(predictions.standardPoopExpectedAt)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {getUrgencyBadge(predictions.poopUrgency)}
            </div>

            {/* Poop Recommendation Description */}
            <p className="text-xs text-slate-300 my-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
              {predictions.poopReason}
            </p>

            {/* Poop Stats Summary */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1 text-slate-400">
              <div className="flex justify-between font-medium">
                <span>Poops today:</span>
                <span className="font-bold text-amber-300">{todayPoopLogs.length}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Last poop:</span>
                <span className="font-bold text-slate-300">
                  {lastPoopMinsAgo !== null ? `${formatMinutesToXhXX(lastPoopMinsAgo)} ago` : 'None logged today'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              onPress={() => onQuickAction('poop', 'outside')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 shadow border-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
              <span>{t.potty.poopedOutside}</span>
            </Button>
            <Button
              size="sm"
              onPress={() => onQuickAction('poop', 'indoor_accident')}
              className="bg-rose-950/60 border border-rose-700/60 text-rose-300 hover:bg-rose-900/60 text-xs py-2 font-bold"
            >
              <span>{t.potty.accident}</span>
            </Button>
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
          <div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl shrink-0 mt-0.5 border border-purple-500/30">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">{t.potty.nextMeal}</div>
                  <div className="text-2xl font-black text-slate-100">
                    {formatCountdown(predictions.nextFoodExpectedAt)}
                  </div>
                </div>
              </div>
              {getUrgencyBadge(predictions.foodUrgency)}
            </div>

            {/* Clean, Non-Repetitive Food Description */}
            <p className="text-xs text-slate-300 my-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
              {predictions.foodReason}
            </p>

            {/* Food Progress Summary */}
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-400">Ration intake:</span>
                <span className="text-purple-300 font-bold">{todayFoodLoggedGrams}g / {dailyGoal}g</span>
              </div>
              <ProgressBar value={Math.min(100, Math.round((todayFoodLoggedGrams / dailyGoal) * 100))} color="accent" size="sm">
                <ProgressBar.Track className="bg-slate-900 border border-slate-800">
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <div className="text-[10px] text-purple-400 font-bold text-right pt-0.5">
                Meal {todayMealsCount} of {targetMeals} logged ({portionLeftForNextMeal}g next)
              </div>
            </div>
          </div>

          <div className="pt-1">
            <Button
              size="sm"
              onPress={() => onOpenQuickLogModal('food')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-2 shadow border-0"
            >
              <Utensils className="w-3.5 h-3.5 mr-1 inline" />
              <span>{t.dashboard.feedMealNow} ({portionLeftForNextMeal}g)</span>
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
