-- Migration 0011: Subscription Event Ordering and Atomic State Machine
alter table public.subscriptions
  add column if not exists last_event_created bigint;

create index if not exists subscriptions_last_event_created_idx
  on public.subscriptions (last_event_created);

-- Priority hierarchy helper function for subscription statuses
-- Terminal 'canceled' is highest priority (5); active/trialing is 1.
create or replace function public.subscription_status_priority(p_status text)
returns integer
language sql
immutable
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

-- Atomic conditional upsert enforcing monotonic event timestamps and terminal tie semantics.
-- Guarantees that concurrent workers across separate isolates cannot race or resurrect canceled subscriptions.
create or replace function public.upsert_subscription_ordered(
  p_sub_id text,
  p_user_id uuid,
  p_customer_id text,
  p_status text,
  p_plan text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_created bigint,
  p_updated_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_existing record;
  v_is_stale boolean := false;
  v_result record;
begin
  -- Lock existing row if present for atomic read-modify-write across concurrent isolates
  select id, status, last_event_created, updated_at
    into v_existing
    from public.subscriptions
   where stripe_subscription_id = p_sub_id
     for update;

  if found and p_event_created is not null and p_event_created > 0 then
    -- 1. Strictly older event is stale
    if p_event_created < coalesce(v_existing.last_event_created, 0) then
      v_is_stale := true;
    -- 2. Tied timestamp
    elsif p_event_created = coalesce(v_existing.last_event_created, 0) then
      -- If existing is canceled and incoming is not, reject
      if v_existing.status = 'canceled' and p_status != 'canceled' then
        v_is_stale := true;
      -- If incoming is canceled and existing is not, allow (not stale)
      elsif p_status = 'canceled' and v_existing.status != 'canceled' then
        v_is_stale := false;
      -- Compare priority hierarchy: if existing has strictly higher priority, reject
      elsif public.subscription_status_priority(v_existing.status) > public.subscription_status_priority(p_status) then
        v_is_stale := true;
      end if;
    end if;
  end if;

  if v_is_stale then
    return jsonb_build_object(
      'updated', false,
      'status', v_existing.status,
      'last_event_created', v_existing.last_event_created,
      'reason', 'stale_event_ignored'
    );
  end if;

  -- Atomic insert or update
  insert into public.subscriptions (
    id,
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    status,
    plan,
    current_period_end,
    cancel_at_period_end,
    last_event_created,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_user_id,
    p_customer_id,
    p_sub_id,
    p_status,
    p_plan,
    p_current_period_end,
    p_cancel_at_period_end,
    p_event_created,
    p_updated_at
  )
  on conflict (stripe_subscription_id)
  do update set
    user_id = EXCLUDED.user_id,
    stripe_customer_id = coalesce(EXCLUDED.stripe_customer_id, public.subscriptions.stripe_customer_id),
    status = EXCLUDED.status,
    plan = coalesce(EXCLUDED.plan, public.subscriptions.plan),
    current_period_end = coalesce(EXCLUDED.current_period_end, public.subscriptions.current_period_end),
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    last_event_created = EXCLUDED.last_event_created,
    updated_at = EXCLUDED.updated_at
  returning id, status, last_event_created into v_result;

  return jsonb_build_object(
    'updated', true,
    'id', v_result.id,
    'status', v_result.status,
    'last_event_created', v_result.last_event_created
  );
end;
$$;
