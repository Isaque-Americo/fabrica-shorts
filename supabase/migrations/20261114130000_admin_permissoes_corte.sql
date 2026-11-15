-- Corte: o banco passa a cobrar o checklist dos admins (confirmado pelo dono em 2026-11-14).
-- Volta atrás, se preciso: recriar docs_admin_all e a versão antiga de catalog_stores_read (ver 20261114120000 e o banco anterior).

drop policy if exists docs_admin_all on public.docs;

-- Lojas do catálogo: admin passa por catalog_stores_admin_ver (cadastros:ver); aqui fica só o representante.
drop policy if exists catalog_stores_read on private.catalog_stores;
create policy catalog_stores_read on private.catalog_stores for select to authenticated
  using (exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.role = 'representante' and p.rep_id = catalog_stores.rep_id
  ));
