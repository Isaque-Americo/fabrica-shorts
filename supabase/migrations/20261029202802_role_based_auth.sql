-- Store authorization separately from user-editable auth metadata.
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'lojista', 'representante')),
  store_name text,
  rep_id text references public.docs(id) on delete restrict,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  constraint user_profiles_role_link_check check (
    (role = 'admin' and store_name is null and rep_id is null)
    or (role = 'lojista' and nullif(btrim(store_name), '') is not null)
    or (role = 'representante' and store_name is null and nullif(btrim(rep_id), '') is not null)
  )
);

create unique index user_profiles_store_name_unique
  on public.user_profiles (lower(store_name))
  where role = 'lojista';

create unique index user_profiles_rep_id_unique
  on public.user_profiles (rep_id)
  where role = 'representante';

alter table public.user_profiles enable row level security;
revoke all on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;

create policy user_profiles_read_self
  on public.user_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create function public.complete_initial_password_change()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_profiles
  set must_change_password = false
  where user_id = (select auth.uid())
    and must_change_password;
$$;
revoke all on function public.complete_initial_password_change() from public, anon;
grant execute on function public.complete_initial_password_change() to authenticated;

-- Lojistas only see their own orders; representatives see orders assigned to
-- their representative record. The admin retains full access.
alter table public.docs add column owner_id uuid references auth.users(id) on delete set null;
create index docs_owner_id_idx on public.docs (owner_id) where col = 'pedidos';

create sequence public.docs_pedidos_numero_seq;
grant usage on sequence public.docs_pedidos_numero_seq to authenticated;
select setval(
  'public.docs_pedidos_numero_seq',
  coalesce(max((data ->> 'numero')::bigint), 1),
  max((data ->> 'numero')::bigint) is not null
)
from public.docs
where col = 'pedidos' and data ->> 'numero' ~ '^[0-9]+$';

create function public.assign_pedido_numero()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.col = 'pedidos' then
    new.data := jsonb_set(
      coalesce(new.data, '{}'::jsonb),
      '{numero}',
      to_jsonb(nextval('public.docs_pedidos_numero_seq')),
      true
    );
  end if;
  return new;
end;
$$;
revoke all on function public.assign_pedido_numero() from public, anon, authenticated;

create trigger docs_assign_pedido_numero
  before insert on public.docs
  for each row execute function public.assign_pedido_numero();

-- These views deliberately run with the view owner's privileges so they can
-- project only safe fields from docs. The role checks are part of each view.
create view public.catalogo_produtos
with (security_barrier = true)
as
select
  d.id,
  jsonb_build_object(
    'ref', d.data -> 'ref',
    'nome', d.data -> 'nome',
    'preco', d.data -> 'preco',
    'precoG', coalesce(d.data -> 'precoG', d.data -> 'preco')
  ) as data
from public.docs d
where d.col = 'produtos'
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('lojista', 'representante')
  );

create view public.catalogo_representantes
with (security_barrier = true)
as
select
  d.id,
  jsonb_build_object(
    'nome', d.data -> 'nome',
    'regiao', d.data -> 'regiao'
  ) as data
from public.docs d
where d.col = 'reps'
  and exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'lojista'
      and p.rep_id = d.id
  );

create view public.catalogo_lojas
with (security_barrier = true)
as
select
  p.user_id::text as id,
  jsonb_build_object('nome', p.store_name) as data
from public.user_profiles p
where p.role = 'lojista'
  and exists (
    select 1 from public.user_profiles current_user_profile
    where current_user_profile.user_id = (select auth.uid())
      and (
        current_user_profile.role = 'admin'
        or (current_user_profile.role = 'representante' and p.rep_id = current_user_profile.rep_id)
      )
  );

revoke all on public.catalogo_produtos, public.catalogo_representantes, public.catalogo_lojas from anon, authenticated;
grant select on public.catalogo_produtos, public.catalogo_representantes, public.catalogo_lojas to authenticated;

