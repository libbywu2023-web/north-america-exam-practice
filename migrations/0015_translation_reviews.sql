-- New languages require explicit review; existing public languages are grandfathered.
ALTER TABLE languages ADD COLUMN review_required INTEGER NOT NULL DEFAULT 0 CHECK(review_required IN (0,1));
UPDATE languages SET review_required = 1 WHERE code = 'fr';

CREATE TABLE translation_reviews (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES languages(code),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('title','topic','question','option')),
  entity_id INTEGER NOT NULL,
  reviewed_text TEXT NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(exam_id, language_code, entity_type, entity_id)
);
CREATE INDEX idx_translation_reviews_exam_lang ON translation_reviews(exam_id, language_code);
