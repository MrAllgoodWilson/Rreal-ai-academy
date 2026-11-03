#!/usr/bin/env bash
# Behavioural SQL checks for migration 0002. Usage: PGHOST=<socket dir> PGPORT=<port> DB=<db> bash tests/sql/v2-checks.sh
Q="psql -U postgres -d ${DB:-r2} -q -t -A"
A=$($Q -c "insert into auth.users(email, raw_user_meta_data) values ('a$RANDOM@x.com','{\"username\":\"ann$RANDOM\"}') returning id" | head -1)
as() { $Q -c "set role authenticated; set request.jwt.claim.sub='$A'; $1" 2>&1 | grep -E "ERROR|^\{|^t$|^f$|^u-|^[0-9]" | head -1; }
echo "no sub, course lesson:     $(as "select complete_lesson('fly-tools',100)")"
$Q -c "insert into subscriptions(user_id,status,plan) values ('$A','active','monthly')"
echo "course lesson 1 (open):    $(as "select complete_lesson('web-plan',100)")"
echo "course lesson 3 (skip):    $(as "select complete_lesson('web-launch',100)")"
echo "program lesson 2 (skip):   $(as "select complete_lesson('what-ai-can-and-cant-do',100)")"
echo "quota 1/2: $(as "select consume_quota('gen',2,'month')")  2/2: $(as "select consume_quota('gen',2,'month')")  3/2: $(as "select consume_quota('gen',2,'month')")"
C="u-test-$RANDOM"
echo "create custom course:      $(as "select create_custom_course('{\"id\":\"$C\",\"name\":\"Pottery with AI\",\"level\":2,\"weeks\":[{\"number\":1,\"modules\":[{\"id\":\"$C-m1\",\"lessons\":[{\"id\":\"$C-l1\",\"title\":\"Intro\",\"xp\":9999}]}]}]}'::jsonb, 'teach me pottery')")"
echo "xp capped at 150:          $($Q -c "select xp from lessons where id='$C-l1'")"
echo "owner completes private:   $(as "select complete_lesson('$C-l1',100)")"
B=$($Q -c "insert into auth.users(email, raw_user_meta_data) values ('b$RANDOM@x.com','{\"username\":\"bob$RANDOM\"}') returning id" | head -1); $Q -c "insert into subscriptions(user_id,status,plan) values ('$B','active','monthly')"
asB() { $Q -c "set role authenticated; set request.jwt.claim.sub='$B'; $1" 2>&1 | grep -E "ERROR|^\{|^[0-9]" | head -1; }
echo "other user sees private:   $(asB "select count(*) from custom_courses where id='$C'")"
echo "other user completes:      $(asB "select complete_lesson('$C-l1',100)")"
$Q -c "set role service_role; select admin_set_course_status('$C','published')" >/dev/null
echo "after publish, other sees: $(asB "select count(*) from custom_courses where id='$C'")  completes: $(asB "select complete_lesson('$C-l1',100)")"
echo "user can't self-publish:   $(as "select admin_set_course_status('$C','published')")"
echo "bad course id rejected:    $(as "select create_custom_course('{\"id\":\"../evil\",\"name\":\"x\",\"weeks\":[]}'::jsonb)")"
