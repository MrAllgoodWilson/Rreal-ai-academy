-- Migration 0011: atomic, ordered Stripe subscription mirror + retryable webhook ledger + server-side checkout bindings.
--
-- Safe to re-run (idempotent DDL, create-or-replace functions). Apply only after 0001..0010.
-- Rollback notes: see docs/FOUNDERS_MIGRATIONS.md (drop functions, drop checkout_bindings, drop added columns).
--
-- Design:
--  * ONE statement (INSERT .. ON CONFLICT DO UPDATE .. WHERE) decides insert-vs-update-vs-stale, so first-insert races
--    and existing-row races are both serialized by the unique index on stripe_subscription_id. No SELECT-then-write.
--  * 'canceled' is terminal: once stored it is never replaced by a non-canceled status; a canceled event always wins
--    over a non-canceled row regardless of clock; otherwise strictly-newer wins and ties resolve by status priority.
--  * A subscription row is bound to one account forever: an event for the same subscription id but a different user
--    never rewrites user_id (reported as binding_mismatch).
--  * A missing/invalid event timestamp is an error (it can neither reset the clock nor admit access).

alter table public.subscriptions
  add column if not exists last_event_created bigint;

-- Existing rows (e.g. the legacy $1 subscriber) get a clock from their last write so an older replay cannot regress them.
update public.subscriptions
   set last_event_created = floor(extract(epoch from updated_at))::bigint
 where last_event_created is null
   and stripe_subscription_id is not null;

create or replace function public.subscription_status_priority(p_status text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_status
    when 'canceled' then 5
    when 'unpaid' then 4
    when 'past_due' then 3
    when 'incomplete_expired' then 2
    when 'active' then 1
    when 'trialing' then 1
    else 0
  end;
$$;

-- Older 9-argument version from the unreleased draft of this migration (never applied to production).
drop function if exists public.upsert_subscription_ordered(text, uuid, text, text, text, timestamptz, boolean, bigint, timestamptz);

create or replace function public.upsert_subscription_ordered(
  p_sub_id text,
  p_user_id uuid,
  p_customer_id text,
  p_status text,
  p_plan text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_existing record;
begin
  if p_sub_id is null or length(p_sub_id) = 0 then
    raise exception 'upsert_subscription_ordered: subscription id is required' using errcode = '22023';
  end if;
  if p_user_id is null then
    raise exception 'upsert_subscription_ordered: user id is required' using errcode = '22023';
  end if;
  if p_event_created is null or p_event_created <= 0 then
    raise exception 'upsert_subscription_ordered: a positive event timestamp is required' using errcode = '22023';
  end if;

  insert into public.subscriptions as s (
    user_id, stripe_customer_id, stripe_subscription_id, status, plan,
    current_period_end, cancel_at_period_end, last_event_created, updated_at
  )
  values (
    p_user_id, p_customer_id, p_sub_id, p_status, coalesce(p_plan, 'monthly'),
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_event_created, now()
  )
  on conflict (stripe_subscription_id) do update set
    stripe_customer_id   = coalesce(excluded.stripe_customer_id, s.stripe_customer_id),
    status               = excluded.status,
    plan                 = coalesce(excluded.plan, s.plan),
    current_period_end   = coalesce(excluded.current_period_end, s.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_event_created   = greatest(excluded.last_event_created, coalesce(s.last_event_created, 0)),
    updated_at           = now()
  where s.user_id = excluded.user_id
    and (s.status <> 'canceled' or excluded.status = 'canceled')
    and (
      (excluded.status = 'canceled' and s.status <> 'canceled')
      or excluded.last_event_created > coalesce(s.last_event_created, 0)
      or (
        excluded.last_event_created = coalesce(s.last_event_created, 0)
        and public.subscription_status_priority(excluded.status) >= public.subscription_status_priority(s.status)
      )
    )
  returning s.id, s.status, s.last_event_created into v_row;

  if found then
    return jsonb_build_object('updated', true, 'id', v_row.id, 'status', v_row.status,
                              'last_event_created', v_row.last_event_created);
  end if;

  -- Not written: the conflicting row is locked by the statement above until this transaction ends.
  select user_id, status, last_event_created into v_existing
    from public.subscriptions where stripe_subscription_id = p_sub_id;

  if not found then
    raise exception 'upsert_subscription_ordered: no row written and none found for %', p_sub_id;
  end if;

  return jsonb_build_object(
    'updated', false,
    'status', v_existing.status,
    'last_event_created', v_existing.last_event_created,
    'reason', case when v_existing.user_id <> p_user_id then 'binding_mismatch' else 'stale_event_ignored' end
  );
end;
$$;

-- ───────────────────────── Retryable webhook ledger ─────────────────────────
-- An event is 'processing' until every entitlement effect has been applied, then 'processed'.
-- A crash or error leaves it 'processing', so the provider retry re-runs the (idempotent) effects.
-- Rows that existed before this migration were only ever kept on success, so they default to 'processed'.
alter table public.webhook_events
  add column if not exists status text not null default 'processed',
  add column if not exists attempts integer not null default 1,
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'webhook_events_status_check') then
    alter table public.webhook_events
      add constraint webhook_events_status_check check (status in ('processing', 'processed'));
  end if;
end $$;

create or replace function public.claim_webhook_event(p_id text, p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  if p_id is null or length(p_id) = 0 then
    raise exception 'claim_webhook_event: event id is required' using errcode = '22023';
  end if;
  insert into public.webhook_events as w (id, type, status, attempts)
  values (p_id, coalesce(p_type, 'unknown'), 'processing', 1)
  on conflict (id) do update set attempts = w.attempts + 1
  where w.status <> 'processed'
  returning w.attempts into v_attempts;

  if not found then
    return 'duplicate';
  end if;
  return case when v_attempts = 1 then 'new' else 'retry' end;
end;
$$;

create or replace function public.complete_webhook_event(p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.webhook_events
     set status = 'processed', processed_at = now(), last_error = null
   where id = p_id;
  if not found then
    raise exception 'complete_webhook_event: event % was never claimed', p_id;
  end if;
  return true;
end;
$$;

create or replace function public.fail_webhook_event(p_id text, p_error text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.webhook_events
     set last_error = left(coalesce(p_error, 'unknown'), 500)
   where id = p_id and status <> 'processed'
  returning true;
$$;

-- ───────────────────────── Server-side checkout bindings ─────────────────────────
-- Written by the authenticated checkout route when it creates a Checkout Session. The webhook resolves the account
-- for a subscription ONLY through this table (or an existing subscriptions row) - never from event metadata or email.
create table if not exists public.checkout_bindings (
  session_id             text primary key,
  user_id                uuid not null references public.profiles(id) on delete cascade,
  company                text not null default 'rreal',
  kind                   text not null check (kind in ('legacy_monthly', 'founders')),
  price_id               text not null,
  livemode               boolean not null,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  created_at             timestamptz not null default now(),
  bound_at               timestamptz
);
create index if not exists checkout_bindings_user_idx on public.checkout_bindings(user_id);
alter table public.checkout_bindings enable row level security;
-- No policies: service role only.

-- Binds the subscription created by a Checkout Session to the account that opened that session.
-- Returns {bound:false} when the session is unknown, belongs to another account, is in the other mode,
-- or is already bound to a different subscription.
create or replace function public.bind_checkout_subscription(
  p_session_id text,
  p_user_id uuid,
  p_sub_id text,
  p_customer_id text,
  p_livemode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if p_session_id is null or p_user_id is null or p_sub_id is null or p_livemode is null then
    raise exception 'bind_checkout_subscription: session, user, subscription and mode are required' using errcode = '22023';
  end if;
  update public.checkout_bindings b
     set stripe_subscription_id = p_sub_id,
         stripe_customer_id = coalesce(p_customer_id, b.stripe_customer_id),
         bound_at = coalesce(b.bound_at, now())
   where b.session_id = p_session_id
     and b.user_id = p_user_id
     and b.livemode = p_livemode
     and (b.stripe_subscription_id is null or b.stripe_subscription_id = p_sub_id)
  returning b.kind, b.price_id, b.company, b.user_id into v;
  if not found then
    -- 'unknown_session' = we never recorded this session; 'mismatch' = recorded, but for another account/mode/subscription.
    return jsonb_build_object('bound', false, 'reason',
      case when exists (select 1 from public.checkout_bindings where session_id = p_session_id)
           then 'mismatch' else 'unknown_session' end);
  end if;
  return jsonb_build_object('bound', true, 'kind', v.kind, 'price_id', v.price_id,
                            'company', v.company, 'user_id', v.user_id);
end;
$$;

-- Lock the new functions down: callable by the service role only.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.upsert_subscription_ordered(text, uuid, text, text, text, timestamptz, boolean, bigint)',
    'public.claim_webhook_event(text, text)',
    'public.complete_webhook_event(text)',
    'public.fail_webhook_event(text, text)',
    'public.bind_checkout_subscription(text, uuid, text, text, boolean)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- Resolves the account a subscription belongs to from SERVER-PERSISTED state only:
-- the checkout binding written by our authenticated checkout route, else an existing mirror row.
-- Never consults event metadata, e-mail or customer-id similarity. Returns null when unknown.
create or replace function public.resolve_subscription_account(p_sub_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b record;
  s record;
begin
  if p_sub_id is null or length(p_sub_id) = 0 then
    return null;
  end if;
  select user_id, kind, price_id, company, livemode into b
    from public.checkout_bindings where stripe_subscription_id = p_sub_id;
  if found then
    return jsonb_build_object('user_id', b.user_id, 'kind', b.kind, 'price_id', b.price_id,
                              'company', b.company, 'livemode', b.livemode, 'source', 'checkout_binding');
  end if;
  select user_id into s from public.subscriptions where stripe_subscription_id = p_sub_id;
  if found then
    return jsonb_build_object('user_id', s.user_id, 'kind', 'legacy_monthly', 'source', 'subscription_row');
  end if;
  return null;
end;
$$;

do $$
begin
  revoke all on function public.resolve_subscription_account(text) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.resolve_subscription_account(text) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.resolve_subscription_account(text) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.resolve_subscription_account(text) to service_role;
  end if;
end $$;
