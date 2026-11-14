#!/usr/bin/env bash
# Behavioural + concurrency checks for migration 0011 against a DISPOSABLE Postgres 17 (stub + all migrations applied).
# Usage: PSQL="docker exec -i <container> psql -U postgres -d <db>" bash tests/sql/founders-0011-checks.sh
# Prints PASS/FAIL lines and a final count; exit code 1 on any failure.
set -u
Q="$PSQL -q -t -A -v ON_ERROR_STOP=1"
fail=0; pass=0
ok() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS $1"; else fail=$((fail+1)); echo "FAIL $1: got [$2] want [$3]"; fi; }
R=$RANDOM$RANDOM
A=$($Q -c "insert into auth.users(email, raw_user_meta_data) values ('a$R@x.test','{\"username\":\"a$R\"}') returning id" | head -1)
B=$($Q -c "insert into auth.users(email, raw_user_meta_data) values ('b$R@x.test','{\"username\":\"b$R\"}') returning id" | head -1)
$Q -c "insert into public.profiles(id, username) values ('$A','a$R'),('$B','b$R') on conflict do nothing" >/dev/null 2>&1
up() { $Q -c "select public.upsert_subscription_ordered('$1','$2','cus_$R','$3','monthly',null,false,$4)->>'$5'" 2>&1 | tail -1; }
st() { $Q -c "select status||':'||last_event_created from public.subscriptions where stripe_subscription_id='$1'"; }

# T1 first-insert race: 24 concurrent writers for a subscription id with NO existing row.
S1=sub_t1_$R
for i in $(seq 1 23); do up $S1 $A active $((100+i)) updated >/dev/null & done
up $S1 $A canceled 50 updated >/dev/null &
wait
ok "T1 one row after 24 concurrent first inserts" "$($Q -c "select count(*) from public.subscriptions where stripe_subscription_id='$S1'")" "1"
# The cancel (oldest timestamp) wins whenever it lands; later 'active' writers are then refused, so the stored clock is
# whatever the newest event applied BEFORE the cancel was - anything from 50 to 123 depending on arrival order.
ok "T1 terminal cancel wins even with the oldest clock" "$($Q -c "select status from public.subscriptions where stripe_subscription_id='$S1'")" "canceled"
ok "T1 clock never below the cancel and never beyond the newest event" "$($Q -c "select last_event_created between 50 and 123 from public.subscriptions where stripe_subscription_id='$S1'")" "t"

# T2 reorder: active(100) -> canceled(300) -> stale active(200) -> newer active(400): stays canceled.
S2=sub_t2_$R
ok "T2 insert active" "$(up $S2 $A active 100 updated)" "true"
ok "T2 cancel" "$(up $S2 $A canceled 300 updated)" "true"
ok "T2 stale active rejected" "$(up $S2 $A active 200 reason)" "stale_event_ignored"
ok "T2 newer active cannot resurrect" "$(up $S2 $A active 400 updated)" "false"
ok "T2 final" "$(st $S2)" "canceled:300"

# T3 ties: equal timestamp, higher priority wins, lower priority is stale; same status retry is accepted.
S3=sub_t3_$R
up $S3 $A active 500 updated >/dev/null
ok "T3 tie past_due beats active" "$(up $S3 $A past_due 500 updated)" "true"
ok "T3 tie active loses to past_due" "$(up $S3 $A active 500 updated)" "false"
ok "T3 same-status retry ok" "$(up $S3 $A past_due 500 updated)" "true"
ok "T3 strictly older rejected" "$(up $S3 $A unpaid 499 updated)" "false"
ok "T3 final" "$(st $S3)" "past_due:500"

# T4 a subscription can never be re-bound to another account.
ok "T4 other account rejected" "$(up $S3 $B active 900 reason)" "binding_mismatch"
ok "T4 owner unchanged" "$($Q -c "select user_id from public.subscriptions where stripe_subscription_id='$S3'")" "$A"

# T5 malformed input fails closed (error, nothing written).
S5=sub_t5_$R
ok "T5 null timestamp errors" "$($Q -c "select public.upsert_subscription_ordered('$S5','$A',null,'active','monthly',null,false,null)" 2>&1 | grep -c ERROR)" "1"
ok "T5 zero timestamp errors" "$($Q -c "select public.upsert_subscription_ordered('$S5','$A',null,'active','monthly',null,false,0)" 2>&1 | grep -c ERROR)" "1"
ok "T5 invalid status errors" "$($Q -c "select public.upsert_subscription_ordered('$S5','$A',null,'bogus','monthly',null,false,10)" 2>&1 | grep -c ERROR)" "1"
ok "T5 nothing written" "$($Q -c "select count(*) from public.subscriptions where stripe_subscription_id='$S5'")" "0"

# T6 webhook ledger: exactly one 'new' among concurrent claims; retry until completed; then duplicate.
E=evt_t6_$R
for i in $(seq 1 12); do $Q -c "select public.claim_webhook_event('$E','x')" & done > /tmp/hw-claims-$R.txt; wait
ok "T6 exactly one new claim of 12" "$(grep -c '^new$' /tmp/hw-claims-$R.txt)" "1"
ok "T6 others are retry" "$(grep -c '^retry$' /tmp/hw-claims-$R.txt)" "11"
ok "T6 still retryable before completion" "$($Q -c "select public.claim_webhook_event('$E','x')")" "retry"
$Q -c "select public.complete_webhook_event('$E')" >/dev/null
ok "T6 duplicate after completion" "$($Q -c "select public.claim_webhook_event('$E','x')")" "duplicate"
ok "T6 completing unknown event errors" "$($Q -c "select public.complete_webhook_event('evt_missing_$R')" 2>&1 | grep -c ERROR)" "1"

# T7 checkout binding: only the session's own account + mode can bind; second subscription refused.
C=cs_t7_$R
$Q -c "insert into public.checkout_bindings(session_id,user_id,kind,price_id,livemode) values ('$C','$A','founders','price_x',false)" >/dev/null
bind() { $Q -c "select public.bind_checkout_subscription('$1','$2','$3','cus_$R',$4)->>'bound'"; }
ok "T7 wrong account cannot bind" "$(bind $C $B sub_b7_$R false)" "false"
ok "T7 wrong mode cannot bind" "$(bind $C $A sub_b7_$R true)" "false"
ok "T7 unknown session cannot bind" "$(bind cs_nope_$R $A sub_b7_$R false)" "false"
ok "T7 owner binds" "$(bind $C $A sub_b7_$R false)" "true"
ok "T7 rebind same sub idempotent" "$(bind $C $A sub_b7_$R false)" "true"
ok "T7 different sub refused" "$(bind $C $A sub_other_$R false)" "false"

# T8 privileges: anon/authenticated cannot execute or read.
deny() { $Q -c "set role $1; $2" 2>&1 | grep -c "permission denied"; }
ok "T8 anon cannot upsert" "$(deny anon "select public.upsert_subscription_ordered('s','$A',null,'active','monthly',null,false,1)")" "1"
ok "T8 authenticated cannot claim" "$(deny authenticated "select public.claim_webhook_event('e','t')")" "1"
ok "T8 authenticated cannot bind" "$(deny authenticated "select public.bind_checkout_subscription('c','$A','s','c',false)")" "1"
ok "T8 anon cannot read bindings" "$($Q -c "set role anon; select count(*) from public.checkout_bindings" 2>&1 | grep -cE "permission denied|^0$")" "1"

echo "RESULT pass=$pass fail=$fail"
[ $fail -eq 0 ]
