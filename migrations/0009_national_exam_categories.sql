-- Nationwide exams use the existing ALL region code (one per country).
-- Safe to apply once through Wrangler D1 migrations; does not publish empty exams.
INSERT INTO regions (country_id, code, name)
SELECT c.id, 'ALL', 'National' FROM countries c
WHERE c.code IN ('CA', 'US')
AND NOT EXISTS (SELECT 1 FROM regions r WHERE r.country_id = c.id AND r.code = 'ALL');

UPDATE regions SET name = 'National' WHERE code = 'ALL' AND country_id IN
  (SELECT id FROM countries WHERE code IN ('CA', 'US'));

INSERT OR IGNORE INTO region_translations (region_id, language_code, name)
SELECT r.id, l.code,
  CASE l.code WHEN 'zh-CN' THEN '全国' WHEN 'zh-TW' THEN '全國' ELSE 'National' END
FROM regions r JOIN countries c ON c.id = r.country_id
CROSS JOIN languages l
WHERE c.code IN ('CA', 'US') AND r.code = 'ALL' AND l.code IN ('en','zh-CN','zh-TW');

INSERT INTO exam_categories (slug, name)
SELECT 'immigration-citizenship', 'Immigration & Citizenship'
WHERE NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug='immigration-citizenship');
INSERT INTO exam_categories (slug, name)
SELECT 'professional-certification', 'Professional Certification'
WHERE NOT EXISTS (SELECT 1 FROM exam_categories WHERE slug='professional-certification');

INSERT OR IGNORE INTO exam_category_translations (category_id, language_code, name)
SELECT cat.id, l.code,
 CASE cat.slug
 WHEN 'immigration-citizenship' THEN CASE l.code WHEN 'zh-CN' THEN '移民与入籍' WHEN 'zh-TW' THEN '移民與入籍' ELSE 'Immigration & Citizenship' END
 WHEN 'professional-certification' THEN CASE l.code WHEN 'zh-CN' THEN '职业资格认证' WHEN 'zh-TW' THEN '職業資格認證' ELSE 'Professional Certification' END END
FROM exam_categories cat CROSS JOIN languages l
WHERE cat.slug IN ('immigration-citizenship','professional-certification')
AND l.code IN ('en','zh-CN','zh-TW');
