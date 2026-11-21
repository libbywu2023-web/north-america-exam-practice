-- Register French as a site language. Exam availability is configured separately.
INSERT INTO languages (code, name, native_name, is_enabled, sort_order)
VALUES ('fr', 'French', 'Français', 1, 4)
ON CONFLICT(code) DO NOTHING;
