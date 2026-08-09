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
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`;
  console.log(`📋 Database Tables (${tables.length}):`);
  for (const t of tables) {
    const tableStr = String(t.table_name);
    try {
      const countRes = await sql`SELECT COUNT(*) as count FROM ${sql(tableStr)};`;
      console.log(`   • ${tableStr.padEnd(20)} ${countRes[0].count} rows`);
    } catch {
      console.log(`   • ${tableStr.padEnd(20)} N/A`);
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
        foodType: a.food_type,
        quantityGrams: a.quantity_grams,
      }));

    console.log(`\n🔮 Live Prediction Engine Diagnostics (${profile.name}):`);
    const sleepSchedule = detectSleepSchedule(puppyActivities);
    console.log(`   • Sleep Schedule      : Bedtime ~${sleepSchedule.bedtimeHour}:00 | Wakeup ~${sleepSchedule.wakeupHour}:00`);

    const learnedPee = calculateLearnedIntervalMinutes(puppyActivities, 'pee', 120, sleepSchedule);
    console.log(`   • Learned Pee Interval: ${learnedPee.intervalMins}m (Learned: ${learnedPee.isLearned}, Samples: ${learnedPee.sampleCount})`);

    const learnedPoop = calculateLearnedIntervalMinutes(puppyActivities, 'poop', 300, sleepSchedule);
    console.log(`   • Learned Poop Interval: ${learnedPoop.intervalMins}m (Learned: ${learnedPoop.isLearned}, Samples: ${learnedPoop.sampleCount})`);

    const predictions = calculatePredictions(puppyActivities, profile);
    console.log(`   • Pee Card            : Mode=${predictions.peeMode} | Urgency=${predictions.peeUrgency} | Next=${predictions.nextPeeExpectedAt ? predictions.nextPeeExpectedAt.toLocaleTimeString() : 'N/A'}`);
    console.log(`     Reason              : "${predictions.peeReason}"`);

    console.log(`   • Poop Card           : Mode=${predictions.poopMode} | Urgency=${predictions.poopUrgency} | Next=${predictions.nextPoopExpectedAt ? predictions.nextPoopExpectedAt.toLocaleTimeString() : 'N/A'}`);
    console.log(`     Reason              : "${predictions.poopReason}"`);

    console.log(`   • Food Card           : Mode=${predictions.foodMode} | Urgency=${predictions.foodUrgency} | Next=${predictions.nextFoodExpectedAt ? predictions.nextFoodExpectedAt.toLocaleTimeString() : 'N/A'}`);
    console.log(`     Reason              : "${predictions.foodReason}"`);
  }

  console.log('\n====================================================\n');
}

runInspection().catch((err) => {
  console.error('❌ Error executing database inspection script:', err);
  process.exit(1);
});
