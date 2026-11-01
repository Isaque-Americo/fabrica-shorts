create table public.admin_password_recovery_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default now(),
  window_started_at timestamptz not null default now(),
  sends_in_window integer not null default 1,
  consented_at timestamptz not null default now(),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_password_recovery_attempts_check check (attempts between 0 and 5),
  constraint admin_password_recovery_sends_check check (sends_in_window between 1 and 5)
);

alter table public.admin_password_recovery_challenges enable row level security;
revoke all on table public.admin_password_recovery_challenges from public, anon, authenticated;
grant all on table public.admin_password_recovery_challenges to service_role;

create function public.begin_admin_password_recovery(
  p_user_id uuid,
  p_phone text,
  p_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  insert into public.admin_password_recovery_challenges (
    user_id, phone, code_hash, expires_at, attempts, last_sent_at, window_started_at, sends_in_window
  )
  values (
    p_user_id, p_phone, p_code_hash, now() + interval '10 minutes', 0, now(), now(), 1
  )
  on conflict (user_id) do update
  set
    phone = excluded.phone,
    code_hash = excluded.code_hash,
    expires_at = excluded.expires_at,
    attempts = 0,
    consumed_at = null,
    last_sent_at = now(),
    consented_at = now(),
    window_started_at = case
      when public.admin_password_recovery_challenges.window_started_at <= now() - interval '24 hours' then now()
      else public.admin_password_recovery_challenges.window_started_at
    end,
    sends_in_window = case
      when public.admin_password_recovery_challenges.window_started_at <= now() - interval '24 hours' then 1
      else public.admin_password_recovery_challenges.sends_in_window + 1
    end
  where public.admin_password_recovery_challenges.last_sent_at <= now() - interval '60 seconds'
    and (
      public.admin_password_recovery_challenges.window_started_at <= now() - interval '24 hours'
      or public.admin_password_recovery_challenges.sends_in_window < 5
    )
  returning user_id into v_user_id;

  return v_user_id is not null;
end;
$$;

create function public.verify_admin_password_recovery(
  p_user_id uuid,
  p_phone text,
  p_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  update public.admin_password_recovery_challenges
  set consumed_at = now()
  where user_id = p_user_id
    and phone = p_phone
    and code_hash = p_code_hash
    and expires_at > now()
    and attempts < 5
    and consumed_at is null
  returning user_id into v_user_id;

  if v_user_id is not null then
    return true;
  end if;

  update public.admin_password_recovery_challenges
  set attempts = attempts + 1
  where user_id = p_user_id
    and phone = p_phone
    and expires_at > now()
    and attempts < 5
    and consumed_at is null;

  return false;
end;
$$;

revoke all on function public.begin_admin_password_recovery(uuid, text, text) from public, anon, authenticated;
revoke all on function public.verify_admin_password_recovery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.begin_admin_password_recovery(uuid, text, text) to service_role;
grant execute on function public.verify_admin_password_recovery(uuid, text, text) to service_role;
