-- Eisenhower matrix: whether a task is important and whether it is urgent (1 or 0).
-- NULL in both means the task hasn't been placed in the matrix yet.
ALTER TABLE task ADD COLUMN important INTEGER;
ALTER TABLE task ADD COLUMN urgent INTEGER;
