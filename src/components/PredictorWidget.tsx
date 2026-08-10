import React, { useState, useEffect } from 'react';
import type { PredictionResult, ActivityType, PuppyProfile } from '../types';
import { Droplet, Utensils, AlertCircle, Clock, CheckCircle2, Sparkles, Footprints } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatMinutesToXhXX } from '../utils/date';
import {
  CardRoot,
  CardHeader,
  CardContent,
  CardTitle,
  ChipRoot,
  ChipLabel,
  ProgressBarRoot,
  ProgressBarTrack,
  ProgressBarFill,
} from '@heroui/react';

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

  const getUrgencyBadge = (urgency: 'safe' | 'soon' | 'overdue') => {
    if (urgency === 'overdue') {
      return (
        <ChipRoot color="danger" variant="soft" className="bg-red-500/20 text-red-300 border border-red-500/40 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse shrink-0">
          <AlertCircle className="w-3.5 h-3.5" />
          <ChipLabel>{t.potty.overdue}</ChipLabel>
        </ChipRoot>
      );
    }
    if (urgency === 'soon') {
      return (
        <ChipRoot color="warning" variant="soft" className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <ChipLabel>{t.potty.dueSoon}</ChipLabel>
        </ChipRoot>
      );
    }
    return (
      <ChipRoot color="success" variant="soft" className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <ChipLabel>{t.potty.allGood}</ChipLabel>
      </ChipRoot>
    );
  };

  const foodPercentage = Math.min(100, Math.round((todayFoodLoggedGrams / dailyGoal) * 100));

  return (
    <CardRoot className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-md text-slate-100">
      <CardHeader className="flex items-center justify-between mb-4 p-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-100">
              {t.dashboard.predictorTitle}
            </CardTitle>
            <p className="text-xs text-slate-400">
              {profile.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenQuickLogModal()}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer transition"
        >
          + {t.potty.logActivity}
        </button>
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {/* Potty & Poop Prediction Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Pee Card */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
                  <Droplet className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">{t.potty.nextPee}</span>
              </div>
              {getUrgencyBadge(predictions.peeUrgency)}
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <div className="text-xl font-black text-slate-100">
                  {formatCountdown(predictions.nextPeeExpectedAt)}
                </div>
                {predictions.nextPeeExpectedAt && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {predictions.nextPeeExpectedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onQuickAction('pee', 'outside')}
                className="px-3 py-1.5 text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 rounded-lg border border-sky-500/30 transition cursor-pointer"
              >
                💧 {t.potty.peedOutside}
              </button>
            </div>
          </div>

          {/* Poop Card */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Footprints className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-200">{t.potty.nextPoop}</span>
              </div>
              {getUrgencyBadge(predictions.poopUrgency)}
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <div className="text-xl font-black text-slate-100">
                  {formatCountdown(predictions.nextPoopExpectedAt)}
                </div>
                {predictions.nextPoopExpectedAt && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {predictions.nextPoopExpectedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onQuickAction('poop', 'outside')}
                className="px-3 py-1.5 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/30 transition cursor-pointer"
              >
                💩 {t.potty.poopedOutside}
              </button>
            </div>
          </div>
        </div>

        {/* Daily Food Portion Goal Progress Card */}
        <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200">{t.potty.nextMeal}</span>
                <p className="text-[11px] text-slate-400">
                  {todayFoodLoggedGrams}g / {dailyGoal}g ({todayMealsCount}/{targetMeals})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenQuickLogModal('food')}
              className="px-3 py-1.5 text-xs font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg border border-purple-500/30 transition cursor-pointer"
            >
              🥣 {portionLeftForNextMeal}g
            </button>
          </div>

          {/* HeroUI ProgressBar */}
          <ProgressBarRoot className="w-full space-y-1">
            <ProgressBarTrack className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <ProgressBarFill className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500" style={{ width: `${foodPercentage}%` }} />
            </ProgressBarTrack>
          </ProgressBarRoot>
        </div>
      </CardContent>
    </CardRoot>
  );
};
