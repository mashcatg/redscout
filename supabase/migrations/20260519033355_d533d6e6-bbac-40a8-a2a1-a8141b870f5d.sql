-- Wire missing trigger so signups create public.users row, and backfill existing auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.users (id, email, name, avatar_url, plan)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name'),
  u.raw_user_meta_data->>'avatar_url',
  CASE WHEN u.email = 'mashcatg@gmail.com' THEN 'agency'::plan_type ELSE 'starter'::plan_type END
FROM auth.users u
LEFT JOIN public.users pu ON pu.id = u.id
WHERE pu.id IS NULL;