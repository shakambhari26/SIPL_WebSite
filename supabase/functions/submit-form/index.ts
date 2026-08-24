// Verifies a Cloudflare Turnstile token, then inserts a row into one of the
// site's form tables. Called by js/supabase-client.js instead of inserting
// directly from the browser, so a script hitting the Supabase REST API
// straight can't skip CAPTCHA verification the way a client-side-only check
// could be bypassed.
//
// Required secrets (set via `supabase secrets set`):
//   TURNSTILE_SECRET_KEY  — from the Cloudflare Turnstile dashboard
// Optional secrets:
//   ALLOWED_HOSTNAMES     — comma-separated hostnames Turnstile solves are
//                           accepted from (default below). Add "localhost"
//                           here temporarily while testing locally, then
//                           remove it again before going live.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase Edge Runtime and don't need to be set manually.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_TABLES: Record<string, string[]> = {
  newsletter_subscribers: ['email'],
  callback_requests: ['name', 'phone'],
  detailed_enquiries: ['name', 'email', 'specification'],
};

// Per-column length caps, applied after stripping HTML — keeps anything
// that later gets rendered somewhere (an admin view, a notification email)
// from being able to carry markup/script content, and keeps junk payloads
// from writing huge rows.
const FIELD_LIMITS: Record<string, number> = {
  email: 320,
  name: 200,
  phone: 30,
  specification: 5000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value: unknown, maxLength: number): string {
  const str = typeof value === 'string' ? value : '';
  return str
    .replace(/<[^>]*>/g, '') // strip HTML tags so nothing stored can render as markup later
    .trim()
    .slice(0, maxLength);
}

// Cloudflare reports the hostname a Turnstile token was actually solved on
// as part of its own verification — the caller can't spoof this the way a
// plain Origin/Referer header could be, so it's the authoritative check that
// the submission really came from our site.
const ALLOWED_HOSTNAMES = (Deno.env.get('ALLOWED_HOSTNAMES') || 'shakambharigroup.in')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// CORS origins are derived from the same hostname list so local testing
// (ALLOWED_HOSTNAMES including "localhost"/"127.0.0.1") just works without a
// separate setting to keep in sync. Compared by hostname only (ignoring
// port) since local dev servers run on arbitrary ports.
const DEFAULT_ORIGIN = (() => {
  const h = ALLOWED_HOSTNAMES[0];
  const scheme = h === 'localhost' || h === '127.0.0.1' ? 'http' : 'https';
  return scheme + '://' + h;
})();

function corsHeadersFor(req: Request) {
  const origin = req.headers.get('origin') || '';
  let allowOrigin = DEFAULT_ORIGIN;
  try {
    if (ALLOWED_HOSTNAMES.includes(new URL(origin).hostname)) {
      allowOrigin = origin;
    }
  } catch {
    // no/invalid Origin header — keep the default
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeadersFor(req);
  function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let body: { table?: string; payload?: Record<string, unknown>; token?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const { table, payload, token } = body;

  const allowedColumns = table ? ALLOWED_TABLES[table] : undefined;
  if (!table || !allowedColumns) {
    return jsonResponse({ error: 'Unknown table.' }, 400);
  }
  if (!token || typeof token !== 'string') {
    return jsonResponse({ error: 'Missing verification token.' }, 400);
  }

  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secretKey) {
    console.error('[submit-form] TURNSTILE_SECRET_KEY is not set.');
    return jsonResponse({ error: 'Server misconfiguration.' }, 500);
  }

  const remoteIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '';

  let verified = false;
  let hostname = '';
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: remoteIp }),
    });
    const verifyData = await verifyRes.json();
    verified = verifyData.success === true;
    hostname = typeof verifyData.hostname === 'string' ? verifyData.hostname : '';
  } catch (err) {
    console.error('[submit-form] Turnstile verification request failed:', err);
    return jsonResponse({ error: 'Verification service unavailable.' }, 502);
  }

  if (!verified) {
    return jsonResponse({ error: 'Verification failed. Please try again.' }, 403);
  }
  if (!ALLOWED_HOSTNAMES.includes(hostname)) {
    console.error('[submit-form] rejected submission solved on unexpected hostname:', hostname);
    return jsonResponse({ error: 'Verification failed. Please try again.' }, 403);
  }

  // Only copy allowlisted columns onto the row, and sanitize each value —
  // the client payload is untrusted, so this keeps it from writing
  // arbitrary columns, oversized values, or HTML/script content.
  const row: Record<string, unknown> = {};
  for (const col of allowedColumns) {
    if (payload && typeof payload === 'object' && col in payload) {
      row[col] = sanitizeText(payload[col], FIELD_LIMITS[col] || 1000);
    }
  }

  if (typeof row.email === 'string' && row.email && !EMAIL_PATTERN.test(row.email)) {
    return jsonResponse({ error: 'Please provide a valid email address.' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await supabase.from(table).insert([row]);
  if (error) {
    console.error('[submit-form] insert into "' + table + '" failed:', error);
    return jsonResponse({ error: 'Could not save your submission.' }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
