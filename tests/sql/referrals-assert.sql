do $$declare v_data jsonb;v_seen uuid;i integer;begin
 if (select count(*) from public.referral_rewards)<>2 then raise exception 'concurrent duplicate/missing reward'; end if;
 if (select count(*) from public.referral_reward_members)<>40 then raise exception 'reward grouping not exactly40'; end if;
 if (select sum(value_cents) from public.referral_rewards)<>2000 then raise exception 'wrong reward value';end if;
 perform set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
 v_data:=public.referral_dashboard();
 if (v_data->>'visits')::int<>2 or (v_data->>'signups')::int<>42 then raise exception 'aggregate activity wrong';end if;
 if (v_data->>'qualified')::int<>40 or (v_data->>'pending')::int<>1 then raise exception 'hold/refund boundary wrong: %',v_data;end if;
 if (select count(*) from public.referral_rewards)<>2 then raise exception 'dashboard replay created reward';end if;
 select id into v_seen from public.referral_rewards limit 1;
 perform set_config('request.jwt.claim.sub',md5('learner-1')::uuid::text,false);
 if public.referral_acknowledge(v_seen) then raise exception 'cross-member notice acknowledged';end if;
 perform set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);
 if not public.referral_acknowledge(v_seen) then raise exception 'own notice acknowledgement failed';end if;
 perform public.referral_reverse_payment('session-1','disputed');
 if (select count(*) from public.referral_rewards where status='review')<>1 then raise exception 'issued reward not flagged after dispute';end if;
-- A paid member deleting their profile must not break deletion or erase reward financial markers.
 delete from public.profiles where id=md5('learner-40')::uuid;
 if not exists(select 1 from public.referral_first_payments where user_id=md5('learner-40')::uuid) then raise exception 'payment marker deleted';end if;
 if exists(select 1 from public.referral_profiles where user_id=md5('learner-40')::uuid) then raise exception 'deleted share link retained';end if;
-- Owner immediate policy applies to new payments, with reward settlement in the payment transaction.
 update public.referral_policy set hold_days=0;
 for i in 43..62 loop
  insert into public.profiles values(md5('learner-'||i)::uuid);
  perform set_config('request.jwt.claim.sub',md5('learner-'||i)::uuid::text,false);
  perform public.referral_attribute((select code from public.referral_profiles where user_id=md5('referrer')::uuid));
  perform public.referral_record_first_payment(md5('learner-'||i)::uuid,'session-'||i,'customer-'||i,100,'usd',now());
 end loop;
 if(select count(*) from public.referral_rewards)<>3 then raise exception 'immediate paid-event cohort not issued';end if;
end$$;
select 'PASS: concurrent repeat milestones, replay, hold, reversals, role/identity isolation';
