-- PupPace preview seed: demo households, members, dogs, logs and health passports for testing previews.
--
-- WHERE  The Neon `preview` branch only, which Vercel preview deployments read. The guard below refuses every other
--        branch (production included) and any host that is not Neon.
-- HOW    Neon SQL editor with the `preview` branch selected (paste the whole file), or
--        psql "$PREVIEW_POSTGRES_URL" -f scripts/preview-seed.sql
-- RERUN  Safe: it first deletes every seed row (ids 'seed-%') and what the app attached to seeded households or dogs,
--        then inserts fresh data relative to now() in Europe/Paris. Real rows (the family's dog, accounts, badges,
--        logs, records) are never touched. Today's slots still ahead of now() are skipped, so counts grow during the day.
--        Logs stop at the run time: re-run the seed at the start of each test session.
-- DATA   Real household FAMILY-COCKER-2026: puppy Pistache (Golden Retriever) logged by the household's own badges
--        (read at run time), and Camille, an account waiting for approval.
--        'Famille Martin (demo)': Rocky (Labrador, 10 weeks, 300 g, 4 meals), Lucky (Beagle, 2 years, no gram goal);
--        Claire (Admin), Paul, Léa (no badge: her first log creates one), badge Mamie (no login).
--        'Famille Dupont (demo)': Caramel (Labradoodle typed under Other, 5 months, adult 25 kg, last dose missed); Julien.

DO $$
DECLARE
  v_days          int  := 30;  -- days of logs per dog; a puppy's logs start on its arrival at 8 weeks
  v_branch        text := current_setting('neon.branch_id', true);
  v_tz            text := 'Europe/Paris';
  v_today         date := (now() AT TIME ZONE v_tz)::date;
  v_clinic        text := 'Clinique Vétérinaire des Tilleuls (demo)';
  v_pending_email text := 'camille.bernard@example.com';
  v_family_loggers text[];  -- the real household's badge names, read at run time (no real names in this file)
  d       record;
  v_key   text;
  v_birth date;
  v_start date;
  v_years int;
BEGIN
  -- 0. Guard, before any write. Fails closed: only the preview branch passes, matched on the md5 of its branch id
  --    (a reset from parent keeps the id; the hash keeps it out of this public repo). Production, any other branch
  --    and a non-Neon host are refused. A recreated preview branch needs its new hash:
  --    SELECT md5(current_setting('neon.branch_id'));
  IF md5(coalesce(v_branch, '')) IS DISTINCT FROM '7617caa124a64e7618ab1b94dffaf520' THEN
    RAISE EXCEPTION 'preview-seed: branch % is not the Neon preview branch. Nothing written.', coalesce(v_branch, '(not Neon)');
  END IF;

  -- 1. Previous seed: seed ids, plus what the app attached to seeded households or dogs (logs, the badge Léa's
  --    first log creates) and the badge an approval gives Camille in the real household.
  DELETE FROM activities     WHERE id LIKE 'seed-%' OR household_id LIKE 'seed-%' OR puppy_id LIKE 'seed-%';
  DELETE FROM health_records WHERE id LIKE 'seed-%' OR household_id LIKE 'seed-%' OR puppy_id LIKE 'seed-%';
  DELETE FROM caretakers     WHERE id LIKE 'seed-%' OR household_id LIKE 'seed-%' OR lower(email) = v_pending_email;
  DELETE FROM users          WHERE id LIKE 'seed-%';
  DELETE FROM puppies        WHERE id LIKE 'seed-%' OR household_id LIKE 'seed-%';
  DELETE FROM households     WHERE id LIKE 'seed-%';

  SELECT array_agg(name ORDER BY name) INTO v_family_loggers
    FROM caretakers WHERE household_id = 'FAMILY-COCKER-2026' AND id NOT LIKE 'seed-%';
  IF v_family_loggers IS NULL THEN
    RAISE EXCEPTION 'preview-seed: FAMILY-COCKER-2026 has no badge to log Pistache''s events. Nothing written.';
  END IF;

  -- 2. Demo households (the real FAMILY-COCKER-2026 has no households row and gets none)
  INSERT INTO households (id, family_pack_id, name) VALUES
    ('seed-hh-martin', 'seed-hh-martin', 'Famille Martin (demo)'),
    ('seed-hh-dupont', 'seed-hh-dupont', 'Famille Dupont (demo)');

  -- 3. Accounts, all fictional @example.com (they cannot sign in: Google SSO)
  INSERT INTO users (id, household_id, email, name, role, status) VALUES
    ('seed-usr-camille', 'FAMILY-COCKER-2026', v_pending_email,             'Camille Bernard', 'Member', 'PENDING_APPROVAL'),
    ('seed-usr-claire',  'seed-hh-martin',     'claire.martin@example.com', 'Claire Martin',   'Admin',  'ACTIVE'),
    ('seed-usr-paul',    'seed-hh-martin',     'paul.martin@example.com',   'Paul Martin',     'Member', 'ACTIVE'),
    ('seed-usr-lea',     'seed-hh-martin',     'lea.martin@example.com',    'Léa Martin',      'Member', 'ACTIVE'),
    ('seed-usr-julien',  'seed-hh-dupont',     'julien.dupont@example.com', 'Julien Dupont',   'Admin',  'ACTIVE');

  -- 4. Badges, linked by lower-case email; Mamie has no login; Léa has no badge
  INSERT INTO caretakers (id, household_id, name, role, color, email) VALUES
    ('seed-ct-claire', 'seed-hh-martin', 'Claire', 'Wife',     '#EC4899', 'claire.martin@example.com'),
    ('seed-ct-paul',   'seed-hh-martin', 'Paul',   'Husband',  '#10B981', 'paul.martin@example.com'),
    ('seed-ct-mamie',  'seed-hh-martin', 'Mamie',  'Relative', '#F59E0B', NULL),
    ('seed-ct-julien', 'seed-hh-dupont', 'Julien', 'Member',   '#0EA5E9', 'julien.dupont@example.com');

  -- 5. Dogs. Growth curve (Gompertz): adult_kg * exp(-4.32 * exp(-0.0146 * age in days)), ~15 % of adult at 8 weeks,
  --    ~45 % at 4 months, ~98 % at 1 year. Jitter comes from md5 of the row id, so a rerun the same day is identical.
  FOR d IN
    SELECT * FROM (VALUES
      -- loggers: badge names, repeated to weight who logs most
      ('seed-dog-pistache', 'FAMILY-COCKER-2026', 'Pistache', 'Golden Retriever',   'female', interval '17 weeks',       28.0, NULL::float8, 320, 3,
        v_family_loggers, 'Smecta', 'Nexgard Spectra', false, false, 0),
      ('seed-dog-rocky',    'seed-hh-martin',     'Rocky',    'Labrador Retriever', 'male',   interval '10 weeks',       33.0, NULL,        300, 4,
        ARRAY['Claire','Claire','Paul','Paul','Mamie'], 'Smecta', NULL, false, false, 2),
      ('seed-dog-lucky',    'seed-hh-martin',     'Lucky',    'Beagle',             'female', interval '2 years 1 month', 11.5, NULL,         0, 2,
        ARRAY['Claire','Paul','Paul','Mamie'], 'Apoquel 5,4 mg', 'Simparica Trio', true, false, 4),
      ('seed-dog-caramel',  'seed-hh-dupont',     'Caramel',  'Labradoodle',        'male',   interval '5 months',        25.0, 25.0,       280, 3,
        ARRAY['Julien'], 'Fortiflora', 'Credelio Plus', true, true, 5)
    ) AS t(id, household_id, name, breed, gender, age, adult_kg, typed_adult_kg, goal, meals,
           loggers, medication, antiparasitic, rabies, missed_last_dose, weigh_day)
  LOOP
    v_key   := replace(d.id, 'seed-dog-', '');
    v_birth := (v_today - d.age)::date;
    v_start := greatest(v_today - v_days + 1, v_birth + 56);
    v_years := date_part('year', age(v_today, v_birth))::int;

    INSERT INTO puppies (id, household_id, name, breed, birth_date, weight_kg, daily_food_gram_goal, target_meals_per_day,
                         gender, expected_adult_weight_kg)
    VALUES (d.id, d.household_id, d.name, d.breed, v_birth,
            round(d.adult_kg * exp(-4.32 * exp(-0.0146 * (v_today - v_birth))), 1),
            d.goal, d.meals, d.gender, d.typed_adult_kg);

    -- Health passport: booster dates follow the app's rules (src/utils/health.ts)
    INSERT INTO health_records (id, household_id, puppy_id, type, name, date, booster_date, batch_number, vet_clinic, product_name)
    SELECT 'seed-hr-' || v_key || '-' || r.kind, d.household_id, d.id, r.type, r.name, r.date, r.booster,
           CASE WHEN r.type = 'vaccination' THEN 'DEMO-' || upper(substr(md5(v_key || r.kind), 1, 6)) END,
           CASE WHEN r.type = 'vaccination' THEN v_clinic END,
           CASE WHEN r.type = 'deworming' THEN r.name END
    FROM (
      -- Puppy series at 8, 12, 16 weeks: +1 month before 16 weeks, then the 1st birthday
      SELECT 'vac-w' || w AS kind, 'vaccination' AS type,
             CASE WHEN w = 8 THEN 'CHPPi / DAPPi (sans L4)'
                  ELSE 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)' END AS name,
             v_birth + 7 * w AS date,
             CASE WHEN w < 16 THEN (v_birth + 7 * w + interval '1 month')::date ELSE (v_birth + interval '1 year')::date END AS booster
      FROM unnest(ARRAY[8, 12, 16]) AS w
      UNION ALL
      -- Adult: CHPPi + L4 on each birthday, yearly
      SELECT 'vac-y' || y, 'vaccination', 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)',
             (v_birth + make_interval(years => y))::date, (v_birth + make_interval(years => y + 1))::date
      FROM generate_series(1, v_years) AS y
      UNION ALL
      -- Rabies (travel) at 16 weeks, then yearly
      SELECT 'rage-' || y, 'vaccination', 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)',
             (v_birth + 112 + make_interval(years => y))::date, (v_birth + 112 + make_interval(years => y + 1))::date
      FROM generate_series(0, v_years) AS y
      WHERE d.rabies
      UNION ALL
      -- Puppy wormers every 2 weeks under 12 weeks (the breeder's at 6 weeks)
      SELECT 'worm-w' || w, 'deworming',
             CASE WHEN w = 6 THEN 'Drontal Chiot (Sirop / Comprimés)' ELSE 'Milbemax Chiot / Milprazon / Milprazikan' END,
             v_birth + 7 * w, v_birth + 7 * w + 14
      FROM unnest(ARRAY[6, 8, 10]) AS w
      WHERE v_years = 0
      UNION ALL
      -- Monthly all-in-one from 12 weeks (an adult: its last 6 months). missed_last_dose leaves an overdue card.
      SELECT 'worm-' || to_char(g, 'YYYYMMDD'), 'deworming', d.antiparasitic, g::date, (g + interval '1 month')::date
      FROM generate_series((v_birth + 84)::timestamp, v_today::timestamp, interval '1 month') AS g
      WHERE d.antiparasitic IS NOT NULL
        AND g > v_today - interval '6 months'
        AND g <= v_today - CASE WHEN d.missed_last_dose THEN 31 ELSE 0 END
    ) AS r
    WHERE r.date <= v_today;

    -- Logs, one row per slot of each day since v_start (Paris local minutes), skipped at random, jittered +-25 min
    INSERT INTO activities (id, household_id, puppy_id, type, timestamp, logged_by, potty_location, stool_consistency,
                            food_type, quantity_grams, weight_kg, medication_name)
    SELECT e.id, d.household_id, d.id, e.type, e.ts,
           d.loggers[1 + floor(e.r3 * array_length(d.loggers, 1))::int],
           CASE WHEN e.type IN ('pee', 'poop') THEN
             CASE WHEN e.r2 < CASE WHEN e.age < 84 THEN 0.06 WHEN e.age < 140 THEN 0.03 WHEN e.age < 183 THEN 0.01 ELSE 0 END
                              * CASE WHEN e.type = 'poop' THEN 0.5 ELSE 1 END
                  THEN 'indoor_accident' ELSE 'outside' END END,
           CASE WHEN e.type = 'poop' THEN CASE WHEN e.r4 < 0.02 THEN 'diarrhea' WHEN e.r4 < 0.05 THEN 'hard' ELSE 'normal' END END,
           CASE WHEN e.type = 'food' THEN 'kibble' END,
           CASE WHEN e.type = 'food' THEN
             CASE WHEN d.goal > 0 THEN round(d.goal::numeric / d.meals * (0.9 + 0.2 * e.r2))
                  WHEN e.r2 < 0.5 THEN round(80 + 30 * e.r4) END END,  -- no gram goal: half the meals unweighed
           CASE WHEN e.type = 'weight' THEN round(d.adult_kg * exp(-4.32 * exp(-0.0146 * e.age)) * (0.985 + 0.03 * e.r2), 2) END,
           CASE WHEN e.type = 'medication' THEN d.medication END
    FROM (
      SELECT ev.*, j.*, (ev.day + make_interval(mins => ev.slot + round(50 * j.r1 - 25)::int)) AT TIME ZONE v_tz AS ts
      FROM (
        SELECT 'seed-act-' || v_key || '-' || t.type || '-' || to_char(dd.day, 'YYYYMMDD') || '-' || t.slot AS id,
               dd.day, dd.age, t.type, t.slot, t.skip
        FROM (SELECT g::date AS day, g::date - v_birth AS age
              FROM generate_series(v_start::timestamp, v_today::timestamp, interval '1 day') AS g) AS dd
        CROSS JOIN LATERAL (
          -- pee every 2 h under 12 weeks, 2.5 h under 20 weeks, 3 h under 1 year, 4.5 h after; under 20 weeks a night
          -- pee at 04:05-04:55, after the app's 04:00 day cutoff (one before 02:00 is read as bedtime, predictions.ts)
          SELECT 'pee' AS type, slot, CASE WHEN slot < 420 THEN 0.3 ELSE 0.08 END AS skip
          FROM unnest(ARRAY(SELECT generate_series(420, 1350, CASE WHEN dd.age < 84 THEN 120 WHEN dd.age < 140 THEN 150
                                                                    WHEN dd.age < 365 THEN 180 ELSE 270 END))
                      || CASE WHEN dd.age < 140 THEN ARRAY[270] ELSE ARRAY[]::int[] END) AS slot
          UNION ALL
          -- poop 4 a day under 12 weeks, 3 under 6 months, then 2 (3 on some days)
          SELECT 'poop', slot, CASE WHEN slot = 870 THEN 0.65 ELSE 0.05 END
          FROM unnest(CASE WHEN dd.age < 84 THEN ARRAY[450, 750, 1050, 1290] WHEN dd.age < 183 THEN ARRAY[460, 800, 1230]
                           ELSE ARRAY[470, 870, 1170] END) AS slot
          UNION ALL
          -- meals spread from 07:00 to 19:00
          SELECT 'food', slot, 0.02
          FROM unnest(CASE WHEN d.meals = 1 THEN ARRAY[480]
                           ELSE ARRAY(SELECT 420 + k * 720 / (d.meals - 1) FROM generate_series(0, d.meals - 1) AS k) END) AS slot
          UNION ALL
          SELECT 'weight', 600, 0 WHERE (v_today - dd.day + d.weigh_day) % 7 = 0  -- weekly weigh-in
          UNION ALL
          SELECT 'medication', 540, 0.93                                           -- now and then
        ) AS t
      ) AS ev
      CROSS JOIN LATERAL (
        SELECT ('x' || substr(h, 1, 6))::bit(24)::int / 16777216.0 AS r0,
               ('x' || substr(h, 7, 6))::bit(24)::int / 16777216.0 AS r1,
               ('x' || substr(h, 13, 6))::bit(24)::int / 16777216.0 AS r2,
               ('x' || substr(h, 19, 6))::bit(24)::int / 16777216.0 AS r3,
               ('x' || substr(h, 25, 6))::bit(24)::int / 16777216.0 AS r4
        FROM md5(ev.id) AS h
      ) AS j
    ) AS e
    WHERE e.r0 >= e.skip AND e.ts <= now();

    -- A vaccine given in the logged window comes with its weigh-in: 12:00 Paris, notes = vaccine name (the vet badge)
    INSERT INTO activities (id, household_id, puppy_id, type, timestamp, logged_by, weight_kg, notes)
    SELECT 'seed-act-' || v_key || '-vet-' || hr.date, d.household_id, d.id, 'weight',
           least((hr.date + time '12:00') AT TIME ZONE v_tz, now()), d.loggers[1],
           round(d.adult_kg * exp(-4.32 * exp(-0.0146 * (hr.date - v_birth))), 2), hr.name
    FROM health_records AS hr
    WHERE hr.puppy_id = d.id AND hr.type = 'vaccination' AND hr.name NOT LIKE 'Rage%' AND hr.date >= v_start;
  END LOOP;

  -- Rocky's newest poop is a diarrhoea, so the preview shows the poop card's 12 h alert (he poops 4 times a
  -- day, so that poop is almost always under 12 h old); the 2 % random ones above only fill the history
  UPDATE activities SET stool_consistency = 'diarrhea'
  WHERE id = (SELECT id FROM activities WHERE puppy_id = 'seed-dog-rocky' AND type = 'poop' ORDER BY timestamp DESC LIMIT 1);

  RAISE NOTICE 'preview-seed on %: % households, % users, % badges, % dogs, % logs, % health records', v_branch,
    (SELECT count(*) FROM households WHERE id LIKE 'seed-%'), (SELECT count(*) FROM users WHERE id LIKE 'seed-%'),
    (SELECT count(*) FROM caretakers WHERE id LIKE 'seed-%'), (SELECT count(*) FROM puppies WHERE id LIKE 'seed-%'),
    (SELECT count(*) FROM activities WHERE id LIKE 'seed-%'), (SELECT count(*) FROM health_records WHERE id LIKE 'seed-%');
END $$;
