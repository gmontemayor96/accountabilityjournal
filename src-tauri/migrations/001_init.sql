-- Identity habit tracker: initial schema. See the product and architecture spec.
CREATE TABLE habit (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  identity    TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL,
  type        TEXT NOT NULL,            -- check | count | duration | scale
  target      REAL,                     -- null for check and scale
  unit        TEXT NOT NULL DEFAULT '',
  schedule    TEXT NOT NULL,            -- JSON: {"kind":"daily"} | {"kind":"weekdays","days":[1,3]} | {"kind":"perWeek","n":3}
  sort_order  INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE habit_field (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  kind       TEXT NOT NULL,             -- text | number
  sort_order INTEGER NOT NULL
);

CREATE TABLE habit_entry (
  habit_id  TEXT NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,              -- YYYY-MM-DD, local calendar date
  value     REAL,                       -- 1 for check, a count, minutes, or 1-5
  note      TEXT NOT NULL DEFAULT '',
  fields    TEXT NOT NULL DEFAULT '{}', -- JSON {field_id: value}
  logged_at TEXT NOT NULL,
  PRIMARY KEY (habit_id, date)
);
CREATE INDEX habit_entry_date ON habit_entry(date);

CREATE TABLE day (
  date    TEXT PRIMARY KEY,
  journal TEXT NOT NULL DEFAULT '',
  mood    INTEGER                       -- 0 (rough) to 4 (great)
);

CREATE TABLE tag (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL
);

CREATE TABLE habit_tag (
  habit_id TEXT NOT NULL REFERENCES habit(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (habit_id, tag_id)
);

CREATE TABLE day_tag (
  date   TEXT NOT NULL,
  tag_id TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (date, tag_id)
);
