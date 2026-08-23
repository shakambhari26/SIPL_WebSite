-- Form submissions now go through the submit-form Edge Function (which
-- verifies a Cloudflare Turnstile token before writing, using the service
-- role key that bypasses RLS). Direct anon/authenticated INSERT policies on
-- these tables are no longer needed and would let a bot skip CAPTCHA
-- verification entirely by calling the Supabase REST API directly, so drop
-- every INSERT policy on them regardless of its name.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('newsletter_subscribers', 'callback_requests', 'detailed_enquiries')
      and cmd = 'INSERT'
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;
