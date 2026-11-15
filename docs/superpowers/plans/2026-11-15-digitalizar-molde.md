# Digitalizar Molde Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passar um molde de papel (uma peça, um tamanho por folha) para o app por fotos tiradas por partes, com contorno à mão ou automático, e levá-lo ao editor como peça base, peça de um tamanho, ou folha de fundo para gradear.

**Architecture:** Lógica pura num módulo novo `molde/digit.js` (grade de cruzes, perspectiva por célula, conferência de erro, cobertura, contorno automático), testado em Node. Página nova `digitalizar.html` para lista, captura no celular com fila de envio no IndexedDB, marcação das cruzes, montagem da folha e contorno automático. O editor `molde.html` ganha a camada "folha de fundo" por tamanho, alinhamento por 2 pontos e o arrasto que grava gradação.

**Tech Stack:** HTML + JS puros (sem build), Supabase (`public.docs`, Storage, RLS), Canvas 2D, IndexedDB, Node para self-checks.

**Spec:** `docs/superpowers/specs/2026-11-15-digitalizar-molde-design.md`

## Global Constraints

- Sem dependência nova; nada de OpenCV.js. Módulo novo segue o padrão UMD de `molde/geo.js` (`g.MoldeDigit = …; if (typeof module !== 'undefined') module.exports = …`).
- Unidades do molde em **mm**. Grade padrão `esp = 500` mm, editável. Rótulo da cruz: letra = linha (y), número = coluna (x): `A1 → (0,0)`, `B3 → (1000, 500)` com esp 500.
- Erro aceito: **2 mm**. Foto com menos de 5 cruzes = "erro não conferido" (aviso, nunca aprovação).
- Digitalização é área **moldes**: ver = `moldes:ver`, mexer = `moldes:mexer`. Fotos no bucket **privado** `digitalizacoes`, caminho `<id da digitalização>/<arquivo>.jpg`, abertas por link assinado (`createSignedUrl`, 3600 s). Nunca no bucket público `produtos`.
- Doc novo em `public.docs` com `col = 'digitalizacoes'`. Todo campo novo (também no molde) lido com valor padrão; docs antigos não quebram.
- `?local=1` (só localhost) continua funcionando: docs no localStorage, imagens no IndexedDB.
- Visual Outline: mesmos tokens `:root` claro/escuro de `corte.html` (`--bg --card --tx --bd --ac --fill --acx --warn`), Barlow Condensed nos títulos.
- Arquivos `.html` do repo usam **CRLF**: editar sem converter o arquivo inteiro para LF (conferir `git diff --stat` antes do commit).
- Commits só no branch `feat/digitalizar-molde`, mensagem em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Self-checks que já existem continuam passando: `node .claude/scripts/selfcheck.js`, `selfcheck-acesso.js`, `selfcheck-edge-acesso.js`, `selfcheck-molde.js`.

## Review Focus

1. **Foto do celular em pé (EXIF):** as coordenadas das cruzes têm que ser as da imagem como ela aparece. Reduzir/gravar a foto já girada (`createImageBitmap(file, {imageOrientation:'from-image'})`) antes de subir — Task 4, teste no navegador com uma foto em pé.
2. **Rótulo repetido ou fora da grade** numa mesma foto (`A1` duas vezes, `ZZ9`, `1A`): recusar com mensagem, não calcular — Task 1 (asserção) e Task 5.
3. **Folha grande estoura o canvas** (limite ~16 Mpx no Safari): a resolução da folha cai até caber e o app mostra a escala usada — Task 5 (`escalaFolha` com asserção).
4. **Sinal cai / aba fecha no meio do envio:** foto fica no IndexedDB e sobe ao reabrir — Task 4, teste com `context.setOffline`.
5. **Molde com folha de fundo cujas fotos foram apagadas:** imagem não carrega → a camada some com um aviso curto, o resto do editor funciona — Task 7.

---

### Task 1: Grade, perspectiva e conferência (`molde/digit.js`)

**Files:**
- Create: `molde/digit.js`
- Create: `.claude/scripts/selfcheck-digit.js` (mesmo estilo de `selfcheck-molde.js`: lista de `[nome, obtido, esperado]`, sai com código 2 se falhar)

**Interfaces:**
- Produces (em `MoldeDigit`):
  - `rotMm(rot: string, esp: number) -> {x,y} | null` — aceita minúscula; `null` se não for `^[A-Za-z][1-9]\d*$`.
  - `homografia(de: {x,y}[], para: {x,y}[]) -> number[9] | null` — ≥4 pares, mínimos quadrados (DLT normalizado); `null` se degenerado.
  - `aplicarH(H, p) -> {x,y}`; `inversa(H) -> number[9]`.
  - `validarCruzes(cruzes: {rot,x,y}[], esp) -> string | null` — mensagem de erro (rótulo inválido ou repetido, menos de 4) ou `null`.
  - `celulas(cruzes, esp) -> {i, j, H}[]` — uma por célula da grade com as 4 cruzes do canto na foto; `H` leva mm → px da foto. `i` = coluna, `j` = linha (0-based).
  - `conferir(cruzes, esp) -> {erro: number | null, n: number}` — com ≥5 cruzes, deixa uma de fora por vez, calcula a homografia px→mm com as outras e mede onde a de fora cai; `erro` = maior distância em mm. Com <5, `erro: null`.
  - `cobertura(fotos: {cruzes}[], esp) -> Set<string>` — chaves `"i,j"` das células cobertas por alguma foto.
  - `foraDaCobertura(pts: {x,y}[], cob: Set<string>, esp) -> boolean[]`.
  - `melhorFoto(fotos: {w,h,cruzes}[], p: {x,y}, esp) -> {k, x, y} | null` — entre as fotos cuja célula de `p` está coberta, a que deixa `p` mais perto do centro da foto (distância normalizada por `max(w,h)`); `x,y` em px dessa foto.

- [ ] **Step 1: Escrever o self-check que falha.** Fixtures: `esp = 500`; perspectiva conhecida `Hv = [1.2, 0.05, 30, -0.03, 1.1, 40, 0.0001, 0.00005, 1]` (mm → px); fotoA com cruzes `A1 A2 A3 B1 B2 B3` (px = `aplicarH(Hv, rotMm(rot))`), `w:1600, h:1200`. Asserções:
  - `rotMm('B3',500)` = `{x:1000,y:500}`; `rotMm('a1',500)` = `{x:0,y:0}`; `rotMm('1A',500)` = `null`.
  - `homografia` recuperada de 4 pontos aplicada em `{x:250,y:250}` bate com `aplicarH(Hv, …)` em `< 1e-6` px.
  - `validarCruzes` com `A1` duas vezes → texto contendo `"A1"`; com 3 cruzes → texto; fotoA → `null`.
  - `celulas(fotoA.cruzes,500).length` = 2 (células `0,0` e `1,0`).
  - `conferir(fotoA.cruzes,500).erro < 0.01`; movendo `B2` 10 px → `erro > 2`; só 4 cruzes → `erro === null`.
  - `cobertura([fotoA],500)` tem `"0,0"` e `"1,0"` e não tem `"0,1"`; `foraDaCobertura([{x:100,y:100},{x:100,y:700}], …)` = `[false, true]`.
  - fotoB = mesmas cruzes deslocadas para a foto ter o ponto `{x:900,y:250}` mais perto do centro → `melhorFoto([fotoA,fotoB], {x:900,y:250}, 500).k === 1`.
- [ ] **Step 2:** `node .claude/scripts/selfcheck-digit.js` → FALHA (módulo não existe).
- [ ] **Step 3:** Implementar `molde/digit.js` com as funções acima.
- [ ] **Step 4:** `node .claude/scripts/selfcheck-digit.js` → `✓ digit: N asserções OK`.
- [ ] **Step 5:** Commit "Digitalizar: grade de cruzes, perspectiva e conferência do erro".

### Task 2: Contorno automático (`molde/digit.js`)

**Files:**
- Modify: `molde/digit.js`
- Modify: `.claude/scripts/selfcheck-digit.js`

**Interfaces:**
- Produces:
  - `pintar(rgba: Uint8ClampedArray, w, h, sx, sy, tol: number) -> Uint8Array` — máscara 0/1: região 4-conectada a partir de `(sx,sy)` com cor a ≤ `tol` (distância RGB) da média 5×5 em volta da semente; furos internos preenchidos (o que não alcança a borda da imagem pelo fundo vira 1).
  - `borda(mask, w, h) -> {x,y}[]` — contorno externo fechado da região (seguimento de vizinhos de Moore), em px, sem repetir o primeiro ponto.
  - `simplificar(pts, tol) -> {x,y}[]` — Douglas-Peucker em polígono fechado (começa pelos dois pontos mais distantes).
  - `paraMolde(pts: {x,y}[], opts = {quina: 35}) -> {pts: {x,y}[], seg: ({tipo:'linha'} | {tipo:'curva', c1:{x,y}, c2:{x,y}})[]}` — `seg[k]` liga `pts[k]` a `pts[(k+1)%n]`. Vértice com giro > `quina` graus é quina; trecho entre dois vértices suaves vira `curva` com alças Catmull-Rom (1/3 da distância, tangente pelos vizinhos); trecho que encosta em quina dos dois lados e com vizinhos alinhados vira `linha`.
- Consumes: nada da Task 1.

- [ ] **Step 1: Asserções que falham.** Imagem sintética 200×150 fundo `(40,40,40)`, retângulo branco `x 40..159, y 30..119`, com 6 pixels de ruído escuro espalhados dentro dele:
  - `pintar(…,100,75,60)` soma = `120*90` (ruído preenchido).
  - `simplificar(borda(…),1.5).length` = 4 e cada canto a ≤ 1 px de `(40,30) (159,30) (159,119) (40,119)` (ou com +1 na borda, conforme a convenção escolhida — documentar no código).
  - `paraMolde(retângulo).seg` só `linha`, 4 itens.
  - Círculo branco raio 50 centro (100,75): `paraMolde(simplificar(borda(pintar(…)),0.8)).seg` todos `curva`; amostrando cada curva (bezier, 10 passos) a distância ao centro fica em `50 ± 1.5`.
- [ ] **Step 2:** Rodar → FALHA.
- [ ] **Step 3:** Implementar as quatro funções.
- [ ] **Step 4:** Rodar → PASSA; `selfcheck-molde.js` continua PASSA.
- [ ] **Step 5:** Commit "Digitalizar: contorno automático da folha".

### Task 3: Banco, acesso, menu e deploy

**Files:**
- Create: `supabase/migrations/20261115120000_digitalizacoes.sql`
- Modify: `acesso.js:21` (`ABA_AREA` ganha `digitalizar: 'moldes'`)
- Modify: `index.html:490-491,502,610` (aba `['digitalizar','Digitalizar molde']` no grupo PRODUÇÃO depois de `molde`, ícone `document_scanner`, link `digitalizar.html` na mesma aba, como `corte`)
- Modify: `.github/workflows/pages.yml` (`cp digitalizar.html _site/digitalizar.html`, `molde/` já vai inteiro)
- Create: `digitalizar.html` (esqueleto: cabeçalho, tokens, `IS_DEV`/`LOCAL`/`sb` como `corte.html`, aviso sem permissão via `Acesso.pode(perfil,'moldes','ver')`)
- Test: `.claude/scripts/selfcheck-acesso.js`

**Interfaces:**
- Produces: bucket `digitalizacoes`; `private.area_da_col('digitalizacoes') = 'moldes'`; página `digitalizar.html` com o objeto de armazenamento `B` (local ou Supabase) que as Tasks 4–6 completam.

- [ ] **Step 1:** Asserção em `selfcheck-acesso.js`: `Acesso.ABA_AREA.digitalizar === 'moldes'` → rodar → FALHA.
- [ ] **Step 2:** Migration: recriar `private.area_da_col` com o `when 'digitalizacoes' then 'moldes'` a mais (copiar o corpo de `20261114120000_admin_permissoes.sql:13-25`); `insert into storage.buckets (id, name, public) values ('digitalizacoes','digitalizacoes', false) on conflict (id) do nothing`; políticas em `storage.objects` para `bucket_id = 'digitalizacoes'`: select com `private.pode('moldes','ver')`, insert/update/delete com `private.pode('moldes','mexer')`. Cabeçalho com o "volta atrás" como nas outras migrations.
- [ ] **Step 3:** `acesso.js`, menu do `index.html`, `pages.yml`, esqueleto `digitalizar.html`.
- [ ] **Step 4:** 4 self-checks + `selfcheck-digit.js` → PASSAM. Navegador `?local=1` (servidor `node <scratchpad>/srv.js`, porta 8765, Playwright): o menu mostra "Digitalizar molde" e abre a página; 390px sem rolagem lateral.
- [ ] **Step 5:** Commit "Digitalizar: banco, acesso, menu e página". **Não aplicar a migration em produção**: o controlador pede ao dono antes.

### Task 4: Lista e captura no celular, com fila de envio

**Files:**
- Modify: `digitalizar.html`

**Interfaces:**
- Consumes: `B` da Task 3.
- Produces — doc `digitalizacoes`: `{nome: string, tam: string, esp: number = 500, fotos: {arq, w, h, cruzes: {rot,x,y}[]}[], folha: null | {arq, mmPx, x0, y0, w, h}, criadaEm: ISO, v: 1}`; métodos de `B`: `lista()`, `dig(id)`, `criar(d) -> id`, `gravar(id,d)`, `apagar(id)`, `subir(caminho, blob)`, `urlFoto(caminho) -> Promise<string>`, `apagarArqs(caminhos[])`.

- [ ] **Step 1:** Tela inicial: lista das digitalizações (nome, tamanho, nº de fotos, "folha montada" sim/não) e "Nova digitalização" (nome, tamanho opcional, espaçamento em cm, padrão 50).
- [ ] **Step 2:** Tela da digitalização no celular: botão grande "Tirar foto" (`<input type=file accept=image/* capture=environment>`) e "Da galeria" (`multiple`). Cada foto: `createImageBitmap(file,{imageOrientation:'from-image'})`, reduzir para no máximo 3000 px no lado maior, JPEG 0,9, guardar no IndexedDB (`fila`: `{digId, arq, blob, w, h}`) **antes** de subir; subir; só ao confirmar, acrescentar em `fotos` do doc e tirar da fila. Estado por foto: enviando / enviada / falhou (botão "tentar de novo"). Ao abrir a página, a fila pendente sobe sozinha.
- [ ] **Step 3:** No computador, a mesma tela aceita arrastar/escolher arquivos (mesmo caminho do Step 2).
- [ ] **Step 4:** Navegador `?local=1`: criar digitalização, mandar 2 imagens; com `context.setOffline(true)` a terceira fica "falhou"; recarregar com rede → sobe sozinha e o doc tem 3 fotos. Foto em pé (fixture com EXIF de rotação) aparece em pé. 390px sem rolagem lateral.
- [ ] **Step 5:** Commit "Digitalizar: captura no celular com fila de envio".

### Task 5: Marcar cruzes e montar a folha

**Files:**
- Modify: `digitalizar.html`, `molde/digit.js`, `.claude/scripts/selfcheck-digit.js`

**Interfaces:**
- Consumes: Task 1 (`validarCruzes`, `conferir`, `celulas`, `cobertura`, `melhorFoto`, `rotMm`), Task 4 (`B`, doc).
- Produces: `escalaFolha(wMm, hMm, maxPx = 16e6) -> number` (mm por px, começando em 0,5 e subindo até `(wMm/mmPx)*(hMm/mmPx) <= maxPx`) em `MoldeDigit`; `folha` gravada no doc e `folha.jpg` em `<digId>/folha.jpg`.

- [ ] **Step 1:** Asserções: `escalaFolha(1500,1000) === 0.5`; `escalaFolha(4000,3000)` > 0.5 e `(4000/r)*(3000/r) <= 16e6`.
- [ ] **Step 2:** Rodar → FALHA; implementar; → PASSA.
- [ ] **Step 3:** Tela "Montar" (computador): foto grande com zoom; clicar numa cruz abre um campo para o rótulo (sugere o próximo da mesma linha); cruz marcada fica com o rótulo em cima, pode arrastar e apagar. Ao lado de cada foto: "erro 0,8 mm" (verde), "erro 3,1 mm — refaça ou confira as cruzes" (`--warn`) ou "erro não conferido (só 4 cruzes)". `validarCruzes` com erro → mensagem, não calcula.
- [ ] **Step 4:** "Montar folha": área = células cobertas; para cada pixel da folha (na escala `escalaFolha`), `melhorFoto` → amostra da foto (carregada por `urlFoto`); grava `folha.jpg` e `folha = {arq, mmPx, x0, y0, w, h}` (`x0,y0` = canto em mm da grade). Mostra a folha com as células cobertas e um aviso se alguma foto ficou acima de 2 mm.
- [ ] **Step 5:** Navegador `?local=1` com fixture: uma imagem sintética de grade (cruzes desenhadas numa perspectiva conhecida, gerada no próprio teste) cortada em 2 "fotos" sobrepostas; marcar as cruzes; a folha montada mostra um quadrado de 300 mm conhecido com lado medido a ±2 mm.
- [ ] **Step 6:** Commit "Digitalizar: marcar cruzes e montar a folha".

### Task 6: Contorno automático na tela e levar para o molde

**Files:**
- Modify: `digitalizar.html`

**Interfaces:**
- Consumes: Task 2 (`pintar`, `borda`, `simplificar`, `paraMolde`), Task 1 (`foraDaCobertura`, `cobertura`), `MoldeModelo` (`uid`, `encadear`, `normalizar` em `molde/modelo.js`), `B` com acesso a `moldes` (mesmos métodos `molde/criar/gravar` de `molde.html:293-316`).
- Produces — campo novo no molde: `fundos: { [tam]: { dig, arq, mmPx, x0, y0, w, h, tx: 0, ty: 0, ang: 0, peca: pecaId | null } }`, padrão `{}` em `MoldeModelo.normalizar`.

- [ ] **Step 1:** "Contorno automático": clicar no papel → `pintar` (tolerância ajustável, padrão 40) → `borda` → px→mm (`x0 + x*mmPx`) → `simplificar` com "Suavizar" (0,3 a 3 mm, padrão 1) → `paraMolde`. Pré-visualização em cima da folha; trechos fora das células cobertas em `--warn` com o aviso "faltou foto ou cruz aqui".
- [ ] **Step 2:** "Levar para o molde" com três escolhas: **(a) peça base** (molde novo ou existente; a peça entra no tamanho base com o contorno automático, e a folha vira `fundos[base]`), **(b) peça só do tamanho X** (peça com `tam: X`), **(c) só a folha de fundo** (para contornar à mão ou gradear: `fundos[X]` com `peca` escolhida). (a) e (b) sem contorno automático entram só como fundo. Ao terminar, abre `molde.html?id=…` (com `local=1` se estiver local).
- [ ] **Step 3:** Botão "Apagar fotos": confirma ("a folha de fundo some do molde; peças e gradação ficam"), apaga `fotos` e `folha.jpg` do storage e zera `fotos`/`folha` no doc.
- [ ] **Step 4:** Asserção em `selfcheck-molde.js`: `MoldeModelo.normalizar({}).fundos` deep-equal `{}`. Rodar os self-checks → PASSAM.
- [ ] **Step 5:** Navegador `?local=1`: folha da Task 5 → contorno automático → (a) num molde novo → o editor abre com a peça de 4 lados ±2 mm. Molde antigo sem `fundos` abre igual a antes.
- [ ] **Step 6:** Commit "Digitalizar: contorno automático e levar para o molde".

### Task 7: Folha de fundo e gradear arrastando no editor

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `M.fundos` (Task 6), `B.urlFoto`-equivalente no `B` de `molde.html` (link assinado do bucket `digitalizacoes`; local: IndexedDB), `MoldeModelo.noTamanho`, `M.grad`.

- [ ] **Step 1:** Camada `<g id="fundo">` antes de `#fantasma` (`molde.html:166`): mostra a folha de `M.fundos[tamVer]` como `<image>` em mm (`x0,y0,w*mmPx,h*mmPx`) com `transform` de `tx,ty,ang`, opacidade ajustável (padrão 0,5). Botão "Folha" no topo liga/desliga. Imagem que não carrega → camada some e toast "Fotos da folha apagadas".
- [ ] **Step 2:** "Alinhar folha": clicar um ponto do molde e depois o ponto igual na folha, duas vezes → calcula giro + deslocamento (sem escala) e grava em `fundos[tamVer]`.
- [ ] **Step 3:** Gradear arrastando: com `tamVer ≠ base` e folha de fundo ligada, arrastar um ponto grava `M.grad[id][tamVer] = posição − posição no base` (os outros tamanhos ficam como estão), em vez de "Edite no tamanho base". Fora disso, o bloqueio atual (`molde.html:802,849`) continua.
- [ ] **Step 4:** Botão "Digitalizar" no topo do editor abre `digitalizar.html` (com `local=1` se local).
- [ ] **Step 5:** Self-checks → PASSAM. Navegador `?local=1`: molde da Task 6 com uma segunda folha (tamanho G) como fundo; alinhar; arrastar 2 pontos; no Fantasma o G aparece deslocado e `M.grad` tem os valores; salvar e reabrir mantém a folha alinhada. Claro e escuro.
- [ ] **Step 6:** Commit "Digitalizar: folha de fundo e gradação por arrasto no editor".
