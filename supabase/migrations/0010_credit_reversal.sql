-- Reverse a credit-pack purchase after a full refund or a new dispute (service role only).
-- Idempotent: the same purchase ref is reversed at most once (ledger ref 'reversal:<ref>').
-- Takes back at most what the learner still holds; credits already spent are not clawed back below zero.
-- Returns the amount reversed and the shortfall (credits already spent) so the caller can log it.
create or replace function public.reverse_credits(p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_kind text; v_qty int; v_have int; v_take int; v_id bigint;
begin
  select user_id, kind, delta into v_user, v_kind, v_qty
    from public.credit_ledger where ref = p_ref and reason = 'purchase' and delta > 0;
  if v_user is null then return jsonb_build_object('reversed', 0, 'shortfall', 0, 'status', 'no_purchase'); end if;

  select balance into v_have from public.credit_balances where user_id = v_user and kind = v_kind for update;
  v_take := least(v_qty, coalesce(v_have, 0));

  insert into public.credit_ledger (user_id, kind, delta, reason, ref)
    values (v_user, v_kind, -v_take, 'reversal', 'reversal:' || p_ref)
    on conflict (ref) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('reversed', 0, 'shortfall', 0, 'status', 'already_reversed'); end if;

  if v_take > 0 then
    update public.credit_balances set balance = balance - v_take where user_id = v_user and kind = v_kind;
  end if;
  return jsonb_build_object('reversed', v_take, 'shortfall', v_qty - v_take, 'status', 'reversed');
end $$;
revoke all on function public.reverse_credits(text) from public, anon, authenticated;
grant execute on function public.reverse_credits(text) to service_role;

-- Give back what reverse_credits took when a dispute is later WON (service role only).
-- Idempotent (ledger ref 'restore:<ref>'). Restores exactly the amount the reversal took, never more.
create or replace function public.restore_credits(p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_kind text; v_taken int; v_id bigint;
begin
  select user_id, kind, -delta into v_user, v_kind, v_taken
    from public.credit_ledger where ref = 'reversal:' || p_ref and reason = 'reversal' and delta < 0;
  if v_user is null then return jsonb_build_object('restored', 0, 'status', 'no_reversal'); end if;

  insert into public.credit_ledger (user_id, kind, delta, reason, ref)
    values (v_user, v_kind, v_taken, 'restore', 'restore:' || p_ref)
    on conflict (ref) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('restored', 0, 'status', 'already_restored'); end if;

  insert into public.credit_balances (user_id, kind, balance) values (v_user, v_kind, v_taken)
    on conflict (user_id, kind) do update set balance = credit_balances.balance + excluded.balance;
  return jsonb_build_object('restored', v_taken, 'status', 'restored');
end $$;
revoke all on function public.restore_credits(text) from public, anon, authenticated;
grant execute on function public.restore_credits(text) to service_role;
