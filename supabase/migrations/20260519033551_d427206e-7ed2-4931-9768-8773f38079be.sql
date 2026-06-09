CREATE OR REPLACE FUNCTION public.plan_limits(_plan text)
 RETURNS TABLE(max_keywords integer, max_competitors integer, max_orgs integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  SELECT
    CASE _plan WHEN 'starter' THEN 10 WHEN 'growth' THEN 30 WHEN 'agency' THEN 50 ELSE 10 END,
    CASE _plan WHEN 'starter' THEN 3 WHEN 'growth' THEN 9 WHEN 'agency' THEN 15 ELSE 3 END,
    CASE _plan WHEN 'starter' THEN 1 WHEN 'growth' THEN 3 WHEN 'agency' THEN 999 ELSE 1 END;
$function$;