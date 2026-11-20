-- Tracks substantive published question changes, not edits to exam metadata.
ALTER TABLE exams ADD COLUMN content_updated_at TEXT;

-- Existing published content: initialize using its newest question creation date.
UPDATE exams SET content_updated_at = (
  SELECT MAX(q.created_at) FROM questions q
  WHERE q.exam_id=exams.id AND q.status='published'
);

CREATE TRIGGER IF NOT EXISTS exam_content_question_insert
AFTER INSERT ON questions WHEN NEW.status='published'
BEGIN
  UPDATE exams SET content_updated_at=CURRENT_TIMESTAMP WHERE id=NEW.exam_id;
END;

CREATE TRIGGER IF NOT EXISTS exam_content_question_update
AFTER UPDATE OF status, difficulty, topic_id ON questions
WHEN NEW.status='published' OR OLD.status='published'
BEGIN
  UPDATE exams SET content_updated_at=CURRENT_TIMESTAMP WHERE id=NEW.exam_id;
END;

CREATE TRIGGER IF NOT EXISTS exam_content_translation_insert
AFTER INSERT ON question_translations
WHEN EXISTS (SELECT 1 FROM questions WHERE id=NEW.question_id AND status='published')
BEGIN
  UPDATE exams SET content_updated_at=CURRENT_TIMESTAMP
  WHERE id=(SELECT exam_id FROM questions WHERE id=NEW.question_id);
END;

CREATE TRIGGER IF NOT EXISTS exam_content_translation_update
AFTER UPDATE OF question_text, explanation ON question_translations
WHEN EXISTS (SELECT 1 FROM questions WHERE id=NEW.question_id AND status='published')
BEGIN
  UPDATE exams SET content_updated_at=CURRENT_TIMESTAMP
  WHERE id=(SELECT exam_id FROM questions WHERE id=NEW.question_id);
END;

CREATE TRIGGER IF NOT EXISTS exam_content_question_delete
AFTER DELETE ON questions WHEN OLD.status='published'
BEGIN
  UPDATE exams SET content_updated_at=CURRENT_TIMESTAMP WHERE id=OLD.exam_id;
END;
