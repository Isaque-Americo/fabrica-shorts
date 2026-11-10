insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists produtos_admin_all on storage.objects;

create policy produtos_admin_all
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'produtos'
    and exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'admin'
    )
  )
  with check (
    bucket_id = 'produtos'
    and exists (
      select 1 from public.user_profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'admin'
    )
  );

create or replace function private.sync_catalog_from_docs()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.col = 'produtos' THEN
      DELETE FROM private.catalog_products WHERE id = OLD.id;
    ELSIF OLD.col = 'reps' THEN
      DELETE FROM private.catalog_representatives WHERE id = OLD.id;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.col = 'produtos' THEN
      INSERT INTO private.catalog_products (id, data)
      VALUES (
        NEW.id,
        jsonb_build_object(
          'ref', NEW.data -> 'ref',
          'nome', NEW.data -> 'nome',
          'preco', NEW.data -> 'preco',
          'precoG', COALESCE(NEW.data -> 'precoG', NEW.data -> 'preco'),
          'imgF', NEW.data -> 'imgF',
          'imgC', NEW.data -> 'imgC'
        )
      )
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
    ELSIF NEW.col = 'reps' THEN
      INSERT INTO private.catalog_representatives (id, data)
      VALUES (
        NEW.id,
        jsonb_build_object(
          'nome', NEW.data -> 'nome',
          'regiao', NEW.data -> 'regiao'
        )
      )
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

update public.docs set data = data where col = 'produtos';
