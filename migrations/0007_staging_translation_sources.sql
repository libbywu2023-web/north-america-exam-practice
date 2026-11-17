ALTER TABLE question_translations_staging
ADD COLUMN translation_source TEXT NOT NULL DEFAULT 'manual'
CHECK(translation_source IN ('manual', 'machine'));

ALTER TABLE option_translations_staging
ADD COLUMN translation_source TEXT NOT NULL DEFAULT 'manual'
CHECK(translation_source IN ('manual', 'machine'));
