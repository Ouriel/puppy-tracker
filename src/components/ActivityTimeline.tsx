import React, { useState, useMemo } from 'react';
import type { Activity, ActivityType, Caretaker } from '../types';
import { Droplet, Footprints, Utensils, Trash2, Pencil, User, ChevronDown } from 'lucide-react';
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
  onLoadMore?: () => Promise<void>;
  isLoadingMore?: boolean;
  hasMoreRemote?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = React.memo(({
  activities,
  caretakers,
  onDeleteActivity,
  onUpdateActivity,
  onLoadMore,
  isLoadingMore = false,
  hasMoreRemote = true,
}) => {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<'all' | 'potty' | 'food'>('all');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [daysLimit, setDaysLimit] = useState<number>(180); // 180-day initial window

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case 'pee':
        return <Droplet className="w-4 h-4 text-sky-400" />;
      case 'poop':
        return <Footprints className="w-4 h-4 text-amber-400" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-purple-400" />;
      default:
        return <Droplet className="w-4 h-4 text-sky-400" />;
    }
  };

  const getCaretakerColor = (name: string) => {
    const resolved = resolveCaretakerName(name, caretakers);
    const caretaker = caretakers.find((item) => item.name.toLowerCase() === resolved.toLowerCase());
    return caretaker ? caretaker.color : '#6366F1';
  };

  // Filter to Pee, Poop, Food logs sorted chronologically descending
  const sortedCoreActivities = useMemo(() => {
    return activities
      .filter((act) => {
        const isCoreType = act.type === 'pee' || act.type === 'poop' || act.type === 'food';
        if (!isCoreType) return false;
        if (filter === 'potty') return act.type === 'pee' || act.type === 'poop';
        if (filter === 'food') return act.type === 'food';
        return true;
      })
      .sort((a, b) => parseIsoDate(b.timestamp).getTime() - parseIsoDate(a.timestamp).getTime());
  }, [activities, filter]);

  // Filter by time window
  const now = new Date();
  const cutoffTime = now.getTime() - daysLimit * 24 * 60 * 60 * 1000;

  const visibleActivities = useMemo(() => {
    return sortedCoreActivities.filter((act) => parseIsoDate(act.timestamp).getTime() >= cutoffTime);
  }, [sortedCoreActivities, cutoffTime]);

  const hasMorePriorLogs = sortedCoreActivities.length > visibleActivities.length || hasMoreRemote;

  const handleLoadMore = async () => {
    setDaysLimit((prev) => prev + 90);
    if (onLoadMore) {
      await onLoadMore();
    }
  };

  const formatTime = (isoString: string) => {
    return formatRelativeTime(isoString, lang as 'en' | 'fr', {
      today: t.dashboard.today,
      yesterday: t.dashboard.yesterday,
    });
  };

  return (
    <Card className="shadow-xl bg-slate-900/90 border-slate-800">
      <Card.Content className="p-5 space-y-4">
        {/* Header & Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <span>{t.dashboard.activityFeed}</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                {visibleActivities.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Showing logs from last {daysLimit} days ({sortedCoreActivities.length} total)
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.dashboard.all}
            </button>
            <button
              type="button"
              onClick={() => setFilter('potty')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'potty'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.dashboard.pottyFilter}
            </button>
            <button
              type="button"
              onClick={() => setFilter('food')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'food'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.dashboard.mealsFilter}
            </button>
          </div>
        </div>

        {/* Timeline list */}
        {visibleActivities.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-1">
            <p className="text-sm font-semibold">{t.dashboard.noActivityLogs}</p>
            <p className="text-xs text-slate-500">{t.dashboard.tapLogEvent}</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {visibleActivities.map((item) => {
              const color = getCaretakerColor(item.loggedBy);
              const caretakerName = resolveCaretakerName(item.loggedBy, caretakers);

              return (
                <div
                  key={item.id}
                  className="relative group bg-slate-950/60 hover:bg-slate-950 border border-slate-800 rounded-xl p-3.5 transition-all shadow-sm flex items-start justify-between gap-3"
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full ring-4 ring-slate-900 shrink-0"
                    style={{ backgroundColor: color }}
                  />

                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 mt-0.5 shrink-0">
                      {getIcon(item.type)}
                    </div>

                    <div className="space-y-1">
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
                            {item.quantityGrams}{t.units.grams} ({item.quantityCups || 0.75} {t.units.cups})
                          </Chip>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-slate-300 italic font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                          "{item.notes}"
                        </p>
                      )}

                      {/* Caretaker Name & Timestamp Line (Clean: just caretaker name, no "Logged by") */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                        <span className="font-medium text-slate-300">{formatTime(item.timestamp)}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800" style={{ color }}>
                          <User className="w-3 h-3" />
                          <span>{caretakerName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onUpdateActivity && (
                      <button
                        type="button"
                        onClick={() => setEditingActivity(item)}
                        aria-label="Edit activity log"
                        className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this activity log?')) {
                          onDeleteActivity(item.id);
                        }
                      }}
                      aria-label="Delete log"
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Load More Button for earlier logs */}
            {hasMorePriorLogs && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleLoadMore}
                  isDisabled={isLoadingMore}
                  className="w-full text-xs font-bold text-slate-300 border-slate-800 hover:bg-slate-950"
                >
                  <ChevronDown className={`w-4 h-4 mr-1 inline ${isLoadingMore ? 'animate-spin' : ''}`} />
                  <span>{isLoadingMore ? 'Loading Earlier Activities...' : `Load Earlier Logs (Past ${daysLimit} Days)`}</span>
                </Button>
              </div>
            )}
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
});
