
-- Migration 0006: Bulk question import and staging workflow

PRAGMA foreign_keys = ON;

-- 1. Add external question ID to production questions.
-- Existing questions keep NULL and are not affected.
ALTER TABLE questions
ADD COLUMN external_question_id TEXT;

CREATE UNIQUE INDEX idx_questions_exam_external_id
ON questions (exam_id, external_question_id);

-- 2. Import batches.
CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL
    REFERENCES exams(id) ON DELETE CASCADE,
  source_filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK(status IN ('received', 'processing', 'completed', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX idx_import_batches_exam
ON import_batches(exam_id, created_at DESC);

-- 3. Staging questions.
CREATE TABLE questions_staging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL
    REFERENCES import_batches(id) ON DELETE CASCADE,
  external_question_id TEXT NOT NULL,
  topic_id INTEGER REFERENCES topics(id),
  difficulty TEXT NOT NULL DEFAULT 'normal'
    CHECK(difficulty IN ('easy', 'normal', 'hard')),
  has_image INTEGER NOT NULL DEFAULT 0
    CHECK(has_image IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK(status IN (
      'waiting_for_image',
      'pending_review',
      'approved',
      'rejected',
      'published'
    )),
  published_question_id INTEGER
    REFERENCES questions(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(batch_id, external_question_id)
);

CREATE INDEX idx_questions_staging_batch_status
ON questions_staging(batch_id, status);

-- 4. Staging question translations.
CREATE TABLE question_translations_staging (
  staging_question_id INTEGER NOT NULL
    REFERENCES questions_staging(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(staging_question_id, language_code)
);

-- 5. Staging options.
CREATE TABLE question_options_staging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staging_question_id INTEGER NOT NULL
    REFERENCES questions_staging(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0
    CHECK(is_correct IN (0, 1)),
  UNIQUE(staging_question_id, option_key),
  UNIQUE(staging_question_id, sort_order)
);

CREATE INDEX idx_question_options_staging_question
ON question_options_staging(staging_question_id, sort_order);

-- 6. Staging option translations.
CREATE TABLE option_translations_staging (
  staging_option_id INTEGER NOT NULL
    REFERENCES question_options_staging(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  option_text TEXT NOT NULL,
  PRIMARY KEY(staging_option_id, language_code)
);

-- 7. Staging images. R2 object keys point to temporary objects.
CREATE TABLE staging_question_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staging_question_id INTEGER NOT NULL
    REFERENCES questions_staging(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staging_question_id, sort_order)
);

CREATE INDEX idx_staging_question_images_question
ON staging_question_images(staging_question_id, sort_order);

-- Enforce a maximum of 8 staging images per question.
CREATE TRIGGER staging_question_images_max_8_insert
BEFORE INSERT ON staging_question_images
WHEN (
  SELECT COUNT(*)
  FROM staging_question_images
  WHERE staging_question_id = NEW.staging_question_id
) >= 8
BEGIN
  SELECT RAISE(ABORT, 'A question can have at most 8 images.');
END;


-- Also enforce the 8-image limit when moving an image
-- from one staging question to another.
CREATE TRIGGER staging_question_images_max_8_update
BEFORE UPDATE OF staging_question_id ON staging_question_images
WHEN NEW.staging_question_id != OLD.staging_question_id
AND (
  SELECT COUNT(*)
  FROM staging_question_images
  WHERE staging_question_id = NEW.staging_question_id
) >= 8
BEGIN
  SELECT RAISE(ABORT, 'A question can have at most 8 images.');
END;



-- 8. Import errors and skipped-row records.
CREATE TABLE import_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL
    REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INTEGER,
  external_question_id TEXT,
  severity TEXT NOT NULL DEFAULT 'error'
    CHECK(severity IN ('warning', 'error')),
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_errors_batch
ON import_errors(batch_id, severity, row_number);