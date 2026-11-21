-- Phase 1: exam-specific language configuration (not yet consumed by public routing).
-- A row with is_enabled=0 represents a planned/pending translation.
CREATE TABLE exam_languages (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES languages(code),
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (exam_id, language_code)
);
CREATE INDEX idx_exam_languages_public ON exam_languages(language_code, is_enabled, exam_id);

-- Seed only languages already represented by exam titles, preserving legacy metadata.
-- Public language filtering is intentionally deferred until the next phase.
INSERT INTO exam_languages (exam_id, language_code, is_enabled)
SELECT et.exam_id, et.language_code, 1
FROM exam_translations et
JOIN languages l ON l.code = et.language_code
WHERE l.is_enabled = 1 AND TRIM(et.title) <> '';
