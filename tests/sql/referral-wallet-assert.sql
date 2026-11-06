-- Existing three cohorts: first under dispute review, second/third pending before wallet launch.
do $$declare i integer;u uuid;begin
 if exists(select 1 from public.project_wallet_grants) then raise exception 'disabled reserve invented funding';end if;
 update public.project_wallet_control set enabled=true where singleton;
 update public.referral_wallet_control set enabled=true,allowance_version='fixture-approved-v1',funded_cost_per_reward_cents=200 where singleton;
 perform set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
 if public.referral_credit_own_rewards()<>0 then raise exception 'unfunded grant';end if;
 perform public.referral_fund_promo_reserve('fixture-verified-real-cash-allocation',500);
 if public.referral_fund_promo_reserve('fixture-verified-real-cash-allocation',500) then raise exception 'duplicate funding';end if;
 if public.referral_credit_own_rewards()<>2 then raise exception 'pending earned rewards not atomically credited';end if;
 if public.referral_credit_own_rewards()<>0 then raise exception 'reward replay';end if;
 if(select available_promo_cost_cents from public.referral_wallet_control where singleton)<>100 then raise exception 'reserve deduction wrong';end if;
 if(select count(*) from public.referral_promo_allocations)<>2 then raise exception 'allocation not once per reward';end if;
 if(select available_credits from public.project_wallet_accounts where user_id=md5('referrer')::uuid and funding_kind='referral')<>2000 then raise exception 'feature allowance wrong';end if;
 for i in 63..82 loop
  u:=md5('learner-'||i)::uuid;
  insert into public.profiles values(u);
  perform public.referral_attribute_at_signup(u,(select code from public.referral_profiles where user_id=md5('referrer')::uuid));
  perform public.referral_record_first_payment(u,'session-'||i,'customer-'||i,100,'usd',now());
 end loop;
 if(select count(*) from public.referral_rewards where status='pending_wallet')<>1 then raise exception 'new reward must remain accurately pending when promo budget exhausted';end if;
end$$;
-- A failure in the final wallet ledger write cannot consume the promo reserve or mark reward credited.
create function public.fixture_wallet_failure() returns trigger language plpgsql as $$begin raise exception 'fixture wallet failure';end$$;
create trigger fixture_wallet_write_failure before insert on public.project_wallet_ledger for each row execute function public.fixture_wallet_failure();
do $$begin
 perform public.referral_fund_promo_reserve('fixture-extra-verified-allocation',200);
 perform set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
 begin
  perform public.referral_credit_own_rewards();
  raise exception 'wallet error swallowed';
 exception when raise_exception then if sqlerrm<>'fixture wallet failure' then raise;end if;end;
 if(select available_promo_cost_cents from public.referral_wallet_control where singleton)<>300 then raise exception 'failed grant consumed reserve';end if;
 if(select count(*) from public.referral_rewards where status='pending_wallet')<>1 then raise exception 'failed grant marked credited';end if;
 if(select count(*) from public.referral_promo_allocations)<>2 then raise exception 'failed grant left allocation';end if;
end$$;
drop trigger fixture_wallet_write_failure on public.project_wallet_ledger;
drop function public.fixture_wallet_failure();
do $$begin
 perform set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
 if public.referral_credit_own_rewards()<>1 then raise exception 'recovery grant failed';end if;
 if(select available_promo_cost_cents from public.referral_wallet_control where singleton)<>100 then raise exception 'recovery reserve wrong';end if;
 if(select count(*) from public.project_wallet_grants)<>3 then raise exception 'duplicate/missing wallet grant';end if;
end$$;
-- A disputed source cohort must stop new referral-funded provider reservations.
do $$declare q uuid;begin
 update public.project_wallet_control set daily_user_cost_cap_cents=1000,daily_global_cost_cap_cents=1000 where singleton;
 insert into public.project_wallet_quotes(user_id,feature,rate_version,retail_cents,net_funding_cents,reserve_cents,minimum_contribution_cents,credits,max_cost_cents,expires_at)
 values(md5('referrer')::uuid,'fixture-feature','fixture-v1',100,90,20,20,50,10,now()+interval '5 minutes') returning id into q;
 begin
  perform public.project_wallet_reserve(md5('referrer')::uuid,q,'referral','fixture-disputed-attempt');
  raise exception 'disputed allowance spent';
 exception when raise_exception then if sqlerrm<>'referral allowance under review' then raise;end if;end;
 if exists(select 1 from public.project_wallet_jobs) then raise exception 'disputed job created';end if;
end$$;
select 'PASS: funded allowance grant + reward + reserve atomic, replay-safe, no unfunded spend';
