# CAD de molde — Etapa 1 (editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `molde.html` onde o admin desenha o diagrama de um short, extrai as peças (margem, fio, piques, pences, dobra, "cortar N") e salva o molde ligado a uma ou mais referências, que passam a ter `p.mol` para o encaixe que já existe.

**Architecture:** Lógica pura em dois arquivos JS sem DOM (`molde/geo.js` geometria, `molde/modelo.js` dados do molde), testados em Node por `.claude/scripts/selfcheck-molde.js`. `molde.html` é a interface (SVG) e fala com o Supabase pela mesma tabela `docs`, `col='moldes'`. O `index.html` só ganha o botão que abre o editor e o aviso quando o molde veio do editor.

**Tech Stack:** HTML/JS puro sem build, SVG, `@supabase/supabase-js@2.45.4` por CDN (mesma versão do `index.html`), Node só para o self-check.

**Spec:** `docs/superpowers/specs/2026-11-11-cad-molde-enfesto-design.md`

## Global Constraints

- Sem build; bibliotecas só por CDN com versão fixa. Nenhuma biblioteca nova nesta etapa.
- Armazenamento em **mm**; tela e campos em **cm**, aceitando vírgula decimal ("11,5").
- Só admin abre o editor. RLS já cobre: `docs_admin_all` libera tudo para admin; nenhuma política dá acesso de lojista/representante a `col='moldes'`. **Nenhuma mudança no banco nesta etapa.** O catálogo do lojista (`private.sync_catalog_from_docs`) copia só `ref, nome, preco, precoG`, então `p.mol` não vaza.
- `p.mol` mantém o formato atual `{arq, un:'mm', pecas:[{w,h,qtd,pts}]}`, com `pts` relativos ao canto da caixa e fio no eixo Y. Campos novos só somam: `p.molId` (id do doc em `moldes`), `p.mol.arq = 'Molde: <nome>'`.
- Leitores de documento antigo usam padrão para todo campo novo (há o agente `compat-reviewer` para conferir).
- Nunca gravar chave nova no front. `molde.html` reusa `SB_URL`/`SB_KEY` públicos (anon) já presentes no `index.html`.
- Visual próprio do app (tokens de cor do `index.html`), sem copiar ícones/marca do molde.me.
- Grade de tamanhos fica para a etapa 2; nesta etapa o molde tem um tamanho (o base, padrão `'M'`, gravado em `molde.base`).

## Review Focus

1. **Contorno que não fecha** (traços que não se encostam, ou ordem bagunçada na seleção): extrair deve encadear os traços sozinho e, se não fechar, dizer qual ponta ficou solta — nunca criar peça aberta. → teste em Task 3.
2. **Margem em curva côncava** (gancho, cava): a linha de corte não pode dar laço nem cruzar a de costura. → teste em Task 2.
3. **Produto antigo com `p.mol` vindo de PLT e sem `molId`**: continua igual; ligar ao molde só sobrescreve depois de confirmar. → teste em Task 3 (`molParaProduto`) e verificação em Task 7.
4. **Sessão expirada ou rede caindo no salvamento automático**: o desenho não se perde (rascunho local + nova tentativa, indicador "não salvo"). → Task 4.
5. **Peça em dobra**: o espelho fecha sem costura duplicada na linha da dobra e com a área exatamente o dobro. → teste em Task 2.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `molde/geo.js` (novo) | Geometria pura: curvas, comprimento, área, offset, espelho, ímã, interseção, estender, arredondar. Expõe `MoldeGeo` no navegador e `module.exports` no Node. |
| `molde/modelo.js` (novo) | Formato do molde, padrões para doc antigo, encadear contorno, gerar costura/corte da peça, converter para `p.mol`, histórico desfazer/refazer. Expõe `MoldeModelo`. |
| `molde.html` (novo) | Interface: login reaproveitado, tela SVG, ferramentas, painel Moldes, propriedades, salvar. |
| `.claude/scripts/selfcheck-molde.js` (novo) | Asserções de `geo.js` e `modelo.js` em Node. |
| `.claude/hooks/selfcheck-index.js` (modificar) | Rodar também o self-check do molde quando `molde/*.js` mudar. |
| `index.html` (modificar) | Botão "Desenhar molde" no formulário do produto (~linha 780); aviso de origem do molde. |

## Formato do documento `moldes` (decidido aqui; tarefas usam estes nomes)

```js
{
  nome: 'Short tactel masc',
  produtoIds: ['<id docs produtos>', ...],
  base: 'M',
  pontos: { p1: {x, y}, ... },                 // mm
  tracos: [                                    // diagrama
    { id, tipo: 'reta',   a: 'p1', b: 'p2' },
    { id, tipo: 'curva',  a, b, c1: {x,y}, c2: {x,y} },   // Bézier cúbica
    { id, tipo: 'circulo', c: 'p3', r },
    { id, tipo: 'livre',  pts: [{x,y}, ...] },
  ],
  textos: [{ id, x, y, texto, tam }],
  pecas: [{
    id, nome, cortar: 1, par: false,           // par=true → corta N pares espelhados
    tracos: [{ id, inv: false }, ...],         // contorno encadeado, sentido anti-horário
    dobra: null | { tracoId },                 // traço reto que vira eixo do espelho
    fio: { a:{x,y}, b:{x,y} },
    margem: 10, margemTraco: { [tracoId]: mm },// bainha = margemTraco do traço da barra
    piques: [{ tracoId, t }],                  // t em 0..1 ao longo do traço
    pences: [{ tracoId, t, abertura, profundidade }],
    visivel: true, travada: false
  }],
  v: 1
}
```

---

### Task 1: Geometria básica (`molde/geo.js`) e self-check

**Files:**
- Create: `molde/geo.js`
- Create: `.claude/scripts/selfcheck-molde.js`
- Modify: `.claude/hooks/selfcheck-index.js` (também disparar para `molde/geo.js`, `molde/modelo.js`, `molde.html`)

**Interfaces:**
- Produces (todas em `MoldeGeo`; ponto = `{x,y}` em mm):
  - `bezier(a, c1, c2, b, tol = 0.2) -> Ponto[]` achata a cúbica até erro ≤ `tol` mm, inclui `a` e `b`.
  - `comprimento(pts: Ponto[]) -> number`
  - `area(pts) -> number` com sinal (positivo = anti-horário); `areaAbs(pts)`.
  - `bbox(pts) -> {x0,y0,w,h}`
  - `circulo(c, r, tol = 0.2) -> Ponto[]` (fechado, anti-horário, sem repetir o 1º).
  - `pontoEm(pts, t) -> {p, tangente}` por comprimento de arco, `t` em 0..1.

- [ ] **Step 1: Escrever os testes** em `selfcheck-molde.js` (carrega os arquivos com `require`, mesmo estilo de lista `[nome, obtido, esperado]` do `selfcheck.js`, tolerância 0,5 mm):
  - `comprimento` de `[{0,0},{30,40}]` = 50.
  - `area` do quadrado 100×100 anti-horário = 10000; horário = −10000.
  - `bezier` de (0,0),(0,55.23),(44.77,100),(100,100) — quarto de círculo r=100 — comprimento ≈ 157,08 (±0,5).
  - `areaAbs(circulo({0,0},100))` ≈ 31415,9 (±30).
  - `pontoEm([{0,0},{100,0}], 0.25).p` = {25,0}.
- [ ] **Step 2:** `node .claude/scripts/selfcheck-molde.js` → falha (arquivo não existe).
- [ ] **Step 3:** Implementar `molde/geo.js`. Envolver em `(function(g){...})(typeof window!=='undefined'?window:globalThis)` e terminar com `if (typeof module!=='undefined') module.exports = MoldeGeo`. Bézier: subdivisão de De Casteljau recursiva até a corda distar ≤ `tol` dos controles.
- [ ] **Step 4:** Rodar → `✓ molde: N asserções OK`. Rodar também `node .claude/scripts/selfcheck.js` → continua 45 OK.
- [ ] **Step 5: Commit** `git add molde/geo.js .claude/scripts/selfcheck-molde.js .claude/hooks/selfcheck-index.js && git commit -m "Geometria basica do editor de molde"`

### Task 2: Geometria de molde — margem, espelho, ímã, edição

**Files:**
- Modify: `molde/geo.js`
- Modify: `.claude/scripts/selfcheck-molde.js`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `offset(pts, dist: number[]) -> Ponto[]` — polígono fechado anti-horário; `dist[i]` vale para a aresta `pts[i]→pts[i+1]`; devolve a linha de corte para fora.
  - `espelhar(pts, a, b) -> Ponto[]` reflete sobre a reta a–b.
  - `abrirDobra(pts, a, b) -> Ponto[]` — `pts` é a meia peça cujo contorno contém a aresta a–b; devolve a peça inteira sem repetir a aresta da dobra.
  - `ima(p, pontos: Ponto[], segs: [Ponto,Ponto][], raio) -> {p, tipo:'ponto'|'linha'|null}` — ponto vence linha.
  - `intersecao(a1,a2,b1,b2) -> {p, ta, tb} | null` (segmentos).
  - `estender(a, b, ate: [Ponto,Ponto][]) -> Ponto | null` — prolonga a→b além de `b` até o primeiro segmento.
  - `arredondar(p0, p1, p2, raio) -> {ini, fim, c1, c2}` — curva cúbica que substitui o canto em `p1`.
  - `girar(pts, centro, graus)`, `mover(pts, dx, dy)`.

- [ ] **Step 1: Testes:**
  - `offset` do quadrado 100×100 com `[10,10,10,10]` → bbox 120×120, área 14400.
  - `offset` com `[10,10,40,10]` (bainha 4 cm na 3ª aresta) → bbox h = 150.
  - **Côncavo (Review 2):** polígono em "L" e um gancho achatado de `bezier` (raio 30 mm) com margem 10: resultado sem auto-interseção (função de teste `semCruzar(pts)` checa todo par de arestas não vizinhas) e toda distância de vértice do corte ao contorno ≥ 9,5 mm.
  - **Dobra (Review 5):** meia peça retângulo 50×100 com dobra na aresta x=0 → `abrirDobra` área = 2 × 5000, 4 vértices (nenhum ponto repetido na linha da dobra).
  - `ima({x:3,y:2},[{0,0}],[],5).tipo` = `'ponto'`; fora do raio → `null`.
  - `estender({0,0},{10,0},[[{50,-10},{50,10}]])` = {50,0}.
  - `arredondar` canto 90° raio 10: `ini` e `fim` a 10 mm do canto.
- [ ] **Step 2:** Rodar → falha.
- [ ] **Step 3:** Implementar. Offset: deslocar cada aresta pela sua distância, interseção de retas consecutivas (miter, limite 4×dist; acima disso, chanfrar com dois pontos). Depois remover laços: percorrer as arestas e, ao achar interseção entre aresta i e j>i+1, descartar os pontos entre elas (laço local de curva côncava).
- [ ] **Step 4:** Rodar → OK.
- [ ] **Step 5: Commit** `"Margem, dobra, ima e edicao na geometria do molde"`

### Task 3: Modelo do molde (`molde/modelo.js`)

**Files:**
- Create: `molde/modelo.js`
- Modify: `.claude/scripts/selfcheck-molde.js`

**Interfaces:**
- Consumes: `MoldeGeo` (Tasks 1–2).
- Produces (em `MoldeModelo`):
  - `novo(nome) -> Molde` (formato acima, `base:'M'`, `v:1`).
  - `normalizar(doc) -> Molde` — preenche todo campo ausente com padrão (doc antigo/parcial).
  - `tracoPts(m, traco) -> Ponto[]` (curva achatada, círculo fechado, livre como está).
  - `encadear(m, tracoIds: string[]) -> {ok:true, tracos:[{id,inv}]} | {ok:false, erro:string, ponta:Ponto}` — ordena e orienta traços para formar um laço fechado anti-horário (tolerância 0,5 mm entre pontas); círculo sozinho é laço válido.
  - `costura(m, peca) -> Ponto[]` (aplica dobra se houver; pences inseridas como V no traço).
  - `corte(m, peca) -> Ponto[]` (`offset` com `margemTraco[id] ?? margem` por aresta).
  - `molParaProduto(m) -> {arq, un:'mm', pecas:[{w,h,qtd,pts}]}` — uma entrada por peça visível; `pts` = `corte` arredondado ao mm, transladado para o canto da caixa, girado para o **fio ficar no eixo Y**; `qtd = cortar * (par ? 2 : 1)`.
  - `historico(limite=100) -> {gravar(m), desfazer() -> Molde|null, refazer() -> Molde|null}` (snapshots via `structuredClone`).

- [ ] **Step 1: Testes:**
  - **Review 1:** quatro retas de um retângulo passadas fora de ordem e uma invertida → `encadear` ok, 4 traços, área positiva. Uma reta tirada → `ok:false`, `erro` contém "não fecha", `ponta` é a ponta solta.
  - `corte` do retângulo 100×200 com margem 10 e `margemTraco` da barra = 30 → bbox 120×240.
  - `molParaProduto` de peça `cortar:1, par:true` com fio na diagonal 45° → `qtd` 2 e a caixa do `pts` igual à do corte girado (largura ≈ altura para um quadrado girado).
  - **Review 3:** `molParaProduto` devolve exatamente as chaves `arq, un, pecas` e cada peça só `w,h,qtd,pts` (o formato que `encaixeMol` lê hoje).
  - `normalizar({})` tem `pontos:{}`, `tracos:[]`, `pecas:[]`, `base:'M'`; `normalizar({pecas:[{id:'a'}]}).pecas[0].margem` = 10.
  - `historico`: gravar 3 estados, desfazer 2 → 1º estado; refazer → 2º.
- [ ] **Step 2:** Rodar → falha.
- [ ] **Step 3:** Implementar no mesmo envelope de `geo.js`.
- [ ] **Step 4:** Rodar → OK.
- [ ] **Step 5: Commit** `"Modelo de dados do molde"`

### Task 4: `molde.html` — casca, acesso e salvamento

**Files:**
- Create: `molde.html`

**Interfaces:**
- Consumes: `MoldeModelo.novo/normalizar/molParaProduto/historico`.
- Produces (globais da página, usados nas Tasks 5–6): `M` (molde atual), `H` (histórico), `alterou()` (grava no histórico, redesenha, agenda salvar), `desenhar()`, `salvar()`, `estado` (`'salvo'|'salvando'|'nao-salvo'`).

- [ ] **Step 1:** Página com o mesmo `<head>` de CDN do Supabase e tokens de cor (`:root` + escuro) copiados do `index.html`; carrega `molde/geo.js` e `molde/modelo.js`. Layout: barra superior (nome do molde, indicador de salvo, zoom, desfazer/refazer), barra de ferramentas à esquerda, SVG no centro, painel "Moldes" à direita.
- [ ] **Step 2:** Acesso: `sb.auth.getSession()`; sem sessão → link "Entrar" para `index.html`; perfil (`user_profiles.role`) diferente de `admin` → "Só administradores editam moldes" e nada mais.
- [ ] **Step 3:** URL `molde.html?id=<docId>` abre o molde; `?produto=<id>` cria (ou abre o que já tiver esse produto em `produtoIds`) e já liga o produto.
- [ ] **Step 3b:** Barra superior: botão "Referências" lista os produtos (`docs`, `col='produtos'`, `ref · nome`) com caixa de marcar; marcar/desmarcar altera `M.produtoIds` (um molde serve várias referências). Desmarcar remove `molId`/`mol` daquele produto ao salvar.
- [ ] **Step 4:** Salvar: 1,5 s depois da última alteração, `update` em `docs` (`col='moldes'`). **Review 4:** antes de enviar, gravar o rascunho em `localStorage['molde:'+id]` (try/catch); erro de rede/sessão → indicador "não salvo — tentando de novo" e nova tentativa a cada 10 s; `beforeunload` avisa se `estado!=='salvo'`; ao abrir, se houver rascunho local mais novo que o do banco (`salvoEm`), oferecer recuperar.
- [ ] **Step 5:** Ao salvar, para cada `produtoIds`: ler o produto, gravar `molId` e `mol = molParaProduto(M)`. Se o produto tinha `mol` sem `molId` (veio de PLT), perguntar antes na primeira ligação (Review 3).
- [ ] **Step 6: Verificar** com Playwright em `http://localhost` (servidor estático da pasta): admin abre `molde.html?produto=<id de teste>`, altera o nome, espera "salvo"; recarrega e o nome persiste. Derrubar a rede (`browser_run_code_unsafe` com `context.setOffline(true)`) → indicador "não salvo"; voltar → "salvo".
- [ ] **Step 7: Commit** `"Editor de molde: pagina, acesso e salvamento"`

### Task 5: Desenho do diagrama

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `MoldeGeo.bezier/ima/comprimento/intersecao/estender/arredondar/girar/mover/espelhar`, `alterou()`.

- [ ] **Step 1:** Tela: arrastar com botão do meio/espaço, zoom na roda centrado no cursor, grade de 1 cm, régua com escala em cm.
- [ ] **Step 2:** Ferramentas: selecionar (clique, caixa, Shift soma), ponto, reta, retângulo (vira 4 retas), círculo, curva (clique nas pontas, arrastar as alças; alça simétrica por padrão = suavização), lápis (simplificar com tolerância 1 mm), texto.
- [ ] **Step 3:** Ímã ligado por padrão (botão e tecla `M`), raio de 8 px na tela convertido para mm; ponta que gruda num ponto reaproveita o mesmo id de ponto (é isso que faz o contorno fechar).
- [ ] **Step 4:** Medida exata: durante a reta, digitar abre caixinha "comprimento cm; ângulo°" (`11,5;90`); Enter fixa.
- [ ] **Step 5:** Edição: mover, apagar (Delete), cortar no cruzamento, estender, arredondar canto (pede raio), girar (pede graus), espelhar (pelo traço selecionado), medir (soma do comprimento dos traços selecionados, em cm com 1 casa).
- [ ] **Step 6:** Desfazer `Ctrl+Z` / refazer `Ctrl+Y` pelo `H`.
- [ ] **Step 7: Verificar** com Playwright: desenhar retângulo 30×50 cm digitando medidas; medir mostra "160,0 cm"; arredondar um canto; desfazer volta ao canto reto; recarregar mantém o desenho.
- [ ] **Step 8: Commit** `"Ferramentas de desenho do diagrama"`

### Task 6: Peças — extrair e propriedades

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `MoldeModelo.encadear/costura/corte`, `MoldeGeo.pontoEm`.

- [ ] **Step 1:** "Extrair molde": usa os traços selecionados; `encadear` falhou → mensagem com o erro e marca a `ponta` solta em vermelho; ok → peça nova "PEÇA n", cortar 1, margem 1 cm, fio vertical no centro.
- [ ] **Step 2:** Painel Moldes: miniatura (SVG da `costura`), nome, ver/ocultar, travar, duplicar, apagar (confirma), renomear com duplo clique.
- [ ] **Step 3:** Propriedades da peça selecionada: nome, cortar N, "em par", margem padrão (cm), margem do traço clicado (bainha), dobra (escolher traço reto do contorno), fio (arrastar as duas pontas), piques (clique no contorno grava `{tracoId,t}`), pence (clique no contorno + abertura e profundidade em cm).
- [ ] **Step 4:** Desenho da peça: costura contínua, corte tracejado, fio com seta, piques como traço de 5 mm para dentro a partir do corte, texto "NOME · cortar N (par)" e o tamanho base no centro.
- [ ] **Step 5:** Alterar o diagrama atualiza as peças que usam os traços (são recalculadas no `desenhar()`); traço apagado que uma peça usa → pedir confirmação e marcar a peça como "contorno quebrado".
- [ ] **Step 6: Verificar** com Playwright: diagrama de frente de short (retângulo + curva do gancho), extrair, margem 1 cm e bainha 3 cm, dobra desligada, 2 piques, "cortar 1 par"; abrir o produto ligado no `index.html` e conferir que o Plano de enfesto calcula metros com o molde (o `encaixeRisco` lê `p.mol`).
- [ ] **Step 7: Commit** `"Extrair pecas e propriedades do molde"`

### Task 7: Ligação no `index.html`

**Files:**
- Modify: `index.html` (formulário do produto, ~linhas 776–800)

**Interfaces:**
- Consumes: URL `molde.html?produto=<id>` e `molde.html?id=<molId>` (Task 4); campos `p.molId`, `p.mol.arq`.

- [ ] **Step 1:** No formulário do produto (só admin, produto já salvo): botão "Desenhar molde" → abre `molde.html?id=<p.molId>` se houver, senão `molde.html?produto=<p.id>`, em nova aba.
- [ ] **Step 2:** Se `p.molId`: o texto do bloco PLT diz "Molde desenhado no editor: <arq>" e importar PLT pede confirmação, avisando que desliga o produto do molde (apaga `molId`).
- [ ] **Step 3:** `node .claude/scripts/selfcheck.js` → 45 OK; `node .claude/scripts/selfcheck-molde.js` → OK.
- [ ] **Step 4: Verificar** com Playwright: produto antigo com PLT (sem `molId`) abre e mostra como antes; produto ligado mostra o aviso e o botão abre o molde certo.
- [ ] **Step 5: Commit** `"Produto abre o editor de molde"` e `git push` só se o dono pedir.
