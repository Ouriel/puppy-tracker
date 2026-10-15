-- 0002_legacy_weight_columns: two legacy weight columns stop holding made-up or duplicate values (backlog item 19, owner decision 2026-10-15).
-- puppies.weight_kg becomes nullable: a new dog stores no weight instead of a made-up 4.5 kg. Nothing reads it (a dog's
--   weight is its weight events); older dogs keep their value. The column has no default to drop (checked on production 2026-10-15).
-- health_records.weight_at_time is emptied only where a weight event holds the same weight (same household, dog, Paris day
--   and weight; the Phase 5c data migration made one for each). The new API no longer writes it and nothing reads it, but the
--   API before this change and builds before Phase 5c still write it, with no weight event: such a weight is left as it is.
--   The column stays in src/db/schema.ts; dropping it would be its own migration.
-- Run it on production before merging the code: until then, creating a dog fails (the code inserts no weight_kg).
--   A second run is safe: it only empties weights a weight event holds.
-- Count check: every table count unchanged; after the run, and again after the deploy (from then on nothing writes the column),
--   SELECT COUNT(*) FROM health_records WHERE weight_at_time IS NOT NULL; is 0. Any other count is a weight that exists only
--   there: show those records to the owner, do not empty them by hand.
-- Rollback: roll the code back first (the old code writes weight_kg on every new dog), then
--   UPDATE puppies SET weight_kg = 4.5 WHERE weight_kg IS NULL;  -- the old made-up value, or a real one per dog
--   ALTER TABLE puppies ALTER COLUMN weight_kg SET NOT NULL;
--   The emptied weight_at_time values have no SQL rollback: they live on as weight events, and in the backup branch (backup-before-0002).
-- Applied to preview: 2026-10-15
-- Applied to production: 2026-10-15 (backup branch backup-before-legacy-weights-2026-10-15; after: 0 weight_at_time left, 8 records, 11 weight events)

ALTER TABLE puppies ALTER COLUMN weight_kg DROP NOT NULL;
UPDATE health_records hr SET weight_at_time = NULL
WHERE hr.weight_at_time IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM activities a
    WHERE a.type = 'weight' AND a.household_id = hr.household_id AND a.puppy_id = hr.puppy_id
      AND (a.timestamp AT TIME ZONE 'Europe/Paris')::date = hr.date AND a.weight_kg = hr.weight_at_time
  );
