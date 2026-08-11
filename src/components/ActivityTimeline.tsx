import React, { useState } from 'react';
import type { Activity, ActivityType, Caretaker } from '../types';
import { Droplet, Footprints, Utensils, Scale, Pill, Trash2, Pencil } from 'lucide-react';
import { Button, Card, Chip } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatRelativeTime, parseIsoDate } from '../utils/date';
import { EditActivityModal } from './EditActivityModal';
import { resolveCaretakerName } from '../utils/caretakers';

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
    <Card className="shadow-xl backdrop-blur-md bg-slate-800/80 border-slate-700/80">
      <Card.Content className="p-5">
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
          <Button
            size="sm"
            variant={filter === 'all' ? 'primary' : 'tertiary'}
            onPress={() => setFilter('all')}
          >
            {t.dashboard.all}
          </Button>
          <Button
            size="sm"
            variant={filter === 'potty' ? 'primary' : 'tertiary'}
            onPress={() => setFilter('potty')}
          >
            {t.dashboard.pottyFilter}
          </Button>
          <Button
            size="sm"
            variant={filter === 'food' ? 'primary' : 'tertiary'}
            onPress={() => setFilter('food')}
          >
            {t.dashboard.mealsFilter}
          </Button>
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
              <Card
                key={item.id}
                className="relative group bg-slate-900/70 hover:bg-slate-900 border border-slate-700/70 hover:border-slate-600 transition-all shadow-sm"
              >
                <Card.Content className="p-3.5 flex items-start justify-between gap-3">
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
                        {t.potty[item.type as keyof typeof t.potty] || item.type}
                      </span>

                      {/* Potty location pill */}
                      {item.pottyLocation === 'outside' && (
                        <Chip color="success" variant="soft" size="sm">
                          🌳 {t.potty.outside}
                        </Chip>
                      )}
                      {item.pottyLocation === 'indoor_accident' && (
                        <Chip color="danger" variant="soft" size="sm">
                          🚨 {t.potty.accident}
                        </Chip>
                      )}

                      {/* Stool consistency */}
                      {item.stoolConsistency && (
                        <Chip color="default" variant="soft" size="sm">
                          Stool: {t.potty[item.stoolConsistency as keyof typeof t.potty] || item.stoolConsistency}
                        </Chip>
                      )}

                      {/* Food Grams */}
                      {item.quantityGrams && (
                        <Chip color="accent" variant="soft" size="sm">
                          {item.quantityGrams}{t.units.grams} ({item.quantityCups || 0.75} {t.units.cups}) - {item.foodType}
                        </Chip>
                      )}

                      {/* Duration */}
                      {item.durationMinutes && (
                        <Chip color="default" variant="soft" size="sm">
                          {item.durationMinutes} {t.units.minutes}
                        </Chip>
                      )}

                      {/* Weight */}
                      {item.weightKg && (
                        <Chip color="danger" variant="soft" size="sm">
                          {item.weightKg} {t.units.kg}
                        </Chip>
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
                        {resolveCaretakerName(item.loggedBy, caretakers)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                  {onUpdateActivity && (
                    <Button
                      onPress={() => setEditingActivity(item)}
                      aria-label="Edit activity log"
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      className="text-slate-400 hover:text-indigo-400"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}

                  <Button
                    onPress={() => {
                      const confirmMsg = 'Are you sure you want to delete this activity log?';
                      if (window.confirm(confirmMsg)) {
                        onDeleteActivity(item.id);
                      }
                    }}
                    aria-label="Delete log"
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      )}

      {editingActivity && onUpdateActivity && (
        <EditActivityModal
          activity={editingActivity}
          onSave={(updated) => {
            onUpdateActivity(updated);
            setEditingActivity(null);
          }}
          onClose={() => setEditingActivity(null)}
        />
      )}
      </Card.Content>
    </Card>
  );
};
