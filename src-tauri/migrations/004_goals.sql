-- Life areas, goals in timescale buckets, and the goal a task moves forward.
-- No foreign keys: records arrive from other devices in any order, and the app tidies links itself.
CREATE TABLE area (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE goal (
  id         TEXT PRIMARY KEY,
  area_id    TEXT NOT NULL,
  parent_id  TEXT,             -- a longer-horizon goal in the same area
  title      TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  horizon    TEXT NOT NULL,    -- day, week, month, year, 5y, 10y
  done_at    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX goal_area ON goal(area_id);

ALTER TABLE task ADD COLUMN goal_id TEXT;
