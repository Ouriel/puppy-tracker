import React from 'react';
import type { Activity, PuppyProfile } from '../types';
import { TrendingUp, ShieldCheck, Utensils } from 'lucide-react';
import { useI18n } from '../i18n';
import { isSameLocalDate } from '../utils/date';

interface StatsAnalyticsProps {
  activities: Activity[];
  profile: PuppyProfile;
}

export const StatsAnalytics: React.FC<StatsAnalyticsProps> = ({ activities, profile }) => {
  const { t } = useI18n();
  const pottyLogs = activities.filter((activity) => activity.type === 'pee' || activity.type === 'poop');
  const outsideCount = pottyLogs.filter((activity) => activity.pottyLocation === 'outside').length;
  const accidentCount = pottyLogs.filter((activity) => activity.pottyLocation === 'indoor_accident').length;
  const totalPotty = pottyLogs.length;

  const successRate = totalPotty > 0 ? Math.round((outsideCount / totalPotty) * 100) : 100;

  const now = new Date();
  const todayFood = activities.filter(
    (activity) => activity.type === 'food' && isSameLocalDate(activity.timestamp, now)
  );
  const todayGramTotal = todayFood.reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0);
  const foodGoalPercent = Math.min(100, Math.round((todayGramTotal / profile.dailyFoodGramGoal) * 100));

  const hourlyCounts = new Array(24).fill(0);
  pottyLogs.forEach((activity) => {
    const hour = new Date(activity.timestamp).getHours();
    hourlyCounts[hour]++;
  });
  const maxHourCount = Math.max(...hourlyCounts, 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{t.dashboard.pottyTrainingScore}</h3>
              <p className="text-[11px] text-slate-400">{t.dashboard.successVsAccidents}</p>
            </div>
          </div>
          <span className="text-xl font-extrabold text-emerald-400">{successRate}%</span>
        </div>

        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden flex mb-3 border border-slate-700">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${totalPotty ? (outsideCount / totalPotty) * 100 : 100}%` }}
            title={`${t.potty.outside}: ${outsideCount}`}
          />
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${totalPotty ? (accidentCount / totalPotty) * 100 : 0}%` }}
            title={`${t.potty.accident}: ${accidentCount}`}
          />
        </div>

        <div className="grid grid-cols-2 text-center text-xs gap-2">
          <div className="bg-emerald-950/30 border border-emerald-800/40 p-2 rounded-lg">
            <div className="font-bold text-emerald-400">{outsideCount}</div>
            <div className="text-[10px] text-slate-400">{t.potty.outside}</div>
          </div>
          <div className="bg-red-950/30 border border-red-800/40 p-2 rounded-lg">
            <div className="font-bold text-red-400">{accidentCount}</div>
            <div className="text-[10px] text-slate-400">{t.potty.accident}</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{t.dashboard.todaysNutrition}</h3>
              <p className="text-[11px] text-slate-400">
                {todayGramTotal}{t.units.grams} / {profile.dailyFoodGramGoal}{t.units.grams}
              </p>
            </div>
          </div>
          <span className="text-xl font-extrabold text-purple-400">
            {todayFood.length} {t.potty.food}
          </span>
        </div>

        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden mb-3 border border-slate-700">
          <div
            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-500"
            style={{ width: `${foodGoalPercent}%` }}
          />
        </div>

        <div className="text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/60 flex items-center justify-between">
          <span>{t.dashboard.targetMealsPerDay}</span>
          <span className="font-bold text-purple-300">{profile.targetMealsPerDay}</span>
        </div>
      </div>

      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">{t.dashboard.pottyPeakHours}</h3>
            <p className="text-[11px] text-slate-400">{t.dashboard.hourlyDistribution}</p>
          </div>
        </div>

        <div className="flex items-end gap-1 h-16 pt-2 px-1 bg-slate-900/60 rounded-xl border border-slate-700/50 relative">
          {hourlyCounts.map((count, hr) => {
            const heightPercent = count > 0 ? (count / maxHourCount) * 100 : 5;
            const isPeak = count === maxHourCount && count > 0;
            return (
              <div
                key={hr}
                className="flex-1 flex flex-col items-center group relative cursor-pointer h-full justify-end"
              >
                {/* Mobile & Desktop Hover Tooltip */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:flex group-active:flex bg-slate-950 text-sky-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700 whitespace-nowrap z-20 shadow-lg pointer-events-none">
                  {String(hr).padStart(2, '0')}:00 ({count})
                </div>
                <div
                  className={`w-full rounded-t transition-all ${
                    isPeak
                      ? 'bg-sky-400 shadow-md shadow-sky-400/50'
                      : count > 0
                      ? 'bg-sky-600/70 hover:bg-sky-500'
                      : 'bg-slate-800'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1.5 px-1 font-mono">
          <span>00h</span>
          <span>04h</span>
          <span>08h</span>
          <span>12h</span>
          <span>16h</span>
          <span>20h</span>
          <span>23h</span>
        </div>
      </div>
    </div>
  );
};
