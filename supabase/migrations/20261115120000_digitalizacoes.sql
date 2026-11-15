-- Digitalizar molde: coleção 'digitalizacoes' (docs) vale como área 'moldes' + bucket privado de fotos.
-- Volta atrás, se preciso: recriar private.area_da_col sem a linha 'digitalizacoes' (corpo em 20261114120000),
-- dropar as políticas digitalizacoes_ver/_inserir/_alterar/_apagar em storage.objects e apagar o bucket 'digitalizacoes' (esvaziar antes).

create or replace function private.area_da_col(col text)
returns text language sql immutable set search_path = '' as $$
  select case col
    when 'produtos'  then 'produtos'
    when 'materiais' then 'materia'
    when 'pedidos'   then 'pedidos'
    when 'ordens'    then 'moldes'
    when 'moldes'    then 'moldes'
    when 'digitalizacoes' then 'moldes'
    when 'reps'      then 'reps'
    when 'cadastros' then 'cadastros'
    when 'config'    then 'config'
  end
$$;

insert into storage.buckets (id, name, public)
values ('digitalizacoes', 'digitalizacoes', false)
on conflict (id) do nothing;

drop policy if exists digitalizacoes_ver on storage.objects;
create policy digitalizacoes_ver on storage.objects for select to authenticated
  using (bucket_id = 'digitalizacoes' and private.pode('moldes', 'ver'));

drop policy if exists digitalizacoes_inserir on storage.objects;
create policy digitalizacoes_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'digitalizacoes' and private.pode('moldes', 'mexer'));

drop policy if exists digitalizacoes_alterar on storage.objects;
create policy digitalizacoes_alterar on storage.objects for update to authenticated
  using (bucket_id = 'digitalizacoes' and private.pode('moldes', 'mexer'))
  with check (bucket_id = 'digitalizacoes' and private.pode('moldes', 'mexer'));

drop policy if exists digitalizacoes_apagar on storage.objects;
create policy digitalizacoes_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'digitalizacoes' and private.pode('moldes', 'mexer'));
