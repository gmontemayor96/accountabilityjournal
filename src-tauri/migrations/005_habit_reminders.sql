-- Times of day to be reminded about a habit, as a JSON array of "HH:MM".
ALTER TABLE habit ADD COLUMN reminders TEXT NOT NULL DEFAULT '[]';
