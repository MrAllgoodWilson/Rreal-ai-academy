-- Private durable backlog when a valid Stripe event lacks referral verification prerequisites.
-- Never acknowledge a successful reward simply because the payment event was received.
create table public.referral_reconciliation (
 event_id text primary key,
 event_type text not null,
 source_id text not null,
 state text not null check(state in ('pending','excluded','completed')),
 reason text not null,
 updated_at timestamptz not null default now()
);
alter table public.referral_reconciliation enable row level security;
revoke all on public.referral_reconciliation from anon,authenticated;
grant select,insert,update on public.referral_reconciliation to service_role;

-- Server sign-up can capture the explicit referral before a confirmation/sign-in round trip.
create function public.referral_attribute_at_signup(p_user uuid,p_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_ref uuid;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found or exists(select 1 from public.referral_first_payments where user_id=p_user) then return false;end if;
 select rp.user_id into v_ref from public.referral_profiles rp join public.referral_first_payments fp on fp.user_id=rp.user_id and fp.status='paid' where rp.code=p_code;
 if v_ref is null or v_ref=p_user then return false;end if;
 insert into public.referral_attributions(referred_user,referrer_user) values(p_user,v_ref) on conflict do nothing;
 return found;
end $$;
revoke all on function public.referral_attribute_at_signup(uuid,text) from public,anon,authenticated;
grant execute on function public.referral_attribute_at_signup(uuid,text) to service_role;
