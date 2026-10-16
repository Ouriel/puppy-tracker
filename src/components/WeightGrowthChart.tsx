import React, { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Card, Button } from '@heroui/react';
import type { Activity, PuppyProfile } from '../types';
import { Scale, Plus, Trash2, Pencil } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatShortDate, getCalendarDaysAgo } from '../utils/date';
import { ConfirmationModal } from './common/ConfirmationModal';
import { formatChange, formatKg, formatKgRange, getAgeInWeeks, type UnifiedWeightEntry } from '../utils/weight';
import { buildDogWeightChart, findNearestPoint, getFullViewEndWeeks, getWeightChartModel } from '../utils/weightChartGeometry';

const QuickLogModal = lazy(() => import('./QuickLogModal').then((module) => ({ default: module.QuickLogModal })));

interface WeightGrowthChartProps {
  activities: Activity[];
  profile: PuppyProfile;
  onOpenQuickLogModal: (type: 'weight') => void;
  onDeleteActivity?: (id: string) => void;
  onUpdateActivity?: (updated: Partial<Activity> & { id: string }) => Promise<boolean>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Before the card is measured (and where nothing measures it, as in tests): a phone's width. */
const FALLBACK_WIDTH = 320;
const FOLDED_ROWS = 3;
const iconButtonClass = 'min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 transition-colors hover:bg-slate-800';

/**
 * The passport's weight card: three tiles, a growth chart drawn at the card's width (tap, drag or arrow keys pick a
 * weigh-in, shown in the readout under it), and the weigh-in list folded open inline under the chart.
 */
export const WeightGrowthChart: React.FC<WeightGrowthChartProps> = ({
  activities,
  profile,
  onOpenQuickLogModal,
  onDeleteActivity,
  onUpdateActivity,
}) => {
  const [editingWeight, setEditingWeight] = useState<UnifiedWeightEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // null: the latest weigh-in
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const { t, lang } = useI18n();
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const idPrefix = useId();

  const width = measuredWidth || FALLBACK_WIDTH;
  const readoutId = `${idPrefix}-readout`;
  const listId = `${idPrefix}-list`;

  const model = useMemo(() => getWeightChartModel(activities, profile), [activities, profile]);
  const geometry = useMemo(() => buildDogWeightChart(model, profile.birthDate, width, isZoomed), [model, width, isZoomed, profile.birthDate]);

  const { entries, unlikelyIds, trusted, projection, pace } = model;
  const foundIndex = entries.findIndex((entry) => entry.id === selectedId);
  const selectedIndex = foundIndex === -1 ? entries.length - 1 : foundIndex;
  const selected = entries[selectedIndex];
  const lastTrusted = trusted[trusted.length - 1];
  const entryToDelete = entries.find((entry) => entry.id === confirmDeleteId);
  const relativeDays = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });

  const ageLabel = (timestamp: string) => {
    const weeks = getAgeInWeeks(profile.birthDate, timestamp);
    return weeks < 16
      ? t.weightChart.weeksOld.replace('{weeks}', String(Math.floor(weeks)))
      : t.weightChart.monthsOld.replace('{months}', String(Math.floor((weeks * 7) / 30.4375)));
  };

  /** The change since the previous weigh-in that is not a typo; none for the first one or a typo. */
  const changeAt = (index: number) => {
    const entry = entries[index];
    if (unlikelyIds.has(entry.id)) return null;
    const previous = entries.slice(0, index).filter((other) => !unlikelyIds.has(other.id)).at(-1);
    if (!previous) return null;
    return { kg: entry.weightKg - previous.weightKg, days: (Date.parse(entry.timestamp) - Date.parse(previous.timestamp)) / DAY_MS };
  };

  const changeText = (index: number) => {
    if (unlikelyIds.has(entries[index].id)) return t.weightChart.checkReason;
    const change = changeAt(index);
    if (!change) return t.weightChart.firstWeighIn;
    const kgText = `${formatChange(change.kg, lang, 1)} kg`;
    return change.days < 1
      ? t.weightChart.changeSameDay.replace('{change}', kgText)
      : t.weightChart.changeOver
        .replace('{change}', kgText)
        .replace('{days}', String(Math.round(change.days)))
        .replace('{grams}', String(Math.round((change.kg * 1000) / change.days)));
  };

  const chartDescription = lastTrusted
    ? t.weightChart.chartDescription
      .replace('{count}', String(entries.length))
      .replace('{from}', formatShortDate(entries[0].timestamp, lang))
      .replace('{to}', formatShortDate(entries[entries.length - 1].timestamp, lang))
      .replace('{first}', formatKg(trusted[0].weightKg, lang))
      .replace('{last}', formatKg(lastTrusted.weightKg, lang))
      .replace('{adult}', formatKgRange(projection.minAdultKg, projection.maxAdultKg, lang))
    : t.weightChart.empty.replace('{button}', t.weightChart.logWeight).replace('{name}', profile.name);

  const pickNearest = (event: React.PointerEvent<SVGRectElement>) => {
    // A tap, a click or a drag; never a mouse just passing over (on its way to the readout's buttons, it picked another weigh-in)
    if (event.type === 'pointermove' && !event.buttons) return;
    const box = svgRef.current!.getBoundingClientRect();
    const index = findNearestPoint(geometry.points, event.clientX - box.left, event.clientY - box.top);
    if (index !== -1) setSelectedId(geometry.points[index].id);
  };

  const handleChartKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: selectedIndex - 1, ArrowRight: selectedIndex + 1, Home: 0, End: entries.length - 1 };
    const next = moves[event.key];
    if (next === undefined || entries.length === 0) return;
    event.preventDefault();
    setSelectedId(entries[Math.max(0, Math.min(entries.length - 1, next))].id);
  };

  const neighboursOf = (entry: UnifiedWeightEntry) => {
    const index = entries.findIndex((other) => other.id === entry.id);
    return [entries[index - 1], entries[index + 1]].filter((neighbour) => neighbour !== undefined);
  };

  const checkBadge = (
    <span className="inline-flex items-center rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">
      {t.weightChart.checkBadge}
    </span>
  );

  // 'la pesée du 3 sept.': names this weigh-in's buttons
  const weighInName = (entry: UnifiedWeightEntry) => t.weightChart.weighInOn.replace('{date}', formatShortDate(entry.timestamp, lang));

  const actionButtons = (entry: UnifiedWeightEntry) => (
    <>
      {onUpdateActivity && (
        <button type="button" onClick={() => setEditingWeight(entry)} aria-label={t.common.editItem.replace('{item}', weighInName(entry))} className={`${iconButtonClass} hover:text-indigo-300`}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {onDeleteActivity && (
        <button type="button" onClick={() => setConfirmDeleteId(entry.id)} aria-label={t.common.deleteItem.replace('{item}', weighInName(entry))} className={`${iconButtonClass} hover:text-red-400`}>
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </>
  );

  const tiles = [
    {
      id: 'weight',
      label: t.weightChart.title,
      value: lastTrusted ? formatKg(lastTrusted.weightKg, lang) : '—',
      sub: lastTrusted ? relativeDays.format(-getCalendarDaysAgo(lastTrusted.timestamp), 'day') : t.weightChart.noWeighInYet,
    },
    {
      id: 'pace',
      label: t.weightChart.pace,
      value: pace ? t.health.dailyGain.replace('{grams}', formatChange(pace.gramsPerDay, lang)) : '—',
      sub: pace ? t.weightChart.paceOver.replace('{days}', String(pace.days)) : trusted.length < 2 ? t.weightChart.paceNeedsTwo : t.weightChart.paceNeedsWeek,
    },
    // An unknown breed and no adult weight typed: the breed figure is a made-up 13 kg, so none before a weigh-in
    model.bandAdultKg === null && !lastTrusted
      ? { id: 'adult', label: t.weightChart.adult, value: '—', sub: t.weightChart.adultNeedsWeighIn }
      : {
        id: 'adult',
        label: t.weightChart.adult,
        value: formatKgRange(projection.minAdultKg, projection.maxAdultKg, lang),
        sub: projection.isTrajectoryBased ? t.weightChart.adultEstimated : t.weightChart.adultFromBreed,
      },
  ];

  const rows = [...entries.keys()].reverse();
  const shownRows = isListExpanded ? rows : rows.slice(0, FOLDED_ROWS);
  const { plot } = geometry;

  // The card's width, for real-pixel drawing (never a viewBox: it shrank the labels to 3–5 px on a phone)
  useEffect(() => {
    const chartBox = chartBoxRef.current;
    if (!chartBox) return;
    const observer = new ResizeObserver(([entry]) => setMeasuredWidth(Math.round(entry.contentRect.width)));
    observer.observe(chartBox);
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="bg-slate-900 border border-slate-800 text-slate-100 shadow-xl">
      <Card.Content className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-100 flex items-center gap-2">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            <span>{t.weightChart.title}</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">{entries.length}</span>
          </h3>
          <Button
            variant="primary"
            size="sm"
            onPress={() => onOpenQuickLogModal('weight')}
            className="min-h-11 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1 inline" />
            {t.weightChart.logWeight}
          </Button>
        </div>

        {/* Three tiles in one row, never stacked */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {tiles.map((tile) => (
            <div key={tile.id} data-tile={tile.id} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/60 px-1.5 py-2 min-[375px]:px-2 sm:px-3">
              <div className="truncate text-[11px] font-semibold text-slate-400">{tile.label}</div>
              {/* A small dog's range ('2,2–2,9 kg') may wrap on a narrow phone, never overflow */}
              <div className="text-sm min-[375px]:text-base sm:text-lg leading-tight tracking-tight font-extrabold tabular-nums text-slate-100">{tile.value}</div>
              {/* Wraps on a narrow phone rather than being cut */}
              <div className="text-[11px] leading-tight text-slate-400">{tile.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400" aria-hidden="true">
            {entries.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-0.5 w-3.5 bg-pink-500" />
                <i className="inline-block h-2 w-2 rounded-full bg-pink-500" />
                {t.weightChart.legendWeighIns}
              </span>
            )}
            {geometry.bandPath && (
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block h-2 w-3.5 border-t border-slate-600 bg-slate-400/25" />
                {t.weightChart.legendZone}
              </span>
            )}
            {geometry.projectionPath && (
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block w-3.5 border-t-2 border-dashed border-pink-500/70" />
                {t.weightChart.legendProjection}
              </span>
            )}
          </div>
          <div role="group" aria-label={t.weightChart.periodLabel} className="inline-flex rounded-lg border border-slate-800 bg-slate-950/60 p-0.5">
            {[false, true].map((zoomed) => (
              <button
                key={String(zoomed)}
                type="button"
                aria-pressed={isZoomed === zoomed}
                onClick={() => setIsZoomed(zoomed)}
                className={`min-h-11 min-w-11 rounded-md px-3 text-xs font-bold whitespace-nowrap ${isZoomed === zoomed ? 'bg-slate-800 text-slate-100' : 'text-slate-400'}`}
              >
                {zoomed ? t.weightChart.periodQuarter : getFullViewEndWeeks(model.todayWeeks, model.category) > 56 ? t.weightChart.periodAll : t.weightChart.periodYear}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={chartBoxRef}
          role="group"
          tabIndex={0}
          aria-label={t.weightChart.chartLabel}
          aria-describedby={readoutId}
          onKeyDown={handleChartKeyDown}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg
            ref={svgRef}
            width={width}
            height={geometry.height}
            role="img"
            aria-labelledby={`${idPrefix}-title ${idPrefix}-description`}
            className="block max-w-full select-none touch-pan-y"
          >
            <title id={`${idPrefix}-title`}>{t.weightChart.chartTitle.replace('{name}', profile.name)}</title>
            <desc id={`${idPrefix}-description`}>{chartDescription}</desc>
            <defs>
              <clipPath id={`${idPrefix}-plot`}>
                <rect x={plot.left} y={0} width={plot.right - plot.left} height={plot.bottom + 2} />
              </clipPath>
            </defs>

            {geometry.yTicks.map((tick, index) => (
              <g key={tick.kg}>
                <line x1={plot.left} x2={plot.right} y1={tick.y} y2={tick.y} className="stroke-slate-800" strokeWidth={1} />
                <text x={plot.left - 6} y={tick.y + 4} textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                  {index === geometry.yTicks.length - 1 ? `${tick.kg} kg` : tick.kg}
                </text>
              </g>
            ))}
            {geometry.xTicks.map((tick, index) => (
              <text key={tick.months} x={tick.x} y={geometry.height - 8} textAnchor={tick.anchor} className="fill-slate-400 text-[11px] tabular-nums">
                {index === geometry.xTicks.length - 1 ? t.weightChart.monthsOld.replace('{months}', String(tick.months)) : tick.months}
              </text>
            ))}

            <g clipPath={`url(#${idPrefix}-plot)`}>
              {geometry.bandPath && <path data-band d={geometry.bandPath} className="fill-slate-400/15" />}
              {geometry.bandMidPath && <path d={geometry.bandMidPath} fill="none" className="stroke-slate-600" strokeWidth={1} />}
              {geometry.projectionPath && (
                <path d={geometry.projectionPath} fill="none" className="stroke-pink-500" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
              )}
              {geometry.linePath && (
                <path data-line d={geometry.linePath} fill="none" className="stroke-pink-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              )}
            </g>

            <line x1={geometry.today.x} x2={geometry.today.x} y1={plot.top} y2={plot.bottom} className="stroke-slate-700" strokeWidth={1} />
            <text x={geometry.today.x} y={plot.top - 3} textAnchor="middle" className="fill-slate-400 text-[11px]">{t.weightChart.todayShort}</text>
            {geometry.projectionEnd && (
              <text x={plot.right} y={geometry.projectionEnd.labelY} textAnchor="end" className="fill-slate-300 text-[11px]">
                {t.weightChart.adultEnd.replace('{weight}', formatKg(projection.projectedAdultKg, lang))}
              </text>
            )}
            {geometry.today.estimateY !== null && (
              <circle cx={geometry.today.x} cy={geometry.today.estimateY} r={4} className="fill-slate-900 stroke-pink-500" strokeWidth={2} />
            )}

            {geometry.points.map((point) => {
              const radius = point.id === selected?.id ? 6 : 4;
              return point.isUnlikely ? (
                <g key={point.id}>
                  <circle data-weigh-in={point.id} cx={point.x} cy={point.y} r={radius + 1} className="fill-slate-900 stroke-amber-400" strokeWidth={2} />
                  <text x={point.x} y={point.y + 4} textAnchor="middle" className="fill-amber-400 text-[10px] font-extrabold">!</text>
                </g>
              ) : (
                <circle key={point.id} data-weigh-in={point.id} cx={point.x} cy={point.y} r={radius} className="fill-pink-500 stroke-slate-900" strokeWidth={2} />
              );
            })}

            {/* Tap or drag: the nearest weigh-in in 2D; pan-y keeps the page scrolling */}
            <rect
              data-hit-area
              x={plot.left}
              y={0}
              width={plot.right - plot.left}
              height={geometry.height}
              fill="transparent"
              onPointerDown={pickNearest}
              onPointerMove={pickNearest}
            />
          </svg>
        </div>

        <div id={readoutId} aria-live="polite" className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
          {selected ? (
            <>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold tabular-nums text-slate-100">{formatKg(selected.weightKg, lang)}</span>
                  {unlikelyIds.has(selected.id) && checkBadge}
                </div>
                <div className="text-xs text-slate-400">{`${formatShortDate(selected.timestamp, lang)} · ${ageLabel(selected.timestamp)}`}</div>
                <div className="text-xs text-slate-300">{changeText(selectedIndex)}</div>
              </div>
              <div className="flex shrink-0 gap-1.5">{actionButtons(selected)}</div>
            </>
          ) : (
            <p className="text-sm text-slate-300">{t.weightChart.empty.replace('{button}', t.weightChart.logWeight).replace('{name}', profile.name)}</p>
          )}
        </div>

        {entries.length > 0 && (
          <div className="space-y-2">
            <h4 id={`${listId}-title`} className="text-xs font-bold text-slate-400">{t.weightChart.recentHistory}</h4>
            <table id={listId} aria-labelledby={`${listId}-title`} className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="text-left text-[11px] text-slate-400">
                  <th className="px-0.5 sm:px-1.5 py-1 font-semibold">{t.weightChart.columnDate}</th>
                  <th className="px-0.5 sm:px-1.5 py-1 text-right font-semibold">{t.weightChart.columnWeight}</th>
                  <th className="px-0.5 sm:px-1.5 py-1 text-right font-semibold">{t.weightChart.columnChange}</th>
                  <th className="px-0.5 sm:px-1.5 py-1"><span className="sr-only">{t.weightChart.editWeightEntry}</span></th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((index) => {
                  const entry = entries[index];
                  const change = changeAt(index);
                  return (
                    <tr key={entry.id} className={`border-t border-slate-800 ${entry.id === selected?.id ? 'bg-pink-500/10' : ''}`}>
                      <td className="px-0.5 sm:px-1.5 py-1.5">
                        {/* A date from another year wraps under the day ('2 nov.' / '2025') rather than widening the row */}
                        <span className="block text-slate-200">{formatShortDate(entry.timestamp, lang)}</span>
                        <span className="block text-[11px] text-slate-400">{ageLabel(entry.timestamp)}</span>
                      </td>
                      <td className="px-0.5 sm:px-1.5 py-1.5 text-right">
                        <span className="block font-bold text-slate-100 whitespace-nowrap">{formatKg(entry.weightKg, lang)}</span>
                        {/* Plain text, no pill: it wraps in the column's width on a 320 px phone */}
                        {unlikelyIds.has(entry.id) && <span className="block text-[11px] font-bold text-amber-300">{t.weightChart.checkBadge}</span>}
                      </td>
                      <td className="px-0.5 sm:px-1.5 py-1.5 text-right">
                        <span className="block text-slate-300">{change ? formatChange(change.kg, lang, 1) : '—'}</span>
                        {change && (
                          <span className="block text-[11px] text-slate-400">
                            {change.days < 1 ? t.weightChart.sameDayShort : t.weightChart.daysShort.replace('{days}', String(Math.round(change.days)))}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pl-0.5 sm:pl-1.5">
                        <div className="flex justify-end gap-1">{actionButtons(entry)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {entries.length > FOLDED_ROWS && (
              <button
                type="button"
                aria-expanded={isListExpanded}
                aria-controls={listId}
                onClick={() => setIsListExpanded((previous) => !previous)}
                className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950/60 text-xs font-bold text-slate-300 hover:bg-slate-800"
              >
                {isListExpanded ? t.weightChart.showLess : t.weightChart.showAll.replace('{count}', String(entries.length))}
              </button>
            )}
          </div>
        )}

        {editingWeight && onUpdateActivity && (
          <Suspense fallback={null}>
            <QuickLogModal
              key={`edit-${editingWeight.id}`}
              isOpen={true}
              activityToEdit={editingWeight}
              weighInNeighbours={neighboursOf(editingWeight)}
              profile={profile}
              dailyFoodGramGoal={profile.dailyFoodGramGoal}
              currentUser={editingWeight.loggedBy}
              onClose={() => setEditingWeight(null)}
              onSave={(activityData) => onUpdateActivity({ id: editingWeight.id, ...activityData })}
            />
          </Suspense>
        )}

        <ConfirmationModal
          isOpen={!!confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
          onConfirm={() => {
            if (confirmDeleteId) onDeleteActivity?.(confirmDeleteId);
          }}
          title={t.weightChart.deleteWeightEntry}
          message={entryToDelete
            ? t.weightChart.deleteMessage.replace('{date}', formatShortDate(entryToDelete.timestamp, lang)).replace('{weight}', formatKg(entryToDelete.weightKg, lang))
            : ''}
        />
      </Card.Content>
    </Card>
  );
};
