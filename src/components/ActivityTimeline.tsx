import React, { useState } from 'react';
import type { Activity, ActivityType, Caretaker } from '../types';
import { Droplet, Footprints, Utensils, Activity as WalkIcon, Scale, Pill, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';

interface ActivityTimelineProps {
  activities: Activity[];
  caretakers: Caretaker[];
  onDeleteActivity: (id: string) => void;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  caretakers,
  onDeleteActivity,
}) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'potty' | 'food' | 'walk'>('all');

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case 'pee':
        return <Droplet className="w-4 h-4 text-sky-400" />;
      case 'poop':
        return <Footprints className="w-4 h-4 text-amber-400" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-purple-400" />;
      case 'walk':
        return <WalkIcon className="w-4 h-4 text-emerald-400" />;
      case 'weight':
        return <Scale className="w-4 h-4 text-pink-400" />;
      case 'medication':
        return <Pill className="w-4 h-4 text-red-400" />;
    }
  };

  const getCaretakerColor = (name: string) => {
    const caretaker = caretakers.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return caretaker ? caretaker.color : '#6366F1';
  };

  const filtered = activities.filter((a) => {
    if (filter === 'potty') return a.type === 'pee' || a.type === 'poop';
    if (filter === 'food') return a.type === 'food';
    if (filter === 'walk') return a.type === 'walk';
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `Today ${timeStr}`;
    } else if (diffHours < 48 && date.getDate() === now.getDate() - 1) {
      return `Yesterday ${timeStr}`;
    } else {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
    }
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      {/* Header & Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{t.dashboard.activityFeed}</span>
            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
              {sorted.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400">{t.dashboard.chronologicalHistory}</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700/60 p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('potty')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'potty'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Potty 💧
          </button>
          <button
            onClick={() => setFilter('food')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'food'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Meals 🍖
          </button>
          <button
            onClick={() => setFilter('walk')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'walk'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Walks 🐾
          </button>
        </div>
      </div>

      {/* Timeline list */}
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-slate-900/40 rounded-xl border border-dashed border-slate-700">
          <p className="text-sm">{t.dashboard.noActivityLogs}</p>
          <p className="text-xs text-slate-500 mt-1">{t.dashboard.tapLogEvent}</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700/60">
          {sorted.map((item) => {
            const color = getCaretakerColor(item.loggedBy);
            return (
              <div
                key={item.id}
                className="relative group bg-slate-900/70 hover:bg-slate-900 border border-slate-700/70 hover:border-slate-600 rounded-xl p-3.5 transition-all shadow-sm flex items-start justify-between gap-3"
              >
                {/* Timeline dot */}
                <div
                  className="absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full ring-4 ring-slate-800 flex items-center justify-center"
                  style={{ backgroundColor: color }}
                />

                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700/60 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-100 capitalize">
                        {item.type}
                      </span>

                      {/* Potty location pill */}
                      {item.pottyLocation === 'outside' && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          🌳 {t.potty.outside}
                        </span>
                      )}
                      {item.pottyLocation === 'indoor_pad' && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          🟨 {t.potty.pad}
                        </span>
                      )}
                      {item.pottyLocation === 'indoor_accident' && (
                        <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          🚨 {t.potty.accident}
                        </span>
                      )}

                      {/* Stool consistency */}
                      {item.stoolConsistency && (
                        <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-700">
                          Stool: {item.stoolConsistency}
                        </span>
                      )}

                      {/* Food Grams */}
                      {item.quantityGrams && (
                        <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {item.quantityGrams}g ({item.quantityCups || 0.75} cups) - {item.foodType}
                        </span>
                      )}

                      {/* Duration */}
                      {item.durationMinutes && (
                        <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {item.durationMinutes} mins
                        </span>
                      )}

                      {/* Weight */}
                      {item.weightKg && (
                        <span className="bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {item.weightKg} kg
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-300 mt-1 italic font-mono bg-slate-950/40 px-2 py-1 rounded border border-slate-800">
                        "{item.notes}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      <span>{formatTime(item.timestamp)}</span>
                      <span>•</span>
                      <span className="font-semibold" style={{ color }}>
                        {item.loggedBy}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteActivity(item.id)}
                  title="Delete log"
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
