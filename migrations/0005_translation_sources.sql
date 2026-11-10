ALTER TABLE question_translations
ADD COLUMN question_text_source TEXT NOT NULL DEFAULT 'manual'
CHECK(question_text_source IN ('manual', 'machine'));

ALTER TABLE question_translations
ADD COLUMN explanation_source TEXT NOT NULL DEFAULT 'manual'
CHECK(explanation_source IN ('manual', 'machine'));

ALTER TABLE option_translations
ADD COLUMN translation_source TEXT NOT NULL DEFAULT 'manual'
CHECK(translation_source IN ('manual', 'machine'));
