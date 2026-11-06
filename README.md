# Classroom Survey

A mobile-friendly classroom polling app. Instructors create and activate surveys, students respond from a QR-code link, and instructors review/export aggregate results.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment variables, the app runs in local demo mode and persists data in browser local storage. The demo login accepts any email and a password of at least four characters.

## Supabase setup

1. Create a Supabase project and run `supabase/migrations/001_initial.sql` in the SQL Editor.
2. Create an instructor account in Supabase Auth.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the deployment environment.
4. When the environment variables are present, the login page automatically uses `supabase.auth.signInWithPassword`; without them it stays in local demo mode.

The migration provides foreign keys, one-active-survey enforcement, RLS, and atomic RPCs for activation and anonymous submission. Never expose a Supabase service-role key in the browser.

## Deploy with Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name classroom-survey
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Cloudflare Pages before production builds. The `public/_redirects` file keeps client-side routes working on refresh.
