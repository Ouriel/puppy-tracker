import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const match = envLocal.match(/DATABASE_URL="?([^"\r\n]+)"?/);
const dbUrl = match ? match[1].trim() : '';
const sql = neon(dbUrl);

function parseIsoDate(isoString: string): Date {
  return new Date(isoString);
}

function getLocalHour(date: Date, timeZone: string = 'Europe/Paris'): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour');
  return hourPart ? parseInt(hourPart.value, 10) % 24 : date.getHours();
}

async function runEvaluation() {
  const activities: any[] = await sql`SELECT * FROM activities ORDER BY timestamp ASC`;
  console.log(`Loaded ${activities.length} activity logs for Balma.\n`);

  const poops = activities.filter((a) => a.type === 'poop');
  const pees = activities.filter((a) => a.type === 'pee');
  const foods = activities.filter((a) => a.type === 'food');

  // -------------------------------------------------------------
  // 1. GASTROCOLIC REFLEX EVALUATION (Food -> Poop delay analysis)
  // -------------------------------------------------------------
  console.log(`===================================================`);
  console.log(`🧪 TEST 1: GASTROCOLIC REFLEX (Food -> Poop Delay)`);
  console.log(`===================================================`);
  const foodToPoopDelays: number[] = [];
  poops.forEach((poop) => {
    const poopTime = parseIsoDate(poop.timestamp).getTime();
    // Find preceding food within 3 hours (180 mins)
    const recentFood = [...foods]
      .reverse()
      .find((f) => {
        const foodTime = parseIsoDate(f.timestamp).getTime();
        const diffMins = (poopTime - foodTime) / (1000 * 60);
        return diffMins >= 0 && diffMins <= 180;
      });

    if (recentFood) {
      const foodTime = parseIsoDate(recentFood.timestamp).getTime();
      const delayMins = Math.round((poopTime - foodTime) / (1000 * 60));
      foodToPoopDelays.push(delayMins);
    }
  });

  const sortedDelays = [...foodToPoopDelays].sort((a, b) => a - b);
  const meanDelay = Math.round(foodToPoopDelays.reduce((a, b) => a + b, 0) / foodToPoopDelays.length);
  const medianDelay = sortedDelays[Math.floor(sortedDelays.length / 2)];
  
  const variance = foodToPoopDelays.reduce((acc, val) => acc + Math.pow(val - meanDelay, 2), 0) / foodToPoopDelays.length;
  const stdDevDelay = Math.round(Math.sqrt(variance));
  const q1 = sortedDelays[Math.floor(sortedDelays.length * 0.25)];
  const q3 = sortedDelays[Math.floor(sortedDelays.length * 0.75)];

  console.log(`Poops preceded by Meal within 3h: ${foodToPoopDelays.length} / ${poops.length} (${Math.round((foodToPoopDelays.length / poops.length) * 100)}%)`);
  console.log(`  • Mean Meal->Poop Delay  : ${meanDelay} mins`);
  console.log(`  • Median Meal->Poop Delay: ${medianDelay} mins`);
  console.log(`  • Std Dev (± σ)           : ±${stdDevDelay} mins`);
  console.log(`  • Interquartile Range (IQR): ${q1}m to ${q3}m (Delta Window: ±${Math.round((q3 - q1) / 2)} mins)\n`);

  // -------------------------------------------------------------
  // 2. DAYTIME PEE INTERVALS: TIME-DECAY (EMA) VS 30-DAY MEAN
  // -------------------------------------------------------------
  console.log(`===================================================`);
  console.log(`🧪 TEST 2: PEE INTERVALS (Time Decay vs Mean vs Median)`);
  console.log(`===================================================`);
  const peeGaps: { diffMins: number; daysAgo: number }[] = [];
  const nowTime = Date.now();

  for (let i = 1; i < pees.length; i++) {
    const prevTime = parseIsoDate(pees[i - 1].timestamp);
    const currTime = parseIsoDate(pees[i].timestamp);
    const diffMins = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);
    const daysAgo = (nowTime - currTime.getTime()) / (1000 * 60 * 60 * 24);

    if (diffMins >= 45 && diffMins <= 360) {
      const prevHour = getLocalHour(prevTime);
      const currHour = getLocalHour(currTime);
      if (prevHour >= 7 && prevHour < 22 && currHour >= 7 && currHour < 22) {
        peeGaps.push({ diffMins, daysAgo });
      }
    }
  }

  const rawGaps = peeGaps.map((g) => g.diffMins);
  const meanPeeGap = Math.round(rawGaps.reduce((a, b) => a + b, 0) / rawGaps.length);
  const sortedPeeGaps = [...rawGaps].sort((a, b) => a - b);
  const medianPeeGap = Math.round(sortedPeeGaps[Math.floor(sortedPeeGaps.length / 2)]);

  // Exponential decay (half-life = 7 days)
  let weightedSum = 0;
  let weightTotal = 0;
  peeGaps.forEach((g) => {
    const weight = Math.exp(-g.daysAgo / 7);
    weightedSum += g.diffMins * weight;
    weightTotal += weight;
  });
  const emaPeeGap = Math.round(weightedSum / weightTotal);

  const peeVariance = rawGaps.reduce((acc, val) => acc + Math.pow(val - meanPeeGap, 2), 0) / rawGaps.length;
  const stdDevPee = Math.round(Math.sqrt(peeVariance));
  const peeQ1 = sortedPeeGaps[Math.floor(sortedPeeGaps.length * 0.25)];
  const peeQ3 = sortedPeeGaps[Math.floor(sortedPeeGaps.length * 0.75)];

  console.log(`Valid Daytime Pee Gaps: ${peeGaps.length}`);
  console.log(`  • 30-Day Unweighted Mean  : ${meanPeeGap} mins (${Math.floor(meanPeeGap / 60)}h ${meanPeeGap % 60}m)`);
  console.log(`  • Unweighted Median       : ${medianPeeGap} mins (${Math.floor(medianPeeGap / 60)}h ${medianPeeGap % 60}m)`);
  console.log(`  • Exponential Time Decay (7d): ${emaPeeGap} mins (${Math.floor(emaPeeGap / 60)}h ${emaPeeGap % 60}m)`);
  console.log(`  • Standard Deviation (± σ): ±${stdDevPee} mins`);
  console.log(`  • Interquartile Range (IQR): ${peeQ1}m to ${peeQ3}m (Delta Window: ±${Math.round((peeQ3 - peeQ1) / 2)} mins)\n`);

  // -------------------------------------------------------------
  // 3. CIRCADIAN CLUSTERING (Poop Hours for Balma)
  // -------------------------------------------------------------
  console.log(`===================================================`);
  console.log(`🧪 TEST 3: CIRCADIAN POOP TIME-OF-DAY DENSITY`);
  console.log(`===================================================`);
  const poopHourCounts: Record<number, number> = {};
  poops.forEach((p) => {
    const hour = getLocalHour(parseIsoDate(p.timestamp));
    poopHourCounts[hour] = (poopHourCounts[hour] || 0) + 1;
  });

  const sortedPoopHours = Object.entries(poopHourCounts)
    .map(([h, c]) => ({ hour: Number(h), count: c }))
    .sort((a, b) => b.count - a.count);

  console.log(`Balma's Primary Poop Windows:`);
  sortedPoopHours.slice(0, 5).forEach((item) => {
    console.log(`  • ${String(item.hour).padStart(2, '0')}:00 - ${String(item.hour + 1).padStart(2, '0')}:00 -> ${item.count} poops (${Math.round((item.count / poops.length) * 100)}% of all poops)`);
  });
}

runEvaluation().catch(console.error);
