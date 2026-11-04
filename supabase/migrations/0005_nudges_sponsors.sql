-- 0005: friendly "keep going" nudges + sponsor inquiries.

-- ───── Nudges ─────
alter table public.profiles add column if not exists nudges_enabled boolean not null default true;
alter table public.profiles add column if not exists last_nudged_at timestamptz;
grant update (nudges_enabled) on public.profiles to authenticated;

-- Members with an active membership who started learning, went quiet for 3–30 days, and weren't nudged in the last 7 days.
create or replace function public.nudge_candidates(p_limit int default 200)
returns table (user_id uuid, email text, display_name text, last_lesson_id text, last_active timestamptz)
language sql security definer set search_path = public, auth as $$
  with last_done as (
    select lp.user_id, max(lp.completed_at) as last_active,
           (array_agg(lp.lesson_id order by lp.completed_at desc))[1] as last_lesson_id
    from public.lesson_progress lp group by lp.user_id
  )
  select p.id, u.email::text, p.display_name, ld.last_lesson_id, ld.last_active
  from public.profiles p
  join auth.users u on u.id = p.id
  join last_done ld on ld.user_id = p.id
  where p.nudges_enabled
    and u.email is not null
    and ld.last_active between now() - interval '30 days' and now() - interval '3 days'
    and (p.last_nudged_at is null or p.last_nudged_at < now() - interval '7 days')
    and exists (select 1 from public.subscriptions s where s.user_id = p.id and s.status in ('active', 'trialing'))
  order by ld.last_active desc
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function public.nudge_candidates(int) from public, anon, authenticated;
grant execute on function public.nudge_candidates(int) to service_role;

create or replace function public.mark_nudged(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_nudged_at = now() where id = any(p_ids);
$$;
revoke all on function public.mark_nudged(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_nudged(uuid[]) to service_role;

-- One-click unsubscribe from email links (token verified by the app, then this runs as service role).
create or replace function public.set_nudges(p_user uuid, p_enabled boolean)
returns void language sql security definer set search_path = public as $$
  update public.profiles set nudges_enabled = p_enabled where id = p_user;
$$;
revoke all on function public.set_nudges(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_nudges(uuid, boolean) to service_role;

-- ───── Sponsor inquiries (written by the API with the service role; no client access) ─────
create table if not exists public.sponsor_inquiries (
  id          uuid primary key default gen_random_uuid(),
  company     text not null check (char_length(company) between 1 and 120),
  contact     text not null check (char_length(contact) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254),
  website     text check (website is null or char_length(website) <= 300),
  tier        text not null check (tier in ('community', 'course', 'title', 'tool-partner')),
  message     text check (message is null or char_length(message) <= 2000),
  status      text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  created_at  timestamptz not null default now()
);
alter table public.sponsor_inquiries enable row level security;
revoke all on public.sponsor_inquiries from anon, authenticated;
