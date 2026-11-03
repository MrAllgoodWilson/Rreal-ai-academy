-- Security advisor follow-up.
-- Trigger-only function: never callable over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Only signed-in learners may submit their own courses.
revoke execute on function public.submit_custom_course(text) from public, anon;
grant execute on function public.submit_custom_course(text) to authenticated;
