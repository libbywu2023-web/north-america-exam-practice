CREATE INDEX IF NOT EXISTS idx_questions_staging_status_created_id
ON questions_staging(status, created_at DESC, id DESC);
