-- Admin principal e permissões por checklist (aditivo: docs_admin_all continua até a etapa de corte).

alter table public.user_profiles
  add column if not exists is_principal boolean not null default false,
  add column if not exists permissoes jsonb;

update public.user_profiles set is_principal = true
where role = 'admin' and contact_name = 'Isaque';

-- Só o servidor (service_role / Edge Function) muda principal e permissões.
revoke update (is_principal, permissoes) on public.user_profiles from authenticated, anon;

create or replace function private.area_da_col(col text)
returns text language sql immutable set search_path = '' as $$
  select case col
    when 'produtos'  then 'produtos'
    when 'materiais' then 'materia'
    when 'pedidos'   then 'pedidos'
    when 'ordens'    then 'moldes'
    when 'moldes'    then 'moldes'
    when 'reps'      then 'reps'
    when 'cadastros' then 'cadastros'
    when 'config'    then 'config'
  end
$$;

create or replace function private.pode(area text, acao text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_principal
        or p.permissoes ->> area = 'mexer'
        or (acao = 'ver' and p.permissoes ->> area = 'ver')
    from public.user_profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  ), false)
$$;

create or replace function public.pode_eu(area text, acao text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pode(area, acao)
$$;

revoke all on function private.area_da_col(text) from public, anon;
revoke all on function private.pode(text, text) from public, anon;
revoke all on function public.pode_eu(text, text) from public, anon;
grant execute on function private.area_da_col(text) to authenticated;
grant execute on function private.pode(text, text) to authenticated;
grant execute on function public.pode_eu(text, text) to authenticated;

-- Políticas por área em docs (somam com docs_admin_all por enquanto).
create policy docs_admin_ver on public.docs for select to authenticated
  using (private.pode(private.area_da_col(col), 'ver'));
create policy docs_admin_criar on public.docs for insert to authenticated
  with check (private.pode(private.area_da_col(col), 'mexer'));
create policy docs_admin_mudar on public.docs for update to authenticated
  using (private.pode(private.area_da_col(col), 'mexer'))
  with check (private.pode(private.area_da_col(col), 'mexer'));
create policy docs_admin_apagar on public.docs for delete to authenticated
  using (private.pode(private.area_da_col(col), 'mexer'));

-- Catálogo (views security_invoker sobre private.catalog_*) para admin com acesso de leitura.
create policy catalog_products_admin_ver on private.catalog_products for select to authenticated
  using (private.pode('produtos', 'ver'));
create policy catalog_representatives_admin_ver on private.catalog_representatives for select to authenticated
  using (private.pode('reps', 'ver'));
create policy catalog_stores_admin_ver on private.catalog_stores for select to authenticated
  using (private.pode('cadastros', 'ver'));

-- Ajuste de estoque sem dar "mexer" em produtos: só troca data->'est'.
create or replace function public.ajustar_estoque(prod_id text, est jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.pode('estoque', 'mexer') then
    raise exception 'sem permissão para ajustar estoque' using errcode = '42501';
  end if;
  if est is null then
    raise exception 'estoque vazio' using errcode = '22004';
  end if;
  update public.docs set data = jsonb_set(data, '{est}', est)
  where id = prod_id and col = 'produtos';
  if not found then
    raise exception 'produto não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ajustar_estoque(text, jsonb) from public, anon;
grant execute on function public.ajustar_estoque(text, jsonb) to authenticated;
