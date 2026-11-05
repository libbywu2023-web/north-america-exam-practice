-- Add support for standard topics and one mixed-practice topic per exam.

ALTER TABLE topics
ADD COLUMN topic_type TEXT NOT NULL DEFAULT 'standard'
CHECK (topic_type IN ('standard', 'mixed'));

ALTER TABLE topics
ADD COLUMN selection_mode TEXT NOT NULL DEFAULT 'all'
CHECK (selection_mode IN ('all', 'random'));

ALTER TABLE topics
ADD COLUMN random_question_count INTEGER
CHECK (
  random_question_count IS NULL
  OR random_question_count > 0
);

-- Each exam can have at most one mixed-practice topic.
CREATE UNIQUE INDEX idx_topics_one_mixed_per_exam
ON topics (exam_id)
WHERE topic_type = 'mixed';
