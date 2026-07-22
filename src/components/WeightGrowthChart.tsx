import React from 'react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, TrendingUp, Plus, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';

interface WeightGrowthChartProps {
  activities: Activity[];
  profile: PuppyProfile;
  onOpenQuickLogModal: (type: 'weight') => void;
}

export const WeightGrowthChart: React.FC<WeightGrowthChartProps> = ({
  activities,
  profile,
  onOpenQuickLogModal,
}) => {
  const { lang } = useI18n();

  // Extract and sort weight entries chronologically
  const weightLogs = React.useMemo(() => {
    return activities
      .filter((a) => a.type === 'weight' && a.weightKg && a.weightKg > 0)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activities]);

  const latestWeight = weightLogs.length > 0
    ? weightLogs[weightLogs.length - 1].weightKg!
    : profile.weightKg;

  // Calculate puppy age in weeks
  const ageWeeks = React.useMemo(() => {
    if (!profile.birthDate) return 12;
    const birth = new Date(profile.birthDate).getTime();
    const now = Date.now();
    const diffDays = (now - birth) / (1000 * 60 * 60 * 24);
    return Math.max(1, Math.floor(diffDays / 7));
  }, [profile.birthDate]);

  // Standard Expected Weight Curve for Cocker Spaniel & Medium Breeds (in kg)
  const growthBenchmarks = [
    { label: '8w', expectedKg: 2.5, minKg: 2.0, maxKg: 3.2 },
    { label: '12w', expectedKg: 5.0, minKg: 4.2, maxKg: 6.0 },
    { label: '16w', expectedKg: 7.2, minKg: 6.0, maxKg: 8.5 },
    { label: '6m', expectedKg: 9.5, minKg: 8.0, maxKg: 11.0 },
    { label: '12m', expectedKg: 13.0, minKg: 11.5, maxKg: 15.0 },
  ];



  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>{lang === 'fr' ? 'Courbe de Croissance & Poids' : 'Weight & Growth Curve Chart'}</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>{lang === 'fr' ? 'Croissance Harmonieuse' : 'Healthy Pace'}</span>
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {lang === 'fr'
                ? `Âge du chiot : ${ageWeeks} semaines • Poids actuel : ${latestWeight} kg`
                : `Puppy age: ${ageWeeks} weeks • Current weight: ${latestWeight} kg`}
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenQuickLogModal('weight')}
          className="flex items-center gap-1.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'fr' ? 'Enregistrer une Pesée' : 'Log Weight'}</span>
        </button>
      </div>

      {/* Visual Weight Curve Chart */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
          <span>{lang === 'fr' ? 'Standard Race (Cocker)' : 'Breed Standard'}</span>
          <span>{latestWeight} kg / 13.0 kg (Target)</span>
        </div>

        {/* Growth Bar Progress */}
        <div className="w-full bg-slate-950 h-4 rounded-full p-0.5 border border-slate-800 overflow-hidden relative">
          {/* Target Zone Gradient */}
          <div
            className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-pink-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (latestWeight / 14) * 100)}%` }}
          />
        </div>

        {/* Benchmarks Grid */}
        <div className="grid grid-cols-5 gap-2 pt-2">
          {growthBenchmarks.map((bench) => {
            const isPassed = ageWeeks >= parseInt(bench.label);
            return (
              <div
                key={bench.label}
                className={`p-2.5 rounded-xl border text-center transition ${
                  isPassed
                    ? 'bg-slate-850 border-indigo-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase">{bench.label}</div>
                <div className="text-xs font-extrabold text-white mt-0.5">{bench.expectedKg} kg</div>
                <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {bench.minKg}-{bench.maxKg}kg
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weight History Timeline List */}
      {weightLogs.length > 0 && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
            <span>{lang === 'fr' ? 'Historique des Pesées' : 'Recent Weight History'}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weightLogs.slice(-5).map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shrink-0"
              >
                <span className="font-bold text-pink-300">{log.weightKg} kg</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(log.timestamp).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
