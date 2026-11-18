REVOKE SELECT ON private.catalog_products, private.catalog_representatives, private.catalog_stores
  FROM authenticated;
GRANT SELECT (id, data)
  ON private.catalog_products, private.catalog_representatives, private.catalog_stores
  TO authenticated;
