import { getWalthamAdultWeeks, getWalthamGrowthFraction, type WalthamCategory } from './weight';

export interface ChartWeighIn {
  id: string;
  ageWeeks: number;
  weightKg: number;
  /** Looks like a typo: out of the line and the scale, still drawn. */
  isUnlikely: boolean;
}

export interface WeightChartInput {
  /** The card's measured width, in CSS pixels. */
  width: number;
  /** Oldest first. */
  weighIns: ChartWeighIn[];
  todayWeeks: number;
  category: WalthamCategory;
  /** The expected zone's adult weight; null: no zone. */
  bandAdultKg: number | null;
  /** The projected adult weight and today's estimate; null: no estimate dot, no dashed line. */
  projection: { adultKg: number; todayKg: number } | null;
  /** The 3-month view. */
  isZoomed: boolean;
}

export interface ChartPoint {
  id: string;
  x: number;
  y: number;
  isUnlikely: boolean;
}

const HEIGHT = 200;
const PADDING = { left: 34, right: 10, top: 14, bottom: 26 };
const WEEKS_PER_MONTH = 4.345;
const BAND_LOW = 0.88;
const BAND_HIGH = 1.15;
/** 11 px labels, measured in system-ui (a digit 7 px, " kg" 16 px, " mois" 28 px, "≈ 12,2 kg adulte" 80 px), plus a margin. */
const DIGIT_PX = 7;
const KG_UNIT_PX = 18;
const MONTHS_UNIT_PX = 30;
const ADULT_LABEL_PX = 90;
/** A typo off the scale is drawn this far inside its edge: its ring clears the "auj." label above the plot. */
const OFF_SCALE_INSET = 10;

/** The full view's last week: a year, or the dog's adult age when later (60 or 68 weeks for a large breed), or just past today. */
export function getFullViewEndWeeks(todayWeeks: number, category: WalthamCategory): number {
  return Math.max(getWalthamAdultWeeks(category) + 0.2, Math.ceil(todayWeeks) + 4);
}

/** Fractional coordinates are fine in SVG; 2 decimals keep the path strings short. */
const round = (value: number) => Math.round(value * 100) / 100;
const toPath = (points: Array<[number, number]>) => `M${points.map(([x, y]) => `${round(x)},${round(y)}`).join('L')}`;

/**
 * The weight chart in real pixels, drawn at the card's width (never scaled through a viewBox, so 11 px labels stay
 * 11 px on a phone): age in weeks on x, kilos on y. A port of the reviewed prototype.
 */
export function buildWeightChartGeometry(input: WeightChartInput) {
  const { width, weighIns, todayWeeks, category, bandAdultKg, projection, isZoomed } = input;
  const trusted = weighIns.filter((weighIn) => !weighIn.isUnlikely);
  const firstWeeks = weighIns[0]?.ageWeeks;
  const bandAt = (weeks: number, factor: number) => (bandAdultKg ?? 0) * getWalthamGrowthFraction(category, weeks) * factor;

  // Default: 8 weeks (or just before the first weigh-in) to a year; zoom: the last 3 months
  const startWeeks = Math.max(0, isZoomed
    ? Math.max(firstWeeks === undefined ? 0 : firstWeeks - 1, todayWeeks - 13)
    : Math.min(8, firstWeeks === undefined ? 8 : Math.floor(firstWeeks) - 1));
  const endWeeks = isZoomed ? todayWeeks + 1.5 : getFullViewEndWeeks(todayWeeks, category);
  const adultWeeks = getWalthamAdultWeeks(category);

  const inView = trusted.filter((weighIn) => weighIn.ageWeeks >= startWeeks).map((weighIn) => weighIn.weightKg);
  const zoomFits = isZoomed && inView.length > 0;
  const topKg = zoomFits
    ? Math.max(...inView, bandAt(endWeeks, BAND_HIGH)) * 1.04
    : Math.max(1, bandAt(endWeeks, BAND_HIGH), projection?.adultKg ?? 0, ...trusted.map((weighIn) => weighIn.weightKg)) * 1.06;
  const lowKg = zoomFits ? Math.min(...inView, bandAdultKg ? bandAt(startWeeks, BAND_LOW) : Infinity) * 0.96 : 0;
  const range = topKg - lowKg;
  const step = range > 24 ? 10 : range > 12 ? 4 : range > 5 ? 2 : 1;
  const minKg = Math.floor(lowKg / step) * step;
  const maxKg = Math.ceil(topKg / step) * step;
  // Room on the left for the top label ("80 kg"), which ends 6 px before the plot
  const left = Math.max(PADDING.left, 6 + String(maxKg).length * DIGIT_PX + KG_UNIT_PX);
  const plot = { left, right: width - PADDING.right, top: PADDING.top, bottom: HEIGHT - PADDING.bottom };

  const xAt = (weeks: number) => plot.left + ((weeks - startWeeks) / (endWeeks - startWeeks)) * (plot.right - plot.left);
  const yAt = (kg: number) => plot.top + (1 - (kg - minKg) / (maxKg - minKg)) * (plot.bottom - plot.top);

  const yTicks: Array<{ kg: number; y: number }> = [];
  for (let kg = minKg; kg <= maxKg; kg += step) yTicks.push({ kg, y: yAt(kg) });
  // From the right: the last label carries the unit (end-anchored near the edge); a label that would come within 6 px of
  // the next one is left out, so an older dog's crowded months never run together
  const xTicks: Array<{ months: number; x: number; anchor: 'middle' | 'end'; labelLeft: number }> = [];
  (isZoomed ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24] : [2, 3, 4, 6, 9, 12, 15, 18, 24])
    .filter((months) => months * WEEKS_PER_MONTH >= startWeeks && months * WEEKS_PER_MONTH <= endWeeks)
    .reverse()
    .forEach((months) => {
      const x = xAt(months * WEEKS_PER_MONTH);
      const isLast = xTicks.length === 0;
      const labelWidth = String(months).length * DIGIT_PX + (isLast ? MONTHS_UNIT_PX : 0);
      const anchor = isLast && x > plot.right - 24 ? 'end' : 'middle';
      const labelLeft = anchor === 'end' ? x - labelWidth : x - labelWidth / 2;
      const labelRight = anchor === 'end' ? x : x + labelWidth / 2;
      if (!isLast && labelRight + 6 > xTicks[0].labelLeft) return;
      xTicks.unshift({ months, x, anchor, labelLeft });
    });

  const bandWeeks: number[] = [];
  for (let weeks = startWeeks; weeks < endWeeks; weeks += 0.5) bandWeeks.push(weeks);
  bandWeeks.push(endWeeks);
  const bandPath = bandAdultKg
    ? `${toPath([
      ...bandWeeks.map((weeks): [number, number] => [xAt(weeks), yAt(bandAt(weeks, BAND_HIGH))]),
      ...[...bandWeeks].reverse().map((weeks): [number, number] => [xAt(weeks), yAt(bandAt(weeks, BAND_LOW))]),
    ])}Z`
    : null;
  const bandMidPath = bandAdultKg ? toPath(bandWeeks.map((weeks) => [xAt(weeks), yAt(bandAt(weeks, 1))])) : null;

  // A typo above or below the scale is drawn just inside its edge
  const points: ChartPoint[] = weighIns
    .filter((weighIn) => weighIn.ageWeeks >= startWeeks && weighIn.ageWeeks <= endWeeks)
    .map((weighIn) => ({
      id: weighIn.id,
      x: xAt(weighIn.ageWeeks),
      y: Math.min(plot.bottom - OFF_SCALE_INSET, Math.max(plot.top + OFF_SCALE_INSET, yAt(weighIn.weightKg))),
      isUnlikely: weighIn.isUnlikely,
    }));
  // Earlier weigh-ins too: the clip path cuts the line at the plot's edge
  const linePath = trusted.length > 1 ? toPath(trusted.map((weighIn) => [xAt(weighIn.ageWeeks), yAt(weighIn.weightKg)])) : null;

  // From the last weigh-in through today's estimate to the adult weight, eased onto the projected curve by the adult age
  const last = trusted[trusted.length - 1];
  const hasProjection = projection !== null && last !== undefined && todayWeeks < adultWeeks;
  const projectedAt = (weeks: number) => projection!.adultKg * getWalthamGrowthFraction(category, weeks)
    + (projection!.todayKg - projection!.adultKg * getWalthamGrowthFraction(category, todayWeeks)) * Math.max(0, (adultWeeks - weeks) / (adultWeeks - todayWeeks));
  const projectionWeeks: number[] = [];
  for (let weeks = todayWeeks; weeks < endWeeks; weeks += 0.5) projectionWeeks.push(weeks);
  projectionWeeks.push(endWeeks);
  const projectionPath = hasProjection
    ? toPath([[xAt(last.ageWeeks), yAt(last.weightKg)], ...projectionWeeks.map((weeks): [number, number] => [xAt(weeks), yAt(projectedAt(weeks))])])
    : null;

  // The "≈ N kg adult" label, end-anchored at the right: above the line's end, else under it, else at the plot's top,
  // whichever covers no dot (a dog near 1 year has its last weigh-ins there)
  const endY = hasProjection ? yAt(projectedAt(endWeeks)) : 0;
  const dots = [...points, ...(projection ? [{ x: xAt(todayWeeks), y: yAt(projection.todayKg) }] : [])];
  const coversDot = (baseline: number) => dots.some((dot) => dot.x + 8 > plot.right - ADULT_LABEL_PX && dot.y + 8 > baseline - 11 && dot.y - 8 < baseline + 3);
  const labelY = [endY - 8, endY + 18, plot.top + 14].find((baseline) => !coversDot(baseline)) ?? endY - 8;

  return {
    height: HEIGHT,
    plot,
    yTicks,
    xTicks,
    bandPath,
    bandMidPath,
    linePath,
    projectionPath,
    /** Where the "≈ N kg adult" label goes: the full view only. */
    projectionEnd: hasProjection && !isZoomed ? { x: xAt(endWeeks), y: endY, labelY } : null,
    today: { x: xAt(todayWeeks), estimateY: projection ? yAt(projection.todayKg) : null },
    points,
  };
}

export type WeightChartGeometry = ReturnType<typeof buildWeightChartGeometry>;

/** The index of the point nearest to (x, y), height counting half as much: two weigh-ins on one day can both be picked. -1 when there is none. */
export function findNearestPoint(points: Array<{ x: number; y: number }>, x: number, y: number): number {
  let nearest = -1;
  let nearestDistance = Infinity;
  points.forEach((point, index) => {
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2 / 4;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}
