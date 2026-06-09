
-- Admin SELECT policies so admin dashboard works without service role key
CREATE POLICY "admin_select_users" ON public.users
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_org_members" ON public.org_members
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_keywords" ON public.keywords
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_competitors" ON public.competitors
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_inbox_items" ON public.inbox_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_select_scan_jobs" ON public.scan_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
