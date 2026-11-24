CREATE TABLE exam_resources (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
 title TEXT NOT NULL, organization TEXT NOT NULL, url TEXT NOT NULL,
 language_code TEXT NOT NULL DEFAULT 'en', sort_order INTEGER NOT NULL DEFAULT 0,
 is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0,1))
);
CREATE INDEX idx_exam_resources_exam ON exam_resources(exam_id, is_published, sort_order);
