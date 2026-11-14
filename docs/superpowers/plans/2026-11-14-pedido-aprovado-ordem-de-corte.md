# Do pedido aprovado à ordem de corte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pedido aprovado vira a sua ordem de corte (automática ou detalhada); todo produto tem molde; o lojista escolhe o representante; a ordem de corte tem Editar/Apagar e mostra o pedido.

**Architecture:** A regra pura fica em `molde/ordem.js` (`dePedido`, `semMolde`, agrupamento por tecido + grupo), testada em Node. O `index.html` aprova o pedido, monta a ordem com `dePedido`, grava em `ordens` e marca o pedido. O `corte.html` lista e apaga ordens, e ao apagar devolve o pedido a Pendente. O molde passa a nascer antes do produto (`molde.html?novo=1`), e o produto escolhe o molde, copiando as peças com `MoldeModelo.molParaProduto`.

**Tech Stack:** HTML/JS sem build, Supabase JS 2.45.4 (tabela `docs` + RLS), Node para self-check.

**Spec:** `docs/superpowers/specs/2026-11-14-pedido-aprovado-ordem-de-corte-design.md`

## Global Constraints

- Tudo em português na tela. Escapar dados com `esc`/`textContent`.
- Ler documentos antigos com valor padrão: pedido sem `status` = `'Pendente'`, sem `ordemId` = sem ordem; ordem sem `pedidoId` = avulsa; produto sem `mol`/`molId` = "sem molde".
- Mesmo enfesto só com a mesma matéria-prima (`materiaId`); cores diferentes do mesmo tecido podem dividir enfesto.
- A ordem corta a **quantidade inteira** do pedido (sem estoque). Grade = falta = qtd; camadas = 1.
- Um pedido tem no máximo uma ordem. Pedido com ordem fica travado (sem voltar a Pendente/Recusado, sem excluir) até a ordem ser apagada.
- `index.html` é CRLF no repositório: `git -c core.autocrlf=false add index.html`. Nunca commitar `e-mail.jpg`.
- Self-checks: `node .claude/scripts/selfcheck-molde.js` e `node .claude/scripts/selfcheck.js` passam ao fim de cada tarefa.
- Migração no banco: aprovada pelo dono em 2026-11-14; aplicar com `apply_migration` do Supabase (projeto `kgikdyqyoaqrhsshpmcw`).

## Review Focus

1. Pedido com um produto sem molde → Aprovar bloqueia e lista as referências; nenhuma ordem nasce. (Task 2 testa `semMolde`; Task 4 usa.)
2. Aprovar duas vezes (clique duplo, ou ordem órfã depois de apagar com falha) → nunca duas ordens para o mesmo pedido. (Task 4: busca ordem existente por `pedidoId` antes de criar.)
3. Detalhado juntando referências de tecidos diferentes no mesmo número de enfesto → saem enfestos separados, um por tecido. (Task 2 testa.)
4. Pedido com cores diferentes da mesma referência → itens separados por cor no mesmo enfesto, grade por cor certa. (Task 2 testa.)
5. Lojista grava pedido com `repId` inexistente ou de outro lojista → RLS recusa; com representante cadastrado → aceita. (Task 1 testa com SQL.)

---

### Task 1: RLS — lojista escolhe o representante

**Files:**
- Create: `supabase/migrations/20261114_lojista_escolhe_representante.sql` (criar a pasta se não existir; só registro, a aplicação é pelo MCP)

**Interfaces:**
- Produces: política `docs_store_insert_own_order` que aceita `data->>'repId'` vazio **ou** igual a um `id` de `private.catalog_representatives`, sem exigir o `rep_id` do perfil.

- [ ] **Step 1: Ler a política viva** com `select pg_get_expr(polwithcheck, polrelid) from pg_policy where polname='docs_store_insert_own_order'`. Hoje ela tem `COALESCE(p.rep_id,'') = COALESCE(docs.data->>'repId','')` e `r.id = (r.data->>'repId')` (compara a linha consigo mesma; `catalog_representatives.data` só tem `nome`/`regiao`, então todo pedido de lojista com representante falha).
- [ ] **Step 2: Escrever a migração**: `drop policy` + `create policy docs_store_insert_own_order` igual à atual, trocando as duas condições por: tirar o `COALESCE(p.rep_id…)` do `EXISTS` do perfil e usar `(NULLIF(data->>'repId','') IS NULL OR EXISTS (select 1 from private.catalog_representatives r where r.id::text = docs.data->>'repId'))`. Manter `col='pedidos'`, `owner_id = auth.uid()`, `role='lojista'` e `store_name = data->>'cliente'`.
- [ ] **Step 3: Aplicar** com `apply_migration` (nome `lojista_escolhe_representante`).
- [ ] **Step 4: Verificar** com SQL em transação revertida (`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<user_id de um lojista>"}'; insert … ; rollback;`): repId de um representante cadastrado → insere; repId `'x'` → erro de RLS; repId vazio → insere. Rodar `get_advisors` (security) e conferir que nada novo aparece.
- [ ] **Step 5: Commit** do arquivo `.sql`.

### Task 2: Regra pura — `dePedido` e `semMolde`

**Files:**
- Modify: `molde/ordem.js` (`normalizar`, `deFabricar`, export)
- Test: `.claude/scripts/selfcheck-molde.js`

**Interfaces:**
- Consumes: `pecasTam(p, tam)` e `deFabricar(lista, opts)` que já existem.
- Produces:
  - `MoldeOrdem.dePedido(pedido, opts) -> ordem`. `pedido = {id, numero, itens:[{prodId, cor, tam, qtd}]}`; `opts = {produtos:[{id, ref, tecidoId, mol}], grupos?: {[prodId]: number}, compMax?: number (mm)}`. Ordem com `pedidoId = pedido.id`, `pedidoNum = pedido.numero`, `nome = 'Pedido #' + numero`, `refs` = refs distintas ordenadas.
  - `MoldeOrdem.semMolde(pedido, produtos) -> string[]`: refs (ou nome) dos produtos do pedido que têm algum tamanho pedido com `pecasTam(p, tam)` vazio, ou que não existem em `produtos`. Sem repetição.
  - `normalizar` passa a devolver `pedidoId: d.pedidoId || ''`, `pedidoNum: d.pedidoNum ?? null`, `refs: Array.isArray(d.refs) ? d.refs.map(String) : []`.
  - `deFabricar` aceita `opts.grupos` e a chave do enfesto vira `materiaId + '|' + (grupos[l.id] ?? 0)`; cada enfesto tem a sua aba de tecido (uma aba por `materiaId`, reaproveitada entre grupos). Nome: `'Enfesto ' + n` contando dentro do tecido. Sem `grupos`, o resultado é idêntico ao de hoje (os testes antigos de `deFabricar` continuam passando sem mudança).

- [ ] **Step 1: Testes que falham** (no fim do bloco de testes):
  - `dePedido automático: 2 refs mesmo tecido → 1 aba, 1 enfesto, 2 itens; pedidoNum 7; nome 'Pedido #7'; refs ['5050','6060']`
  - `dePedido: tecidos diferentes → 2 abas, 2 enfestos`
  - `dePedido detalhado grupos {pA:0,pB:1} mesmo tecido → 1 aba, 2 enfestos ('Enfesto 1','Enfesto 2')`
  - `dePedido detalhado grupos {pA:0,pC:0} tecidos diferentes → 2 enfestos (nunca junta tecidos)`
  - `dePedido: mesma ref Azul M 3 + Preto M 2 → 2 itens, grade {M:3} e {M:2}, falta igual, camadas 1`
  - `dePedido: peça de forro → aba e enfesto próprios do forro` (reusar o produto com `q.tecido` do teste I4 existente)
  - `semMolde: produto sem mol → ['9090']; produto com peças → []; produto inexistente → ['?'] ou o prodId`
  - `normalizar ordem antiga → pedidoId '', pedidoNum null, refs []`
- [ ] **Step 2: Rodar** `node .claude/scripts/selfcheck-molde.js` → as novas falham (função não existe).
- [ ] **Step 3: Implementar** em `molde/ordem.js`: `grupos` no `deFabricar`; `dePedido` converte `itens` em `lista` (`{id: prodId, c: cor, t: tam, f: qtd}`), chama `deFabricar` e acrescenta os campos do pedido; `semMolde`; campos novos em `normalizar`; exportar os dois.
- [ ] **Step 4: Rodar os dois self-checks** → tudo passa.
- [ ] **Step 5: Commit** (`molde/ordem.js`, `.claude/scripts/selfcheck-molde.js`).

### Task 3: Molde primeiro, produto exige molde

**Files:**
- Modify: `molde.html` (`abrir()`, ~l.475-500)
- Modify: `index.html` (scripts no `<head>`, sidebar ~l.554, formulário do produto ~l.757-805, lista de produtos ~l.745, bloco de itens do pedido `bloco()` ~l.1296)

**Interfaces:**
- Consumes: `MoldeModelo.molParaProduto(m) -> {mol, avisos}` (já usado em `molde.html`); o molde guarda `produtoIds`, o produto guarda `molId` e `mol`.
- Produces: `molde.html?novo=1` cria um molde sem produto; produto com `molId` + `mol` gravados pelo formulário; helper `temMolde(p) -> boolean` no `index.html`: `true` quando `p.mol` tem peças (`p.mol.pecas` não vazio ou algum `p.mol.porTam[t]` não vazio).

- [ ] **Step 1: `molde.html?novo=1`**: em `abrir()`, quando `Q.get('novo')==='1'` e sem `id`/`produto`: `doc = MM.novo('Novo molde')`, `dlgGrade(doc, true)` (cancelar → `bloquear('Molde não criado.')`), `aplicarDlg`, `doc.produtoIds = []`, `id = await B.criar(doc)`, segue o fluxo normal. A mensagem de `bloquear` sem molde passa a ser "Nenhum molde escolhido. Use “Criar molde” no menu do app."
- [ ] **Step 2: Menu lateral**: `TABS_ADMIN` ganha o item `['molde','Criar molde']` logo antes de `['corte','Ordens de corte']`, renderizado como link `molde.html?novo=1` aberto em nova aba (mesmo padrão do item `corte`); ícone `draw`.
- [ ] **Step 3: Formulário do produto**: carregar `molde/geo.js` e `molde/modelo.js` no `<head>`. O admin carrega a lista de moldes (`col='moldes'`, só `id` e `data->>nome`, mais `data` sob demanda). Campo **Molde** obrigatório (`<select name="molId" required>`: "— escolha o molde —", os moldes por nome, e a opção "Importar PLT" que mantém o caminho de hoje). O Tecido continua obrigatório (`required`, tirar a opção "sem ficha"). Ao salvar com um molde escolhido: buscar o doc do molde, `mol = MoldeModelo.molParaProduto(MoldeModelo.normalizar(doc)).mol`, gravar o produto com `{molId, mol}` e acrescentar o `id` do produto em `produtoIds` do molde (sem repetir). Se o molde não tiver peças válidas, recusar com a mensagem "O molde escolhido ainda não tem peças."
- [ ] **Step 4: Selo e bloqueio**: na lista de produtos, produto sem molde mostra `<small class="aviso">sem molde</small>`. No bloco de itens do pedido (`bloco()`/seleção de referência), produtos sem molde não aparecem para escolher; se `S.produtos` só tem produtos sem molde, `fPed` avisa "Cadastre o molde dos produtos antes de lançar pedidos."
- [ ] **Step 5: Teste no navegador** (`?local=1` do `molde.html` e o app em localhost): Criar molde → abre o diálogo de grade → salva; produto novo sem molde → Salvar recusa; com molde → grava `molId` e `mol`, e o molde passa a listar o produto em Referências.
- [ ] **Step 6: Self-checks** passam. **Commit** (`molde.html`, `index.html` com `core.autocrlf=false`).

### Task 4: Pedido — representante, aprovação e ordem automática/detalhada

**Files:**
- Modify: `index.html` (`ST` l.453, CSS `.pill` l.69-70, `fPed` l.1326-1356, `pedidos()` l.1280-1296, `setSt` l.1655, `delPed`, painéis que excluem `'Cancelado'` l.687 e l.708, aba Fabricar l.1440-1510)

**Interfaces:**
- Consumes: `MoldeOrdem.dePedido`, `MoldeOrdem.semMolde` (Task 2); RLS da Task 1.
- Produces: pedido com `status` em `['Pendente','Aprovado','Recusado','Faturado','Enviado','Entregue','Cancelado']` e `ordemId` (id do doc em `ordens`); ordem em `ordens` com `pedidoId`, `pedidoNum`, `refs`.

- [ ] **Step 1: Status**: `ST` vira a lista acima; `.pill.s-aprovado` (cor `var(--ok)`) e `.pill.s-recusado` (cor `var(--bad)`). Onde hoje se exclui `'Cancelado'` dos totais (l.687, l.708), excluir também `'Recusado'`.
- [ ] **Step 2: Representante no pedido do lojista**: em `fPed`, o lojista vê `<select name="repId" required>` com `S.reps` (já vem de `catalogo_representantes`), pré-selecionado com `appProfile.rep_id`. No salvar, `repId`/`repNome` do lojista vêm do select; sem escolha → erro "Escolha o representante."
- [ ] **Step 3: Ações do admin** no menu do pedido:
  - Pendente: **Aprovar** (`aprovarPed(id)`), **Recusar** (`setSt(id,'Recusado')`).
  - Recusado: pode voltar a Pendente.
  - Com `ordemId`: **Abrir ordem de corte** (`corte.html?id=<ordemId>`). "Mudar status para" não oferece Pendente nem Recusado. **Excluir pedido** recusa com "Apague a ordem de corte deste pedido antes." **Cancelado** pede confirmação "Este pedido tem ordem de corte. Cancelar mesmo assim? A ordem não é apagada."
- [ ] **Step 4: `aprovarPed(id)`**:
  1. `semMolde(o, S.produtos)` não vazio → `aviso('Sem molde: ' + refs.join(', ') + '. Cadastre o molde antes de aprovar.')` e para.
  2. Busca ordem existente: `docs` `col='ordens'` com `data->>pedidoId = id`. Se existir → só grava `{status:'Aprovado', ordemId}` no pedido e abre a ordem.
  3. Modal "Aprovar pedido #N" com duas opções: **Enfesto automático** e **Enfesto detalhado**. O detalhado lista as referências agrupadas por tecido (nome do tecido como título); cada referência tem um `<select>` "Enfesto 1…N" (N = nº de referências daquele tecido), padrão Enfesto 1. Como o select vive dentro do grupo do tecido, não dá para juntar tecidos diferentes.
  4. `const doc = MoldeOrdem.dePedido(o, {produtos: S.produtos, grupos, compMax: Math.round(enfMesa*1000)})` (`grupos` só no detalhado), `doc.criadaEm = new Date().toISOString()`, cria em `ordens`, depois `update` do pedido `{status:'Aprovado', ordemId}`. Se o update falhar, avisar "A ordem foi criada mas o pedido não foi marcado; tente Aprovar de novo" (o passo 2 reaproveita a ordem).
  5. Abre `corte.html?id=<ordemId>` em nova aba. Botão Aprovar desabilitado enquanto grava.
- [ ] **Step 5: Aba Fabricar → "A fabricar"**: rótulo da aba `'A fabricar'`; `ABERTOS = ['Aprovado','Faturado']`; a quantidade mostrada é a demanda (sem descontar o estoque: `a = 0`, `f = ag[k]`); tirar o botão "Criar ordem de corte" e o código de `sessionStorage('ordemNova')` (l.1504-1505). O "Plano de enfesto" estimado pode continuar.
- [ ] **Step 6: Teste no navegador** em localhost com dados falsos (padrão do self-check de `index.html` l.1742): pedido de 2 refs do mesmo tecido → automático → 1 enfesto; detalhado com Enfesto 1/2 → 2 enfestos; produto sem molde → bloqueia; com ordem → Excluir recusa.
- [ ] **Step 7: Self-checks** passam. **Commit**.

### Task 5: Ordens de corte — lista com pedido, Editar e Apagar

**Files:**
- Modify: `corte.html` (lista ~l.280-290, cabeçalho da ordem, `B` com Supabase e local, bloco `?deFabricar=1` l.543-550)

**Interfaces:**
- Consumes: ordem com `pedidoId`, `pedidoNum`, `refs` (Task 2); pedido com `ordemId` (Task 4).
- Produces: `B.apagar(id)` e `B.voltarPedido(pedidoId)` (`update` do pedido `{status:'Pendente', ordemId:null}`), nas duas versões do `B` (Supabase e `?local=1`).

- [ ] **Step 1: Lista**: colunas **Pedido** (`#N` ou "avulsa"), **Nome**, **Referências** (`refs.join(', ')`), **Data**, **Metros**, e as ações **Editar** (abre a ordem) e **Apagar**. Texto de lista vazia: "Nenhuma ordem ainda. Aprove um pedido no app ou use “Nova ordem”."
- [ ] **Step 2: Apagar**: ordem avulsa → confirmar "Apagar a ordem “nome”?" → `B.apagar`. Ordem de pedido → confirmar "Apagar a ordem do pedido #N? O pedido volta para Pendente." → `B.voltarPedido(pedidoId)` e depois `B.apagar(id)`. Erro em qualquer passo → toast com `ptErro` e a lista recarrega. Apagar também dentro da ordem (botão no cabeçalho, mesma função), voltando para a lista.
- [ ] **Step 3: Cabeçalho da ordem**: mostra "Pedido #N · refs" quando houver `pedidoId`.
- [ ] **Step 4: Remover** o bloco `?deFabricar=1` (o Fabricar não cria mais ordem).
- [ ] **Step 5: Teste no navegador** com `?local=1`: o seed local ganha uma ordem com `pedidoId:'p-ex', pedidoNum:12, refs:['5050']`; Apagar volta o pedido local e some da lista; ordem avulsa apaga sem mexer em pedido.
- [ ] **Step 6: Self-checks** passam. **Commit**.

### Task 6: Enfesto — nº do pedido e referência no risco

**Files:**
- Modify: `enfesto.html` (diálogo Exportar, `formasAtuais`, `resumoTxt`, título), `molde/exporta.js:27` (texto da peça)
- Test: `.claude/scripts/selfcheck-molde.js`

**Interfaces:**
- Consumes: `ordem.pedidoNum` (Task 2).
- Produces: `MoldeExporta.formas(..., o)` aceita `o.pedido` (string, ex. `'Ped. 12'`), que entra no texto da peça antes da referência.

- [ ] **Step 1: Teste**: `formas com o.pedido 'Ped. 12' e o.nome → texto 'Ped. 12 · 5050 · Frente M'`; sem `o.pedido` → texto igual ao de hoje.
- [ ] **Step 2: Implementar** em `exporta.js:27` (prefixo opcional).
- [ ] **Step 3: `enfesto.html`**: no "Mostrar" do Exportar, renomear "Nome do molde" para **"Referência do produto"** e acrescentar **"Nº do pedido"** (só aparece quando a ordem tem `pedidoNum`; padrão ligado). `resumoTxt()` começa com "Pedido #N · " quando houver. O título da página mostra "Pedido #N" quando houver.
- [ ] **Step 4: Self-checks** passam; conferir no navegador (`?local=1`) que o PLT/PDF exportado traz "Ped. 12".
- [ ] **Step 5: Commit**.
