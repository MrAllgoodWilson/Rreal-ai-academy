-- Referral foundation. Do not apply until reviewed; no existing balances are converted.
-- A reward is a $10 project-credit entitlement pending the reviewed wallet adapter.
-- Financial qualification/reward markers retain pseudonymous UUIDs without blocking account deletion.
-- Referral share profiles cascade on deletion; retention/disclosure and orphan reward reconciliation require review.
create table public.referral_policy (
  id boolean primary key default true check (id),
  threshold integer not null default 20 check (threshold > 0),
  reward_cents integer not null default 1000 check (reward_cents > 0),
  hold_days integer not null default 0 check (hold_days between 0 and 365),
  version integer not null default 1 check (version > 0)
);
insert into public.referral_policy(id) values(true);
create table public.referral_first_payments (
  user_id uuid primary key,
  session_id text not null unique,
  customer_id text not null unique,
  paid_at timestamptz not null,
  qualified_at timestamptz not null,
  status text not null default 'paid' check(status in ('paid','refunded','disputed'))
);
create table public.referral_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  visits bigint not null default 0 check(visits>=0),
  created_at timestamptz not null default now()
);
create table public.referral_attributions (
  referred_user uuid primary key,
  referrer_user uuid not null,
  created_at timestamptz not null default now(),
  check(referred_user <> referrer_user)
);
create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  milestone integer not null check(milestone > 0),
  value_cents integer not null check(value_cents > 0),
  policy_version integer not null,
  status text not null default 'pending_wallet' check(status in ('pending_wallet','credited','review')),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique(user_id,milestone)
);
create table public.referral_reward_members (
  referred_user uuid primary key references public.referral_first_payments(user_id),
  reward_id uuid not null references public.referral_rewards(id)
);
create index referral_attributions_referrer_idx on public.referral_attributions(referrer_user);
create index referral_rewards_user_idx on public.referral_rewards(user_id);
alter table public.referral_policy enable row level security;
alter table public.referral_first_payments enable row level security;
alter table public.referral_profiles enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_reward_members enable row level security;
-- All access is through narrow RPCs below. Raw referred identities/payment IDs are never exposed.
revoke all on public.referral_policy,public.referral_first_payments,public.referral_profiles,public.referral_attributions,public.referral_rewards,public.referral_reward_members from anon,authenticated;

-- Called ONLY by a signature-verified, account/mode/product-validated payment handler.
-- The adapter must establish this is the learner's first settled monthly $1 subscription payment.
create function public.referral_record_first_payment(p_user uuid,p_session text,p_customer text,p_amount integer,p_currency text,p_paid_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_hold integer;v_ref uuid;
begin
  if p_amount is distinct from 100 or p_currency is distinct from 'usd' or p_paid_at is null or p_paid_at > now() or coalesce(p_session,'')='' or coalesce(p_customer,'')='' then
    raise exception 'invalid qualifying payment';
  end if;
  -- Serialize attribution/payment on the same learner to make signup attribution immutable after payment.
  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'unknown learner'; end if;
  select hold_days into strict v_hold from public.referral_policy where id;
  insert into public.referral_first_payments(user_id,session_id,customer_id,paid_at,qualified_at)
  values(p_user,p_session,p_customer,p_paid_at,p_paid_at+make_interval(days=>v_hold)) on conflict do nothing;
  if not found then return false; end if;
  insert into public.referral_profiles(user_id) values(p_user) on conflict do nothing;
  select referrer_user into v_ref from public.referral_attributions where referred_user=p_user;
  if v_ref is not null then perform public.referral_settle_rewards(v_ref);end if;
  return true;
end $$;
revoke all on function public.referral_record_first_payment(uuid,text,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.referral_record_first_payment(uuid,text,text,integer,text,timestamptz) to service_role;

create function public.referral_attribute(p_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_ref uuid;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  perform 1 from public.profiles where id=v_uid for update;
  if exists(select 1 from public.referral_first_payments where user_id=v_uid) then return false; end if;
  select rp.user_id into v_ref from public.referral_profiles rp join public.referral_first_payments fp on fp.user_id=rp.user_id and fp.status='paid' where rp.code=p_code;
  if v_ref is null or v_ref=v_uid then return false; end if;
  insert into public.referral_attributions(referred_user,referrer_user) values(v_uid,v_ref) on conflict do nothing;
  return found;
end $$;
revoke all on function public.referral_attribute(text) from public,anon;
grant execute on function public.referral_attribute(text) to authenticated;

-- Refund/dispute adapter must call this, including after a reward is issued.
-- Never claw money back silently: affected issued rewards are flagged for review.
create function public.referral_reverse_payment(p_session text,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid;
begin
  if p_status not in ('refunded','disputed') then raise exception 'invalid reversal'; end if;
  update public.referral_first_payments set status=p_status where session_id=p_session returning user_id into v_uid;
  update public.referral_rewards set status='review' where id in(select reward_id from public.referral_reward_members where referred_user=v_uid);
end $$;
revoke all on function public.referral_reverse_payment(text,text) from public,anon,authenticated;
grant execute on function public.referral_reverse_payment(text,text) to service_role;

-- Atomic paid-event reward issuance; dashboard reconciliation uses the same serialized function.
create function public.referral_settle_rewards(p_referrer uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_policy public.referral_policy;v_ids uuid[];v_milestone integer;v_reward uuid;
begin
 perform 1 from public.referral_profiles where user_id=p_referrer for update;
 if not found or not exists(select 1 from public.referral_first_payments where user_id=p_referrer and status='paid') then return;end if;
 select * into strict v_policy from public.referral_policy where id;
  -- Lock qualifying payments while grouping so a concurrent reversal cannot slip through.
  loop
    select array_agg(q.user_id) into v_ids from (
      select fp.user_id from public.referral_first_payments fp join public.referral_attributions a on a.referred_user=fp.user_id
      where a.referrer_user=p_referrer and fp.status='paid' and fp.qualified_at<=now()
      and not exists(select 1 from public.referral_reward_members rm where rm.referred_user=fp.user_id)
      order by fp.paid_at,fp.user_id limit v_policy.threshold for update of fp
    ) q;
    exit when coalesce(cardinality(v_ids),0)<v_policy.threshold;
    select coalesce(max(milestone),0)+1 into v_milestone from public.referral_rewards where user_id=p_referrer;
    insert into public.referral_rewards(user_id,milestone,value_cents,policy_version) values(p_referrer,v_milestone,v_policy.reward_cents,v_policy.version) returning id into v_reward;
    insert into public.referral_reward_members(referred_user,reward_id) select unnest(v_ids),v_reward;
  end loop;
end $$;
revoke all on function public.referral_settle_rewards(uuid) from public,anon,authenticated;
grant execute on function public.referral_settle_rewards(uuid) to service_role;

create function public.referral_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_code text;v_policy public.referral_policy;v_ids uuid[];v_reward uuid;v_milestone integer;v_eligible integer;v_pending integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select code into v_code from public.referral_profiles where user_id=v_uid for update;
  select * into strict v_policy from public.referral_policy where id;
  if v_code is null or not exists(select 1 from public.referral_first_payments where user_id=v_uid and status='paid') then return jsonb_build_object('eligible',false,'threshold',v_policy.threshold,'rewardCents',v_policy.reward_cents,'holdDays',v_policy.hold_days); end if;
  perform public.referral_settle_rewards(v_uid);
  select count(*) into v_eligible from public.referral_attributions a join public.referral_first_payments fp on fp.user_id=a.referred_user where a.referrer_user=v_uid and fp.status='paid' and fp.qualified_at<=now();
  select count(*) into v_pending from public.referral_attributions a join public.referral_first_payments fp on fp.user_id=a.referred_user where a.referrer_user=v_uid and fp.status='paid' and fp.qualified_at>now();
  return jsonb_build_object('eligible',true,'code',v_code,'visits',(select visits from public.referral_profiles where user_id=v_uid),'signups',(select count(*) from public.referral_attributions where referrer_user=v_uid),'qualified',v_eligible,'pending',v_pending,'threshold',v_policy.threshold,'rewardCents',v_policy.reward_cents,'holdDays',v_policy.hold_days,
    'rewards',coalesce((select jsonb_agg(jsonb_build_object('id',id,'milestone',milestone,'valueCents',value_cents,'status',status,'seen',seen_at is not null) order by milestone) from public.referral_rewards where user_id=v_uid),'[]'::jsonb));
end $$;
revoke all on function public.referral_dashboard() from public,anon;
grant execute on function public.referral_dashboard() to authenticated;

create function public.referral_acknowledge(p_reward uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.referral_rewards set seen_at=coalesce(seen_at,now()) where id=p_reward and user_id=auth.uid();
  return found;
end $$;
revoke all on function public.referral_acknowledge(uuid) from public,anon;
grant execute on function public.referral_acknowledge(uuid) to authenticated;

-- Anonymous visitors never get profile/payment data. Server route increments only an aggregate.
create function public.referral_track_visit(p_code text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.referral_profiles rp set visits=visits+1 where code=p_code and exists(select 1 from public.referral_first_payments fp where fp.user_id=rp.user_id and fp.status='paid');
 return found;
end $$;
revoke all on function public.referral_track_visit(text) from public,anon,authenticated;
grant execute on function public.referral_track_visit(text) to service_role;
