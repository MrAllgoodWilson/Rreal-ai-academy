-- Disposable local database only; never run this against Supabase.
insert into public.profiles values(md5('referrer')::uuid);
select public.referral_record_first_payment(md5('referrer')::uuid,'referrer-session','referrer-customer',100,'usd',now()-interval '31 days');
-- Renewal/replay cannot issue another identity or paid qualification.
do $$begin
 if public.referral_record_first_payment(md5('referrer')::uuid,'referrer-renewal','referrer-customer',100,'usd',now()) then raise exception 'renewal counted'; end if;
end$$;
select set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
do $$begin
 if public.referral_attribute((select code from public.referral_profiles where user_id=auth.uid())) then raise exception 'self referral accepted'; end if;
end$$;
-- Forty independently paid new learners; all exceed the hold.
do $$declare i integer;v_uid uuid;v_code text;begin
 select code into v_code from public.referral_profiles where user_id=md5('referrer')::uuid;
 for i in 1..40 loop
  v_uid:=md5('learner-'||i)::uuid;
  insert into public.profiles values(v_uid);
  perform set_config('request.jwt.claim.sub',v_uid::text,false);
  if not public.referral_attribute(v_code) then raise exception 'attribution failed';end if;
  if public.referral_attribute(v_code) then raise exception 'duplicate attribution accepted';end if;
  perform public.referral_record_first_payment(v_uid,'session-'||i,'customer-'||i,100,'usd',now()-interval '31 days');
 end loop;
end$$;
-- One recently paid learner remains pending; one refunded learner never qualifies.
do $$declare i integer;v_uid uuid;v_code text;begin
 select code into v_code from public.referral_profiles where user_id=md5('referrer')::uuid;
 for i in 41..42 loop
  v_uid:=md5('learner-'||i)::uuid;
  insert into public.profiles values(v_uid);
  perform set_config('request.jwt.claim.sub',v_uid::text,false);
  perform public.referral_attribute(v_code);
  perform public.referral_record_first_payment(v_uid,'session-'||i,'customer-'||i,100,'usd',case when i=41 then now() else now()-interval '31 days' end);
 end loop;
 perform public.referral_reverse_payment('session-42','refunded');
end$$;
-- Wrong amount is rejected, and users cannot mutate raw payment tables.
do $$begin
 begin
  perform public.referral_record_first_payment(md5('learner-1')::uuid,'wrong-price','wrong-customer',null,'usd',now());
  raise exception 'wrong amount accepted';
 exception when raise_exception then
  if sqlerrm<>'invalid qualifying payment' then raise;end if;
 end;
end$$;
set role authenticated;
do $$begin
 begin
  perform 1 from public.referral_first_payments;
  raise exception 'raw payment table exposed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.referral_record_first_payment(md5('learner-1')::uuid,'bad','bad',100,'usd',now());
  raise exception 'member could qualify own payment';
 exception when insufficient_privilege then null;
 end;
end$$;
reset role;

-- Forced failure in the last reward write must roll back both reward and cohort.
create function public.fixture_reject_reward_members() returns trigger language plpgsql as $$begin raise exception 'fixture reward write failure'; end$$;
create trigger fixture_reward_failure before insert on public.referral_reward_members for each row execute function public.fixture_reject_reward_members();
do $$begin
 perform set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
 begin
  perform public.referral_dashboard();
  raise exception 'partial failure did not propagate';
 exception when raise_exception then
  if sqlerrm<>'fixture reward write failure' then raise;end if;
 end;
 if exists(select 1 from public.referral_rewards) or exists(select 1 from public.referral_reward_members) then raise exception 'partial reward committed';end if;
end$$;
drop trigger fixture_reward_failure on public.referral_reward_members;
drop function public.fixture_reject_reward_members();

select public.referral_track_visit((select code from public.referral_profiles where user_id=md5('referrer')::uuid));
select public.referral_track_visit((select code from public.referral_profiles where user_id=md5('referrer')::uuid));
