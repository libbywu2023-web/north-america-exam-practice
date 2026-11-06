-- Store up to 8 images for each question.
CREATE TABLE question_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL
    REFERENCES questions(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(question_id, sort_order)
);

CREATE INDEX idx_question_images_question
ON question_images(question_id, sort_order);

-- Enforce a maximum of 8 images per question.
CREATE TRIGGER question_images_max_8_insert
BEFORE INSERT ON question_images
WHEN (
  SELECT COUNT(*)
  FROM question_images
  WHERE question_id = NEW.question_id
) >= 8
BEGIN
  SELECT RAISE(ABORT, 'A question can have at most 8 images.');
END;

CREATE TRIGGER question_images_max_8_update
BEFORE UPDATE OF question_id ON question_images
WHEN NEW.question_id != OLD.question_id
AND (
  SELECT COUNT(*)
  FROM question_images
  WHERE question_id = NEW.question_id
) >= 8
BEGIN
  SELECT RAISE(ABORT, 'A question can have at most 8 images.');
END;
