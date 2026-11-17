-- 0010_free_access.sql — Rreal AI Academy is FREE for every signed-in learner (founder decision 2026-11-17).
--
-- WHAT THIS CHANGES: the database no longer demands an active/trialing subscription before a learner can complete lessons or save a
-- custom course. It does so through ONE switch, public.app_settings.free_access (default TRUE as inserted below), read by
-- public.has_access(uid). While the switch is TRUE every authenticated learner has access; set it to FALSE and the old rule
-- (active/trialing subscription required) applies again, instantly, with no redeploy.
--
-- WHAT THIS DOES NOT CHANGE: public.subscriptions rows are untouched (nobody is cancelled, refunded or charged); fair-use quotas
-- (consume_quota) and credits (spend_credit) are untouched; prerequisite/lesson-order rules inside complete_lesson are untouched.
--
-- ROLLBACK (data stays intact):  update public.app_settings set value = 'false'::jsonb, updated_at = now() where key = 'free_access';
-- The two function bodies below are the repo's latest definitions (0004 complete_lesson, 0002 create_custom_course) with ONLY the
-- subscription predicate replaced by `not public.has_access(v_uid)`.

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;   -- no policies: only the service role / security definer functions can read or write
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings (key, value) values ('free_access', 'true'::jsonb) on conflict (key) do nothing;

create or replace function public.free_access_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'free_access'), false)
$$;

create or replace function public.has_access(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and (
    public.free_access_enabled()
    or exists (select 1 from public.subscriptions where user_id = p_uid and status in ('active', 'trialing'))
  )
$$;
revoke all on function public.free_access_enabled() from public, anon, authenticated;
revoke all on function public.has_access(uuid) from public, anon, authenticated;
grant execute on function public.free_access_enabled() to service_role;
grant execute on function public.has_access(uuid) to service_role;

-- create_custom_course (from 0002) with the entitlement check routed through has_access()
create or replace function public.create_custom_course(p_course jsonb, p_request text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id text := p_course->>'id';
  v_level smallint := least(5, greatest(1, coalesce((p_course->>'level')::int, 1)));
  v_week jsonb; v_mod jsonb; v_lesson jsonb;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if v_id is null or v_id !~ '^u-[a-z0-9-]{4,60}$' then raise exception 'invalid course id'; end if;
  if not public.has_access(v_uid) then
    raise exception 'subscription required' using errcode = '42501';
  end if;

  insert into public.custom_courses (id, owner_id, title, language, level, category, request, content)
  values (v_id, v_uid, left(p_course->>'name', 140), coalesce(p_course->>'language', 'en'), v_level, p_course->>'category', left(p_request, 1000), p_course);

  insert into public.tracks (id, level, name, certificate_title, kind, category, owner_id, is_published)
  values (v_id, v_level, left(p_course->>'name', 140), left(coalesce(p_course->>'certificateTitle', 'Rreal Certified: ' || (p_course->>'name')), 200), 'custom', p_course->>'category', v_uid, false);

  for v_week in select * from jsonb_array_elements(p_course->'weeks') loop
    for v_mod in select * from jsonb_array_elements(v_week->'modules') loop
      for v_lesson in select * from jsonb_array_elements(v_mod->'lessons') loop
        if (v_lesson->>'id') !~ '^u-[a-z0-9-]{4,90}$' then raise exception 'invalid lesson id'; end if;
        insert into public.lessons (id, track_id, track_level, week_number, module_id, ordinal, title, xp, minutes, is_free, track_kind)
        values (v_lesson->>'id', v_id, v_level, coalesce((v_week->>'number')::int, 1), coalesce(v_mod->>'id', v_id || '-m'),
                nextval('public.custom_lesson_ordinal_seq'), left(v_lesson->>'title', 200),
                least(150, greatest(10, coalesce((v_lesson->>'xp')::int, 60))), least(60, greatest(3, coalesce((v_lesson->>'minutes')::int, 8))), false, 'custom');
      end loop;
    end loop;
  end loop;
  return v_id;
end $$;

-- complete_lesson (from 0004) with the entitlement check routed through has_access()
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

  if not public.has_access(v_uid) then
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

-- Privileges are preserved by CREATE OR REPLACE; restated so this migration never depends on that.
revoke all on function public.complete_lesson(text, int, text) from public, anon;
grant execute on function public.complete_lesson(text, int, text) to authenticated;
revoke all on function public.create_custom_course(jsonb, text) from public, anon;
grant execute on function public.create_custom_course(jsonb, text) to authenticated;
