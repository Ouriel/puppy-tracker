-- 0001_puppies_deleted_at: restorable dog delete (backlog item 20, owner decision 2026-10-15).
-- DELETE /api/dogs sets deleted_at instead of removing the row; every read skips a dog with deleted_at set,
-- its logs and health records stay, and the owner restores it (deleted_at back to NULL).
-- Additive: a nullable column, existing dogs keep NULL (shown). No index: a household has a few dogs,
-- and idx_puppies_household already narrows every read to them.
-- Run it on production before merging the code that reads the column (the API would fail without it).
-- Rollback: roll the code back first (code that reads the column fails without it), then
--   ALTER TABLE puppies DROP COLUMN IF EXISTS deleted_at;
--   Every dog deleted meanwhile shows again: delete those rows for good first if they must stay gone.
-- Applied to preview: 2026-10-15
-- Applied to production: 2026-10-15 (backup branch backup-before-deleted-at-2026-10-15)

ALTER TABLE puppies ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
