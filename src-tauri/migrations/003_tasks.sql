-- One-off tasks: optional due date and time, an optional reminder, tags, and done.
CREATE TABLE task (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  due_date   TEXT,            -- YYYY-MM-DD
  due_time   TEXT,            -- HH:MM, only with a due date
  remind_at  TEXT,            -- local YYYY-MM-DDTHH:MM
  done_at    TEXT,            -- ISO timestamp
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX task_due ON task(due_date);

CREATE TABLE task_tag (
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);
