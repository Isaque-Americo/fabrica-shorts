-- Apply this migration only after every existing account has a matching
-- public.user_profiles row. Without a profile, access is intentionally denied.
drop policy if exists autenticados on public.docs;

create policy docs_admin_all
  on public.docs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'admin'
    )
  );

create policy docs_store_read_own_orders
  on public.docs
  for select
  to authenticated
  using (
    col = 'pedidos'
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'lojista'
    )
  );

create policy docs_representative_read_assigned_orders
  on public.docs
  for select
  to authenticated
  using (
    col = 'pedidos'
    and data ->> 'repId' = (
      select p.rep_id from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'representante'
    )
  );

create policy docs_representative_read_own_record
  on public.docs
  for select
  to authenticated
  using (
    col = 'reps'
    and id = (
      select p.rep_id from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'representante'
    )
  );

create policy docs_store_insert_own_order
  on public.docs
  for insert
  to authenticated
  with check (
    col = 'pedidos'
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'lojista'
        and p.store_name = data ->> 'cliente'
        and coalesce(p.rep_id, '') = coalesce(data ->> 'repId', '')
    )
    and (
      nullif(data ->> 'repId', '') is null
      or exists (
        select 1 from public.catalogo_representantes r
        where r.id = data ->> 'repId'
      )
    )
  );

create policy docs_representative_insert_assigned_order
  on public.docs
  for insert
  to authenticated
  with check (
    col = 'pedidos'
    and data ->> 'repId' = (
      select p.rep_id from public.user_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'representante'
    )
    and (
      owner_id is null
      or exists (
        select 1 from public.catalogo_lojas s
        where s.id = owner_id::text
          and s.data ->> 'nome' = data ->> 'cliente'
      )
    )
  );
