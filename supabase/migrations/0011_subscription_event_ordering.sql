-- Migration 0011: Subscription Event Ordering and Monotonic Clocks
alter table public.subscriptions
  add column if not exists last_event_created bigint;

create index if not exists subscriptions_last_event_created_idx
  on public.subscriptions (last_event_created);
