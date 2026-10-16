import { describe, it, expect } from 'vitest';
import { buildWeightChartGeometry, findNearestPoint, type WeightChartInput } from '../weightChartGeometry';
import { getWalthamGrowthFraction } from '../weight';

// A made-up 14 kg-adult dog, 20 weeks old today: weigh-ins at 9, 12 and 16 weeks, the 16-week one a typo (63 for 6,3)
const input: WeightChartInput = {
  width: 320,
  weighIns: [
    { id: 'w9', ageWeeks: 9, weightKg: 4.2, isUnlikely: false },
    { id: 'w12', ageWeeks: 12, weightKg: 5.9, isUnlikely: false },
    { id: 'typo', ageWeeks: 16, weightKg: 63, isUnlikely: true },
  ],
  todayWeeks: 20,
  category: 'III',
  bandAdultKg: 14,
  projection: { adultKg: 14, todayKg: 9 },
  isZoomed: false,
};

/** The first point of an SVG path, "M12.34,56.78L…" */
const firstPoint = (path: string) => path.slice(1).split('L')[0].split(',').map(Number);

describe('buildWeightChartGeometry: real pixels at the measured width, never a viewBox', () => {
  it('fills the width, 200 px tall, from 8 weeks to just past 12 months, kilos from 0', () => {
    const geometry = buildWeightChartGeometry(input);

    expect(geometry.height).toBe(200);
    // Left: room for the top label, "20 kg" (it was 34 px, which cut the first digit of "80 kg")
    expect(geometry.plot).toEqual({ left: 38, right: 310, top: 14, bottom: 174 });
    expect(geometry.xTicks.map((tick) => tick.months)).toEqual([2, 3, 4, 6, 9, 12]);
    expect(geometry.xTicks[0].x).toBeCloseTo(38 + ((2 * 4.345 - 8) / (52.2 - 8)) * 272, 5);
    expect(geometry.yTicks[0]).toEqual({ kg: 0, y: 174 });
    // The scale fits the zone's top (14 kg × 1.15 + 6 %), not the typo
    expect(geometry.yTicks.at(-1)).toEqual({ kg: 20, y: 14 });
  });

  it.each([[70, 90, 30], [90, 110, 37]])('the top label fits left of the plot: a %s kg adult, a scale to %s kg', (adultKg, topKg, labelWidth) => {
    // Measured at 11 px in system-ui (SF Pro): "80 kg" is 29.7 px wide, one more digit about 7 px; the label ends 6 px before the plot
    const geometry = buildWeightChartGeometry({ ...input, bandAdultKg: adultKg, projection: null });

    expect(geometry.yTicks.at(-1)!.kg).toBe(topKg);
    expect(geometry.plot.left - 6).toBeGreaterThanOrEqual(labelWidth);
  });

  it('a weigh-in that looks like a typo stays out of the line and the scale, drawn at the top edge, never hidden', () => {
    const geometry = buildWeightChartGeometry(input);

    expect(geometry.linePath!.match(/[ML]/g)).toEqual(['M', 'L']);
    expect(geometry.points.map((point) => point.id)).toEqual(['w9', 'w12', 'typo']);
    expect(geometry.points[2]).toMatchObject({ isUnlikely: true, y: 24 });
    // Its selected ring (r 7, 2 px stroke) stays under the plot's top, clear of the "auj." label above it
    expect(geometry.points[2].y - 8).toBeGreaterThanOrEqual(geometry.plot.top);
  });

  it('the zone is the adult weight × the growth curve × 0.88–1.15; none without an adult weight', () => {
    const geometry = buildWeightChartGeometry(input);
    const yAt = (kg: number) => 14 + (1 - kg / 20) * 160;

    const [x, y] = firstPoint(geometry.bandPath!);
    expect(x).toBe(geometry.plot.left);
    expect(y).toBeCloseTo(yAt(14 * getWalthamGrowthFraction('III', 8) * 1.15), 2);
    expect(buildWeightChartGeometry({ ...input, bandAdultKg: null }).bandPath).toBeNull();
  });

  it('today: the estimate dot, and a dashed line from the last weigh-in to the adult weight', () => {
    const geometry = buildWeightChartGeometry(input);

    expect(geometry.today.x).toBeCloseTo(38 + ((20 - 8) / 44.2) * 272, 5);
    expect(geometry.today.estimateY).toBeCloseTo(14 + (1 - 9 / 20) * 160, 5);
    const [x, y] = firstPoint(geometry.projectionPath!);
    expect(x).toBeCloseTo(geometry.points[1].x, 2);
    expect(y).toBeCloseTo(geometry.points[1].y, 2);
    expect(geometry.projectionEnd!.y).toBeCloseTo(14 + (1 - 14 / 20) * 160, 5);
    expect(buildWeightChartGeometry({ ...input, projection: null }).projectionPath).toBeNull();
  });

  it('the 3-month zoom starts a week before the first weigh-in, or 13 weeks before today, and fits the kilos in view', () => {
    const geometry = buildWeightChartGeometry({ ...input, isZoomed: true });

    expect(geometry.points.map((point) => point.id)).toEqual(['w9', 'w12', 'typo']); // 13 weeks before today is 7: the first, minus 1, is 8
    expect(geometry.plot.left).toBe(38); // "12 kg" at the top
    expect(geometry.xTicks.map((tick) => tick.months)).toEqual([2, 3, 4]);
    expect(geometry.yTicks[0].kg).toBeGreaterThan(0);
    expect(geometry.projectionEnd).toBeNull();
  });

  it('the "≈ N kg adult" label leaves its place above the line\'s end when it would cover a weigh-in there (a dog near 1 year)', () => {
    const nearOneYear: WeightChartInput = {
      ...input,
      weighIns: [{ id: 'w40', ageWeeks: 40, weightKg: 13, isUnlikely: false }, { id: 'w47', ageWeeks: 47, weightKg: 14.3, isUnlikely: false }],
      todayWeeks: 48,
      projection: { adultKg: 14, todayKg: 14.4 },
    };
    const geometry = buildWeightChartGeometry(nearOneYear);

    expect(geometry.projectionEnd!.labelY).not.toBe(geometry.projectionEnd!.y - 8);
    // Away from the weigh-ins, above the line
    expect(buildWeightChartGeometry(input).projectionEnd!.labelY).toBe(buildWeightChartGeometry(input).projectionEnd!.y - 8);
  });

  it('a dog near 1 year weighed along its curve: the "≈ N kg adult" label covers no dot, above, under or at the top', () => {
    // 11 weigh-ins from 8 weeks to 48.6 weeks, ±3 % around an 11 kg adult's curve, at 320 px: the label above and the one
    // under the line's end each covered two dots
    const weighIns = Array.from({ length: 11 }, (_, index) => {
      const ageWeeks = (56 + ((340 - 56) * index) / 10) / 7;
      return { id: `w${index}`, ageWeeks, weightKg: Math.round(11 * getWalthamGrowthFraction('III', ageWeeks) * (1 + 0.03 * Math.sin(index * 2.1)) * 10) / 10, isUnlikely: false };
    });
    const geometry = buildWeightChartGeometry({ ...input, weighIns, todayWeeks: 49, bandAdultKg: 11, projection: { adultKg: 11.1, todayKg: 11.2 } });
    const { labelY } = geometry.projectionEnd!;
    // Measured: the label is 80 px wide, 10 px above its baseline to 3 px under; a selected dot's radius is 6
    const covered = [...geometry.points, { x: geometry.today.x, y: geometry.today.estimateY! }]
      .filter((dot) => dot.x + 6 > geometry.plot.right - 80 && dot.y + 6 > labelY - 10 && dot.y - 6 < labelY + 3);

    expect(covered).toEqual([]);
  });

  it('a dog over a year old: month labels never touch (measured at 11 px: 7 px a digit, "24 mois" 42 px)', () => {
    const geometry = buildWeightChartGeometry({ ...input, width: 254, todayWeeks: 110, weighIns: [{ id: 'w100', ageWeeks: 100, weightKg: 13, isUnlikely: false }] });
    const extent = (tick: (typeof geometry.xTicks)[number], isLast: boolean) => {
      const labelWidth = String(tick.months).length * 7 + (isLast ? 28 : 0);
      return tick.anchor === 'end' ? [tick.x - labelWidth, tick.x] : [tick.x - labelWidth / 2, tick.x + labelWidth / 2];
    };

    expect(geometry.xTicks.at(-1)!.months).toBe(24);
    geometry.xTicks.slice(1).forEach((tick, index) => {
      const [, previousRight] = extent(geometry.xTicks[index], false);
      const [left] = extent(tick, index === geometry.xTicks.length - 2);
      expect(left - previousRight).toBeGreaterThanOrEqual(2);
    });
  });

  it('a large breed (category V) grows until 68 weeks: the view and the dashed line reach its adult age, ending on the labelled adult weight', () => {
    const largeDog: WeightChartInput = {
      ...input,
      weighIns: [{ id: 'w20', ageWeeks: 20, weightKg: 19, isUnlikely: false }, { id: 'w26', ageWeeks: 26, weightKg: 23, isUnlikely: false }],
      todayWeeks: 30,
      category: 'V',
      bandAdultKg: 36,
      projection: { adultKg: 37.7, todayKg: 26 },
    };
    const geometry = buildWeightChartGeometry(largeDog);
    const [bottom, top] = [geometry.yTicks[0], geometry.yTicks.at(-1)!];
    const yAt = (kg: number) => bottom.y + ((kg - bottom.kg) / (top.kg - bottom.kg)) * (top.y - bottom.y);
    const lastPoint = geometry.projectionPath!.split('L').at(-1)!.split(',').map(Number);

    expect(lastPoint[1]).toBeCloseTo(yAt(37.7), 1); // it ended at 35,1 kg, 7 % under its label
    expect(geometry.projectionEnd!.y).toBeCloseTo(yAt(37.7), 5);
    expect(geometry.xTicks.at(-1)!.months).toBe(15);
    // Still growing at 55 weeks: the dashed line is still there
    expect(buildWeightChartGeometry({ ...largeDog, todayWeeks: 55, projection: { adultKg: 37.7, todayKg: 35 } }).projectionPath).not.toBeNull();
  });

  it('no weigh-in yet: the zone only', () => {
    const geometry = buildWeightChartGeometry({ ...input, weighIns: [], projection: null });

    expect(geometry.points).toEqual([]);
    expect(geometry.linePath).toBeNull();
    expect(geometry.bandPath).not.toBeNull();
  });
});

describe('findNearestPoint: a tap picks the closest weigh-in in 2D', () => {
  it('two weigh-ins on the same day are told apart by their height', () => {
    const points = [{ x: 100, y: 50 }, { x: 100, y: 90 }, { x: 140, y: 70 }];

    expect(findNearestPoint(points, 101, 85)).toBe(1);
    expect(findNearestPoint(points, 99, 55)).toBe(0);
    expect(findNearestPoint(points, 135, 20)).toBe(2);
    expect(findNearestPoint([], 10, 10)).toBe(-1);
  });
});
