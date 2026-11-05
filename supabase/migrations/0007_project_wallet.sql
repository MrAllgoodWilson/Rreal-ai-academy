-- Disabled project-wallet foundation. No legacy course/video wallet is changed.
-- All mutation RPCs are service-role-only; callers must independently authenticate users,
-- validate paid Stripe sessions / approved reward entitlements and use a trusted rate card.
begin;
create table public.project_wallet_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  max_cost_bps_of_retail int not null default 3000 check (max_cost_bps_of_retail between 1 and 10000),
  daily_user_cost_cap_cents int not null default 0 check (daily_user_cost_cap_cents >= 0),
  daily_global_cost_cap_cents int not null default 0 check (daily_global_cost_cap_cents >= 0)
);
insert into public.project_wallet_control(singleton) values(true);
create table public.project_wallet_accounts (
  user_id uuid not null references public.profiles(id) on delete restrict,
  funding_kind text not null check (funding_kind in ('purchased','referral')),
  available_credits bigint not null default 0 check (available_credits >= 0),
  reserved_credits bigint not null default 0 check (reserved_credits >= 0),
  available_cost_cents bigint not null default 0 check (available_cost_cents >= 0),
  reserved_cost_cents bigint not null default 0 check (reserved_cost_cents >= 0),
  primary key(user_id,funding_kind)
);
create table public.project_wallet_grants (
  source_ref text primary key check (length(source_ref) between 1 and 200),
  user_id uuid not null references public.profiles(id) on delete restrict,
  funding_kind text not null check (funding_kind in ('purchased','referral')),
  credits bigint not null check (credits > 0),
  funded_cost_cents bigint not null check (funded_cost_cents > 0),
  created_at timestamptz not null default now()
);
create table public.project_wallet_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  feature text not null check (length(feature) between 1 and 80),
  rate_version text not null check (length(rate_version) between 1 and 80),
  retail_cents bigint not null check(retail_cents>0),
  net_funding_cents bigint not null check(net_funding_cents>0 and net_funding_cents<=retail_cents),
  reserve_cents bigint not null check(reserve_cents>=0),
  minimum_contribution_cents bigint not null check(minimum_contribution_cents>0),
  credits bigint not null check (credits > 0),
  max_cost_cents bigint not null check (max_cost_cents > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.project_wallet_jobs (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique check (length(request_key) between 1 and 200),
  quote_id uuid not null unique references public.project_wallet_quotes(id),
  user_id uuid not null references public.profiles(id) on delete restrict,
  funding_kind text not null check (funding_kind in ('purchased','referral')),
  credits bigint not null check (credits > 0),
  max_cost_cents bigint not null check (max_cost_cents > 0),
  status text not null default 'reserved' check (status in ('reserved','settled','released')),
  actual_cost_cents bigint check (actual_cost_cents >= 0),
  budget_day date not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status='reserved' and actual_cost_cents is null and finished_at is null)
      or (status='settled' and actual_cost_cents is not null and actual_cost_cents <= max_cost_cents and finished_at is not null)
      or (status='released' and actual_cost_cents=0 and finished_at is not null))
);
create table public.project_wallet_daily_cost (
  scope_key text not null,
  budget_day date not null,
  reserved_cents bigint not null default 0 check (reserved_cents >= 0),
  settled_cents bigint not null default 0 check (settled_cents >= 0),
  primary key(scope_key,budget_day)
);
create table public.project_wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  funding_kind text not null check (funding_kind in ('purchased','referral')),
  operation text not null check (operation in ('grant','reserve','settle','release')),
  ref text not null,
  credits bigint not null check(credits > 0),
  cost_cents bigint not null check(cost_cents >= 0),
  created_at timestamptz not null default now(),
  unique(operation,ref)
);
-- No browser or service-role direct writes to financial records. Mutation functions own writes.
-- Global control is the sole explicit administrative switch; caps of zero prevent reservations.
alter table public.project_wallet_control enable row level security;
alter table public.project_wallet_accounts enable row level security;
alter table public.project_wallet_grants enable row level security;
alter table public.project_wallet_quotes enable row level security;
alter table public.project_wallet_jobs enable row level security;
alter table public.project_wallet_daily_cost enable row level security;
alter table public.project_wallet_ledger enable row level security;
create policy "read own project account" on public.project_wallet_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy "read own project grants" on public.project_wallet_grants for select to authenticated using(user_id=(select auth.uid()));
create policy "read own project quotes" on public.project_wallet_quotes for select to authenticated using(user_id=(select auth.uid()));
create policy "read own project jobs" on public.project_wallet_jobs for select to authenticated using(user_id=(select auth.uid()));
create policy "read own project ledger" on public.project_wallet_ledger for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.project_wallet_control,public.project_wallet_accounts,public.project_wallet_grants,public.project_wallet_quotes,public.project_wallet_jobs,public.project_wallet_daily_cost,public.project_wallet_ledger from public,anon,authenticated,service_role;
grant select on public.project_wallet_accounts,public.project_wallet_grants,public.project_wallet_quotes,public.project_wallet_jobs,public.project_wallet_ledger to authenticated;
grant select,update on public.project_wallet_control to service_role;
grant select on public.project_wallet_accounts,public.project_wallet_grants,public.project_wallet_quotes,public.project_wallet_jobs,public.project_wallet_daily_cost,public.project_wallet_ledger to service_role;
revoke all on sequence public.project_wallet_ledger_id_seq from public,anon,authenticated,service_role;

create function public.project_wallet_grant(p_user uuid,p_kind text,p_ref text,p_credits bigint,p_funded_cost_cents bigint)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.project_wallet_grants%rowtype; wrote int;
begin
  if not coalesce((select enabled from project_wallet_control where singleton),false) then raise exception 'project wallet disabled'; end if;
  if p_user is null or p_kind is null or p_kind not in ('purchased','referral') or p_ref is null or length(p_ref) not between 1 and 200
    or p_credits is null or p_credits <= 0 or p_funded_cost_cents is null or p_funded_cost_cents <= 0 then raise exception 'invalid grant'; end if;
  insert into project_wallet_grants(source_ref,user_id,funding_kind,credits,funded_cost_cents) values(p_ref,p_user,p_kind,p_credits,p_funded_cost_cents) on conflict(source_ref) do nothing;
  get diagnostics wrote=row_count;
  if wrote=0 then
    select * into old from project_wallet_grants where source_ref=p_ref;
    if old.user_id<>p_user or old.funding_kind<>p_kind or old.credits<>p_credits or old.funded_cost_cents<>p_funded_cost_cents then raise exception 'grant reference mismatch'; end if;
    return false;
  end if;
  insert into project_wallet_accounts(user_id,funding_kind,available_credits,available_cost_cents) values(p_user,p_kind,p_credits,p_funded_cost_cents)
    on conflict(user_id,funding_kind) do update set available_credits=project_wallet_accounts.available_credits+excluded.available_credits, available_cost_cents=project_wallet_accounts.available_cost_cents+excluded.available_cost_cents;
  insert into project_wallet_ledger(user_id,funding_kind,operation,ref,credits,cost_cents) values(p_user,p_kind,'grant',p_ref,p_credits,p_funded_cost_cents);
  return true;
end $$;

create function public.project_wallet_quote(p_user uuid,p_feature text,p_rate_version text,p_credits bigint,p_max_cost_cents bigint,p_expires_at timestamptz,p_retail_cents bigint,p_net_funding_cents bigint,p_reserve_cents bigint,p_minimum_contribution_cents bigint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.project_wallet_control%rowtype; q uuid;
begin
  select * into c from project_wallet_control where singleton;
  if not coalesce(c.enabled,false) then raise exception 'project wallet disabled'; end if;
  if p_user is null or p_feature is null or length(p_feature) not between 1 and 80 or p_rate_version is null or length(p_rate_version) not between 1 and 80
    or p_credits is null or p_credits<=0 or p_max_cost_cents is null or p_max_cost_cents<=0
    or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '15 minutes'
    or p_retail_cents is null or p_retail_cents<=0 or p_net_funding_cents is null or p_net_funding_cents<=0 or p_net_funding_cents>p_retail_cents
    or p_reserve_cents is null or p_reserve_cents<0 or p_minimum_contribution_cents is null or p_minimum_contribution_cents<=0
    or p_max_cost_cents>p_net_funding_cents-p_reserve_cents-p_minimum_contribution_cents
    or p_max_cost_cents > floor(p_retail_cents::numeric*c.max_cost_bps_of_retail/10000) then raise exception 'invalid or unprofitable quote'; end if;
  -- Credits are internal allowance units, never cash or provider tokens.
  -- Funding figures are trusted receipt allocations; the caller must verify their source.
  insert into project_wallet_quotes(user_id,feature,rate_version,credits,max_cost_cents,expires_at,retail_cents,net_funding_cents,reserve_cents,minimum_contribution_cents) values(p_user,p_feature,p_rate_version,p_credits,p_max_cost_cents,p_expires_at,p_retail_cents,p_net_funding_cents,p_reserve_cents,p_minimum_contribution_cents) returning id into q;
  return q;
end $$;

create function public.project_wallet_reserve(p_user uuid,p_quote uuid,p_kind text,p_request_key text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.project_wallet_control%rowtype; q public.project_wallet_quotes%rowtype; j public.project_wallet_jobs%rowtype;
  a public.project_wallet_accounts%rowtype; d public.project_wallet_daily_cost%rowtype; day date := (now() at time zone 'UTC')::date; result uuid;
begin
  select * into c from project_wallet_control where singleton;
  if not coalesce(c.enabled,false) or c.daily_user_cost_cap_cents<=0 or c.daily_global_cost_cap_cents<=0 then raise exception 'project wallet disabled or cost caps unset'; end if;
  if p_user is null or p_quote is null or p_kind is null or p_kind not in ('purchased','referral') or p_request_key is null or length(p_request_key) not between 1 and 200 then raise exception 'invalid reservation'; end if;
  -- Same global row serializes account-wide cost reservations across every user.
  insert into project_wallet_daily_cost(scope_key,budget_day) values('global',day) on conflict do nothing;
  select * into d from project_wallet_daily_cost where scope_key='global' and budget_day=day for update;
  select * into j from project_wallet_jobs where request_key=p_request_key;
  if found then
    if j.user_id<>p_user or j.quote_id<>p_quote or j.funding_kind<>p_kind then raise exception 'reservation reference mismatch'; end if;
    if j.status<>'reserved' then raise exception 'job already terminal'; end if;
    return j.id;
  end if;
  select * into q from project_wallet_quotes where id=p_quote for update;
  if not found or q.user_id<>p_user or q.expires_at<=now() then raise exception 'quote unavailable'; end if;
  if q.max_cost_cents > floor(q.retail_cents::numeric*c.max_cost_bps_of_retail/10000) or q.max_cost_cents>q.net_funding_cents-q.reserve_cents-q.minimum_contribution_cents then raise exception 'quote exceeds current margin limit'; end if;
  if d.reserved_cents+d.settled_cents+q.max_cost_cents>c.daily_global_cost_cap_cents then raise exception 'global cost cap'; end if;
  insert into project_wallet_daily_cost(scope_key,budget_day) values(p_user::text,day) on conflict do nothing;
  select * into d from project_wallet_daily_cost where scope_key=p_user::text and budget_day=day for update;
  if d.reserved_cents+d.settled_cents+q.max_cost_cents>c.daily_user_cost_cap_cents then raise exception 'member cost cap'; end if;
  select * into a from project_wallet_accounts where user_id=p_user and funding_kind=p_kind for update;
  if not found or a.available_credits<q.credits or a.available_cost_cents<q.max_cost_cents then raise exception 'insufficient funded balance'; end if;
  insert into project_wallet_jobs(request_key,quote_id,user_id,funding_kind,credits,max_cost_cents,budget_day) values(p_request_key,q.id,p_user,p_kind,q.credits,q.max_cost_cents,day) returning id into result;
  update project_wallet_accounts set available_credits=available_credits-q.credits,reserved_credits=reserved_credits+q.credits,available_cost_cents=available_cost_cents-q.max_cost_cents,reserved_cost_cents=reserved_cost_cents+q.max_cost_cents where user_id=p_user and funding_kind=p_kind;
  update project_wallet_daily_cost set reserved_cents=reserved_cents+q.max_cost_cents where budget_day=day and scope_key in ('global',p_user::text);
  insert into project_wallet_ledger(user_id,funding_kind,operation,ref,credits,cost_cents) values(p_user,p_kind,'reserve',result::text,q.credits,q.max_cost_cents);
  return result;
end $$;

-- Settle only after verified usable delivery and known provider cost. Customer price is
-- the accepted fixed quote. Release only after confirmed zero-cost failure/cancellation.
-- Unknown/running jobs remain reserved for reconciliation, never age-based refund.
create function public.project_wallet_finish(p_job uuid,p_release boolean,p_actual_cost_cents bigint)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.project_wallet_jobs%rowtype; desired text;
begin
  if p_release is null or p_actual_cost_cents is null or p_actual_cost_cents<0 or (p_release and p_actual_cost_cents<>0) then raise exception 'invalid finish'; end if;
  select * into j from project_wallet_jobs where id=p_job;
  if not found then raise exception 'unknown job'; end if;
  -- Lock order matches reserve: global day, member day, job, account.
  perform 1 from project_wallet_daily_cost where scope_key='global' and budget_day=j.budget_day for update;
  perform 1 from project_wallet_daily_cost where scope_key=j.user_id::text and budget_day=j.budget_day for update;
  select * into j from project_wallet_jobs where id=p_job for update;
  desired := case when p_release then 'released' else 'settled' end;
  if j.status<>'reserved' then
    if j.status<>desired or j.actual_cost_cents<>p_actual_cost_cents then raise exception 'terminal finish mismatch'; end if;
    return false;
  end if;
  if p_actual_cost_cents>j.max_cost_cents then raise exception 'actual cost exceeds reserved cap: reconcile manually'; end if;
  update project_wallet_accounts set reserved_credits=reserved_credits-j.credits,
    available_credits=available_credits+(case when p_release then j.credits else 0 end),
    reserved_cost_cents=reserved_cost_cents-j.max_cost_cents,
    available_cost_cents=available_cost_cents+j.max_cost_cents-p_actual_cost_cents
    where user_id=j.user_id and funding_kind=j.funding_kind;
  update project_wallet_daily_cost set reserved_cents=reserved_cents-j.max_cost_cents,settled_cents=settled_cents+p_actual_cost_cents where budget_day=j.budget_day and scope_key in ('global',j.user_id::text);
  update project_wallet_jobs set status=desired,actual_cost_cents=p_actual_cost_cents,finished_at=now() where id=j.id;
  insert into project_wallet_ledger(user_id,funding_kind,operation,ref,credits,cost_cents) values(j.user_id,j.funding_kind,case when p_release then 'release' else 'settle' end,j.id::text,j.credits,p_actual_cost_cents);
  return true;
end $$;
-- Read-only closure gate, usable while new wallet execution is disabled. A financial
-- history needs manual retention/refund reconciliation before a profile can be removed.
create function public.project_wallet_account_closure_status(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare u uuid; credits bigint; reserved bigint; jobs bigint; history boolean;
begin
  if auth.role()='service_role' then
    u:=p_user;
  else
    u:=auth.uid();
    if p_user is not null and p_user is distinct from u then raise exception 'not your wallet' using errcode='42501'; end if;
  end if;
  if u is null then raise exception 'authenticated wallet owner required' using errcode='42501'; end if;
  select coalesce(sum(available_credits),0),coalesce(sum(reserved_credits),0) into credits,reserved from project_wallet_accounts where user_id=u;
  select count(*) into jobs from project_wallet_jobs where user_id=u and status='reserved';
  select exists(select 1 from project_wallet_accounts where user_id=u)
    or exists(select 1 from project_wallet_grants where user_id=u)
    or exists(select 1 from project_wallet_quotes where user_id=u)
    or exists(select 1 from project_wallet_jobs where user_id=u)
    or exists(select 1 from project_wallet_ledger where user_id=u) into history;
  return jsonb_build_object('availableCredits',credits,'reservedCredits',reserved,'activeJobs',jobs,'hasFinancialHistory',history,'blocked',history or credits>0 or reserved>0 or jobs>0);
end $$;
revoke all on function public.project_wallet_account_closure_status(uuid) from public,anon;
grant execute on function public.project_wallet_account_closure_status(uuid) to authenticated,service_role;

revoke all on function public.project_wallet_grant(uuid,text,text,bigint,bigint),public.project_wallet_quote(uuid,text,text,bigint,bigint,timestamptz,bigint,bigint,bigint,bigint),public.project_wallet_reserve(uuid,uuid,text,text),public.project_wallet_finish(uuid,boolean,bigint) from public,anon,authenticated;
grant execute on function public.project_wallet_grant(uuid,text,text,bigint,bigint),public.project_wallet_quote(uuid,text,text,bigint,bigint,timestamptz,bigint,bigint,bigint,bigint),public.project_wallet_reserve(uuid,uuid,text,text),public.project_wallet_finish(uuid,boolean,bigint) to service_role;
commit;
