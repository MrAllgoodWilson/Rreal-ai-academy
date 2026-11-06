#!/usr/bin/env bash
# Disposable PostgreSQL17 only. No host ports, network, volumes, passwords or production env.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
CONTAINER="rreal-wallet-test-${RANDOM}-$$"
LOGDIR=$(mktemp -d)
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$LOGDIR"; }
trap cleanup EXIT
# Uses a preinstalled image; never pulls from a registry.
docker image inspect pgvector/pgvector:pg17 >/dev/null
docker run --pull=never --name "$CONTAINER" --network none --memory 256m --cpus 1 -e POSTGRES_HOST_AUTH_METHOD=trust -d pgvector/pgvector:pg17 >/dev/null
for _ in $(seq 1 40); do if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
q() { docker exec -i "$CONTAINER" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
q <<'SQL'
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.profiles(id uuid primary key);
insert into public.profiles values('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
SQL
q < "$ROOT/supabase/migrations/0007_project_wallet.sql"
q <<'SQL'
-- Error expectations use subtransactions, so a failed assertion does not affect fixtures.
create function public.test_reject(stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then return; end;
  raise exception 'Expected rejection: %',stmt;
end$$;
create function public.wallet_test_quote(u uuid,f text,v text,c bigint,m bigint,e timestamptz) returns uuid language sql as $$
 select public.project_wallet_quote(u,f,v,c,m,e,100,95,5,30)
$$;
select test_reject($s$select project_wallet_grant('10000000-0000-4000-8000-000000000001','purchased','disabled',100,30)$s$);
update project_wallet_control set enabled=true,daily_user_cost_cap_cents=1000,daily_global_cost_cap_cents=1500;
select test_reject($s$select project_wallet_grant('10000000-0000-4000-8000-000000000001','purchased','zero',0,30)$s$);
select test_reject($s$select project_wallet_grant('10000000-0000-4000-8000-000000000001','purchased','negative',100,-1)$s$);
set role service_role;
select project_wallet_grant('10000000-0000-4000-8000-000000000001','purchased','stripe:fixture-session',100,40);
select project_wallet_grant('10000000-0000-4000-8000-000000000001','purchased','stripe:fixture-session',100,40);
select project_wallet_grant('10000000-0000-4000-8000-000000000002','referral','reward:fixture-uuid',100,20);
reset role;
do $$begin
 if (select available_credits from project_wallet_accounts where funding_kind='purchased')<>100 then raise exception 'duplicate grant'; end if;
 if (select count(*) from project_wallet_ledger where operation='grant')<>2 then raise exception 'duplicate ledger'; end if;
end$$;
select test_reject($s$select project_wallet_grant('10000000-0000-4000-8000-000000000002','purchased','stripe:fixture-session',100,40)$s$);
select test_reject($s$select wallet_test_quote('10000000-0000-4000-8000-000000000001','fixture','v1',100,31,now()+interval '5 min')$s$);
select test_reject($s$select wallet_test_quote('10000000-0000-4000-8000-000000000001','fixture','v1',100,0,now()+interval '5 min')$s$);
select test_reject($s$select wallet_test_quote('10000000-0000-4000-8000-000000000001','fixture','v1',100,20,now()-interval '1 min')$s$);
select test_reject($s$select project_wallet_quote('10000000-0000-4000-8000-000000000001','fixture','v1',100,20,now()+interval '5 min',100,25,5,10)$s$);
-- RLS and privileges, including service role direct financial mutation denial.
set role authenticated;
set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$begin
 if (select count(*) from project_wallet_accounts)<>1 then raise exception 'RLS isolation'; end if;
 if not (project_wallet_account_closure_status()->>'blocked')::boolean then raise exception 'missing closure gate'; end if;
 if (project_wallet_account_closure_status()->>'availableCredits')::int<>100 then raise exception 'incorrect closure balance'; end if;
end$$;
reset role;
select test_reject($s$set local role authenticated; select project_wallet_grant('10000000-0000-4000-8000-000000000001','purchased','hacked',100,40)$s$);
select test_reject($s$set local role service_role; update project_wallet_accounts set available_credits=999$s$);
select test_reject($s$set local role service_role; delete from project_wallet_ledger$s$);
select test_reject($s$set local role authenticated; select project_wallet_account_closure_status('10000000-0000-4000-8000-000000000002')$s$);
set request.jwt.claim.role='service_role';
set role service_role;
do $$begin if not (project_wallet_account_closure_status('10000000-0000-4000-8000-000000000002')->>'blocked')::boolean then raise exception 'service closure lookup'; end if; end$$;
reset role;
set request.jwt.claim.role='';
SQL
A=10000000-0000-4000-8000-000000000001
B=10000000-0000-4000-8000-000000000002
Q1=$(q -c "select wallet_test_quote('$A','fixture','v1',100,20,now()+interval '5 min')")
Q2=$(q -c "select wallet_test_quote('$A','fixture','v1',100,20,now()+interval '5 min')")
# Two sessions race to spend a balance that funds exactly one job.
(q -c "select project_wallet_reserve('$A','$Q1','purchased','race-one')" >"$LOGDIR/one" 2>&1) & P1=$!
(q -c "select project_wallet_reserve('$A','$Q2','purchased','race-two')" >"$LOGDIR/two" 2>&1) & P2=$!
set +e
wait "$P1"; S1=$?; wait "$P2"; S2=$?
set -e
if ! { { [ "$S1" = 0 ] && [ "$S2" != 0 ]; } || { [ "$S2" = 0 ] && [ "$S1" != 0 ]; }; }; then cat "$LOGDIR/one" "$LOGDIR/two"; exit 1; fi
J=$(q -c "select id from project_wallet_jobs where status='reserved'")
Q=$(q -c "select quote_id from project_wallet_jobs where id='$J'")
K=$(q -c "select request_key from project_wallet_jobs where id='$J'")
[ "$(q -c "select project_wallet_reserve('$A','$Q','purchased','$K')")" = "$J" ]
q -c "select test_reject(\$s\$select project_wallet_reserve('$B','$Q','referral','$K')\$s\$)" >/dev/null
q -c "select test_reject(\$s\$select project_wallet_finish('$J',true,1)\$s\$)" >/dev/null
q -c "select test_reject(\$s\$select project_wallet_finish('$J',false,21)\$s\$)" >/dev/null
[ "$(q -c "select status from project_wallet_jobs where id='$J'")" = reserved ]
[ "$(q -c "select project_wallet_finish('$J',true,0)")" = t ]
[ "$(q -c "select project_wallet_finish('$J',true,0)")" = f ]
[ "$(q -c "select available_credits from project_wallet_accounts where user_id='$A' and funding_kind='purchased'")" = 100 ]
Q3=$(q -c "select wallet_test_quote('$A','fixture','v1',100,20,now()+interval '5 min')")
J3=$(q -c "select project_wallet_reserve('$A','$Q3','purchased','settle-fixture')")
# Disabling new execution must not prevent reconciling already-reserved jobs.
q -c "update project_wallet_control set enabled=false" >/dev/null
[ "$(q -c "select project_wallet_finish('$J3',false,12)")" = t ]
[ "$(q -c "select project_wallet_finish('$J3',false,12)")" = f ]
q -c "select test_reject(\$s\$select project_wallet_finish('$J3',true,0)\$s\$)" >/dev/null
[ "$(q -c "select available_credits||':'||reserved_credits||':'||available_cost_cents||':'||reserved_cost_cents from project_wallet_accounts where user_id='$A' and funding_kind='purchased'")" = 0:0:28:0 ]
# Source buckets remain separate and global cost cap applies across users.
q -c "update project_wallet_control set enabled=true,daily_global_cost_cap_cents=20" >/dev/null
QB=$(q -c "select wallet_test_quote('$B','fixture','v1',100,20,now()+interval '5 min')")
q -c "select test_reject(\$s\$select project_wallet_reserve('$B','$QB','referral','global-cap')\$s\$)" >/dev/null
[ "$(q -c "select available_credits from project_wallet_accounts where user_id='$B' and funding_kind='referral'")" = 100 ]
q -c "do \$\$begin if exists(select 1 from project_wallet_accounts where available_credits<0 or reserved_credits<0 or available_cost_cents<0 or reserved_cost_cents<0) then raise exception 'negative balance'; end if; end\$\$;" >/dev/null
printf '%s\n' 'PASS PostgreSQL17 wallet: disabled defaults; grant replay/mismatch; invalid cost; RLS/direct-write denial; concurrent reservations; idempotent reserve/release/settle; failure rollback; source buckets; global cap; reconciliation after kill switch.'
