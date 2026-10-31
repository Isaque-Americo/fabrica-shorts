grant update (contact_email, contact_whatsapp)
  on public.user_profiles to authenticated;

drop policy if exists user_profiles_admin_update_own_contact
  on public.user_profiles;

create policy user_profiles_admin_update_own_contact
  on public.user_profiles
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and role = 'admin'
  )
  with check (
    user_id = (select auth.uid())
    and role = 'admin'
  );
