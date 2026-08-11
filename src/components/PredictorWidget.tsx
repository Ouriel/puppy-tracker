import React, { useState, useEffect } from 'react';
import type { PredictionResult, ActivityType, PuppyProfile } from '../types';
import { Droplet, Utensils, AlertCircle, Clock, CheckCircle2, Sparkles, Footprints } from 'lucide-react';
import { Button, Card, Chip, ProgressBar } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatMinutesToXhXX } from '../utils/date';

interface PredictorWidgetProps {
  predictions: PredictionResult;
  profile: PuppyProfile;
  todayFoodLoggedGrams: number;
  todayMealsCount?: number;
  onQuickAction: (type: ActivityType, defaultLocation?: 'outside' | 'indoor_accident') => void;
  onOpenQuickLogModal: (type?: ActivityType) => void;
}

export const PredictorWidget: React.FC<PredictorWidgetProps> = ({
  predictions,
  profile,
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

  const targetMeals = Math.max(1, profile.targetMealsPerDay || 3);
  const dailyGoal = profile.dailyFoodGramGoal || 240;
  const remainingFoodGrams = Math.max(0, dailyGoal - todayFoodLoggedGrams);
  const remainingMealsToday = Math.max(1, targetMeals - todayMealsCount);

  const portionLeftForNextMeal = remainingFoodGrams > 0
    ? Math.max(10, Math.round(remainingFoodGrams / remainingMealsToday))
    : Math.round(dailyGoal / targetMeals);

  const formatCountdown = (targetDate: Date | null) => {
    if (!targetDate) return t.dashboard.noLogYet;
    const now = new Date();
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
    const now = new Date();
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
        <Chip color="danger" variant="soft" size="sm" className="animate-pulse">
          <div className="flex items-center gap-1 font-bold">
            <AlertCircle className="w-3.5 h-3.5" /> {t.potty.overdue}
          </div>
        </Chip>
      );
    }
    if (urgency === 'soon') {
      return (
        <Chip color="warning" variant="soft" size="sm">
          <div className="flex items-center gap-1 font-bold">
            <Clock className="w-3.5 h-3.5" /> {t.potty.dueSoon}
          </div>
        </Chip>
      );
    }
    return (
      <Chip color="success" variant="soft" size="sm">
        <div className="flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> {t.potty.allGood}
        </div>
      </Chip>
    );
  };

  return (
    <Card className="bg-slate-800/80 border-slate-700/80 shadow-xl backdrop-blur-md">
      <Card.Content className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {t.dashboard.predictorTitle}
            </h2>
            <p className="text-xs text-slate-400">
              {t.dashboard.predictorSubtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Pee Card */}
        <Card
          className={`transition-all ${
            predictions.peeUrgency === 'overdue'
              ? 'bg-red-950/30 border-red-700/60 shadow-lg shadow-red-950/50'
              : predictions.peeUrgency === 'soon'
              ? 'bg-amber-950/20 border-amber-600/50'
              : 'bg-slate-900/60 border-slate-700/60'
          }`}
        >
          <Card.Content className="p-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg shrink-0 mt-0.5">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">{t.potty.nextPee}</div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg font-bold text-slate-100">
                      {formatCountdown(predictions.nextPeeExpectedAt)}
                    </span>
                    {/* Standard baseline label if post-meal active during daytime */}
                    {predictions.peeMode === 'post_meal_override' &&
                      predictions.standardPeeExpectedAt && (
                        <span className="text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-lg">
                          ({t.dashboard.withoutMeal} ~{formatTimeLeft(predictions.standardPeeExpectedAt)})
                        </span>
                    )}
                  </div>
                </div>
              </div>
              {getUrgencyBadge(predictions.peeUrgency)}
            </div>

            <p className="text-xs text-slate-300 my-2.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
              {predictions.peeReason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="primary"
              size="sm"
              onPress={() => onQuickAction('pee', 'outside')}
              className="font-semibold text-xs py-2 px-2 shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
              <span>{t.potty.peedOutside}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => onQuickAction('pee', 'indoor_accident')}
              className="text-slate-300 text-xs py-2 px-2 border-slate-700"
            >
              <span>{t.potty.accident}</span>
            </Button>
          </div>
          </Card.Content>
        </Card>

        {/* Next Poop Card */}
        <Card
          className={`transition-all ${
            predictions.poopUrgency === 'overdue'
              ? 'bg-red-950/30 border-red-700/60 shadow-lg shadow-red-950/50'
              : predictions.poopUrgency === 'soon'
              ? 'bg-amber-950/20 border-amber-600/50'
              : 'bg-slate-900/60 border-slate-700/60'
          }`}
        >
          <Card.Content className="p-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-amber-600/20 text-amber-400 rounded-lg shrink-0 mt-0.5">
                  <Footprints className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">{t.potty.nextPoop}</div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg font-bold text-slate-100">
                      {formatCountdown(predictions.nextPoopExpectedAt)}
                    </span>
                    {predictions.poopMode === 'post_meal_override' &&
                      predictions.standardPoopExpectedAt && (
                        <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-lg">
                          ({t.dashboard.withoutMeal} ~{formatTimeLeft(predictions.standardPoopExpectedAt)})
                        </span>
                    )}
                  </div>
                </div>
              </div>
              {getUrgencyBadge(predictions.poopUrgency)}
            </div>

            <p className="text-xs text-slate-300 my-2.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
              {predictions.poopReason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="primary"
              size="sm"
              onPress={() => onQuickAction('poop', 'outside')}
              className="font-semibold text-xs py-2 px-2 shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
              <span>{t.potty.poopedOutside}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onPress={() => onQuickAction('poop', 'indoor_accident')}
              className="text-slate-300 text-xs py-2 px-2 border-slate-700"
            >
              <span>{t.potty.accident}</span>
            </Button>
          </div>
          </Card.Content>
        </Card>

        {/* Next Food Card with Remaining Food Grams */}
        <Card
          className={`transition-all ${
            predictions.foodUrgency === 'overdue'
              ? 'bg-amber-950/30 border-amber-700/60'
              : predictions.foodUrgency === 'soon'
              ? 'bg-indigo-950/30 border-indigo-600/50'
              : 'bg-slate-900/60 border-slate-700/60'
          }`}
        >
          <Card.Content className="p-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg shrink-0 mt-0.5">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-400">{t.potty.nextMeal}</div>
                  <div className="text-lg font-bold text-slate-100">
                    {formatCountdown(predictions.nextFoodExpectedAt)}
                  </div>
                </div>
              </div>
              {getUrgencyBadge(predictions.foodUrgency)}
            </div>

            <p className="text-xs text-slate-300 my-2.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed">
              {predictions.foodReason}
            </p>

            <div className="mb-3">
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-slate-400">{t.dashboard.remainingFoodToday}</span>
                <span className="text-purple-300 font-bold">{remainingFoodGrams}g {t.dashboard.leftOf} {dailyGoal}g</span>
              </div>
              <ProgressBar value={Math.min(100, Math.round((todayFoodLoggedGrams / dailyGoal) * 100))} color="accent" size="sm">
                <ProgressBar.Track className="bg-slate-950 border border-slate-800">
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onPress={() => onOpenQuickLogModal('food')}
            className="w-full font-semibold text-xs py-2 px-3 shadow mt-2"
          >
            <Utensils className="w-3.5 h-3.5 mr-1 inline" />
            <span>{t.dashboard.feedMealNow} ({portionLeftForNextMeal}g)</span>
          </Button>
          </Card.Content>
        </Card>
      </div>
      </Card.Content>
    </Card>
  );
};
