-- Idempotent category normalization. Preserve existing category IDs and exam links.
INSERT INTO exam_categories (slug, name)
SELECT 'driving', 'Driving Tests'
WHERE NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'driving')
  AND NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'car-driving');

UPDATE exam_categories SET slug = 'driving', name = 'Driving Tests'
WHERE slug = 'car-driving'
  AND NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'driving');
UPDATE exam_categories SET name = 'Driving Tests' WHERE slug = 'driving';

-- Consolidate legacy motorcycle/truck categories into the driving category.
UPDATE exams SET category_id = (SELECT id FROM exam_categories WHERE slug = 'driving')
WHERE category_id IN (SELECT id FROM exam_categories WHERE slug IN ('motorcycle', 'truck-driving'))
  AND EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'driving');
DELETE FROM exam_categories WHERE slug IN ('motorcycle', 'truck-driving')
  AND NOT EXISTS (SELECT 1 FROM exams WHERE category_id = exam_categories.id);

INSERT INTO exam_categories (slug, name)
SELECT 'immigration-citizenship', 'Immigration & Citizenship'
WHERE NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'immigration-citizenship');
INSERT INTO exam_categories (slug, name)
SELECT 'professional-certification', 'Professional Certification'
WHERE NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'professional-certification');
INSERT INTO exam_categories (slug, name)
SELECT 'other', 'Other Exams'
WHERE NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug = 'other');

INSERT OR IGNORE INTO exam_category_translations (category_id, language_code, name)
SELECT c.id, l.code, '' FROM exam_categories c CROSS JOIN languages l
WHERE c.slug IN ('driving','immigration-citizenship','professional-certification','other')
  AND l.code IN ('en','zh-CN','zh-TW');
UPDATE exam_category_translations
SET name = CASE (SELECT slug FROM exam_categories WHERE id = category_id)
  WHEN 'driving' THEN CASE language_code WHEN 'zh-CN' THEN '驾驶考试' WHEN 'zh-TW' THEN '駕駛考試' ELSE 'Driving Tests' END
  WHEN 'immigration-citizenship' THEN CASE language_code WHEN 'zh-CN' THEN '移民与入籍' WHEN 'zh-TW' THEN '移民與入籍' ELSE 'Immigration & Citizenship' END
  WHEN 'professional-certification' THEN CASE language_code WHEN 'zh-CN' THEN '职业资格认证' WHEN 'zh-TW' THEN '職業資格認證' ELSE 'Professional Certification' END
  WHEN 'other' THEN CASE language_code WHEN 'zh-CN' THEN '其他考试' WHEN 'zh-TW' THEN '其他考試' ELSE 'Other Exams' END
END
WHERE category_id IN (SELECT id FROM exam_categories WHERE slug IN ('driving','immigration-citizenship','professional-certification','other'))
  AND language_code IN ('en','zh-CN','zh-TW');
