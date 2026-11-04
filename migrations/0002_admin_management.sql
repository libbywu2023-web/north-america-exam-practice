
-- =====================================================
-- Migration 0002: Generic Admin Management Foundation
-- =====================================================

PRAGMA foreign_keys = ON;

-- 1. Supported languages
CREATE TABLE languages (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    native_name TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (is_enabled IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 2. Country translations
CREATE TABLE country_translations (
    country_id INTEGER NOT NULL
        REFERENCES countries(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL
        REFERENCES languages(code),
    name TEXT NOT NULL,
    PRIMARY KEY (country_id, language_code)
);

-- 3. Region translations
CREATE TABLE region_translations (
    region_id INTEGER NOT NULL
        REFERENCES regions(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL
        REFERENCES languages(code),
    name TEXT NOT NULL,
    PRIMARY KEY (region_id, language_code)
);

-- 4. Exam category translations
CREATE TABLE exam_category_translations (
    category_id INTEGER NOT NULL
        REFERENCES exam_categories(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL
        REFERENCES languages(code),
    name TEXT NOT NULL,
    PRIMARY KEY (category_id, language_code)
);

-- 5. Admin operation audit log
CREATE TABLE admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_audit_created
    ON admin_audit_logs(created_at DESC);

CREATE INDEX idx_admin_audit_entity
    ON admin_audit_logs(entity_type, entity_id);

-- 6. Initial supported languages
INSERT INTO languages
    (code, name, native_name, sort_order)
VALUES
    ('en', 'English', 'English', 1),
    ('zh-CN', 'Simplified Chinese', '简体中文', 2),
    ('zh-TW', 'Traditional Chinese', '繁體中文', 3);

-- 7. Initial translations for existing records
INSERT INTO country_translations
    (country_id, language_code, name)
VALUES
    (1, 'en', 'Canada'),
    (1, 'zh-CN', '加拿大'),
    (1, 'zh-TW', '加拿大');

INSERT INTO region_translations
    (region_id, language_code, name)
VALUES
    (1, 'en', 'British Columbia'),
    (1, 'zh-CN', '不列颠哥伦比亚省'),
    (1, 'zh-TW', '卑詩省');

INSERT INTO exam_category_translations
    (category_id, language_code, name)
VALUES
    (1, 'en', 'Driving'),
    (1, 'zh-CN', '驾驶考试'),
    (1, 'zh-TW', '駕駛考試');