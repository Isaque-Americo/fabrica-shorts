# Admin principal e permissões por checklist — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Só o admin principal cria admins e escolhe, num checklist por área (Ver/Mexer), o que cada um pode fazer; o banco obedece.

**Architecture:** Um módulo puro `acesso.js` define as áreas, as dependências e a checagem, usado pelas 4 páginas e testado em Node. No banco, `user_profiles` ganha `is_principal` e `permissoes`, e uma função `private.pode(area, acao)` alimenta políticas por coleção em `docs`, ao lado de `docs_admin_all`, que só sai na última tarefa, com a confirmação do dono. As Edge Functions passam a checar principal e permissões.

**Tech Stack:** HTML/JS sem build, Supabase (Postgres RLS, Edge Functions Deno), Node para self-check.

**Spec:** `docs/superpowers/specs/2026-11-14-admin-principal-permissoes-design.md`

## Global Constraints

- Áreas (chaves exatas): `painel`, `produtos`, `materia`, `pedidos`, `fabricar`, `moldes`, `reps`, `cadastros`, `estoque`, `config`. Ações: `'ver'` e `'mexer'` (`mexer` inclui `ver`). `fabricar` só tem `ver`.
- `permissoes` = objeto `{area: 'ver'|'mexer'}`; área ausente = sem acesso; `null` = sem acesso. O principal ignora `permissoes`.
- Dependências (fechamento aplicado ao gravar, no app **e** na Edge Function): `produtos:mexer → moldes:mexer`; `moldes:ver → produtos:ver, materia:ver`; `pedidos:ver → produtos:ver, cadastros:ver, reps:ver`; `painel:ver → pedidos:ver, produtos:ver`; `fabricar:ver → pedidos:ver, produtos:ver`; `estoque:ver → produtos:ver`.
- Coleção → área no banco: `produtos→produtos`, `materiais→materia`, `pedidos→pedidos`, `ordens→moldes`, `moldes→moldes`, `reps→reps`, `cadastros→cadastros`, `config→config`. SELECT pede `ver`; INSERT/UPDATE/DELETE pedem `mexer`.
- Principal: a conta admin existente (`contact_name` "Isaque"). `is_principal` e `permissoes` **fora** dos grants de UPDATE de `authenticated` (hoje: só contato e `must_change_password`).
- Lojista e representante: nenhuma política deles muda.
- Não existe bucket no Storage hoje (`storage.buckets` vazio): fotos não precisam de política nesta entrega.
- Migrações: registrar em `supabase/migrations/` e aplicar com `apply_migration` no projeto `kgikdyqyoaqrhsshpmcw`. Testes de RLS sempre em `begin; … rollback;` sem deixar dados. **Task 6 só roda com confirmação explícita do dono na hora.**
- `index.html` é CRLF: `git -c core.autocrlf=false add index.html`. Nunca commitar `e-mail.jpg`. Tudo em português na tela.
- Self-checks: `node .claude/scripts/selfcheck.js`, `node .claude/scripts/selfcheck-molde.js` e o novo `node .claude/scripts/selfcheck-acesso.js` passam ao fim de cada tarefa.

## Review Focus

1. Admin limitado chamando a API direto numa coleção sem Ver/Mexer → recusado (Task 1 testa com SQL).
2. Admin limitado tentando gravar a própria `permissoes`/`is_principal` ou chamar `gerenciar-administradores` → recusado (Tasks 1 e 2).
3. Principal continua podendo tudo em todas as coleções e Edge Functions depois de cada migração (Tasks 1, 2 e 6).
4. Lojista e representante continuam lendo/gravando o que podem hoje (Task 1 e Task 6 repetem os testes de pedido do lojista).
5. Checklist gravado sem as dependências (chamada direta à Edge Function) → a função fecha as dependências antes de gravar (Task 2).

---

### Task 1: Banco — colunas, principal, `pode` e políticas novas (aditivo)

**Files:**
- Create: `supabase/migrations/20261114120000_admin_permissoes.sql`

**Interfaces:**
- Produces: `user_profiles.is_principal boolean not null default false`, `user_profiles.permissoes jsonb`; `private.pode(area text, acao text) returns boolean` (SECURITY DEFINER, `search_path=''`, `stable`): verdadeiro se o perfil de `auth.uid()` é admin e (`is_principal` ou `permissoes->>area` = `'mexer'`, ou = `'ver'` quando `acao='ver'`); `private.area_da_col(col text) returns text` com o mapa acima; políticas `docs_admin_ver` (SELECT), `docs_admin_criar` (INSERT), `docs_admin_mudar` (UPDATE, using e with check), `docs_admin_apagar` (DELETE) usando `private.pode(private.area_da_col(col), …)`; `public.ajustar_estoque(prod_id text, est jsonb) returns void` (SECURITY DEFINER) que exige `pode('estoque','mexer')` e só troca `data->'est'` do doc `col='produtos'`; leitura das views/tabelas de catálogo por admin condicionada a `pode('cadastros'|'reps'|'produtos','ver')`.

- [ ] **Step 1: Ler o estado vivo**: políticas de `public.docs`, `public.user_profiles`, `private.catalog_*`, as views `catalogo_*` (security_invoker?) e os grants de coluna. Anotar no relatório.
- [ ] **Step 2: Escrever a migração** com tudo de Interfaces, marcando `is_principal=true` na conta admin existente. **Não** remover `docs_admin_all`. `revoke` explícito de UPDATE em `is_principal` e `permissoes` para `authenticated`. Conceder EXECUTE de `ajustar_estoque` a `authenticated`.
- [ ] **Step 3: Aplicar** com `apply_migration` (`admin_permissoes`).
- [ ] **Step 4: Testar em `begin; … rollback;`**: criar um usuário admin de teste em `user_profiles` (sem principal), `permissoes = {"pedidos":"ver"}`, e com `set local role authenticated` + `request.jwt.claims` do teste: `private.pode('pedidos','ver')` = true, `('pedidos','mexer')` = false, `('produtos','ver')` = false; para o principal, todas true; `update user_profiles set permissoes='{}'` pelo teste → erro de permissão. Rodar `get_advisors` (security).
- [ ] **Step 5: Commit** do `.sql`.

### Task 2: Edge Functions — principal e permissões

**Files:**
- Create: `supabase/functions/gerenciar-administradores/index.ts`, `supabase/functions/gerenciar-acesso/index.ts`, `supabase/functions/ler-pedido/index.ts` (código atual baixado com `get_edge_function`, depois alterado)

**Interfaces:**
- Consumes: colunas e `pode` da Task 1.
- Produces: `gerenciar-administradores` aceita só o principal; `list` devolve também `permissoes` e `is_principal`; `create`/`update` recebem `permissoes` (objeto da Global Constraints), validam chaves/valores, aplicam o fechamento de dependências e gravam com a service role; recusa rebaixar/apagar o principal. `gerenciar-acesso` exige `pode('cadastros','mexer')` (principal passa). `ler-pedido` exige `pode('pedidos','mexer')`.

- [ ] **Step 1: Baixar** as 3 funções com `get_edge_function` e salvar no repo como estão; commit "código atual das funções" antes de mudar.
- [ ] **Step 2: Alterar** conforme Interfaces. A checagem de permissão chama `rpc('pode', …)` com o JWT do usuário **ou** lê `user_profiles` com a service role — escolher um e usar nos três.
- [ ] **Step 3: Deploy** com `deploy_edge_function` (mesmos slugs, `verify_jwt` como está).
- [ ] **Step 4: Testar**: a validação e o fechamento de `permissoes` num teste Node que importa a mesma tabela de dependências (mesmos casos do `selfcheck-acesso.js`); o deploy chamando sem token → 401. Não pedir senha nem token do dono; registrar no relatório o que não foi exercitado com usuário real.
- [ ] **Step 5: Commit**.

### Task 3: Módulo puro `acesso.js`

**Files:**
- Create: `acesso.js` (raiz), `.claude/scripts/selfcheck-acesso.js`
- Modify: `.github/workflows/pages.yml` (copiar `acesso.js` para `_site`)

**Interfaces:**
- Produces (global `window.Acesso` e `module.exports`): `AREAS` (lista `{k, nome, soVer?}` na ordem do checklist, nomes: "Painel", "Produtos", "Matéria-prima", "Pedidos", "A fabricar", "Moldes e ordens de corte", "Representantes", "Cadastros (lojas)", "Estoque", "Configurações"); `fechar(perm) -> perm` (aplica dependências, `mexer` ⊇ `ver`, remove chaves inválidas); `pode(perfil, area, acao) -> boolean` (perfil = `appProfile`: `role`, `is_principal`, `permissoes`); `ABA_AREA` (aba do `index.html` → área: `painel→painel`, `produtos→produtos`, `materia→materia`, `pedidos→pedidos`, `fabricar→fabricar`, `molde→moldes`, `corte→moldes`, `reps→reps`, `cadastros→cadastros`, `estoque→estoque`).

- [ ] **Step 1: Testes que falham** em `selfcheck-acesso.js`: `fechar({produtos:'mexer'})` inclui `moldes:'mexer'`, `produtos:'mexer'`, `materia:'ver'`; `fechar({pedidos:'ver'})` inclui `produtos/cadastros/reps:'ver'`; `fechar({fabricar:'mexer'})` → `fabricar:'ver'`; `fechar({x:'mexer', pedidos:'tudo'})` → `{}`; `pode` principal → true em tudo; admin com `{pedidos:'ver'}` → `ver` true, `mexer` false; lojista → false; `permissoes` null → false.
- [ ] **Step 2: Rodar** → falham. **Step 3: Implementar.** **Step 4: Rodar os 3 self-checks.** **Step 5: Commit.**

### Task 4: `index.html` — checklist, menu e botões

**Files:**
- Modify: `index.html` (`<script src="acesso.js">`, carga do perfil com `is_principal`/`permissoes`, `tabs` ~l.559, `adminAccountsPage` ~l.574 e `novoAdministrador`/`editarAdministrador`, botões de criar/editar/excluir das abas, `aprovarPed`, salvar estoque)

**Interfaces:**
- Consumes: `Acesso` (Task 3), Edge Function (Task 2), `ajustar_estoque` (Task 1).

- [ ] **Step 1: Perfil**: o select de `user_profiles` traz `is_principal, permissoes`.
- [ ] **Step 2: Menu**: admin vê só as abas com `Acesso.pode(appProfile, ABA_AREA[k], 'ver')`; "Administradores" só para o principal. Sem nenhuma área: tela "Sem acesso a nenhuma área; fale com o administrador principal."
- [ ] **Step 3: Botões**: criar/editar/excluir/mudar status/Aprovar/Atualizar preços só com `mexer` na área. Aprovar exige `pedidos:mexer` e `moldes:mexer`. Estoque: quem tem `estoque:mexer` sem `produtos:mexer` grava pelo `rpc('ajustar_estoque')`.
- [ ] **Step 4: Checklist** no Novo/Editar administrador: tabela com as `AREAS`, duas caixas (Ver, Mexer; "A fabricar" só Ver), e ao marcar aplica `Acesso.fechar` na hora (as dependências aparecem marcadas e travadas). Envia `permissoes` para a Edge Function. Para o próprio principal o checklist não aparece.
- [ ] **Step 5: Teste no navegador** com o banco e o perfil simulados na página (principal; admin `{pedidos:'ver'}`; admin vazio): menu, botões, checklist com dependências. Registrar o que não foi exercitado.
- [ ] **Step 6: Self-checks e commit.**

### Task 5: `corte.html`, `molde.html`, `enfesto.html` — guarda por área

**Files:**
- Modify: `corte.html:561`, `molde.html:599`, `enfesto.html:456` (e `<script src="acesso.js">` nas três)

- [ ] **Step 1**: trocar `perfil.role!=='admin'` por `!Acesso.pode(perfil,'moldes','ver')` (o perfil carregado passa a trazer `is_principal, permissoes`). Sem `mexer`: páginas em leitura (esconder/desabilitar salvar, criar, apagar, exportar continua). Apagar ordem de pedido exige também `pedidos:mexer`.
- [ ] **Step 2**: Teste com `?local=1` (perfil local principal) e uma simulação de perfil só `ver`. **Step 3**: self-checks e commit.

### Task 6: Remover `docs_admin_all` (com confirmação do dono)

**Files:**
- Create: `supabase/migrations/20261114130000_remove_docs_admin_all.sql`

- [ ] **Step 1: Parar e pedir confirmação do dono** com o resumo dos testes das Tasks 1–5.
- [ ] **Step 2: Migração** `drop policy docs_admin_all on public.docs`. Aplicar.
- [ ] **Step 3: Testar em `begin; … rollback;`**: principal lê/grava todas as coleções; admin de teste com `permissoes` já fechadas de `{pedidos:'ver'}` (= pedidos, produtos, cadastros, reps em `ver`): lê `pedidos`, `produtos`, `cadastros`, `reps`; não lê `materiais`, `ordens`, `config`; não grava nada. Lojista com rep do perfil insere pedido; representante lê os atribuídos. Realtime: admin de teste não recebe eventos de `materiais` (testar com dois clientes supabase-js em Node, ou registrar como não exercitado).
- [ ] **Step 4: `get_advisors`**, commit, e em caso de qualquer falha **restaurar `docs_admin_all`** na hora.
