-- Sync support: every syncable row records when it last changed, and deletions leave a
-- tombstone so other devices learn about them. Rows that existed before this migration get
-- their creation time, or a fixed early time where none was stored.
ALTER TABLE habit ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE habit_entry ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE day ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE tag ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE habit SET updated_at = created_at;
UPDATE habit_entry SET updated_at = logged_at;
UPDATE day SET updated_at = '2000-01-01T00:00:00.000Z';
UPDATE tag SET updated_at = '2000-01-01T00:00:00.000Z';

-- kind: 'tag' (key = tag id) or 'entry' (key = habit_id|date)
CREATE TABLE tombstone (
  kind       TEXT NOT NULL,
  key        TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  PRIMARY KEY (kind, key)
);

-- Per-device settings (sync folder, device id). Never synced.
CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
