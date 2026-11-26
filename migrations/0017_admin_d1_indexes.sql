-- Index admin question lookups and reference checks.
CREATE INDEX IF NOT EXISTS idx_attempt_questions_question_id
ON attempt_questions(question_id);

CREATE INDEX IF NOT EXISTS idx_attempt_questions_selected_option_id
ON attempt_questions(selected_option_id);

CREATE INDEX IF NOT EXISTS idx_questions_staging_published_question_id
ON questions_staging(published_question_id);

CREATE INDEX IF NOT EXISTS idx_question_images_image_url
ON question_images(image_url);
