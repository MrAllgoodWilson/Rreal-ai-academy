-- Atomic earned-feature-access fulfillment. Requires0006/0007/0008.
-- NO money is created here: a trusted operator must allocate verified, already-collected cash
-- to a promo reserve after fees, member delivery, refunds and required contribution.
create table public.referral_wallet_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 allowance_units_per_reward bigint not null default 1000 check(allowance_units_per_reward>0),
 allowance_version text not null default 'unapproved',
 funded_cost_per_reward_cents bigint not null default 0 check(funded_cost_per_reward_cents>=0),
 available_promo_cost_cents bigint not null default 0 check(available_promo_cost_cents>=0)
);
insert into public.referral_wallet_control(singleton) values(true);
create table public.referral_promo_fundings (
 source_ref text primary key check(length(source_ref) between 1 and 200),
 cost_cents bigint not null check(cost_cents>0),
 created_at timestamptz not null default now()
);
create table public.referral_promo_allocations (
 reward_id uuid primary key references public.referral_rewards(id),
 allowance_version text not null,
 allowance_units bigint not null check(allowance_units>0),
 funded_cost_cents bigint not null check(funded_cost_cents>0),
 created_at timestamptz not null default now()
);
alter table public.referral_wallet_control enable row level security;
alter table public.referral_promo_fundings enable row level security;
alter table public.referral_promo_allocations enable row level security;
revoke all on public.referral_wallet_control,public.referral_promo_fundings,public.referral_promo_allocations from public,anon,authenticated,service_role;
grant select,update(enabled,allowance_units_per_reward,allowance_version,funded_cost_per_reward_cents) on public.referral_wallet_control to service_role;
grant select on public.referral_promo_fundings,public.referral_promo_allocations to service_role;

create function public.referral_fund_promo_reserve(p_verified_source text,p_cost_cents bigint)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare old bigint;
begin
 if p_verified_source is null or length(p_verified_source) not between 1 and 200 or p_cost_cents is null or p_cost_cents<=0 then raise exception 'invalid verified promo funding';end if;
 perform 1 from public.referral_wallet_control where singleton for update;
 select cost_cents into old from public.referral_promo_fundings where source_ref=p_verified_source;
 if found then
  if old<>p_cost_cents then raise exception 'promo funding reference mismatch';end if;
  return false;
 end if;
 insert into public.referral_promo_fundings(source_ref,cost_cents) values(p_verified_source,p_cost_cents);
 update public.referral_wallet_control set available_promo_cost_cents=available_promo_cost_cents+p_cost_cents where singleton;
 return true;
end $$;
revoke all on function public.referral_fund_promo_reserve(text,bigint) from public,anon,authenticated;
grant execute on function public.referral_fund_promo_reserve(text,bigint) to service_role;

create function public.referral_credit_reward(p_reward uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.referral_rewards%rowtype;c public.referral_wallet_control%rowtype;did_grant boolean;owner_id uuid;
begin
 -- Match milestone lock order: referral profile, global promo reserve, reward.
 select user_id into owner_id from public.referral_rewards where id=p_reward;
 if not found then return false;end if;
 perform 1 from public.referral_profiles where user_id=owner_id for update;
 if not found then update public.referral_rewards set status='review' where id=p_reward and status='pending_wallet';return false;end if;
 select * into c from public.referral_wallet_control where singleton for update;
 select * into r from public.referral_rewards where id=p_reward for update;
 if not found or r.status<>'pending_wallet' then return false;end if;
 if c.funded_cost_per_reward_cents>floor(r.value_cents::numeric*(select max_cost_bps_of_retail from public.project_wallet_control where singleton)/10000) then return false;end if;
 if not c.enabled or c.allowance_version='unapproved' or c.funded_cost_per_reward_cents<=0 or c.available_promo_cost_cents<c.funded_cost_per_reward_cents or not coalesce((select enabled from public.project_wallet_control where singleton),false) then return false;end if;
 perform 1 from public.profiles where id=r.user_id;
 if not found or not exists(select 1 from public.referral_first_payments where user_id=r.user_id and status='paid') then
  update public.referral_rewards set status='review' where id=r.id;
  return false;
 end if;
 -- Never grant on the face value alone: consume only the separately approved provider-cost reserve.
 did_grant:=public.project_wallet_grant(r.user_id,'referral','referral:'||r.id::text,c.allowance_units_per_reward,c.funded_cost_per_reward_cents);
 if not did_grant then raise exception 'orphan referral wallet grant requires review';end if;
 insert into public.referral_promo_allocations(reward_id,allowance_version,allowance_units,funded_cost_cents)
 values(r.id,c.allowance_version,c.allowance_units_per_reward,c.funded_cost_per_reward_cents);
 update public.referral_wallet_control set available_promo_cost_cents=available_promo_cost_cents-c.funded_cost_per_reward_cents where singleton;
 update public.referral_rewards set status='credited' where id=r.id;
 return true;
end $$;
revoke all on function public.referral_credit_reward(uuid) from public,anon,authenticated;
grant execute on function public.referral_credit_reward(uuid) to service_role;

create function public.referral_reward_on_insert()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.referral_credit_reward(new.id);
 return new;
end $$;
revoke all on function public.referral_reward_on_insert() from public,anon,authenticated,service_role;
create trigger referral_credit_on_reward after insert on public.referral_rewards for each row execute function public.referral_reward_on_insert();

create function public.referral_credit_own_rewards()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare reward uuid;credited integer:=0;u uuid:=auth.uid();
begin
 if u is null then raise exception 'not authenticated' using errcode='42501';end if;
 for reward in select id from public.referral_rewards where user_id=u and status='pending_wallet' order by created_at,id loop
  if public.referral_credit_reward(reward) then credited:=credited+1;end if;
 end loop;
 return credited;
end $$;
revoke all on function public.referral_credit_own_rewards() from public,anon;
grant execute on function public.referral_credit_own_rewards() to authenticated;

-- Stop new referral-funded execution if an earned cohort or the referrer's own first receipt is reversed.
-- Already-running jobs require provider-state reconciliation, never an age-based refund.
create function public.referral_guard_job()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.funding_kind='referral' and (exists(select 1 from public.referral_rewards where user_id=new.user_id and status='review') or not exists(select 1 from public.referral_first_payments where user_id=new.user_id and status='paid')) then
  raise exception 'referral allowance under review';
 end if;
 return new;
end $$;
revoke all on function public.referral_guard_job() from public,anon,authenticated,service_role;
create trigger referral_review_guard before insert on public.project_wallet_jobs for each row execute function public.referral_guard_job();
