import React, { useState, useEffect } from 'react';
import type { PredictionResult, ActivityType, PuppyProfile } from '../types';
import { Droplet, Utensils, AlertCircle, Clock, CheckCircle2, Sparkles, Footprints } from 'lucide-react';
import { useI18n } from '../i18n';

interface PredictorWidgetProps {
  predictions: PredictionResult;
  profile: PuppyProfile;
  todayFoodLoggedGrams: number;
  onQuickAction: (type: ActivityType, defaultLocation?: 'outside' | 'indoor_accident') => void;
  onOpenQuickLogModal: (type?: ActivityType) => void;
}

export const PredictorWidget: React.FC<PredictorWidgetProps> = ({
  predictions,
  profile,
  todayFoodLoggedGrams,
  onQuickAction,
  onOpenQuickLogModal,
}) => {
  const { t } = useI18n();
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const dailyGoal = profile.dailyFoodGramGoal || 200;
  const remainingFoodGrams = Math.max(0, dailyGoal - todayFoodLoggedGrams);

  const formatCountdown = (targetDate: Date | null) => {
    if (!targetDate) return t.dashboard.noLogYet;
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) {
      const overdueMins = Math.abs(diffMins);
      if (overdueMins < 60) {
        return `${overdueMins}m ${t.dashboard.overdueText}!`;
      }
      const h = Math.floor(overdueMins / 60);
      const m = overdueMins % 60;
      return m > 0 ? `${h}h ${m}m ${t.dashboard.overdueText}` : `${h}h ${t.dashboard.overdueText}`;
    } else if (diffMins === 0) {
      return t.dashboard.dueNow;
    } else if (diffMins < 60) {
      return `~${diffMins} min`;
    } else {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
    }
  };

  const formatTimeLeft = (targetDate: Date | null) => {
    if (!targetDate) return '';
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) {
      const overdueMins = Math.abs(diffMins);
      if (overdueMins < 60) return `${overdueMins}m ${t.dashboard.overdueText}`;
      const h = Math.floor(overdueMins / 60);
      const m = overdueMins % 60;
      return m > 0 ? `${h}h ${m}m ${t.dashboard.overdueText}` : `${h}h ${t.dashboard.overdueText}`;
    } else if (diffMins === 0) {
      return t.dashboard.dueNow;
    } else if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
  };

  const getUrgencyBadge = (urgency: 'safe' | 'soon' | 'overdue') => {
    if (urgency === 'overdue') {
      return (
        <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse shrink-0">
          <AlertCircle className="w-3.5 h-3.5" /> {t.potty.overdue}
        </span>
      );
    }
    if (urgency === 'soon') {
      return (
        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5" /> {t.potty.dueSoon}
        </span>
      );
    }
    return (
      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" /> {t.potty.allGood}
      </span>
    );
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
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
        <div
          className={`relative rounded-xl p-4 border transition-all flex flex-col justify-between ${
            predictions.peeUrgency === 'overdue'
              ? 'bg-red-950/30 border-red-700/60 shadow-lg shadow-red-950/50'
              : predictions.peeUrgency === 'soon'
              ? 'bg-amber-950/20 border-amber-600/50'
              : 'bg-slate-900/60 border-slate-700/60'
          }`}
        >
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
                    {/* Standard baseline label if post-meal active */}
                    {predictions.standardPeeExpectedAt &&
                      predictions.nextPeeExpectedAt &&
                      Math.abs(predictions.nextPeeExpectedAt.getTime() - predictions.standardPeeExpectedAt.getTime()) > 5 * 60 * 1000 && (
                        <span className="text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-lg">
                          ({t.potty.withoutMeal} ~{formatTimeLeft(predictions.standardPeeExpectedAt)})
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
            <button
              onClick={() => onQuickAction('pee', 'outside')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-2 rounded-lg flex items-center justify-center gap-1 shadow transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.potty.peedOutside}</span>
            </button>
            <button
              onClick={() => onQuickAction('pee', 'indoor_accident')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-2 rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <span>{t.potty.accident}</span>
            </button>
          </div>
        </div>

        {/* Next Poop Card */}
        <div
          className={`relative rounded-xl p-4 border transition-all flex flex-col justify-between ${
            predictions.poopUrgency === 'overdue'
              ? 'bg-red-950/30 border-red-700/60 shadow-lg shadow-red-950/50'
              : predictions.poopUrgency === 'soon'
              ? 'bg-amber-950/20 border-amber-600/50'
              : 'bg-slate-900/60 border-slate-700/60'
          }`}
        >
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
                    {predictions.standardPoopExpectedAt &&
                      predictions.nextPoopExpectedAt &&
                      Math.abs(predictions.nextPoopExpectedAt.getTime() - predictions.standardPoopExpectedAt.getTime()) > 5 * 60 * 1000 && (
                        <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-lg">
                          ({t.potty.withoutMeal} ~{formatTimeLeft(predictions.standardPoopExpectedAt)})
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
            <button
              onClick={() => onQuickAction('poop', 'outside')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-2 rounded-lg flex items-center justify-center gap-1 shadow transition active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.potty.poopedOutside}</span>
            </button>
            <button
              onClick={() => onQuickAction('poop', 'indoor_accident')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 px-2 rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <span>{t.potty.accident}</span>
            </button>
          </div>
        </div>

        {/* Next Food Card with Remaining Food Grams */}
        <div
          className={`relative rounded-xl p-4 border transition-all flex flex-col justify-between ${
            predictions.foodUrgency === 'overdue'
              ? 'bg-amber-950/30 border-amber-700/60'
              : predictions.foodUrgency === 'soon'
              ? 'bg-indigo-950/30 border-indigo-600/50'
              : 'bg-slate-900/60 border-slate-700/60'
          }`}
        >
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

            {/* Display Remaining Food Grams vs Daily Goal */}
            <div className="mb-3">
              <div className="flex justify-between text-[11px] font-semibold mb-1">
                <span className="text-slate-400">{t.dashboard.remainingFoodToday}</span>
                <span className="text-purple-300 font-bold">{remainingFoodGrams}g {t.dashboard.leftOf} {dailyGoal}g</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round((todayFoodLoggedGrams / dailyGoal) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenQuickLogModal('food')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer mt-2"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>{t.dashboard.feedMealNow} ({remainingFoodGrams}g)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
