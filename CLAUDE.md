This is the **Shakambhari Group** website — a static, multi-page corporate/product site for an integrated steel manufacturer (TMT bars, structural steel, sponge iron, MS billets, ferro alloys, aluminium foil), plants in Durgapur, Madandih, Rukni and Purulia (West Bengal), HQ in Kolkata.

## Stack & deployment
- Plain HTML/CSS/JS. No build step, no framework, no `package.json`.
- Hosted on Apache (GoDaddy shared hosting) at `https://shakambharigroup.in` (non-www — `.htaccess` redirects `www` → non-www, keep canonical/OG/schema tags consistent with that).
- Brand name is **"Shakambhari Group"** (with an h) — do not confuse with similar spellings.

## Structure
- `index.html` — homepage, lives at repo root.
- `assets/pages/*.html` — most other pages (careers, contact, products, quality, etc.).
- `assets/pages/steel/**` — steel product sub-site; category hub pages are real, but the deepest product pages (e.g. `steel/espl-tubes/erw-round-tubes/`) are intentional `noindex` meta-refresh stubs that redirect to an anchor on their parent hub — leave that pattern alone.
- `assets/css/`, `assets/js/`, `assets/image/` — page-specific styles/scripts/media.
- `js/supabase-client.js` — shared Supabase client (forms integration, see below).

## Conventions worth knowing before editing
- HTML files use **CRLF** line endings. If editing via a script (not the Edit tool), read/write in binary mode or you'll flip every line ending and blow up the diff.
- Script `src` paths are inconsistent by design: page-specific scripts use relative paths (`../js/...` from `assets/pages/`), but *shared* scripts used across many pages use absolute root paths (`/assets/js/loading-bar.js`, `/js/supabase-client.js`) so they resolve correctly regardless of page nesting depth.
- SEO metadata (title/description/canonical/OG/Twitter/keywords) for all real pages is centralized in `assets/js/seo-metadata-map.json` — that's the source of truth even though the actual tags are hand-injected per page (no templating layer exists).

## Forms
Newsletter, callback-request, and detailed-enquiry forms across the site submit directly to **Supabase** via `js/supabase-client.js` (tables: `newsletter_subscribers`, `callback_requests`, `detailed_enquiries`). The Careers page's job-application form (`#careerApplyForm`) is separate and still unwired (placeholder submit URL) — it doesn't map to any of those three tables.

## Not used here
No n8n, no n8n-mcp connection. (There's a separate, unrelated n8n automation project elsewhere — not this repo.)
