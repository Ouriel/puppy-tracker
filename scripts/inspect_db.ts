import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { detectSleepSchedule, calculateLearnedIntervalMinutes, calculatePredictions } from '../src/utils/predictions';
import type { Activity, PuppyProfile } from '../src/types';

/**
 * Safe Neon DB Inspection & Prediction Engine Diagnostics Script
 * 
 * Usage:
 *   npx tsx scripts/inspect_db.ts
 *   npm run db:inspect
 * 
 * Security Note:
 *   This script NEVER hardcodes credentials. It safely reads `DATABASE_URL`
 *   from `.env.local` or `process.env.DATABASE_URL`.
 */

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envText = fs.readFileSync(envLocalPath, 'utf8');
    const match = envText.match(/DATABASE_URL="([^"]+)"/) || envText.match(/DATABASE_URL=([^\s]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, 'utf8');
    const match = envText.match(/DATABASE_URL="([^"]+)"/) || envText.match(/DATABASE_URL=([^\s]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('DATABASE_URL is not set. Please ensure .env.local contains DATABASE_URL.');
}

async function runInspection() {
  console.log('====================================================');
  console.log('🐾 PUPPACE — NEON DATABASE INSPECTION & DIAGNOSTICS');
  console.log('====================================================\n');

  const dbUrl = getDatabaseUrl();
  const sql = neon(dbUrl);

  // 1. Table Inventory & Row Counts
  console.log('📋 Database Tables:');
  const tableList = ['activities', 'caretakers', 'households', 'users', 'puppies', 'health_records'];
  for (const tableName of tableList) {
    try {
      let count = 0;
      if (tableName === 'activities') {
        const res = await sql`SELECT COUNT(*) as c FROM activities;`;
        count = Number(res[0].c);
      } else if (tableName === 'caretakers') {
        const res = await sql`SELECT COUNT(*) as c FROM caretakers;`;
        count = Number(res[0].c);
      } else if (tableName === 'households') {
        const res = await sql`SELECT COUNT(*) as c FROM households;`;
        count = Number(res[0].c);
      } else if (tableName === 'users') {
        const res = await sql`SELECT COUNT(*) as c FROM users;`;
        count = Number(res[0].c);
      } else if (tableName === 'puppies') {
        const res = await sql`SELECT COUNT(*) as c FROM puppies;`;
        count = Number(res[0].c);
      } else if (tableName === 'health_records') {
        const res = await sql`SELECT COUNT(*) as c FROM health_records;`;
        count = Number(res[0].c);
      }
      console.log(`   • ${tableName.padEnd(20)} ${count} rows`);
    } catch {
      console.log(`   • ${tableName.padEnd(20)} N/A`);
    }
  }

  // 2. Puppies Profile Summary
  const rawPuppies = await sql`SELECT * FROM puppies;`;
  console.log(`\n🐕 Puppies (${rawPuppies.length}):`);
  rawPuppies.forEach((p) => {
    console.log(`   • ID: ${p.id} | Name: ${p.name} | Breed: ${p.breed} | Weight: ${p.weight_kg}kg | Goal: ${p.daily_food_gram_goal}g (${p.target_meals_per_day} meals/day)`);
  });

  // 3. Activity Type Breakdown & Timestamp Range
  const rawActivities = await sql`SELECT * FROM activities ORDER BY timestamp ASC;`;
  console.log(`\n📊 Activity Logs (${rawActivities.length} total):`);

  const activityCounts = await sql`SELECT type, COUNT(*) as count FROM activities GROUP BY type ORDER BY count DESC;`;
  activityCounts.forEach((c) => {
    console.log(`   • ${String(c.type).padEnd(12)} : ${c.count} logs`);
  });

  const span = await sql`SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM activities;`;
  if (span.length > 0 && span[0].oldest) {
    console.log(`   • Span        : ${new Date(span[0].oldest).toLocaleDateString()} to ${new Date(span[0].newest).toLocaleDateString()}`);
  }

  // 4. Live Prediction Engine Output for Primary Puppy
  if (rawPuppies.length > 0) {
    const puppy = rawPuppies[0];
    const profile: PuppyProfile = {
      id: puppy.id,
      name: puppy.name,
      breed: puppy.breed,
      birthDate: puppy.birth_date,
      weightKg: Number(puppy.weight_kg),
      dailyFoodGramGoal: puppy.daily_food_gram_goal,
      targetMealsPerDay: puppy.target_meals_per_day,
    };

    const puppyActivities: Activity[] = rawActivities
      .filter((a) => a.puppy_id === puppy.id)
      .map((a) => ({
        id: a.id,
        puppyId: a.puppy_id,
        type: a.type,
        timestamp: a.timestamp instanceof Date ? a.timestamp.toISOString() : new Date(a.timestamp).toISOString(),
        loggedBy: a.logged_by || 'User',
        pottyLocation: a.potty_location,
        stoolConsistency: a.stool_consistency,
        foodType: a.food_type,
        quantityGrams: a.quantity_grams,
        notes: a.notes,
      }));

    console.log(`\n🔮 Live Prediction Engine Diagnostics (${profile.name}):`);
    const sleepSchedule = detectSleepSchedule(puppyActivities);
    console.log(`   • Sleep Schedule      : Bedtime ~${sleepSchedule.bedtimeStr} | Wakeup ~${sleepSchedule.wakeupStr}`);

    const learnedPee = calculateLearnedIntervalMinutes(puppyActivities, 'pee', 120, sleepSchedule);
    console.log(`   • Learned Pee Interval: ${Math.round(learnedPee.intervalMins)}m (Learned: ${learnedPee.isLearned}, Samples: ${learnedPee.sampleCount})`);

    const learnedPoop = calculateLearnedIntervalMinutes(puppyActivities, 'poop', 300, sleepSchedule);
    console.log(`   • Learned Poop Interval: ${Math.round(learnedPoop.intervalMins)}m (Learned: ${learnedPoop.isLearned}, Samples: ${learnedPoop.sampleCount})`);

    const predictions = calculatePredictions(puppyActivities, profile);
    console.log(`   • Pee Card            : Mode=${predictions.peeMode} | Urgency=${predictions.peeUrgency} | Next=${predictions.nextPeeExpectedAt ? predictions.nextPeeExpectedAt.toLocaleTimeString() : 'N/A'}`);
    console.log(`     Reason              : "${predictions.peeReason}"`);

    console.log(`   • Poop Card           : Mode=${predictions.poopMode} | Urgency=${predictions.poopUrgency} | Next=${predictions.nextPoopExpectedAt ? predictions.nextPoopExpectedAt.toLocaleTimeString() : 'N/A'}`);
    console.log(`     Reason              : "${predictions.poopReason}"`);

    console.log(`   • Food Card           : Mode=${predictions.foodMode} | Urgency=${predictions.foodUrgency} | Next=${predictions.nextFoodExpectedAt ? predictions.nextFoodExpectedAt.toLocaleTimeString() : 'N/A'}`);
    console.log(`     Reason              : "${predictions.foodReason}"`);

    // 5. Daily Breakdown (Last 14 days)
    console.log('\n📅 Daily Breakdown (Last 14 days):');
    const byDate: Record<string, typeof puppyActivities> = {};
    puppyActivities.forEach((act) => {
      const d = new Date(act.timestamp).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(act);
    });

    const sortedDates = Object.keys(byDate).sort().reverse().slice(0, 14);
    sortedDates.forEach((d) => {
      const dayLogs = byDate[d].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstPee = dayLogs.find((a) => a.type === 'pee');
      const firstPoop = dayLogs.find((a) => a.type === 'poop');
      const firstFood = dayLogs.find((a) => a.type === 'food');
      const lastAct = dayLogs[dayLogs.length - 1];

      const fmt = (act?: typeof dayLogs[0]) => {
        if (!act) return '--:--';
        const dateObj = new Date(act.timestamp);
        return dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
      };

      console.log(`   • ${d} | FirstPee: ${fmt(firstPee)} | FirstPoop: ${fmt(firstPoop)} | FirstFood: ${fmt(firstFood)} | LastAct: ${fmt(lastAct)} (Logs: ${dayLogs.length})`);
    });

    // 6. Recent Activity Trail (Last 20 entries)
    console.log('\n📜 Recent Activity Trail (Last 20 entries):');
    const recentTrail = [...puppyActivities].reverse().slice(0, 20);
    recentTrail.forEach((a) => {
      const time = new Date(a.timestamp).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
      const details = [
        a.pottyLocation ? `loc:${a.pottyLocation}` : '',
        a.stoolConsistency ? `stool:${a.stoolConsistency}` : '',
        a.quantityGrams ? `${a.quantityGrams}g` : '',
        a.loggedBy ? `by:${a.loggedBy}` : '',
        a.notes ? `notes:"${a.notes}"` : '',
      ].filter(Boolean).join(' | ');

      console.log(`   • ${time.padEnd(16)} | ${a.type.padEnd(6)} | ${details}`);
    });
  }

  console.log('\n====================================================\n');
}

runInspection().catch((err) => {
  console.error('❌ Error executing database inspection script:', err);
  process.exit(1);
});
