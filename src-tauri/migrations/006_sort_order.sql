-- Order set by dragging on the Tasks and Goals screens. Rows that tie keep their old order.
ALTER TABLE task ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE goal ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
