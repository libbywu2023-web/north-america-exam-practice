-- Every country gets one National region (code ALL), including countries
-- created later through the admin API. Idempotent for existing countries.
CREATE TRIGGER IF NOT EXISTS countries_auto_national_region
AFTER INSERT ON countries
BEGIN
  INSERT OR IGNORE INTO regions (country_id, code, name)
  VALUES (NEW.id, 'ALL', 'National');

  INSERT OR IGNORE INTO region_translations (region_id, language_code, name)
  SELECT r.id, l.code,
    CASE l.code
      WHEN 'zh-CN' THEN '全国'
      WHEN 'zh-TW' THEN '全國'
      ELSE 'National'
    END
  FROM regions r CROSS JOIN languages l
  WHERE r.country_id = NEW.id AND r.code = 'ALL'
    AND l.code IN ('en', 'zh-CN', 'zh-TW');
END;

-- Backfill all countries already in the database, not only CA and US.
INSERT OR IGNORE INTO regions (country_id, code, name)
SELECT c.id, 'ALL', 'National' FROM countries c;

INSERT OR IGNORE INTO region_translations (region_id, language_code, name)
SELECT r.id, l.code,
  CASE l.code
    WHEN 'zh-CN' THEN '全国'
    WHEN 'zh-TW' THEN '全國'
    ELSE 'National'
  END
FROM regions r CROSS JOIN languages l
WHERE r.code = 'ALL' AND l.code IN ('en', 'zh-CN', 'zh-TW');
