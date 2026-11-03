-- ════════════════════════════════════════════════════════════════════════
-- Rreal AI Academy — core schema
-- Postgres / Supabase. Run with `supabase db push` or paste into the SQL editor.
-- Security model:
--   * Row Level Security on every user table.
--   * Learners can READ their own data, but can never write XP, streaks,
--     lesson completions, subscriptions or certificates directly.
--     Those change only through SECURITY DEFINER functions (complete_lesson)
--     or the service role (Stripe webhook, certificate issuer).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists citext;

-- ───────────────────────── Curriculum (mirror of src/lib/curriculum) ─────────────────────────
create table public.tracks (
  id            text primary key,
  level         smallint not null check (level between 1 and 5),
  name          text not null,
  certificate_title text not null
);

create table public.lessons (
  id            text primary key,
  track_id      text not null references public.tracks(id) on delete cascade,
  track_level   smallint not null,
  week_number   smallint not null,
  module_id     text not null,
  ordinal       int not null unique,          -- position in the global learning path
  title         text not null,
  xp            int not null check (xp > 0),
  minutes       int not null,
  is_free       boolean not null default false
);
create index lessons_track_idx on public.lessons(track_id);

-- ───────────────────────── Profiles ─────────────────────────
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         citext not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name     text not null check (char_length(display_name) between 1 and 80),
  avatar           text not null default '🦊',
  xp               int not null default 0,
  streak_current   int not null default 0,
  streak_longest   int not null default 0,
  streak_freezes   int not null default 1,
  last_active_date date,
  placement_level  smallint not null default 1 check (placement_level between 1 and 5),
  show_on_leaderboard boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ───────────────────────── Progress & gamification ─────────────────────────
create table public.lesson_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  lesson_id    text not null references public.lessons(id) on delete cascade,
  score        smallint not null default 0 check (score between 0 and 100),
  perfect      boolean not null default false,
  attempts     int not null default 1,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     int not null,
  reason     text not null,
  lesson_id  text references public.lessons(id) on delete set null,
  created_at timestamptz not null default now()
);
create index xp_events_user_time_idx on public.xp_events(user_id, created_at desc);
create index xp_events_time_idx on public.xp_events(created_at desc);

create table public.user_badges (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  badge_id  text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- Non-authoritative UI state: portfolio, onboarding answers, counters, preferences.
create table public.user_state (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Credentials ─────────────────────────
create table public.certificates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  track_id        text not null,                 -- a track id or 'master'
  credential_code text not null unique,          -- RRAI-2026-XXXXXXXX
  token           text not null,                 -- signed credential (see src/lib/certificates/server.ts)
  token_hash      text not null unique,          -- sha256(token) for public lookup
  recipient_name  text not null,
  title           text,
  score           smallint,
  issued_at       timestamptz not null default now(),
  revoked_at      timestamptz,
  revoked_reason  text,
  unique (user_id, track_id)
);

-- ───────────────────────── Billing ─────────────────────────
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 text not null check (status in ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
  plan                   text check (plan in ('monthly','annual','team')),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions(user_id);

-- Stripe webhook idempotency ledger (service role only)
create table public.webhook_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- ════════════════════════════ Row Level Security ════════════════════════════
alter table public.tracks          enable row level security;
alter table public.lessons         enable row level security;
alter table public.profiles        enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.xp_events       enable row level security;
alter table public.user_badges     enable row level security;
alter table public.user_state      enable row level security;
alter table public.certificates    enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.webhook_events  enable row level security;

create policy "curriculum is public"  on public.tracks  for select using (true);
create policy "lessons are public"    on public.lessons for select using (true);

create policy "read own profile"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Column-level guard: learners may only edit cosmetic/self-reported fields, never XP or streaks.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar, show_on_leaderboard, placement_level) on public.profiles to authenticated;

create policy "read own progress" on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()));
create policy "read own xp"       on public.xp_events       for select to authenticated using (user_id = (select auth.uid()));
create policy "read own badges"   on public.user_badges     for select to authenticated using (user_id = (select auth.uid()));
create policy "add own badges"    on public.user_badges     for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own state"         on public.user_state      for all    to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "read own certs"    on public.certificates    for select to authenticated using (user_id = (select auth.uid()));
create policy "read own subs"     on public.subscriptions   for select to authenticated using (user_id = (select auth.uid()));
-- webhook_events: no policies → only the service role can touch it.

-- ════════════════════════════ Functions ════════════════════════════

-- Create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text := coalesce(new.raw_user_meta_data->>'username', 'learner_' || substr(replace(new.id::text, '-', ''), 1, 8));
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), v_username));
  insert into public.user_state (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Username availability (safe to expose: reveals only whether a handle is taken).
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where username = p_username::citext);
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Username ⇄ email lookups for sign-in-by-username and Forgot Username.
-- SERVICE ROLE ONLY — never callable from the browser (prevents email harvesting).
create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = public, auth as $$
  select u.email from auth.users u join public.profiles p on p.id = u.id where p.username = p_username::citext;
$$;
create or replace function public.username_for_email(p_email text)
returns text language sql stable security definer set search_path = public, auth as $$
  select p.username::text from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = lower(p_email);
$$;
revoke all on function public.email_for_username(text) from public, anon, authenticated;
revoke all on function public.username_for_email(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;
grant execute on function public.username_for_email(text) to service_role;

-- Authoritative lesson completion: gating, XP (with streak multiplier), streak + freezes.
-- Mirrors src/lib/gamification.ts so the client can render optimistically.
create or replace function public.complete_lesson(p_lesson_id text, p_score int, p_tz text default 'UTC')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lesson public.lessons%rowtype;
  v_prev public.lessons%rowtype;
  v_p public.profiles%rowtype;
  v_today date;
  v_gap int;
  v_cur int;
  v_freezes int;
  v_extended boolean := false;
  v_first boolean;
  v_xp int;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_score < 0 or p_score > 100 then raise exception 'invalid score'; end if;

  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found then raise exception 'unknown lesson'; end if;

  select * into v_p from public.profiles where id = v_uid for update;

  -- Gate 1: subscription
  if not v_lesson.is_free and not exists (
    select 1 from public.subscriptions where user_id = v_uid and status in ('active', 'trialing')
  ) then raise exception 'subscription required' using errcode = '42501'; end if;

  -- Gate 2: prerequisites (previous lesson done, or placement lets you start this track)
  select * into v_prev from public.lessons where ordinal = v_lesson.ordinal - 1;
  if found
     and not exists (select 1 from public.lesson_progress where user_id = v_uid and lesson_id = v_prev.id)
     and not (v_prev.track_id <> v_lesson.track_id and v_p.placement_level >= v_lesson.track_level)
  then raise exception 'prerequisite not complete' using errcode = '42501'; end if;

  -- Gate 3: capstone exam pass mark
  if p_lesson_id = 'capstone-exam' and p_score < 80 then raise exception 'exam requires 80%%'; end if;

  begin
    v_today := (now() at time zone p_tz)::date;
  exception when others then
    v_today := (now() at time zone 'UTC')::date;
  end;

  -- Streak
  v_cur := v_p.streak_current;
  v_freezes := v_p.streak_freezes;
  if v_p.last_active_date is null then
    v_cur := 1; v_extended := true;
  else
    v_gap := v_today - v_p.last_active_date;
    if v_gap = 1 then v_cur := v_cur + 1; v_extended := true;
    elsif v_gap > 1 and (v_gap - 1) <= v_freezes then v_freezes := v_freezes - (v_gap - 1); v_cur := v_cur + 1; v_extended := true;
    elsif v_gap > 1 then v_cur := 1; v_extended := true;
    end if;
  end if;
  if v_extended and v_cur % 7 = 0 then v_freezes := v_freezes + 1; end if;

  -- XP: full on first completion, 20% on replay; +10% per 7-day streak block (max +50%)
  v_first := not exists (select 1 from public.lesson_progress where user_id = v_uid and lesson_id = p_lesson_id);
  v_xp := round((case when v_first then v_lesson.xp else round(v_lesson.xp * 0.2) end) * (1 + least(0.5, floor(v_cur / 7.0) * 0.1)));

  insert into public.lesson_progress (user_id, lesson_id, score, perfect)
  values (v_uid, p_lesson_id, p_score, p_score >= 100)
  on conflict (user_id, lesson_id) do update
    set score = greatest(lesson_progress.score, excluded.score),
        perfect = lesson_progress.perfect or excluded.perfect,
        attempts = lesson_progress.attempts + 1;

  insert into public.xp_events (user_id, amount, reason, lesson_id)
  values (v_uid, v_xp, case when v_first then 'lesson' else 'review' end, p_lesson_id);

  update public.profiles set
    xp = xp + v_xp,
    streak_current = v_cur,
    streak_longest = greatest(streak_longest, v_cur),
    streak_freezes = v_freezes,
    last_active_date = greatest(coalesce(last_active_date, v_today), v_today)
  where id = v_uid;

  return jsonb_build_object('xp_awarded', v_xp, 'first_time', v_first, 'streak', v_cur, 'freezes', v_freezes);
end $$;
revoke all on function public.complete_lesson(text, int, text) from public, anon;
grant execute on function public.complete_lesson(text, int, text) to authenticated;

-- Weekly league leaderboard (Monday-start week, opt-in only). Exposes only public handle fields.
create or replace function public.leaderboard_weekly(p_limit int default 50)
returns table (user_id uuid, username text, display_name text, avatar text, weekly_xp bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar, coalesce(sum(e.amount), 0) as weekly_xp
  from public.profiles p
  left join public.xp_events e on e.user_id = p.id and e.created_at >= date_trunc('week', now())
  where p.show_on_leaderboard
  group by p.id
  order by weekly_xp desc, p.created_at
  limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function public.leaderboard_weekly(int) from public, anon;
grant execute on function public.leaderboard_weekly(int) to authenticated;

-- Public credential lookup by fingerprint (used by /verify for revocation checks).
create or replace function public.certificate_status(p_token_hash text)
returns table (credential_code text, recipient_name text, track_id text, issued_at timestamptz, revoked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select credential_code, recipient_name, track_id, issued_at, revoked_at from public.certificates where token_hash = p_token_hash;
$$;
grant execute on function public.certificate_status(text) to anon, authenticated;
