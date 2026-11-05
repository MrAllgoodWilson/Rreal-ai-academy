#!/usr/bin/env bash
set -euo pipefail
# No network, production credentials, persistent volumes or downloaded images.
# Existing local postgres17 image only; all data discarded when the fixture container exits.
cd "$(dirname "$0")/../.."
docker image inspect pgvector/pgvector:pg17 >/dev/null
fixture="rreal-referrals-$RANDOM-$$"
trap 'docker rm -f "$fixture" >/dev/null 2>&1 || true' EXIT
docker run --name "$fixture" --memory=256m --cpus=1 --network none -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=referral_fixture -d pgvector/pgvector:pg17 >/dev/null
for _ in {1..30};do
 if docker logs "$fixture" 2>&1 | rg -q "PostgreSQL init process complete; ready for start up" && docker exec "$fixture" pg_isready -U postgres -d referral_fixture >/dev/null 2>&1;then break;fi
 sleep 1
done
q(){ docker exec -i "$fixture" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d referral_fixture "$@"; }
q <<'SQL'
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.profiles(id uuid primary key);
SQL
q < supabase/migrations/0006_referrals.sql
q < tests/sql/referrals-fixture.sql
pids=()
for _ in 1 2;do q -c "select set_config('request.jwt.claim.sub',md5('referrer')::uuid::text,false);select public.referral_dashboard();" > /dev/null & pids+=("$!");done
for pid in "${pids[@]}";do wait "$pid";done
q < tests/sql/referrals-assert.sql
