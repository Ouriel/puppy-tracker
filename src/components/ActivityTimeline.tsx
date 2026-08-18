import React, { useState, useMemo } from 'react';
import type { Activity, ActivityType, Caretaker, PuppyProfile } from '../types';
import { Droplet, Utensils, Trash2, Pencil, User, ChevronDown, Calendar, CheckCircle2, ChevronsUpDown, AlertTriangle } from 'lucide-react';
import { PoopIcon } from './common/PoopIcon';
import { Button, Card } from '@heroui/react';
import { useI18n } from '../i18n';
import { formatRelativeTime, parseIsoDate, formatLogicalDate, getUserTimezone } from '../utils/date';
import { EditActivityModal } from './EditActivityModal';
import { resolveCaretakerName } from '../utils/caretakers';
import { sortByTimestampDesc } from '../utils/activities';
import { ConfirmationModal } from './common/ConfirmationModal';

interface ActivityTimelineProps {
  activities: Activity[];
  caretakers: Caretaker[];
  activePuppy?: PuppyProfile | null;
  onDeleteActivity: (id: string) => void;
  onUpdateActivity?: (updated: Partial<Activity> & { id: string }) => void;
  onLoadMore?: () => Promise<void>;
  isLoadingMore?: boolean;
  hasMoreRemote?: boolean;
}

interface DayGroup {
  dateKey: string;
  isToday: boolean;
  isYesterday: boolean;
  dateLabel: string;
  totalFoodGrams: number;
  mealsCount: number;
  dailyGoalGrams: number;
  targetMealsCount: number;
  peeCount: number;
  poopCount: number;
  accidentCount: number;
  activities: Activity[];
}

function formatDayHeading(
  dateKey: string,
  isToday: boolean,
  isYesterday: boolean,
  lang: 'en' | 'fr',
  labels: { today: string; yesterday: string }
): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const dateObj = new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const shortDate = dateObj.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });

  if (isToday) {
    return `${labels.today} • ${shortDate}`;
  }
  if (isYesterday) {
    return `${labels.yesterday} • ${shortDate}`;
  }
  return dateObj.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  caretakers,
  activePuppy,
  onDeleteActivity,
  onUpdateActivity,
  onLoadMore,
  isLoadingMore = false,
  hasMoreRemote = true,
}) => {
  const { t, lang } = useI18n();
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: string } | null>(null);
  const [daysLimit, setDaysLimit] = useState<number>(180);
  const tz = getUserTimezone();

  const todayDateKey = useMemo(() => formatLogicalDate(new Date(), tz), [tz]);
  const yesterdayDateKey = useMemo(() => formatLogicalDate(new Date(Date.now() - 24 * 3600 * 1000), tz), [tz]);

  // Track expanded days in accordion (All days collapsed by default)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case 'pee':
        return <Droplet className="w-4 h-4 text-sky-400" />;
      case 'poop':
        return <PoopIcon className="w-4 h-4 text-amber-400" />;
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

  // Filter to core activities sorted chronologically descending
  const sortedCoreActivities = useMemo(() => {
    const filtered = activities.filter((act) => act.type === 'pee' || act.type === 'poop' || act.type === 'food');
    return sortByTimestampDesc(filtered);
  }, [activities]);

  // Filter by time window
  const now = new Date();
  const cutoffTime = now.getTime() - daysLimit * 24 * 60 * 60 * 1000;

  const visibleActivities = useMemo(() => {
    return sortedCoreActivities.filter((act) => parseIsoDate(act.timestamp).getTime() >= cutoffTime);
  }, [sortedCoreActivities, cutoffTime]);

  const hasMorePriorLogs = sortedCoreActivities.length > visibleActivities.length || hasMoreRemote;

  const handleLoadMore = async () => {
    setDaysLimit((previous) => previous + 90);
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

  const dailyGoalGrams = activePuppy?.dailyFoodGramGoal || 200;
  const targetMealsCount = activePuppy?.targetMealsPerDay || 3;

  // Group visible activities by logical day
  const dayGroups = useMemo<DayGroup[]>(() => {
    const groupsMap = new Map<string, Activity[]>();

    visibleActivities.forEach((activity) => {
      const dateKey = formatLogicalDate(activity.timestamp, tz);
      const existing = groupsMap.get(dateKey) || [];
      existing.push(activity);
      groupsMap.set(dateKey, existing);
    });

    const groups: DayGroup[] = [];

    groupsMap.forEach((dayActs, dateKey) => {
      const isToday = dateKey === todayDateKey;
      const isYesterday = dateKey === yesterdayDateKey;
      const totalFoodGrams = dayActs
        .filter((activity) => activity.type === 'food')
        .reduce((sum, activity) => sum + (activity.quantityGrams || 0), 0);
      const mealsCount = dayActs.filter((activity) => activity.type === 'food').length;
      const peeCount = dayActs.filter((activity) => activity.type === 'pee').length;
      const poopCount = dayActs.filter((activity) => activity.type === 'poop').length;
      const accidentCount = dayActs.filter(
        (activity) => (activity.type === 'pee' || activity.type === 'poop') && activity.pottyLocation === 'indoor_accident'
      ).length;

      groups.push({
        dateKey,
        isToday,
        isYesterday,
        dateLabel: formatDayHeading(dateKey, isToday, isYesterday, lang as 'en' | 'fr', {
          today: t.dashboard.today,
          yesterday: t.dashboard.yesterday,
        }),
        totalFoodGrams,
        mealsCount,
        dailyGoalGrams,
        targetMealsCount,
        peeCount,
        poopCount,
        accidentCount,
        activities: dayActs,
      });
    });

    // Ensure groups are sorted by dateKey descending
    return groups.sort((groupA, groupB) => groupB.dateKey.localeCompare(groupA.dateKey));
  }, [visibleActivities, tz, todayDateKey, yesterdayDateKey, lang, t.dashboard.today, t.dashboard.yesterday, dailyGoalGrams, targetMealsCount]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays((previous) => {
      const next = new Set(previous);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const allDayKeys = useMemo(() => dayGroups.map((group) => group.dateKey), [dayGroups]);
  const isAllExpanded = allDayKeys.length > 0 && allDayKeys.every((key) => expandedDays.has(key));

  const handleToggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedDays(new Set());
    } else {
      setExpandedDays(new Set(allDayKeys));
    }
  };

  return (
    <Card className="shadow-xl bg-slate-900/90 border-slate-800">
      <Card.Content className="p-3.5 sm:p-5 space-y-4">
        {/* Header & Expand/Collapse All Action */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <span>{t.dashboard.activityFeed}</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                {visibleActivities.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {t.dashboard.showingLogs.replace('{days}', String(daysLimit)).replace('{total}', String(sortedCoreActivities.length))}
            </p>
          </div>

          {/* Expand / Collapse All Button */}
          {dayGroups.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              title={isAllExpanded ? t.dashboard.collapseAll : t.dashboard.expandAll}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              <span>{isAllExpanded ? t.dashboard.collapseAll : t.dashboard.expandAll}</span>
            </button>
          )}
        </div>

        {/* Day-by-day Accordion List */}
        {dayGroups.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-1">
            <p className="text-sm font-semibold">{t.dashboard.noActivityLogs}</p>
            <p className="text-xs text-slate-500">{t.dashboard.tapLogEvent}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayGroups.map((group) => {
              const isExpanded = expandedDays.has(group.dateKey);
              const foodGoalReached = group.totalFoodGrams >= group.dailyGoalGrams && group.dailyGoalGrams > 0;
              const hasFoodLogs = group.totalFoodGrams > 0;

              return (
                <div
                  key={group.dateKey}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    group.isToday
                      ? 'bg-slate-950/70 border-indigo-500/40 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Accordion Header (Clickable Summary Bar) */}
                  <button
                    type="button"
                    onClick={() => toggleDay(group.dateKey)}
                    className="w-full p-3 sm:p-4 text-left transition-colors hover:bg-slate-900/50 focus:outline-none"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Date Title & Events Badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`p-1.5 sm:p-2 rounded-xl border shrink-0 ${
                            group.isToday
                              ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-100 capitalize">
                            {group.dateLabel}
                          </span>
                          <span className="text-[10px] font-bold bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700/60 shrink-0">
                            {t.dashboard.eventsCount.replace('{count}', String(group.activities.length))}
                          </span>
                        </div>
                      </div>

                      {/* Expand/Collapse Chevron */}
                      <div className="p-1 rounded-lg text-slate-400 hover:text-slate-200 shrink-0">
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                      </div>
                    </div>

                    {/* Nutrition & Potty Summaries (Responsive Wrap) */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-slate-800/50">
                      {/* Food Summary Pill */}
                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                          foodGoalReached
                            ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                            : hasFoodLogs
                            ? 'bg-amber-950/60 border-amber-700/50 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                        title={`${t.dashboard.foodIntake}: ${group.totalFoodGrams}g / ${group.dailyGoalGrams}g`}
                      >
                        <Utensils className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {group.totalFoodGrams}g / {group.dailyGoalGrams}g
                        </span>
                        <span className="text-[10px] opacity-80">
                          ({group.mealsCount}/{group.targetMealsCount})
                        </span>
                        {foodGoalReached && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-0.5 shrink-0" />}
                      </div>

                      {/* Potty Pills: Pee */}
                      <div
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-sky-950/60 border border-sky-800/50 text-sky-300"
                        title={t.dashboard.peesCount.replace('{count}', String(group.peeCount))}
                      >
                        <Droplet className="w-3.5 h-3.5 shrink-0" />
                        <span>{group.peeCount}</span>
                      </div>

                      {/* Potty Pills: Poop */}
                      <div
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-amber-950/60 border border-amber-800/50 text-amber-300"
                        title={t.dashboard.poopsCount.replace('{count}', String(group.poopCount))}
                      >
                        <PoopIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{group.poopCount}</span>
                      </div>

                      {/* Accidents Warning Chip (if any) */}
                      {group.accidentCount > 0 && (
                        <div
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-rose-950/80 border border-rose-700 text-rose-300 animate-pulse"
                          title={t.dashboard.accidentsCount.replace('{count}', String(group.accidentCount))}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{group.accidentCount}</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Accordion Content (Detailed Event Feed) */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/80 bg-slate-950/40 p-3 sm:p-5 pt-4">
                      {group.activities.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">{t.dashboard.noLogsThisDay}</p>
                      ) : (
                        <div className="relative pl-5 sm:pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800/80">
                          {group.activities.map((item) => {
                            const color = getCaretakerColor(item.loggedBy);
                            const caretakerName = resolveCaretakerName(item.loggedBy, caretakers);

                            return (
                              <div
                                key={item.id}
                                className="relative group bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 sm:p-3.5 transition-all shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-3"
                              >
                                {/* Timeline dot */}
                                <div
                                  className="absolute -left-[22px] sm:-left-[23px] top-4 w-3.5 h-3.5 rounded-full ring-4 ring-slate-950 shrink-0"
                                  style={{ backgroundColor: color }}
                                />

                                <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                                  <div className="p-2 sm:p-2.5 bg-slate-950 rounded-xl border border-slate-800 mt-0.5 shrink-0">
                                    {getIcon(item.type)}
                                  </div>

                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-slate-100 capitalize">
                                        {t.potty[item.type as keyof typeof t.potty] || item.type}
                                      </span>

                                      {/* Potty location pill */}
                                      {item.pottyLocation === 'outside' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 whitespace-nowrap">
                                          🌳 {t.potty.outside}
                                        </span>
                                      )}
                                      {item.pottyLocation === 'indoor_accident' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-950/80 border border-rose-700/80 text-rose-300 whitespace-nowrap">
                                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                          <span>{t.potty.accident}</span>
                                        </span>
                                      )}

                                      {/* Stool consistency */}
                                      {item.stoolConsistency && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-950 border border-slate-800 text-slate-300 whitespace-nowrap">
                                          {t.potty[item.stoolConsistency as keyof typeof t.potty] || item.stoolConsistency}
                                        </span>
                                      )}

                                      {/* Food Grams */}
                                      {item.quantityGrams && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-950/60 border border-purple-800/60 text-purple-300 whitespace-nowrap">
                                          {item.quantityGrams}{t.units.grams}
                                          {item.quantityCups ? (
                                            <span className="font-normal text-purple-400/80"> ({item.quantityCups} {t.units.cups})</span>
                                          ) : null}
                                        </span>
                                      )}

                                      {/* Weight Kg */}
                                      {item.weightKg && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-pink-950/60 border border-pink-800/60 text-pink-300 whitespace-nowrap">
                                          {item.weightKg} {t.units.kg}
                                        </span>
                                      )}

                                      {/* Medication */}
                                      {item.medicationName && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-950/60 border border-teal-800/60 text-teal-300 whitespace-nowrap">
                                          💊 {item.medicationName}
                                        </span>
                                      )}
                                    </div>

                                    {item.notes && (
                                      <p className="text-xs text-slate-300 italic font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 break-words">
                                        "{item.notes}"
                                      </p>
                                    )}

                                    {/* Caretaker Name & Timestamp Line */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-400 pt-0.5 min-w-0">
                                      <span className="font-medium text-slate-300 shrink-0 whitespace-nowrap">{formatTime(item.timestamp)}</span>
                                      <span className="text-slate-600 shrink-0">&bull;</span>
                                      <span
                                        className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[11px] max-w-[130px] sm:max-w-[220px] min-w-0"
                                        style={{ color }}
                                        title={caretakerName}
                                      >
                                        <User className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{caretakerName}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions: Edit & Delete */}
                                <div className="flex items-center justify-end gap-1.5 shrink-0 self-end sm:self-start pt-1 sm:pt-0 border-t border-slate-800/40 sm:border-t-0 w-full sm:w-auto">
                                  {onUpdateActivity && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingActivity(item)}
                                      aria-label="Edit activity log"
                                      className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setConfirmDelete({ id: item.id, type: 'activity' })}
                                    aria-label="Delete log"
                                    className="p-1.5 sm:p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
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
                  <span>{isLoadingMore ? t.dashboard.loadingEarlier : t.dashboard.loadEarlier.replace('{days}', String(daysLimit))}</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {editingActivity && onUpdateActivity && (
          <EditActivityModal
            key={`edit-${editingActivity.id}`}
            activity={editingActivity}
            onSave={(updated) => {
              onUpdateActivity(updated);
              setEditingActivity(null);
            }}
            onClose={() => setEditingActivity(null)}
          />
        )}

        <ConfirmationModal
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete) onDeleteActivity(confirmDelete.id);
          }}
          title={t.potty.deleteActivityTitle}
          message={t.potty.deleteActivityMessage}
        />
      </Card.Content>
    </Card>
  );
};

