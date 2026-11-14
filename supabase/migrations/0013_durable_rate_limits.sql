-- Migration 0013: shared, durable fixed-window rate limits (replaces per-process memory for sign-in).
-- Keys are stored only as SHA-256 hashes computed by the server. Service role only. Safe to re-run.
-- Rollback: drop the two functions and the table (loses only short-lived counters).
create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);
alter table public.rate_limits enable row level security;
-- No policies: service role only.

-- Atomically counts one hit in the current window and reports whether the caller is still within the limit.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_key is null or length(p_key) < 16 or p_limit is null or p_limit <= 0 or p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'rate_limit_hit: invalid arguments' using errcode = '22023';
  end if;
  insert into public.rate_limits as r (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start + make_interval(secs => p_window_seconds) <= now() then 1 else r.count + 1 end,
    window_start = case when r.window_start + make_interval(secs => p_window_seconds) <= now() then now() else r.window_start end
  returning r.count into v_count;
  return v_count <= p_limit;
end;
$$;

-- Reads without counting: true while the key is still under the limit in its current window.
create or replace function public.rate_limit_ok(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select r.count < p_limit or r.window_start + make_interval(secs => p_window_seconds) <= now()
      from public.rate_limits r where r.key = p_key
  ), true);
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.rate_limit_hit(text, integer, integer)',
    'public.rate_limit_ok(text, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function %s from anon', f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on function %s from authenticated', f); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end $$;
