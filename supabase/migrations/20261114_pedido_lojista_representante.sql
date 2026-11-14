-- Pedido do lojista com representante: a condicao comparava r.id com r.data->>'repId'
-- da propria linha do catalogo (sempre falsa). Agora compara com o repId do pedido.
drop policy if exists docs_store_insert_own_order on public.docs;
create policy docs_store_insert_own_order on public.docs
  for insert to authenticated
  with check (
    col = 'pedidos'
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'lojista'
        and p.store_name = (docs.data ->> 'cliente')
        and coalesce(p.rep_id, '') = coalesce(docs.data ->> 'repId', '')
    )
    and (
      nullif(docs.data ->> 'repId', '') is null
      or exists (
        select 1 from public.catalogo_representantes r
        where r.id::text = (docs.data ->> 'repId')
      )
    )
  );
