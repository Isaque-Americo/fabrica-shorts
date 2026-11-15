# Visual Outline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a cara do app para a marca Outline, no estilo esportivo preto e laranja, com um painel novo do admin, sem mudar o que as telas fazem.

**Architecture:** Tudo é CSS por tokens em `:root` (com o modo escuro) mais markup gerado pelo JS que já existe em `index.html`. Os números do painel saem de uma função pura `painelDados(pedidos, produtos, reps, hoje)`, testada no self-check do index. As outras páginas só trocam os tokens e as fontes.

**Tech Stack:** HTML/CSS/JS sem build, Google Fonts (Inter e Barlow Condensed), Supabase (só leitura no que já existe), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-14-visual-outline-design.md`. A maquete aprovada está em `.superpowers/brainstorm/1933-1794704910/content/estilo-b-v2.html`.

## Global Constraints

- **Tokens no modo claro:**

  | Token | Valor | Uso |
  |---|---|---|
  | `--bg` | `#f4f4f3` | fundo |
  | `--card` | `#ffffff` | cartões |
  | `--tx` | `#18181b` | texto |
  | `--mut` | `#71717a` | texto secundário |
  | `--bd` | `#e4e4e7` | bordas |
  | `--hd` | `#18181b` | cabeçalhos |
  | `--sidebar` | `#0e0e0f` | barra lateral |
  | `--fill` | `#f97316` | preenchimento laranja: botão principal, aba ativa, destaques, mês atual |
  | `--acx` | `#0e0e0f` | texto sobre `--fill` |
  | `--ac` | `#c2410c` | laranja escuro para texto, link, borda e foco: contraste ≥ 4,5:1 no branco |
  | `--ok` | `#16a34a` | estado ok |
  | `--warn` | `#d97706` | estado de aviso |
  | `--bad` | `#dc2626` | estado de erro |

- **Tokens no modo escuro**, nos dois blocos que já existem: `prefers-color-scheme` e `[data-theme="dark"]`.

  | Token | Valor |
  |---|---|
  | `--bg` | `#121214` |
  | `--card` | `#1c1c1f` |
  | `--tx` | `#f4f4f5` |
  | `--mut` | `#a1a1aa` |
  | `--bd` | `#2e2e33` |
  | `--hd` | `#f4f4f5` |
  | `--sidebar` | `#0a0a0b` |
  | `--fill` | `#f97316` |
  | `--acx` | `#0e0e0f` |
  | `--ac` | `#fb923c` |
  | `--ok` | `#4ade80` |
  | `--warn` | `#fbbf24` |
  | `--bad` | `#f87171` |

- **Nunca branco sobre laranja.** Texto sobre `--fill` é sempre `--acx`.
- **Fontes.** Inter para o texto. Barlow Condensed 600/700/800 com a classe `.num` para números grandes e títulos de página, em caixa alta. Poppins e Roboto saem do `<link>` do index, se nada mais usar.
- **Marca.** "Outline" substitui "Fábrica de Shorts" no `<title>`, no login e no topo do menu. O logo fica em `img/outline-logo.png`; no fundo escuro usa `filter:brightness(0) invert(1)`.
- **Arquivos.** `index.html` é CRLF: use `git -c core.autocrlf=false add index.html` e mantenha o diff só nas linhas da tarefa. Nunca commitar `e-mail.jpg`.
- **Testes.** Os self-checks passam: `node .claude/scripts/selfcheck.js`, `selfcheck-molde.js`, `selfcheck-acesso.js` e `selfcheck-edge-acesso.js`.
- **Commits** em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Escopo.** Sem mudança no banco, nas permissões ou no que as telas fazem.

## Review Focus

1. **Celular** (até 900px): a barra lateral já vira uma barra horizontal no topo (`index.html` ~l.116–124). Os títulos de grupo e a marca grande não podem quebrar essa barra: esconda os títulos de grupo e mostre só o logo.
2. **Modo escuro:** o laranja escuro `--ac` em texto fica ilegível no fundo escuro se o token escuro não for aplicado. Confira os links e os botões fantasma nos dois modos.
3. **Admin limitado:** atalho do painel para aba sem permissão vira texto. O botão "+ Novo pedido" só aparece com `pedidos:mexer`.
4. **Pedidos sem `data`, com `data` inválida ou de anos anteriores:** ficam fora de "Vendas por mês" sem quebrar a conta.
5. **Lojista e representante:** veem a barra nova com as abas deles, e o painel do representante (`painelRepresentante`) continua funcionando.

---

### Task 1: Marca, tokens, fontes e barra lateral (`index.html`, `pages.yml`)

**Files:**
- Create: `img/outline-logo.png`, copiado de `C:\Users\Isaque\Desktop\Short\logo\logo 2.png`.
- Modify: `.github/workflows/pages.yml`, acrescentando `cp -r img _site/img` junto dos outros `cp`.
- Modify: `index.html`:
  - `<title>` e `<link>` de fontes (l.6–7);
  - tokens (l.19–22);
  - `.sidebar*` (l.27–33 e 116–124);
  - cabeçalho da barra (l.163–168);
  - montagem do menu em `render()` (~l.561–565);
  - login (~l.237).

**Interfaces:**
- Produces: as classes `.num` (Barlow Condensed) e `.grupo` (título de grupo do menu), e os tokens `--fill`/`--acx`/`--ac`, que as Tasks 2 e 3 usam.

- [ ] **Step 1:** Copiar o logo para `img/outline-logo.png` e acrescentar o `cp -r img _site/img` no `pages.yml`.
- [ ] **Step 2:** Trocar os tokens e as fontes conforme as Global Constraints.
  - `button.pri` passa a usar `background:var(--fill);color:var(--acx);border-color:var(--fill)`.
  - O realce da aba ativa usa `box-shadow:inset 3px 0 0 var(--fill)` no desktop e `border-bottom-color:var(--fill)` no celular.
  - O título de cada página (`#page-title`) também usa `.num`, em caixa alta.
- [ ] **Step 3:** No cabeçalho da barra, o logo em branco fica ao lado de "OUTLINE" (`.num`, 20px) com "CONFECÇÃO" pequeno embaixo (letter-spacing 2px). No celular aparece só o logo.
- [ ] **Step 4:** Agrupar o menu do admin. A ordem e os títulos são:

  | Grupo | Abas |
  |---|---|
  | VISÃO GERAL | painel |
  | VENDAS | pedidos, reps, cadastros |
  | PRODUÇÃO | fabricar, corte, molde |
  | CATÁLOGO | produtos, materia, estoque |
  | (sem título) | administradores |

  - Use o filtro de permissão que já existe.
  - Um grupo sem nenhuma aba visível não aparece.
  - Pedidos mostra a pílula `.pill` (fundo `--fill`, texto `--acx`) com o nº de pedidos `Pendente`, quando for maior que 0.
  - Lojista e representante usam as abas deles, sem títulos de grupo.
  - Os títulos de grupo ficam `display:none` em até 900px.
- [ ] **Step 5:** No login, o fundo da página é `--sidebar`. O cartão traz o logo (cinza original sobre o cartão branco) e o título "OUTLINE" em `.num`. O botão é `.pri`. O Turnstile e os campos não mudam.
- [ ] **Step 6:** Rodar os 4 self-checks e fazer o teste no navegador com `?local=1` (servidor estático em `node <scratchpad>/srv.js`, porta 8765, e Playwright). Conferir:
  - desktop e 390px de largura;
  - modo claro e escuro (`document.documentElement.dataset.theme`);
  - admin principal e admin simulado `{pedidos:'ver'}`;
  - login.
- [ ] **Step 7:** Commit "Visual: marca Outline, cores e menu agrupado".

### Task 2: Painel do admin

**Files:**
- Modify: `index.html`:
  - `painel()` (~l.722–742) e o CSS do painel;
  - nova função pura `painelDados` perto de `pedTotal` (~l.520);
  - asserções no bloco de self-check (~l.1955, no formato `[nome, obtido, esperado]`).

**Interfaces:**
- Consumes: `pedTotal`, `tot`, `rep`, `pode`, `fabricarLista`, `irPara`, `brl`, `esc`, e `.num`/`--fill` da Task 1.
- Produces: `painelDados(pedidos, produtos, reps, hoje)` devolve `{vendido, aprovado, varPct, etapas, meses, atencao}`.
  - **`vendido`:** soma de `pedTotal` dos pedidos fora de `Cancelado`/`Recusado`.
  - **`aprovado`:** soma de `pedTotal` dos pedidos em `Aprovado|Faturado|Enviado|Entregue`.
  - **`varPct`:** variação, em %, do Vendido do mês de `hoje` sobre o mês anterior, arredondada. `null` quando o mês anterior tem 0.
  - **`etapas`:** `{Pendente, Aprovado, 'Em corte', Faturado, Enviado, Entregue}`, com as contagens. Aprovado com `ordemId` conta em "Em corte"; sem `ordemId`, conta em "Aprovado".
  - **`meses`:** os 6 meses até o de `hoje`, como `[{rot:'jun', v:number}, …]`. A data vem de `o.data` (`AAAA-MM-DD`); pedido sem data válida fica fora. Os status excluídos são os mesmos do `vendido`.
  - **`atencao`:** lista de `{tipo, n}` só com o que é maior que 0. Os tipos são:
    - `aprovar` (Pendente);
    - `semMolde` (produtos sem molde, pela regra `temMolde` que já existe);
    - `estoqueBaixo` (regra `tot(p) <= (+p.min||0)` de hoje);
    - `semRep` (a regra `sc` de hoje).

  A comissão por representante continua na tabela.

- [ ] **Step 1: Escrever as asserções que falham.** Com 4 pedidos de exemplo, `hoje = new Date(2026,10,14)`:
  - Pendente 100 (`data` 2026-11-02);
  - Aprovado com `ordemId` 200 (2026-11-05);
  - Faturado 50 (2026-10-10);
  - Cancelado 999 (2026-11-01).

  | Asserção | Esperado |
  |---|---|
  | `vendido` | 350 |
  | `aprovado` | 250 |
  | `etapas['Em corte']` | 1 |
  | `etapas.Aprovado` | 0 |
  | `varPct` | 500 (300 em nov contra 50 em out) |
  | `meses.length` | 6 |
  | último mês | 300 |
  | pedido sem `data` fica fora do gráfico, mas entra no `vendido` | — |
  | `varPct` com outubro vazio | `null` |
- [ ] **Step 2:** Rodar `node .claude/scripts/selfcheck.js`. Esperado: FALHA (`painelDados` não definida).
- [ ] **Step 3:** Implementar `painelDados`.
- [ ] **Step 4:** Rodar de novo. Esperado: PASSA.
- [ ] **Step 5:** Reescrever o `painel()` do admin conforme a maquete v2. A ordem, de cima para baixo:
  1. **Saudação.** "Bom dia/Boa tarde/Boa noite", com o nome de `appProfile.contact_name` ou "Admin", e a data por extenso, mais o botão "+ Novo pedido" só com `pode('pedidos')`, que abre o mesmo fluxo do botão da aba Pedidos.
  2. **4 cartões.**
     - Cartão preto: "VENDIDO", o valor grande e "Aprovado: R$ X" menor embaixo, com "▲/▼ N% sobre o mês anterior" quando `varPct!==null`.
     - "PARA APROVAR", em laranja.
     - "A FABRICAR".
     - "EM ESTOQUE", com o nº de produtos.
  3. **Caminho dos pedidos**, com as 6 etapas. A etapa Pendente com contagem maior que 0 fica destacada com `outline:2px solid var(--fill)`. Clicar faz `irPara('pedidos', <status>)`; para "Em corte", use `'Aprovado'`.
  4. **Vendas por mês** em barras CSS, com a altura proporcional ao maior mês e o mês atual em `--fill`. `title` em cada barra com o valor em R$.
  5. **Precisa de atenção.** Cada item é clicável para a aba do assunto (aprovar → pedidos Pendente; semMolde e estoqueBaixo → produtos; semRep → pedidos), e só vira link se `pode(área,'ver')`.
  6. A tabela de comissões que já existe.

  Os números grandes usam `.num`. Os textos vêm escapados com `esc`. O `painelRepresentante` não muda de lógica.
- [ ] **Step 6:** Rodar os 4 self-checks e testar no navegador:
  - admin principal com os dados locais;
  - admin simulado `{pedidos:'ver'}`: sem botão "Novo pedido", atalhos de produtos como texto;
  - 390px de largura: os cartões caem em 2 colunas e o caminho rola na horizontal ou quebra em 3+3;
  - modo escuro.
- [ ] **Step 7:** Commit "Visual: painel novo do admin".

### Task 3: Corte, molde e enfesto com os mesmos tokens

**Files:**
- Modify: `corte.html`, `molde.html`, `enfesto.html`: só os tokens `:root` (claro, escuro e impressão), o `<link>` de fontes e os botões e realces que usam `--ac` como fundo.

**Interfaces:**
- Consumes: a tabela de tokens das Global Constraints.

- [ ] **Step 1:** Aplicar os tokens claro e escuro, e acrescentar `--fill`/`--acx`.
  - Onde `--ac` é **fundo** (`button.pri`, aba selecionada, realces), trocar para `var(--fill)` com texto `var(--acx)`.
  - Onde é texto ou borda, manter `var(--ac)`.
  - O bloco de impressão (`corte.html` ~l.91) não muda.
- [ ] **Step 2:** Os títulos das páginas ("Ordens de corte", "Editor de molde", "Enfesto") usam Barlow Condensed em caixa alta. O desenho do molde e do encaixe (canvas e SVG) não muda de cor.
- [ ] **Step 3:** Rodar os self-checks e fazer o teste no navegador com `?local=1` nas três páginas, no claro e no escuro. Conferir também que a impressão do corte continua em preto e branco.
- [ ] **Step 4:** Commit "Visual: corte, molde e enfesto com as cores Outline".
