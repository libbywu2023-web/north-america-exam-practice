-- NEW badge is explicitly controlled per exam, not by question update dates.
-- Existing exams default to no badge; administrators can enable individually.
ALTER TABLE exams ADD COLUMN show_new_badge INTEGER NOT NULL DEFAULT 0
  CHECK (show_new_badge IN (0, 1));
