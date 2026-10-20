import React, { useState, useMemo, lazy, Suspense, useRef, useEffect, useCallback } from 'react';
import type { Activity, ActivityType, Caretaker, PuppyProfile } from '../types';
import { Droplet, Utensils, Trash2, Pencil, User, ChevronDown, Calendar, CheckCircle2, ChevronsUpDown, AlertTriangle, Download, FileSpreadsheet, Printer, Pill, Scale, RotateCw, X } from 'lucide-react';
import { PoopIcon } from './common/PoopIcon';
import { Button, Card } from '@heroui/react';
import { useI18n, formatCount } from '../i18n';
import { formatLocalTime, formatLogicalDate, getUserTimezone } from '../utils/date';
import { resolveCaretakerName } from '../utils/caretakers';
import { exportActivitiesToCSV, printActivitiesReport } from '../utils/export';
import { getDayFoodPill } from '../utils/dayFoodPill';
import { formatGrams, formatKg } from '../utils/weight';
import { ConfirmationModal } from './common/ConfirmationModal';

const QuickLogModal = lazy(() => import('./QuickLogModal').then((m) => ({ default: m.QuickLogModal })));

interface ActivityTimelineProps {
  activities: Activity[];
  caretakers: Caretaker[];
  activePuppy?: PuppyProfile | null;
  onDeleteActivity: (id: string) => void;
  onUpdateActivity?: (updated: Partial<Activity> & { id: string }) => Promise<boolean>;
  // Logs the server did not take: marked, with Retry and Discard instead of Edit and Delete
  unsavedIds?: ReadonlySet<string>;
  onRetry?: (unsaved: Activity) => void;
  onDiscard?: (id: string) => void;
  onLoadMore?: (targetDays?: number) => Promise<void>;
  isLoadingMore?: boolean;
  hasMoreRemote?: boolean;
  referenceTime?: Date;
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
  // 'Mardi 13 oct.': only the first letter is a capital (CSS capitalize gave 'Mardi 13 Oct.')
  const longDate = dateObj.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
  return longDate.charAt(0).toLocaleUpperCase(locale) + longDate.slice(1);
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = React.memo(({
  activities,
  caretakers,
  activePuppy,
  onDeleteActivity,
  onUpdateActivity,
  unsavedIds,
  onRetry,
  onDiscard,
  onLoadMore,
  isLoadingMore = false,
  hasMoreRemote = true,
  referenceTime,
}) => {
  const { t, lang } = useI18n();
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: string } | null>(null);
  const [daysLimit, setDaysLimit] = useState<number>(7);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const tz = getUserTimezone();

  const targetTime = referenceTime ? referenceTime.getTime() : null;
  const todayDateKey = useMemo(() => {
    const baseDate = targetTime ? new Date(targetTime) : new Date();
    return formatLogicalDate(baseDate, tz);
  }, [targetTime, tz]);

  const yesterdayDateKey = useMemo(() => {
    const baseDate = targetTime ? new Date(targetTime) : new Date();
    baseDate.setDate(baseDate.getDate() - 1);
    return formatLogicalDate(baseDate, tz);
  }, [targetTime, tz]);

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case 'pee':
        return <Droplet className="w-4 h-4 text-sky-400" />;
      case 'poop':
        return <PoopIcon className="w-4 h-4 text-amber-400" />;
      case 'food':
        return <Utensils className="w-4 h-4 text-purple-400" />;
      case 'medication':
        return <Pill className="w-4 h-4 text-teal-400" />;
      case 'weight':
        return <Scale className="w-4 h-4 text-pink-400" />;
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
    return activities
      .filter((act) => act.type === 'pee' || act.type === 'poop' || act.type === 'food' || act.type === 'medication' || act.type === 'weight')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activities]);

  // Progression steps: 7 -> 14 -> 30 -> 90 -> 180 -> All Time (Infinity)
  const nextDaysLimit = useMemo(() => {
    if (daysLimit < 14) return 14;
    if (daysLimit < 30) return 30;
    if (daysLimit < 90) return 90;
    if (daysLimit < 180) return 180;
    return Infinity;
  }, [daysLimit]);

  const cutoffDateKey = useMemo(() => {
    if (daysLimit === Infinity) return null;
    const baseDate = targetTime ? new Date(targetTime) : new Date();
    const cutoffDate = new Date(baseDate.getTime() - (daysLimit - 1) * 24 * 60 * 60 * 1000);
    return formatLogicalDate(cutoffDate, tz);
  }, [daysLimit, targetTime, tz]);

  const visibleActivities = useMemo(() => {
    if (!cutoffDateKey) return sortedCoreActivities;
    return sortedCoreActivities.filter((act) => formatLogicalDate(act.timestamp, tz) >= cutoffDateKey);
  }, [sortedCoreActivities, cutoffDateKey, tz]);

  const hasMorePriorLogs = sortedCoreActivities.length > visibleActivities.length || hasMoreRemote;

  // The export is what the feed shows (owner decision 2026-10-14): its days, and the report prints them.
  // A log the server never took is left out (app review decision 8).
  const exportableActivities = useMemo(
    () => (unsavedIds?.size ? visibleActivities.filter((activity) => !unsavedIds.has(activity.id)) : visibleActivities),
    [visibleActivities, unsavedIds]
  );

  const dailyGoalGrams = activePuppy?.dailyFoodGramGoal ?? 200; // 0: no gram goal
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

  const allDayKeys = useMemo(() => dayGroups.map((group) => group.dateKey), [dayGroups]);
  const isAllExpanded = allDayKeys.length > 0 && allDayKeys.every((key) => expandedDays.has(key));

  const handleLoadMore = useCallback(async () => {
    setDaysLimit(nextDaysLimit);
    if (onLoadMore) {
      await onLoadMore(nextDaysLimit);
    }
  }, [nextDaysLimit, onLoadMore]);

  const toggleDay = useCallback((dateKey: string) => {
    setExpandedDays((previous) => {
      const next = new Set(previous);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  }, []);

  const handleToggleExpandAll = useCallback(() => {
    if (isAllExpanded) {
      setExpandedDays(new Set());
    } else {
      setExpandedDays(new Set(allDayKeys));
    }
  }, [isAllExpanded, allDayKeys]);

  const handleExportCsv = useCallback(() => {
    setIsExportMenuOpen(false);
    if (!activePuppy) return;
    exportActivitiesToCSV(exportableActivities, activePuppy, lang as 'en' | 'fr', caretakers);
  }, [activePuppy, exportableActivities, lang, caretakers]);

  const handleExportPdf = useCallback(() => {
    setIsExportMenuOpen(false);
    if (!activePuppy) return;
    // All time: from the oldest day shown
    const period = { from: cutoffDateKey ?? dayGroups[dayGroups.length - 1]?.dateKey ?? todayDateKey, to: todayDateKey };
    printActivitiesReport(exportableActivities, activePuppy, lang as 'en' | 'fr', t, caretakers, period);
  }, [activePuppy, exportableActivities, cutoffDateKey, dayGroups, todayDateKey, lang, t, caretakers]);

  // Close Export dropdown on outside click or Escape key
  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  const hasLogsToExport = exportableActivities.length > 0 && !!activePuppy;

  return (
    <Card className="shadow-xl bg-slate-900/90 border-slate-800">
      <Card.Content className="p-3.5 sm:p-5 space-y-4">
        {/* Header & Actions */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-100 flex items-center gap-2">
              <span>{t.dashboard.activityFeed}</span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                {visibleActivities.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {daysLimit === Infinity
                ? t.dashboard.showingAllLogs.replace('{total}', String(sortedCoreActivities.length))
                : t.dashboard.showingLogs.replace('{days}', String(daysLimit)).replace('{total}', String(sortedCoreActivities.length))}
            </p>
          </div>

          {/* Action Toolbar: Export Dropdown & Expand/Collapse All */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Unified Export ▾ Dropdown */}
            {hasLogsToExport && (
              <div className="relative inline-block text-left" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((previous) => !previous)}
                  className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                  aria-expanded={isExportMenuOpen}
                  aria-label={t.dashboard.export}
                  title={t.dashboard.export}
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="hidden sm:inline">{t.dashboard.export}</span>
                  {/* Below sm the download icon alone, so the 44 px buttons leave the title its two lines */}
                  <ChevronDown className={`hidden sm:block w-3 h-3 text-slate-400 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180 text-indigo-400' : ''}`} />
                </button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-800/80 transition-colors text-slate-200 group"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mt-0.5 shrink-0 group-hover:bg-emerald-900/90 transition-colors">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                          {t.dashboard.exportCsv}
                        </div>
                        <div className="text-xs text-slate-400 leading-tight mt-0.5">
                          {t.dashboard.exportCsvDesc}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportPdf}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-slate-800/80 transition-colors text-slate-200 border-t border-slate-800/80 group"
                    >
                      <div className="p-1.5 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400 mt-0.5 shrink-0 group-hover:bg-teal-900/90 transition-colors">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-100 group-hover:text-teal-300 transition-colors">
                          {t.dashboard.exportPdf}
                        </div>
                        <div className="text-xs text-slate-400 leading-tight mt-0.5">
                          {t.dashboard.exportPdfDesc}
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Expand / Collapse All Button */}
            {dayGroups.length > 0 && (
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 px-2.5 rounded-lg text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                aria-label={isAllExpanded ? t.dashboard.collapseAll : t.dashboard.expandAll}
                title={isAllExpanded ? t.dashboard.collapseAll : t.dashboard.expandAll}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isAllExpanded ? t.dashboard.collapseAll : t.dashboard.expandAll}</span>
              </button>
            )}
          </div>
        </div>

        {/* Day-by-day Accordion List */}
        {dayGroups.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-1">
            <p className="text-sm font-semibold">{t.dashboard.noActivityLogs}</p>
            <p className="text-xs text-slate-400">{t.dashboard.tapLogEvent}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayGroups.map((group) => {
              // Open only by a tap: a log not saved never opens or closes its day, which would move the page (its Retry is in the line at the bottom)
              const isExpanded = expandedDays.has(group.dateKey);
              const unsavedCount = unsavedIds?.size ? group.activities.filter((activity) => unsavedIds.has(activity.id)).length : 0;
              const foodPill = getDayFoodPill(group, formatCount(t.dashboard.mealsCount, group.mealsCount, lang), lang);

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
                    className="w-full p-3 sm:p-4 text-left transition-colors hover:bg-slate-900/50 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Date Title & Events Badge */}
                      <div className="flex items-center gap-2 min-w-0">
                        {/* A day holding a log not saved shows it in its closed header, in the calendar's place (same size) */}
                        <div
                          className={`p-1.5 sm:p-2 rounded-xl border shrink-0 ${
                            unsavedCount > 0
                              ? 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                              : group.isToday
                              ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          {unsavedCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-100">
                            {group.dateLabel}
                          </span>
                          <span className="text-[10px] font-bold bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700/60 shrink-0">
                            {formatCount(t.dashboard.eventsCount, group.activities.length, lang)}
                          </span>
                        </div>
                      </div>

                      {/* Expand/Collapse Chevron */}
                      <div className="p-1 rounded-lg text-slate-400 hover:text-slate-200 shrink-0">
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                      </div>
                    </div>

                    {/* Nutrition & Potty Summaries (Responsive Wrap). Screen readers hear the counts as words, not bare numbers */}
                    <span className="sr-only">
                      {[
                        formatCount(t.dashboard.peesCount, group.peeCount, lang),
                        formatCount(t.dashboard.poopsCount, group.poopCount, lang),
                        group.accidentCount > 0 ? formatCount(t.dashboard.accidentsCount, group.accidentCount, lang) : '',
                        unsavedCount > 0 ? formatCount(t.dashboard.unsentLogs, unsavedCount, lang) : '',
                      ].filter(Boolean).join(', ')}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-slate-800/50">
                      {/* Food Summary Pill */}
                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                          foodPill.tone === 'goalReached'
                            ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                            : foodPill.tone === 'underGoal'
                            ? 'bg-amber-950/60 border-amber-700/50 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                        title={`${t.dashboard.foodIntake}${t.common.colon} ${foodPill.text || foodPill.mealsText}`}
                      >
                        <Utensils className="w-3.5 h-3.5 shrink-0" />
                        {foodPill.text && <span>{foodPill.text}</span>}
                        {foodPill.mealsText && (
                          <span className="text-xs opacity-80">{foodPill.mealsText}</span>
                        )}
                        {foodPill.tone === 'goalReached' && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-0.5 shrink-0" />}
                      </div>

                      {/* Potty Pills: Pee */}
                      <div
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-sky-950/60 border border-sky-800/50 text-sky-300"
                        title={formatCount(t.dashboard.peesCount, group.peeCount, lang)}
                        aria-hidden="true"
                      >
                        <Droplet className="w-3.5 h-3.5 shrink-0" />
                        <span>{group.peeCount}</span>
                      </div>

                      {/* Potty Pills: Poop */}
                      <div
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-amber-950/60 border border-amber-800/50 text-amber-300"
                        title={formatCount(t.dashboard.poopsCount, group.poopCount, lang)}
                        aria-hidden="true"
                      >
                        <PoopIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{group.poopCount}</span>
                      </div>

                      {/* Accidents Warning Chip (if any) */}
                      {group.accidentCount > 0 && (
                        <div
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold bg-red-950/80 border border-red-700 text-red-300 motion-safe:animate-pulse"
                          title={formatCount(t.dashboard.accidentsCount, group.accidentCount, lang)}
                          aria-hidden="true"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{group.accidentCount}</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Accordion Content (Detailed Event Feed) */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/80 bg-slate-950/40 p-3 sm:p-5 pt-4">
                      {group.activities.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">{t.dashboard.noLogsThisDay}</p>
                      ) : (
                        <div className="relative pl-5 sm:pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800/80">
                          {group.activities.map((item) => {
                            const color = getCaretakerColor(item.loggedBy);
                            const caretakerName = resolveCaretakerName(item.loggedBy, caretakers);
                            const isUnsaved = unsavedIds?.has(item.id);
                            // 'pipi 14:20': names this row's buttons
                            const rowName = `${String(t.potty[item.type as keyof typeof t.potty] || item.type).toLocaleLowerCase(lang)} ${formatLocalTime(new Date(item.timestamp), tz)}`;
                            // The buttons sit at the row's right from 400 px (narrower phones keep the text readable with the buttons below); a log not saved keeps Retry and Discard on their own line below sm,
                            // since they are wider and its "Not saved" mark must stay readable
                            const inline = isUnsaved
                              ? { row: 'sm:flex-row sm:items-start', actions: 'sm:self-start sm:pt-0 sm:border-t-0 sm:w-auto' }
                              : { row: 'min-[400px]:flex-row min-[400px]:items-start', actions: 'min-[400px]:self-start min-[400px]:pt-0 min-[400px]:border-t-0 min-[400px]:w-auto' };

                            return (
                              <div
                                key={item.id}
                                className={`relative group bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 sm:p-3.5 transition-all shadow-sm flex flex-col ${inline.row} justify-between gap-2.5 sm:gap-3`}
                              >
                                {/* Timeline dot, centred on the line (the list's before: element, 10 px from its left edge) */}
                                <div
                                  className="absolute -left-4 sm:-left-5 top-4 w-3.5 h-3.5 rounded-full ring-4 ring-slate-950 shrink-0"
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

                                      {isUnsaved && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-950/70 border border-amber-700/60 text-amber-300 sm:whitespace-nowrap">
                                          <AlertTriangle className="w-3 h-3 shrink-0" />
                                          <span>{t.potty.notSaved}</span>
                                        </span>
                                      )}

                                      {/* Potty location pill */}
                                      {item.pottyLocation === 'outside' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 sm:whitespace-nowrap">
                                          <span aria-hidden="true">🌳</span> {t.potty.outside}
                                        </span>
                                      )}
                                      {item.pottyLocation === 'indoor_accident' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-950/80 border border-red-700/80 text-red-300 sm:whitespace-nowrap">
                                          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                                          <span>{t.potty.accident}</span>
                                        </span>
                                      )}

                                      {/* Stool consistency */}
                                      {item.stoolConsistency && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 sm:whitespace-nowrap">
                                          {t.dashboard.stoolChip[item.stoolConsistency] || item.stoolConsistency}
                                        </span>
                                      )}

                                      {/* Food Grams */}
                                      {item.quantityGrams && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-950/60 border border-purple-800/60 text-purple-300 sm:whitespace-nowrap">
                                          {formatGrams(item.quantityGrams, lang)}
                                          {item.quantityCups ? (
                                            <span className="font-normal text-purple-400/80"> ({item.quantityCups} {t.units.cups})</span>
                                          ) : null}
                                        </span>
                                      )}

                                      {/* Weight Kg */}
                                      {item.weightKg && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-pink-950/60 border border-pink-800/60 text-pink-300 sm:whitespace-nowrap">
                                          {formatKg(item.weightKg, lang)}
                                        </span>
                                      )}

                                      {/* Medication */}
                                      {item.medicationName && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-teal-950/60 border border-teal-800/60 text-teal-300 sm:whitespace-nowrap">
                                          <span aria-hidden="true">💊</span> {item.medicationName}
                                        </span>
                                      )}
                                    </div>

                                    {item.notes && (
                                      <p className="text-xs text-slate-300 italic font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 break-words">
                                        "{item.notes}"
                                      </p>
                                    )}

                                    {/* Caretaker Name & Timestamp Line */}
                                    {/* Wraps: next to the buttons a name like "Owner Example" goes under the time rather than under the buttons */}
                                    <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 text-xs text-slate-400 pt-0.5 min-w-0">
                                      <span className="font-medium text-slate-300 shrink-0 whitespace-nowrap">{formatLocalTime(new Date(item.timestamp), tz)}</span>
                                      <span className="text-slate-600 shrink-0">&bull;</span>
                                      {/* Readable whatever the badge colour, which outlines the pill (from sm) and fills the dot. On a phone, no pill: the name gets the room */}
                                      <span
                                        className="inline-flex items-center gap-1 font-bold text-slate-200 sm:px-2 sm:py-0.5 rounded-full sm:bg-slate-950 sm:border text-xs sm:max-w-[220px] min-w-0"
                                        style={{ borderColor: color }}
                                        title={caretakerName}
                                      >
                                        <User className="hidden sm:block w-3 h-3 shrink-0" style={{ color }} />
                                        {/* A phone wraps a long name rather than cut it to 'Own…', inside a word only when one word is wider than the row */}
                                        <span className="min-w-0 break-words sm:truncate">{caretakerName}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Actions: Edit & Delete, or Retry & Discard for a log not saved */}
                                <div className={`flex items-center justify-end gap-1.5 shrink-0 self-end pt-1 border-t border-slate-800/40 w-full ${inline.actions}`}>
                                  {isUnsaved ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => onRetry?.(item)}
                                        className="px-2.5 min-h-11 inline-flex items-center gap-1.5 text-xs font-bold text-amber-200 hover:bg-slate-800 rounded-lg border border-amber-700/60 bg-slate-950 transition-colors"
                                      >
                                        <RotateCw className="w-3.5 h-3.5" />
                                        <span>{t.potty.retry}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onDiscard?.(item.id)}
                                        aria-label={t.potty.discard}
                                        className="p-1.5 sm:p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {onUpdateActivity && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingActivity(item)}
                                          aria-label={t.common.editItem.replace('{item}', rowName)}
                                          className="p-1.5 sm:p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => setConfirmDelete({ id: item.id, type: 'activity' })}
                                        aria-label={t.common.deleteItem.replace('{item}', rowName)}
                                        className="p-1.5 sm:p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
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
                  className="w-full min-h-11 text-xs font-bold text-slate-300 border-slate-800 hover:bg-slate-950"
                >
                  <ChevronDown className={`w-4 h-4 mr-1 inline ${isLoadingMore ? 'animate-spin' : ''}`} />
                  <span>
                    {isLoadingMore
                      ? t.dashboard.loadingEarlier
                      : nextDaysLimit === Infinity
                      ? t.dashboard.loadAllLogs
                      : t.dashboard.loadEarlier.replace('{days}', String(nextDaysLimit))}
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}

        {editingActivity && onUpdateActivity && (
          <Suspense fallback={null}>
            <QuickLogModal
              key={`edit-${editingActivity.id}`}
              isOpen={true}
              activityToEdit={editingActivity}
              dailyFoodGramGoal={activePuppy?.dailyFoodGramGoal}
              currentUser={editingActivity.loggedBy}
              onClose={() => setEditingActivity(null)}
              onSave={(activityData) => onUpdateActivity({ id: editingActivity.id, ...activityData })}
            />
          </Suspense>
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
});

