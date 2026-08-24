# CAPTCHA / Bot Protection for Website Forms

Status: **Complete and live on the backend.** Pending: upload of these frontend
files to production hosting (shakambharigroup.in) — see "What's left" below.

## The problem

The site has three Supabase-backed forms (newsletter signup, callback
request, detailed enquiry) plus two product-page enquiry forms (ferro
alloys, aluminium foil) — seven form instances total across five pages.
Originally, each form submitted straight to a Supabase table from the
browser, using the public anon key. That has two weaknesses:

1. **No bot/spam filtering.** Any script could fill and submit the HTML
   forms automatically.
2. **The real weakness**: even a client-side CAPTCHA check alone doesn't
   stop a scripted attacker, because they don't need to load the page at
   all — they can call the Supabase REST insert endpoint directly with the
   public anon key and skip the website (and any CAPTCHA widget on it)
   entirely.

## What was built

Two layers, so bots are blocked whether they use the website or skip
straight to the API:

1. **Cloudflare Turnstile** widget added to all 7 forms — a free,
   privacy-friendly CAPTCHA (usually invisible to real users).
2. **Server-side verification.** Form submissions no longer insert into
   Supabase directly from the browser. They now call a Supabase **Edge
   Function** (`submit-form`), which:
   - Verifies the Turnstile token with Cloudflare's API before doing
     anything else.
   - Checks that the token was solved on an approved hostname
     (`shakambharigroup.in`) — this comes from Cloudflare's own
     verification response, not a client-supplied header, so it can't be
     spoofed.
   - Only then inserts the row, using a service-role key (which bypasses
     Row Level Security).
3. **Database lockdown.** The old "anyone can insert" database policies
   have been dropped (see `supabase/migrations/`). Direct inserts from the
   browser's anon key are now rejected outright — the Edge Function is the
   *only* way data reaches these tables.

## Architecture

```
Visitor's browser
   │
   │  1. Fills form, solves Turnstile widget → gets a token
   ▼
js/supabase-client.js
   │
   │  2. POSTs { table, payload, token } to the Edge Function
   ▼
Supabase Edge Function: submit-form
   │
   │  3. Verifies token + hostname with Cloudflare
   │  4. Inserts row using service-role key (bypasses RLS)
   ▼
Supabase Postgres tables
   (newsletter_subscribers / callback_requests / detailed_enquiries)
```

A direct call to Supabase's REST API from outside this flow now fails —
there is no RLS policy left that permits it.

## Files touched

| File | What changed |
|---|---|
| `js/supabase-client.js` | Forms now call the `submit-form` Edge Function instead of inserting directly; requires a solved Turnstile token before submitting. |
| `index.html`, `assets/pages/{careers,contact,ferro-alloys,aluminium-foil}.html` | Added the Turnstile `<script>` tag and a `.cf-turnstile` widget div to each of the 7 forms. |
| `assets/css/styles.css` | Small `.turnstile-widget` spacing rule. |
| `supabase/functions/submit-form/index.ts` | New Edge Function — verifies Turnstile token + hostname, then inserts via service role. |
| `supabase/migrations/20260823141421_revoke_public_form_inserts.sql` | Drops the old direct-insert RLS policies on all 3 tables. |
| `supabase/.gitignore` | Keeps the Supabase CLI's local `.temp/` cache out of git. |

## Tools & technologies used

- **Cloudflare Turnstile** — CAPTCHA widget (free tier).
- **Supabase** — existing Postgres database + new Edge Function (Deno/TypeScript runtime).
- **Supabase CLI** (`brew install supabase/tap/supabase`) — used to log in, link the project, set secrets, deploy the function, and apply the database migration.
- No new frontend dependencies — the site remains plain HTML/CSS/JS with no build step, consistent with the rest of the codebase.

## How the Edge Function decides what's allowed

`ALLOWED_TABLES` in `submit-form/index.ts` is an explicit allowlist of the
3 tables and their exact columns — anything else in the request payload is
silently dropped, so a malicious client can't write arbitrary columns or
target other tables. `ALLOWED_HOSTNAMES` (a Supabase secret, currently just
`shakambharigroup.in`) controls which domains' Turnstile solves are
accepted; CORS is derived from the same list.

## Setup that was performed (for reference / re-doing on a new project)

1. Created a Cloudflare Turnstile widget scoped to `shakambharigroup.in`, got a Site Key (public) and Secret Key (private).
2. Put the Site Key directly in the 7 forms' HTML (safe — it's meant to be public).
3. Installed the Supabase CLI, logged in (`supabase login`), linked the project (`supabase link --project-ref <ref>`).
4. Set two secrets on the Supabase project: `TURNSTILE_SECRET_KEY` and `ALLOWED_HOSTNAMES`.
5. Deployed the function: `supabase functions deploy submit-form`.
6. Applied the migration: `supabase db push`.

## Testing

Verified end-to-end using Cloudflare's official "always-pass" test keys
(`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`),
temporarily swapped into the site and Supabase secret, then swapped back
to the real production keys afterward. Confirmed via direct API calls
that:
- A direct insert to any of the 3 tables (bypassing the Edge Function) is now rejected with a Postgres RLS error (`42501`).
- The Edge Function correctly rejects an invalid/missing Turnstile token (`403`).
- A real form submission (via the widget) succeeds and the row appears in the corresponding Supabase table.

## What's left

The frontend files in this repo are **not yet uploaded to the live site**
(`shakambharigroup.in` currently serves an older, unrelated site with no
Supabase forms at all). Once a developer uploads these files to replace
the live site:

1. Test one real submission on the live domain to confirm Turnstile
   renders (it's domain-locked to `shakambharigroup.in`, so it will *not*
   work on `localhost` or any other domain).
2. No further backend steps are needed — the Edge Function, secrets, and
   database lockdown are already live and were applied ahead of the
   frontend deployment (verified to have no effect on the currently-live
   site, since it doesn't use these tables).

## Where secrets live

No secret values are stored in this repository. See
`CREDENTIALS-PRIVATE-DO-NOT-COMMIT.md` in the project root (gitignored,
kept out of version control) for a private reference of what exists and
where to find/rotate each one.
