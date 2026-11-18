CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE private.catalog_products (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE private.catalog_representatives (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE private.catalog_stores (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  rep_id text
);

ALTER TABLE private.catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.catalog_products FORCE ROW LEVEL SECURITY;
ALTER TABLE private.catalog_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.catalog_representatives FORCE ROW LEVEL SECURITY;
ALTER TABLE private.catalog_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.catalog_stores FORCE ROW LEVEL SECURITY;

CREATE POLICY catalog_products_read ON private.catalog_products
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role IN ('lojista', 'representante')
  ));
CREATE POLICY catalog_representatives_read ON private.catalog_representatives
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.role = 'lojista'
      AND p.rep_id = private.catalog_representatives.id
  ));
CREATE POLICY catalog_stores_read ON private.catalog_stores
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND (
        p.role = 'admin'
        OR (p.role = 'representante' AND p.rep_id = private.catalog_stores.rep_id)
      )
  ));

REVOKE ALL ON private.catalog_products, private.catalog_representatives, private.catalog_stores FROM PUBLIC, anon;
GRANT SELECT ON private.catalog_products, private.catalog_representatives, private.catalog_stores TO authenticated;

CREATE OR REPLACE FUNCTION private.sync_catalog_from_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
          'precoG', COALESCE(NEW.data -> 'precoG', NEW.data -> 'preco')
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

CREATE OR REPLACE FUNCTION private.sync_catalog_from_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.role = 'lojista' THEN
    DELETE FROM private.catalog_stores WHERE id = OLD.user_id::text;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.role = 'lojista' THEN
    INSERT INTO private.catalog_stores (id, data, rep_id)
    VALUES (
      NEW.user_id::text,
      jsonb_build_object('nome', NEW.store_name),
      NEW.rep_id
    )
    ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data,
          rep_id = EXCLUDED.rep_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_catalog_from_docs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_catalog_from_user_profiles() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_catalog_docs
  AFTER INSERT OR UPDATE OR DELETE ON public.docs
  FOR EACH ROW EXECUTE FUNCTION private.sync_catalog_from_docs();
CREATE TRIGGER sync_catalog_user_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION private.sync_catalog_from_user_profiles();

INSERT INTO private.catalog_products (id, data)
SELECT id,
       jsonb_build_object(
         'ref', data -> 'ref',
         'nome', data -> 'nome',
         'preco', data -> 'preco',
         'precoG', COALESCE(data -> 'precoG', data -> 'preco')
       )
FROM public.docs
WHERE col = 'produtos'
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO private.catalog_representatives (id, data)
SELECT id,
       jsonb_build_object('nome', data -> 'nome', 'regiao', data -> 'regiao')
FROM public.docs
WHERE col = 'reps'
ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;

INSERT INTO private.catalog_stores (id, data, rep_id)
SELECT user_id::text, jsonb_build_object('nome', store_name), rep_id
FROM public.user_profiles
WHERE role = 'lojista'
ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data,
      rep_id = EXCLUDED.rep_id;

CREATE OR REPLACE VIEW public.catalogo_produtos
WITH (security_invoker = true, security_barrier = true)
AS SELECT id, data FROM private.catalog_products;

CREATE OR REPLACE VIEW public.catalogo_representantes
WITH (security_invoker = true, security_barrier = true)
AS SELECT id, data FROM private.catalog_representatives;

CREATE OR REPLACE VIEW public.catalogo_lojas
WITH (security_invoker = true, security_barrier = true)
AS SELECT id, data FROM private.catalog_stores;

REVOKE ALL ON public.catalogo_produtos, public.catalogo_representantes, public.catalogo_lojas FROM PUBLIC, anon;
GRANT SELECT ON public.catalogo_produtos, public.catalogo_representantes, public.catalogo_lojas TO authenticated;
