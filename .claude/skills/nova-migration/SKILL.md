---
name: nova-migration
description: Cria uma migração SQL do Supabase no padrão do projeto, com nome por timestamp e RLS já no formato certo
disable-model-invocation: true
---

# Nova migração do Supabase

## 1. Nome do arquivo
`supabase/migrations/<YYYYMMDDHHMMSS>_<slug_em_snake_case>.sql`, em UTC crescente.
Gere o timestamp, não invente:

```bash
node -e "console.log(new Date().toISOString().replace(/[-:T]/g,'').slice(0,14))"
```

Confira com `ls supabase/migrations | tail -3` que o novo nome vem **depois** do último. Nunca edite uma
migração já aplicada em produção: o banco não vai reexecutá-la e o histórico passa a mentir. Corrija com uma nova.

## 2. Regras que este projeto segue
- **Idempotente**: `drop policy if exists` antes de `create policy`; `create or replace function`;
  `insert ... on conflict (id) do update set`. A migração precisa poder rodar duas vezes.
- **RLS**: toda tabela nova em `public` nasce com `alter table ... enable row level security` e pelo menos
  uma policy. Sem policy, a tabela fica inacessível e o bug aparece só no cliente.
- **`(select auth.uid())`**, nunca `auth.uid()` solto: a subquery é avaliada uma vez por consulta em vez de por linha.
- **Papel**: a autorização vem de `public.user_profiles` (`role` = `admin` | `lojista` | `representante`),
  via `exists (select 1 from public.user_profiles p where p.user_id = (select auth.uid()) and p.role = '...')`.
- **Funções**: `language plpgsql security definer set search_path to ''` e todo nome de tabela qualificado
  (`public.x`, `private.y`) — com `search_path` vazio, nome sem esquema não resolve.
- **Dados**: os registros do app vivem em `public.docs (col, id, data jsonb)`. Não crie tabela nova para
  um campo novo de produto/material: ele é só uma chave no `data`.

## 3. Se o campo novo precisa aparecer para lojista ou representante
Esses perfis não leem `public.docs`: leem as projeções `private.catalog_products` e
`private.catalog_representatives`, montadas pelo trigger `private.sync_catalog_from_docs()`, que faz uma
**lista fechada** de campos no `jsonb_build_object`. Então:
1. `create or replace function private.sync_catalog_from_docs()` com o campo novo incluído
   (use `COALESCE(NEW.data -> 'novo', NEW.data -> 'antigo')` quando houver fallback);
2. feche a migração com `update public.docs set data = data where col = 'produtos';` para o trigger
   reprojetar tudo que já estava salvo.

Campo que só o admin usa (custo, ficha técnica, molde, enfesto) **não** entra na projeção — é justamente
o que a mantém privada.

## 4. Aplicar
Mostre o arquivo ao usuário antes de aplicar. Para aplicar: `npx supabase db push`
(pede login e link do projeto). Não aplique sem o usuário pedir.
