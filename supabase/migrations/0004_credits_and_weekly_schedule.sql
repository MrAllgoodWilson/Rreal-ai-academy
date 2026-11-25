-- ════════════════════════════════════════════════════════════════════════
-- v0.3: credit packs (AI video renders, $9.99 custom courses) and
-- weekly release schedule (each course week unlocks 7 days after the learner starts it).
-- Owner decision 2026-11-04: $1/month forever + credit packs; $9.99 per custom course.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.credit_balances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null check (kind in ('video', 'course')),
  balance int  not null default 0 check (balance >= 0),
  primary key (user_id, kind)
);
alter table public.credit_balances enable row level security;
create policy "read own credits" on public.credit_balances for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.credit_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  delta      int  not null,
  reason     text not null,
  ref        text unique,            -- Stripe checkout session id / spend id: makes grants idempotent
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at desc);
alter table public.credit_ledger enable row level security;
create policy "read own ledger" on public.credit_ledger for select to authenticated using (user_id = (select auth.uid()));

-- Purchases & refunds (service role only). Idempotent: the same ref never grants twice.
create or replace function public.grant_credits(p_user uuid, p_kind text, p_qty int, p_reason text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_qty <= 0 or p_kind not in ('video', 'course') then raise exception 'bad grant'; end if;
  insert into public.credit_ledger (user_id, kind, delta, reason, ref) values (p_user, p_kind, p_qty, p_reason, p_ref)
  on conflict (ref) do nothing returning id into v_id;
  if v_id is null then return false; end if;
  insert into public.credit_balances (user_id, kind, balance) values (p_user, p_kind, p_qty)
  on conflict (user_id, kind) do update set balance = credit_balances.balance + excluded.balance;
  return true;
end $$;
revoke all on function public.grant_credits(uuid, text, int, text, text) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, text, int, text, text) to service_role;

-- Spend one credit (signed-in learner). Returns false when the balance is empty.
create or replace function public.spend_credit(p_kind text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_left int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  update public.credit_balances set balance = balance - 1 where user_id = v_uid and kind = p_kind and balance > 0 returning balance into v_left;
  if v_left is null then return false; end if;
  insert into public.credit_ledger (user_id, kind, delta, reason, ref) values (v_uid, p_kind, -1, 'spend', p_ref);
  return true;
end $$;
revoke all on function public.spend_credit(text, text) from public, anon;
grant execute on function public.spend_credit(text, text) to authenticated;

-- ───── Weekly release schedule ─────
-- When a lesson's week opens for this learner, or null if it is already open.
-- Week 1 of wherever the learner starts opens immediately; each following week opens 7 days later.
create or replace function public.week_unlock_at(p_uid uuid, p_lesson public.lessons)
returns timestamptz language sql stable security definer set search_path = public as $$
  with started as (
    select lp.completed_at, l.week_number
    from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = p_uid
      and (case when p_lesson.track_kind = 'program' then l.track_kind = 'program' else l.track_id = p_lesson.track_id end)
    order by lp.completed_at asc limit 1
  )
  select case
    when (select count(*) from started) = 0 then null
    when p_lesson.week_number <= (select week_number from started) then null
    else (select completed_at from started) + make_interval(days => 7 * (p_lesson.week_number - (select week_number from started)))
  end;
$$;
revoke all on function public.week_unlock_at(uuid, public.lessons) from public, anon, authenticated;

-- complete_lesson v3 = v2 + weekly schedule check.
create or replace function public.complete_lesson(p_lesson_id text, p_score int, p_tz text default 'UTC')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lesson public.lessons%rowtype;
  v_prev public.lessons%rowtype;
  v_track public.tracks%rowtype;
  v_p public.profiles%rowtype;
  v_today date; v_gap int; v_cur int; v_freezes int;
  v_extended boolean := false; v_first boolean; v_xp int; v_unlock timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_score < 0 or p_score > 100 then raise exception 'invalid score'; end if;
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then raise exception 'unknown lesson'; end if;
  select * into v_track from public.tracks where id = v_lesson.track_id;
  select * into v_p from public.profiles where id = v_uid for update;

  if not exists (select 1 from public.subscriptions where user_id = v_uid and status in ('active', 'trialing')) then
    raise exception 'subscription required' using errcode = '42501';
  end if;
  if v_track.kind = 'custom' and not v_track.is_published and v_track.owner_id <> v_uid then
    raise exception 'course not available' using errcode = '42501';
  end if;

  v_first := not exists (select 1 from public.lesson_progress where user_id = v_uid and lesson_id = p_lesson_id);
  if v_first then
    v_unlock := public.week_unlock_at(v_uid, v_lesson);
    if v_unlock is not null and now() < v_unlock then
      raise exception 'week not released yet' using errcode = '42501', detail = v_unlock::text;
    end if;
  end if;

  if v_lesson.track_kind = 'program' then
    select * into v_prev from public.lessons where track_kind = 'program' and ordinal < v_lesson.ordinal order by ordinal desc limit 1;
  else
    select * into v_prev from public.lessons where track_id = v_lesson.track_id and ordinal < v_lesson.ordinal order by ordinal desc limit 1;
  end if;
  if found
     and not exists (select 1 from public.lesson_progress where user_id = v_uid and lesson_id = v_prev.id)
     and not (v_lesson.track_kind = 'program' and v_prev.track_id <> v_lesson.track_id and v_p.placement_level >= v_lesson.track_level)
  then raise exception 'prerequisite not complete' using errcode = '42501'; end if;

  if p_lesson_id = 'capstone-exam' and p_score < 80 then raise exception 'exam requires 80%%'; end if;

  begin
    v_today := (now() at time zone p_tz)::date;
  exception when others then
    v_today := (now() at time zone 'UTC')::date;
  end;

  v_cur := v_p.streak_current; v_freezes := v_p.streak_freezes;
  if v_p.last_active_date is null then v_cur := 1; v_extended := true;
  else
    v_gap := v_today - v_p.last_active_date;
    if v_gap = 1 then v_cur := v_cur + 1; v_extended := true;
    elsif v_gap > 1 and (v_gap - 1) <= v_freezes then v_freezes := v_freezes - (v_gap - 1); v_cur := v_cur + 1; v_extended := true;
    elsif v_gap > 1 then v_cur := 1; v_extended := true;
    end if;
  end if;
  if v_extended and v_cur % 7 = 0 then v_freezes := v_freezes + 1; end if;

  v_xp := round((case when v_first then v_lesson.xp else round(v_lesson.xp * 0.2) end) * (1 + least(0.5, floor(v_cur / 7.0) * 0.1)));

  insert into public.lesson_progress (user_id, lesson_id, score, perfect) values (v_uid, p_lesson_id, p_score, p_score >= 100)
  on conflict (user_id, lesson_id) do update set score = greatest(lesson_progress.score, excluded.score), perfect = lesson_progress.perfect or excluded.perfect, attempts = lesson_progress.attempts + 1;
  insert into public.xp_events (user_id, amount, reason, lesson_id) values (v_uid, v_xp, case when v_first then 'lesson' else 'review' end, p_lesson_id);
  update public.profiles set xp = xp + v_xp, streak_current = v_cur, streak_longest = greatest(streak_longest, v_cur), streak_freezes = v_freezes,
    last_active_date = greatest(coalesce(last_active_date, v_today), v_today) where id = v_uid;

  return jsonb_build_object('xp_awarded', v_xp, 'first_time', v_first, 'streak', v_cur, 'freezes', v_freezes);
end $$;
revoke all on function public.complete_lesson(text, int, text) from public, anon;
grant execute on function public.complete_lesson(text, int, text) to authenticated;
