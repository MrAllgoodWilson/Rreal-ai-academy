-- 0010_leaderboard_explicit_utc.sql
-- Proposes explicit UTC timestamptz boundary for weekly leaderboard (Monday-start week, opt-in only).
-- Resolves unpinned database session timezone uncertainty by pinning timezone('UTC', now()).
-- Local review only; zero remote database mutation.

create or replace function public.leaderboard_weekly(p_limit int default 50)
returns table (user_id uuid, username text, display_name text, avatar text, weekly_xp bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar, coalesce(sum(e.amount), 0) as weekly_xp
  from public.profiles p
  left join public.xp_events e on e.user_id = p.id and e.created_at >= date_trunc('week', timezone('UTC', now()))
  where p.show_on_leaderboard
  group by p.id
  order by weekly_xp desc, p.created_at
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.leaderboard_weekly(int) from public, anon;
grant execute on function public.leaderboard_weekly(int) to authenticated;
