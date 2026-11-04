# North America Exam Practice — Cloudflare starter

A multi-country, multi-region, multi-exam and multilingual practice platform starter. The first populated exam is a small BC Class 7L sample set. The included questions are illustrative practice examples, not official ICBC questions and not a complete exam bank.

## Stack

- Cloudflare Workers for API logic
- Workers Static Assets for HTML/CSS/JS
- Cloudflare D1 (SQLite) for exam content and attempt records
- Vanilla JavaScript frontend; no frontend framework required

## Project setup

Requirements: Node.js 20+ and a Cloudflare account.

```bash
npm install
npx wrangler login
```

Create the D1 database:

```bash
npx wrangler d1 create exam-practice-db
```

Copy the `database_id` returned by Wrangler into `wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

Apply the schema and sample seed data to your local D1 database:

```bash
npm run db:migrate:local
```

Start local development:

```bash
npm run dev
```

Open the local URL printed by Wrangler. Test:
- `/` — exam landing page
- `/practice.html?exam=bc-class-7l&lang=en`
- `/practice.html?exam=bc-class-7l&lang=zh-CN`
- `/mock.html?exam=bc-class-7l&lang=en`
- `/api/health`

When local testing is successful, apply the migration to the remote D1 database:

```bash
npm run db:migrate:remote
```

Deploy:

```bash
npm run deploy
```

## Database design

The schema is intentionally reusable:
- countries, regions, exam_categories, exams
- exam_translations
- topics and topic_translations
- questions and question_translations
- question_options and option_translations
- exam_attempts and attempt_questions
- bookmarks

A question has one stable ID. Its English, Simplified Chinese and Traditional Chinese text are stored as translations, not duplicated question records.

## Important security model

- The question-list API does not return `is_correct`.
- Practice mode checks an answer through the Worker API and returns feedback.
- Mock mode creates an attempt on the server and scores it on submission.
- Correct answers are not sent to the browser before a mock test is submitted.

This is a learning starter, not a complete production security review. Before public launch, add rate limiting/abuse controls, stronger attempt validation, operational monitoring, backup procedures, accessibility review, and a complete privacy notice. Anonymous browser IDs are not authentication and can be reset by a visitor.

## Adding content

Add rows through reviewed SQL migrations. Keep official source URLs and review dates in the question records. Do not copy copyrighted questions, explanations, illustrations, or branding. Verify every safety/legal statement against current official BC/ICBC material before publishing.

## Analytics and ads

GA4 and AdSense are intentionally not enabled in this starter. Add GA4 after choosing a production domain and privacy/consent approach. Track meaningful events such as `question_answered`, `mock_exam_started`, and `mock_exam_completed`; do not create fake page views by forcing a page reload after each answer. Add AdSense only after approval and keep ads visually separate from answer choices and controls.

## Production checklist

- Replace the sample question bank with original, reviewed content.
- Add a real contact address and complete About/Privacy/Terms pages.
- Add consent handling appropriate to visitor locations and your analytics/advertising setup.
- Add automated tests and error monitoring.
- Review accessibility, mobile behavior, SEO metadata, canonical URLs and sitemap.
- Set up a custom domain after the platform is stable.
