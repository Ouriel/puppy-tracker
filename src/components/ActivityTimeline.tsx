import React, { useState } from 'react';
import type { Activity, ActivityType, Caretaker } from '../types';
import { Droplet, Footprints, Utensils, Scale, Pill, Trash2, Pencil } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatRelativeTime, parseIsoDate } from '../utils/date';
import { EditActivityModal } from './EditActivityModal';
import { resolveCaretakerName } from '../utils/caretakers';
import {
  CardRoot,
  CardHeader,
  CardContent,
  CardTitle,
  ChipRoot,
  ChipLabel,
} from '@heroui/react';

interface ActivityTimelineProps {
  activities: Activity[];
  caretakers: Caretaker[];
  onDeleteActivity: (id: string) => void;
  onUpdateActivity?: (updated: Partial<Activity> & { id: string }) => void;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  caretakers,
  onDeleteActivity,
  onUpdateActivity,
}) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'potty' | 'food'>('all');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case 'pee':
        return <Droplet className="w-4 h-4 text-sky-400" />;
      case 'poop':
        return <Footprints className="w-4 h-4 text-amber-400" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-purple-400" />;
      case 'weight':
        return <Scale className="w-4 h-4 text-pink-400" />;
      case 'medication':
        return <Pill className="w-4 h-4 text-red-400" />;
    }
  };

  const getCaretakerColor = (name: string) => {
    const resolved = resolveCaretakerName(name, caretakers);
    const caretaker = caretakers.find((item) => item.name.toLowerCase() === resolved.toLowerCase());
    return caretaker ? caretaker.color : '#6366F1';
  };

  const filtered = activities.filter((activity) => {
    if (filter === 'potty') return activity.type === 'pee' || activity.type === 'poop';
    if (filter === 'food') return activity.type === 'food';
    return true;
  });

  const sorted = [...filtered].sort(
    (activityA, activityB) => parseIsoDate(activityB.timestamp).getTime() - parseIsoDate(activityA.timestamp).getTime()
  );

  const { lang } = useI18n();

  const formatTime = (isoString: string) => {
    return formatRelativeTime(isoString, lang as 'en' | 'fr', {
      today: t.dashboard.today,
      yesterday: t.dashboard.yesterday,
    });
  };

  return (
    <CardRoot className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl backdrop-blur-md text-slate-100">
      {/* Header & Filter Chips */}
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 mb-5 p-0">
        <div>
          <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{t.dashboard.recentActivity}</span>
            <ChipRoot color="accent" variant="soft" className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-semibold">
              <ChipLabel>{sorted.length}</ChipLabel>
            </ChipRoot>
          </CardTitle>
          <p className="text-xs text-slate-400">{t.dashboard.recentActivity}</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.dashboard.all}
          </button>
          <button
            type="button"
            onClick={() => setFilter('potty')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'potty'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.dashboard.pottyFilter}
          </button>
          <button
            type="button"
            onClick={() => setFilter('food')}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
              filter === 'food'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.dashboard.mealsFilter}
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Timeline List */}
        {sorted.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800">
            <p className="text-sm font-medium text-slate-400">{t.dashboard.noLogYet}</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-700/60">
            {sorted.map((item) => {
              const friendlyLoggedBy = resolveCaretakerName(item.loggedBy, caretakers);
              const caretakerBgColor = getCaretakerColor(friendlyLoggedBy);

              return (
                <div key={item.id} className="relative group">
                  {/* Bullet */}
                  <div className="absolute -left-6 top-3 w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center group-hover:border-indigo-500 transition">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  </div>

                  {/* Log Card */}
                  <div className="bg-slate-900/80 border border-slate-700/60 hover:border-slate-600 rounded-xl p-4 transition-all shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 shrink-0">
                          {getIcon(item.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-200 capitalize">
                              {item.type === 'pee' && t.potty.pee}
                              {item.type === 'poop' && t.potty.poop}
                              {item.type === 'food' && t.potty.food}
                              {item.type === 'weight' && t.potty.weight}
                              {item.type === 'medication' && t.potty.medication}
                            </span>

                            {item.pottyLocation === 'indoor_accident' && (
                              <ChipRoot color="danger" variant="soft" className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                <ChipLabel>🚨 {t.potty.accident}</ChipLabel>
                              </ChipRoot>
                            )}

                            {item.pottyLocation === 'outside' && (
                              <ChipRoot color="success" variant="soft" className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                <ChipLabel>🌳 {t.potty.outside}</ChipLabel>
                              </ChipRoot>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 mt-1 space-x-2">
                            {item.type === 'food' && item.quantityGrams && (
                              <span className="font-semibold text-slate-300">
                                🥣 {item.quantityGrams}g ({item.quantityCups ?? (item.quantityGrams / 110).toFixed(2)} {t.units.cups}) - {item.foodType || t.potty.kibble}
                              </span>
                            )}
                            {item.type === 'weight' && item.weightKg && (
                              <span className="font-semibold text-slate-300">
                                ⚖️ {item.weightKg} {t.units.kg}
                              </span>
                            )}
                            {item.type === 'medication' && item.medicationName && (
                              <span className="font-semibold text-slate-300">
                                💊 {item.medicationName}
                              </span>
                            )}
                            {item.stoolConsistency && (
                              <span className="text-amber-300/80 font-medium">
                                ({t.potty.stoolConsistency}: {item.stoolConsistency})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Buttons & Caretaker Info */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {formatTime(item.timestamp)}
                          </span>
                          <span
                            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mt-0.5 shadow-sm"
                            style={{ backgroundColor: caretakerBgColor }}
                          >
                            {friendlyLoggedBy}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          {onUpdateActivity && (
                            <button
                              type="button"
                              onClick={() => setEditingActivity(item)}
                              className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded-lg transition cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteActivity(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800 text-xs text-slate-300 italic bg-slate-950/40 p-2 rounded-lg">
                        "{item.notes}"
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Edit Activity Modal */}
      {editingActivity && onUpdateActivity && (
        <EditActivityModal
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSave={(updated) => {
            onUpdateActivity(updated);
            setEditingActivity(null);
          }}
        />
      )}
    </CardRoot>
  );
};
