#!/usr/bin/env bash
# Behavioural checks for migration 0010 (free access). DISPOSABLE LOCAL POSTGRES ONLY: it creates and drops its own database and
# must never be pointed at Supabase or any shared server. No network, no production credentials.
#
#   PSQL="runuser -u postgres -- psql -X -q -t -A" bash tests/sql/free-access-checks.sh      (container)
#   PSQL="psql -X -q -t -A -U postgres -h 127.0.0.1" bash tests/sql/free-access-checks.sh     (any local server)
set -uo pipefail
cd "$(dirname "$0")/../.."
PSQL=${PSQL:-"psql -X -q -t -A -U postgres"}
MIG10=${MIG10:-supabase/migrations/0010_free_access.sql}   # override only for the negative-control run
DB="free_access_$$_$RANDOM"
fail=0; pass=0
admin() { $PSQL -d postgres "$@"; }
q()     { $PSQL -d "$DB" "$@"; }
cleanup() { admin -c "drop database if exists $DB with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

check() { # name, actual, extended-regex the actual must match
  if [[ "$2" =~ $3 ]]; then pass=$((pass+1)); echo "PASS  $1"; else fail=$((fail+1)); echo "FAIL  $1  (got: ${2:0:140})"; fi
}
as() { # user-id, sql -> first meaningful line (result or ERROR)
  q -c "set role authenticated; set request.jwt.claim.sub='$1'; $2" 2>&1 | grep -E "ERROR|^\{|^t$|^f$|^[0-9]|^u-|permission denied" | head -1
}
mkuser() { q -c "insert into auth.users(email, raw_user_meta_data) values ('$1@fixture.test','{\"username\":\"$1\"}') returning id" | head -1; }

admin -v ON_ERROR_STOP=1 -c "create database $DB" || { echo "cannot create disposable database"; exit 2; }
q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create extension if not exists citext;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
SQL
# UPTO = highest base migration to apply before 0010. Production currently has 0001-0005 applied, so that is the default;
# run UPTO=9 as well to prove 0010 also sits correctly on top of the not-yet-released referral/wallet migrations.
UPTO=${UPTO:-5}
for f in $(ls supabase/migrations/000?_*.sql | sort); do
  n=$((10#$(basename "$f" | cut -c1-4))); [ "$n" -le "$UPTO" ] || continue
  q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>/tmp/fa-mig.err || { echo "PRECONDITION FAIL: $f did not apply: $(grep -m2 ERROR /tmp/fa-mig.err)"; exit 3; }
done
q -v ON_ERROR_STOP=1 -f supabase/seed.sql >/dev/null 2>/tmp/fa-mig.err || { echo "PRECONDITION FAIL: seed.sql: $(grep -m2 ERROR /tmp/fa-mig.err)"; exit 3; }
echo "preconditions: migrations 0001-000$UPTO + seed applied on a fresh disposable database"
echo "parity (compare with production): complete_lesson $(q -c "select md5(pg_get_functiondef('public.complete_lesson(text,integer,text)'::regprocedure))||' len='||length(pg_get_functiondef('public.complete_lesson(text,integer,text)'::regprocedure))")"
echo "parity (compare with production): create_custom_course $(q -c "select md5(pg_get_functiondef('public.create_custom_course(jsonb,text)'::regprocedure))||' len='||length(pg_get_functiondef('public.create_custom_course(jsonb,text)'::regprocedure))")"

# ── a paying member exists BEFORE the migration; it must be untouched by it ──
PAID=$(mkuser paid_member)
q -c "insert into subscriptions(user_id,status,plan) values ('$PAID','active','monthly')"
BEFORE=$(q -c "select count(*)||':'||string_agg(status,',') from subscriptions")

q -v ON_ERROR_STOP=1 >/dev/null 2>/tmp/fa-mig.err < "$MIG10"; check "migration 0010 applies" "$([ $? -eq 0 ] && echo ok || cat /tmp/fa-mig.err)" "^ok$"
q -v ON_ERROR_STOP=1 >/dev/null 2>/tmp/fa-mig.err < "$MIG10"; check "migration 0010 re-applies (idempotent)" "$([ $? -eq 0 ] && echo ok || cat /tmp/fa-mig.err)" "^ok$"
check "existing subscriptions are untouched by the migration" "$(q -c "select count(*)||':'||string_agg(status,',') from subscriptions")" "^$BEFORE$"
check "free_access is ON after the migration" "$(q -c "select public.free_access_enabled()")" "^t$"

FREE=$(mkuser free_learner)
C="u-free-$RANDOM"
COURSE="{\"id\":\"$C\",\"name\":\"Pottery with AI\",\"level\":2,\"weeks\":[{\"number\":1,\"modules\":[{\"id\":\"$C-m1\",\"lessons\":[{\"id\":\"$C-l1\",\"title\":\"Intro\",\"xp\":50}]}]}]}"

# ── free access ON: a learner with NO subscription can learn ──
check "free learner has no subscription row" "$(q -c "select count(*) from subscriptions where user_id='$FREE'")" "^0$"
check "ON: free learner completes a lesson" "$(as "$FREE" "select complete_lesson('web-plan',100)")" "^\{"
check "ON: free learner saves a custom course" "$(as "$FREE" "select create_custom_course('$COURSE'::jsonb, 'teach me pottery')")" "^$C$"

# ── fair use still applies to a free learner (no unmetered AI spend) ──
r1=$(as "$FREE" "select consume_quota('coach',2,'day')"); r2=$(as "$FREE" "select consume_quota('coach',2,'day')"); r3=$(as "$FREE" "select consume_quota('coach',2,'day')")
check "ON: quota allows 2 uses then blocks the 3rd for a free learner" "$r1$r2$r3" "^ttf$"

# ── learners cannot see or change the switch, or probe other people's access ──
check "learner cannot read app_settings" "$(as "$FREE" "select * from public.app_settings")" "permission denied"
check "learner cannot turn the switch off" "$(as "$FREE" "update public.app_settings set value='false'::jsonb where key='free_access'")" "permission denied"
check "learner cannot call has_access()" "$(as "$FREE" "select public.has_access('$PAID')")" "permission denied"
check "unauthenticated caller is refused" "$(q -c "set role anon; select complete_lesson('web-plan',100)" 2>&1 | grep -m1 -E "ERROR|permission denied")" "permission denied|not authenticated"

# ── kill switch OFF restores the old rule exactly ──
q -c "update public.app_settings set value='false'::jsonb where key='free_access'" >/dev/null
NOSUB=$(mkuser no_sub_after_off)
check "OFF: learner without a subscription is refused (lesson)" "$(as "$NOSUB" "select complete_lesson('web-plan',100)")" "subscription required"
check "OFF: learner without a subscription is refused (custom course)" "$(as "$NOSUB" "select create_custom_course('{\"id\":\"u-off-$RANDOM\",\"name\":\"x\",\"weeks\":[]}'::jsonb)")" "subscription required"
check "OFF: an existing paying member is unaffected" "$(as "$PAID" "select complete_lesson('web-plan',100)")" "^\{"

# ── re-running the migration must NOT flip a deliberately-off switch back on ──
q -v ON_ERROR_STOP=1 >/dev/null 2>&1 < "$MIG10"
check "re-applying the migration keeps a switch that was set to OFF" "$(q -c "select public.free_access_enabled()")" "^f$"

# ── turning it back ON restores free access (reversible both ways) ──
q -c "update public.app_settings set value='true'::jsonb where key='free_access'" >/dev/null
check "ON again: the previously refused learner can now learn" "$(as "$NOSUB" "select complete_lesson('web-plan',100)")" "^\{"
check "prerequisite rules still apply while free (skipping ahead is refused)" "$(as "$NOSUB" "select complete_lesson('web-launch',100)")" "prerequisite|ERROR"

echo; echo "free-access checks: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
