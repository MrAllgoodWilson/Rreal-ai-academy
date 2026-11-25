-- ════════════════════════════════════════════════════════════════════════
-- v0.2: standalone + AI-generated courses, all-paid gating, usage quotas,
-- AI video renders, social connections, plugins, translations cache,
-- accredited credentials, language + voice preferences.
-- ════════════════════════════════════════════════════════════════════════

-- ───── Course kinds ─────
alter table public.tracks
  add column if not exists kind text not null default 'program' check (kind in ('program', 'course', 'custom')),
  add column if not exists category text,
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade,
  add column if not exists is_published boolean not null default true;

alter table public.lessons add column if not exists track_kind text not null default 'program' check (track_kind in ('program', 'course', 'custom'));
alter table public.tracks drop constraint if exists tracks_level_check;
alter table public.tracks add constraint tracks_level_check check (level between 1 and 5);

-- Membership is $1/month for everyone: no free lessons.
update public.lessons set is_free = false;

create sequence if not exists public.custom_lesson_ordinal_seq start 100000;

-- Hide unpublished custom courses from everyone but their owner.
drop policy if exists "curriculum is public" on public.tracks;
create policy "curriculum is public" on public.tracks for select using (kind <> 'custom' or is_published or owner_id = (select auth.uid()));
drop policy if exists "lessons are public" on public.lessons;
create policy "lessons are public" on public.lessons for select using (
  track_kind <> 'custom' or exists (select 1 from public.tracks t where t.id = track_id and (t.is_published or t.owner_id = (select auth.uid())))
);

-- ───── Preferences ─────
alter table public.profiles
  add column if not exists preferred_lang text not null default 'en' check (preferred_lang in ('en', 'es')),
  add column if not exists voice_id text;
grant update (preferred_lang, voice_id) on public.profiles to authenticated;

-- ───── Usage quotas (protects margins on a $1/month plan) ─────
create table if not exists public.usage_counters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null,
  period  text not null,
  count   int  not null default 0,
  primary key (user_id, kind, period)
);
alter table public.usage_counters enable row level security;
drop policy if exists "read own usage" on public.usage_counters;
create policy "read own usage" on public.usage_counters for select to authenticated using (user_id = (select auth.uid()));

-- Atomically consume one unit of quota. Returns false when the limit is reached.
create or replace function public.consume_quota(p_kind text, p_limit int, p_period text default 'day')
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_key text := case when p_period = 'month' then to_char(now() at time zone 'UTC', 'YYYY-MM') else to_char(now() at time zone 'UTC', 'YYYY-MM-DD') end;
  v_count int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_limit <= 0 then return false; end if;
  insert into public.usage_counters (user_id, kind, period, count) values (v_uid, p_kind, v_key, 1)
  on conflict (user_id, kind, period) do update set count = usage_counters.count + 1 where usage_counters.count < p_limit
  returning count into v_count;
  return v_count is not null;
end $$;
revoke all on function public.consume_quota(text, int, text) from public, anon;
grant execute on function public.consume_quota(text, int, text) to authenticated;

-- ───── AI-generated (custom) courses ─────
create table if not exists public.custom_courses (
  id           text primary key,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  language     text not null default 'en',
  level        smallint not null check (level between 1 and 5),
  category     text,
  request      text,
  status       text not null default 'private' check (status in ('private', 'submitted', 'published', 'rejected')),
  content      jsonb not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
alter table public.custom_courses enable row level security;
drop policy if exists "read published or own courses" on public.custom_courses;
create policy "read published or own courses" on public.custom_courses for select using (status = 'published' or owner_id = (select auth.uid()));

-- Saves a validated AI-generated course and registers its lessons so XP/progress work.
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
  if not exists (select 1 from public.subscriptions where user_id = v_uid and status in ('active', 'trialing')) then
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
revoke all on function public.create_custom_course(jsonb, text) from public, anon;
grant execute on function public.create_custom_course(jsonb, text) to authenticated;

-- Owner submits their course to be offered to all learners (an admin publishes it).
create or replace function public.submit_custom_course(p_id text)
returns void language sql security definer set search_path = public as $$
  update public.custom_courses set status = 'submitted' where id = p_id and owner_id = auth.uid() and status in ('private', 'rejected');
$$;
grant execute on function public.submit_custom_course(text) to authenticated;

-- Admin (service role) publishes/rejects a course.
create or replace function public.admin_set_course_status(p_id text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('published', 'rejected', 'private') then raise exception 'bad status'; end if;
  update public.custom_courses set status = p_status, published_at = case when p_status = 'published' then now() else null end where id = p_id;
  update public.tracks set is_published = (p_status = 'published') where id = p_id and kind = 'custom';
end $$;
revoke all on function public.admin_set_course_status(text, text) from public, anon, authenticated;
grant execute on function public.admin_set_course_status(text, text) to service_role;

-- ───── complete_lesson v2: program vs. course gating, custom-course access ─────
create or replace function public.complete_lesson(p_lesson_id text, p_score int, p_tz text default 'UTC')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lesson public.lessons%rowtype;
  v_prev public.lessons%rowtype;
  v_track public.tracks%rowtype;
  v_p public.profiles%rowtype;
  v_today date; v_gap int; v_cur int; v_freezes int;
  v_extended boolean := false; v_first boolean; v_xp int;
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

  v_first := not exists (select 1 from public.lesson_progress where user_id = v_uid and lesson_id = p_lesson_id);
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

-- ───── AI video renders ─────
create table if not exists public.video_renders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  provider        text not null,
  provider_job_id text,
  prompt          text not null,
  status          text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  output_url      text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists video_renders_user_idx on public.video_renders(user_id, created_at desc);
alter table public.video_renders enable row level security;
drop policy if exists "own renders" on public.video_renders;
create policy "own renders" on public.video_renders for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ───── Social connections (provider keys are server-only: no policies) ─────
create table if not exists public.social_connections (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  provider         text not null default 'ayrshare',
  profile_key      text not null,
  linked_platforms text[] not null default '{}',
  updated_at       timestamptz not null default now()
);
alter table public.social_connections enable row level security;

create table if not exists public.social_posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platforms    text[] not null,
  body         text not null,
  media_url    text,
  scheduled_at timestamptz,
  provider_id  text,
  status       text not null default 'submitted',
  created_at   timestamptz not null default now()
);
alter table public.social_posts enable row level security;
drop policy if exists "read own posts" on public.social_posts;
create policy "read own posts" on public.social_posts for select to authenticated using (user_id = (select auth.uid()));

-- ───── Plugins (outgoing webhooks to Zapier / Make / Slack / Discord / custom) ─────
create table if not exists public.user_plugins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('zapier', 'make', 'slack', 'discord', 'webhook')),
  url        text not null check (url ~ '^https://'),
  events     text[] not null default array['lesson.completed', 'certificate.issued', 'video.rendered', 'course.created'],
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.user_plugins enable row level security;
drop policy if exists "own plugins" on public.user_plugins;
create policy "own plugins" on public.user_plugins for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ───── Translation cache (Spanish content generated once, served to everyone) ─────
create table if not exists public.content_translations (
  key        text primary key,
  lang       text not null,
  content    jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.content_translations enable row level security;
drop policy if exists "translations are public" on public.content_translations;
create policy "translations are public" on public.content_translations for select using (true);

-- ───── Credentials: self-issued vs. accredited ─────
alter table public.certificates
  add column if not exists credential_type text not null default 'rreal' check (credential_type in ('rreal', 'accredited')),
  add column if not exists accreditation jsonb;
