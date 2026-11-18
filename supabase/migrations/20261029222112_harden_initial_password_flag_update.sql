CREATE POLICY user_profiles_complete_initial_password_change
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND must_change_password = true
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND must_change_password = false
  );

GRANT UPDATE (must_change_password) ON public.user_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_initial_password_change()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  UPDATE public.user_profiles
  SET must_change_password = false
  WHERE user_id = (SELECT auth.uid())
    AND must_change_password;
$function$;
