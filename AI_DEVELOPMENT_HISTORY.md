# AI Development History

## 1. Specification review

The AI coding agent reviewed `Classroom_Survey_Web_App_Specification.md`,
`TODO.md`, `DATABASE.md`, `API.md`, and `UI.md` before implementation. The
documents established the React/Vite frontend, Supabase/PostgreSQL backend,
anonymous student workflow, survey lifecycle, QR presentation page, results
dashboard, CSV export, RLS requirements, and deployment target.

## 2. Initial implementation

The agent created the Vite/React/TypeScript project structure, Supabase client,
typed survey models, responsive UI, survey editor, instructor dashboard,
student route, QR-code generation, results calculations, CSV export, and local
demo mode. It also created `.env.example`, Cloudflare SPA routing, and the
Supabase migration.

## 3. Database and security

The migration created the `surveys`, `questions`, `choices`, `responses`, and
`answers` tables with UUID primary keys, foreign keys, indexes, cascading
deletes, status validation, one-active-survey enforcement, RLS policies, and
the `activate_survey` and `submit_survey_response` RPC functions.

## 4. Testing and debugging

The first build exposed TypeScript nullability errors. The agent fixed these by
capturing state values after loading guards and changing the TypeScript target
to ES2021. Wrangler initially rejected the Cloudflare project name because it
contained uppercase characters; the project was redeployed as
`classroom-survey`.

Supabase login initially failed because the project URL was copied with the
`/rest/v1/` path. The URL was corrected to the base project URL. Survey
activation then exposed a PostgreSQL `gen_random_bytes` resolution issue; the
function was updated to use `extensions.gen_random_bytes`.

The save and activation UI was improved to display actual Supabase error
messages instead of generic failures. Protected instructor routes, logout,
presentation response counts, and QR downloading were added.

## 5. Deployment

The project was built with `npm run build` and deployed to Cloudflare Pages
with Wrangler. The source was pushed to GitHub. The deployed application was
tested with an instructor account, a production survey, a public student URL,
and an anonymous response submission.

## 6. Evidence

The `screenshots` directory contains application and Supabase evidence
captured during testing. Remaining assignment evidence should include the
presentation page, results page, CSV export, and stored `responses`/`answers`
rows if those screenshots are required by the instructor.
