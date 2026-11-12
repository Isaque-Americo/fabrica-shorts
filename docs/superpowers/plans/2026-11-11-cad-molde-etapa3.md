# CAD de molde — Etapa 3 (ordem de corte e risco) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ordem de corte com abas de tecido e de enfesto, grade por tamanho e camada (preenchida pelos pedidos), risco desenhado com cores por tamanho e ajuste manual, painel de resultados (aproveitamento, pesos, custo, consumo, grade) e impressões (minimapa A4, relatório, encaixe 1:1 em PDF/PLT/DXF/A4 emendável); tecido ganha tipo, sentido único e encolhimento; ficha técnica ganha processos opcionais.

**Architecture:** O encaixe sai do `index.html` para `molde/encaixe.js` (puro, agora devolvendo posições), usado pelo `index.html` e pela página nova `corte.html`. A regra da ordem fica em `molde/ordem.js` e as exportações em `molde/exporta.js`, ambos puros e testados em Node. `corte.html` é a interface (padrão do `molde.html`: acesso só admin, modo `?local=1`, armazenamento atrás de `B`).

**Tech Stack:** HTML/JS sem build, SVG, Supabase JS 2.45.4, jsPDF 2.5.1 (`https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`) só no `enfesto.html`, Node para self-check.

**Spec:** `docs/superpowers/specs/2026-11-11-cad-molde-enfesto-design.md` (seção "Etapa 3", itens 5–10, e "Compatibilidade")

## Global Constraints

- Sem build. Única biblioteca nova: jsPDF 2.5.1 pelo CDN acima, só em `enfesto.html`.
- mm internamente; cm/m na tela com vírgula decimal.
- No encaixe: X = comprimento do risco, Y = largura do tecido; fio ao longo de X. Resolução da grade de encaixe 20 mm (`ENC_RES`) como hoje.
- Só admin: `docs_admin_all` cobre `col='ordens'`; nada muda no banco. `corte.html` bloqueia não-admin como o `molde.html`.
- Produtos antigos (só `p.mol.pecas`, sem `rot`) continuam com o mesmo resultado no Plano de enfesto do `index.html`.
- Tecido da ordem = matéria-prima (`col='materiais'`, `tipo:'tecido'`): `larg` (m), `gram` (g/m²), `forn`, preço por `matCusto` (R$/m). Campos novos no tecido: `tubular` (bool), `sentidoUnico` (bool), `encolhC`, `encolhL` (% comprimento e largura).
- Pedidos: a grade "falta fabricar" vem de `fabricarLista()` do `index.html` (itens `{id, ref, nome, c, t, f}`), passada para `corte.html` pela URL/`sessionStorage` (ver Task 8).
- Ajuste manual do risco não é salvo (call do spec).
- Escapar textos de dados (`esc`/`textContent`); números coeridos.

## Rulings deste plano (substituem detalhes do spec)

- **Três páginas separadas (pedido do dono em 2026-11-12):** `molde.html` (já existe), `corte.html` (ordens de corte: lista, propriedades, abas de tecido/enfesto, grade, resultados e relatório) e `enfesto.html` (o risco de um enfesto: desenho, painel do enfesto, ajuste manual, minimapa e exportação do encaixe). `corte.html` abre `enfesto.html?ordem=<id>&enf=<id>`. O `index.html` ganha a aba-link "Ordens de corte" e o botão "Criar ordem de corte" na aba Fabricar.
- **Plano de enfesto da aba Fabricar continua como está** (estimativa rápida com mesa/camadas do navegador); o botão "Criar ordem de corte" leva a mesa e as camadas dali como valores iniciais do enfesto.
- **Tubular:** cada camada tem dois panos → cada peça encaixada rende 2 (qtd por camada da grade é dividida por 2, arredondando para cima). Peça com "dobra no tecido tubular" é encaixada como meia peça (a metade do lado da dobra) encostada na borda Y=0.
- **Sentido do enfesto:** `duplo` (camadas face a face) → peça em par rende 2 por posição; `unico` → par vira duas posições (normal + espelhada se `espelhar`, senão duas normais). Tecido `sentidoUnico` força rotação `'nenhuma'`.
- **Encolhimento:** escala X por (1 + encolhC/100) e Y por (1 + encolhL/100) antes de encaixar e imprimir.
- **Largura útil** = `larg·1000 − ourelaE − ourelaD` (mm); comprimento do risco = encaixe + `cabeceira` (mm) por enfesto.

## Review Focus

1. **Escala 1:1**: um quadrado de 100 mm sai com 100 mm no PDF (unidade mm), 4000 unidades no PLT (40/mm) e 100 no DXF; o A4 emendável traz quadrado de calibração de 100 mm. → Task 4.
2. **Produto antigo no Plano de enfesto**: mesmo comprimento de antes depois da extração para `encaixe.js`. → Task 1.
3. **Grade dos pedidos**: a ordem criada pela aba Fabricar tem exatamente o "falta fabricar" por referência/cor/tamanho; +/− não deixa número negativo. → Task 3.
4. **Pesos e custo**: com gramatura 160 g/m², largura 1,60 m e risco de 2,00 m × 10 camadas → tecido 5,12 kg; custo = metros × `matCusto`. → Task 3.
5. **Tecido tubular e sentido único** mudam a contagem de peças como nos rulings, sem peça a mais nem a menos no total da grade. → Task 3.

---

## Formato do doc `ordens` (decidido aqui)

```js
{
  nome, obs, criadaEm,                         // ISO
  pedidos: ['<id>', ...],                       // origem (opcional)
  tecidos: [{ id, materiaId }],                 // abas de tecido; [0] = principal
  enfestos: [{
    id, nome, tecidoId,                         // tecidoId = id de uma aba de `tecidos`
    camadas: 1, alturaMax: 0, compMax: 0,       // alturaMax em camadas; compMax mm (0 = sem limite)
    cabeceira: 0, ourelaE: 0, ourelaD: 0,       // mm
    sentido: 'duplo',                           // 'duplo' | 'unico'
    itens: [{ produtoId, cor, pecas: [nomes] | null,  // null = todas as peças daquele tecido
              grade: { [tam]: qtdPorCamada } }]
  }],
  v: 1
}
```

---

### Task 1: `molde/encaixe.js` (extração + posições)

**Files:** Create `molde/encaixe.js`; Modify `index.html` (remover `ENC_RES`, `rasterPol`, `rasterRot`, `encaixaBLF`, `encaixeMol`, `pecasDoRisco`, carregar o script, manter `encaixeRisco` usando `MoldeEncaixe`); Modify `.claude/scripts/selfcheck.js` (carregar também `<script src="molde/…">` locais antes dos inline); Modify `.claude/scripts/selfcheck-molde.js`.

**Interfaces — Produces (`MoldeEncaixe`):**
- `ENC_RES = 20`
- `variantes(pts, {rot, espelhar, escala:{x,y}}) -> Raster[]` (rot como hoje; `espelhar` acrescenta as variantes espelhadas em Y; escala antes de rasterizar).
- `encaixar(itens, largMm, opts={borda0:false}) -> {comp, posicoes:[{i, ox, oy, var}]}` — `itens` = lista expandida (uma entrada por peça a colocar, `{pecaIdx, rasters, borda0}`); `borda0` obriga `oy=0`; `comp` em mm = células × `ENC_RES`.
- `pecasDoRisco(p, tams)` (mesma regra de hoje, movida).
- `encaixeMol(pecas, largMm) -> mm|null` (compatível: `encaixar(...).comp`).

- [ ] Step 1: Testes em `selfcheck-molde.js`: **Review 2** — os mesmos 3 produtos antigos (triângulo, L, quadrado; 1, 2, 3, 5 tamanhos; 1,0 e 1,6 m) dão o mesmo comprimento que `index.html` em `9f5b2e0` (copiar os números obtidos antes de mover); `posicoes` não se sobrepõem (célula ocupada uma vez) e ficam dentro da largura; `borda0` → `oy===0`; `espelhar` dobra o número de variantes; escala 1,1×1 → comprimento maior ou igual.
- [ ] Step 2: rodar → falha. Step 3: implementar e ligar no `index.html` (`<script src="molde/encaixe.js">` antes do script inline). Step 4: `selfcheck.js` (58+) e `selfcheck-molde.js` → OK.
- [ ] Step 5: Commit `"Encaixe em molde/encaixe.js com posicoes"`

### Task 2: Tecido e ficha técnica no `index.html`

**Files:** Modify `index.html` (form de matéria-prima ~960–985; `custoFicha` ~932; editor de ficha própria/padrão).

**Interfaces — Produces:** campos `tubular`, `sentidoUnico`, `encolhC`, `encolhL` no tecido; `ficha.processos = [{nome, min, custoMin}]`; `custoFicha(...).mo` = `ficha.mo + Σ min×custoMin`.

- [ ] Step 1: Testes IS_DEV: ficha sem `processos` dá o mesmo `mo` de hoje (as 45 asserções de custo continuam); ficha com processos `[{min:2,custoMin:0.5},{min:3,custoMin:0.4}]` e `mo:1` → `mo` 3,2.
- [ ] Step 2–4: rodar/implementar/rodar. Form do tecido: "Tecido tubular", "Sentido único (pelo, estampa)", "Encolhimento comprimento %", "largura %". Ficha: lista "Processos (opcional)" com nome, minutos, R$/min e total, somada à mão de obra; texto deixa claro que é opcional.
- [ ] Step 5: Commit `"Tecido com tipo, sentido e encolhimento; processos na ficha"`

### Task 3: `molde/ordem.js` (regra da ordem)

**Files:** Create `molde/ordem.js`; Modify `.claude/scripts/selfcheck-molde.js`.

**Interfaces — Consumes:** `MoldeEncaixe`. **Produces (`MoldeOrdem`):**
- `normalizar(doc)`, `nova(nome)`.
- `deFabricar(lista, opts={camadas, compMax}) -> Ordem` — agrupa `{id,ref,nome,c,t,f}` por produto e cor; um enfesto por tecido principal do produto; grade por camada = `f` com `camadas` = 1 (o usuário ajusta).
- `ajustarGrade(item, tam, delta)` — nunca abaixo de 0.
- `pecasEnfesto(enf, ordem, produtos, tecidos) -> itens` para `encaixar` — aplica tecido da aba (peças cujo `tecido` bate: `''` = principal do produto), seleção de peças, grade × `qtd` da peça, tubular, sentido, sentido único, encolhimento, espelhar (rulings acima).
- `calcularEnfesto(enf, ...) -> {comp, largUtil, posicoes, itens, pecasTotal, areaPecas, aproveitamento}` (comp inclui cabeceira; aproveitamento = áreaPeças / (comp × largUtil)).
- `resultados(ordem, calculos, tecidos) -> {metros, pesoTecido, pesoPecas, pesoDesperdicio, consumoLinear, custo, pecas, grade:{[ref]:{[tam]:n}}}` — pesos em kg pela gramatura; custo = metros × `matCusto`.

- [ ] Step 1: Testes: **Review 3** (lista de 3 itens → grade igual ao `f`; `ajustarGrade` −5 em 2 → 0); **Review 4** (risco 2000 mm, largura 1,60, 160 g/m², 10 camadas → `pesoTecido` 5,12; custo com `matCusto` 12 → 240); **Review 5** (peça qtd 1, grade 4 por camada: aberto/duplo → 4 posições; tubular → 2 posições, 4 peças; par em `unico` com `espelhar` → posições normais e espelhadas em igual número); tecido `sentidoUnico` → todas as variantes com rot 0; encolhimento 10% C → comp ≥ 1,1× sem encolhimento (±1 célula).
- [ ] Step 2–4. Step 5: Commit `"Regra da ordem de corte"`

### Task 4: `molde/exporta.js` (saídas 1:1)

**Files:** Create `molde/exporta.js`; Modify `.claude/scripts/selfcheck-molde.js`.

**Interfaces — Produces (`MoldeExporta`):**
- `formas(calc, produtos, opts) -> [{pts, texto, fio, costura, cor}]` — polígonos do risco já posicionados (mm), com camadas opcionais conforme `opts` (`nome, textos, margem, fio, bordas, limites, cabecalho`).
- `plt(formas, larg, comp) -> string` (HP-GL: `IN;SP1;` PU/PD, 40 unidades/mm, Y invertido para o plotter).
- `dxf(formas) -> string` (R12, POLYLINE fechada por forma, unidades mm, TEXT opcional).
- `paginasA4(comp, larg, margem=10) -> [{x, y, w, h, linha, coluna}]` (área útil 190×277 mm com sobreposição 10 mm para colar).
- `pdfPlano(formas, larg, comp, opts) -> instruções` — lista de comandos neutros (`linha`, `texto`, `retangulo`) em mm que a página entrega ao jsPDF (assim o Node testa sem jsPDF).

- [ ] Step 1: Testes: **Review 1** — quadrado 100 mm → no `plt` a diferença entre PD extremos é 4000; no `dxf` os vértices vão de 0 a 100; `paginasA4(600, 1600)` cobre toda a área, sobreposição 10 mm; `pdfPlano` contém o quadrado de calibração de 100 mm quando `opts.calibracao`.
- [ ] Step 2–4. Step 5: Commit `"Exportacao do risco em PLT, DXF, PDF e A4"`

### Task 5: `corte.html` — ordens e edição

**Files:** Create `corte.html`; Modify `.github/workflows/pages.yml` (copiar `corte.html`).

**Interfaces — Consumes:** `MoldeOrdem`, `MoldeEncaixe`, Supabase/`B` no padrão do `molde.html` (copiar as funções de sessão/admin/`B`, `?local=1` só em localhost com produtos, tecidos e uma ordem de exemplo).

- [ ] Step 1: Lista de ordens (nome, data, metros) + "Nova ordem"; `?id=` abre; `?deFabricar=1` lê a lista do `sessionStorage['ordemNova']` e cria com `deFabricar`.
- [ ] Step 2: Diálogo "Propriedades da ordem": nome, observação; por aba de tecido: matéria-prima (mostra largura, fornecedor, gramatura, preço, tipo); por enfesto: camadas, altura máxima, comprimento máximo, cabeceira, ourelas, sentido.
- [ ] Step 3: Abas de tecido e de enfesto (+ nova, renomear, apagar com confirmação).
- [ ] Step 4: Por item do enfesto: referência e cor, botões +/− por tamanho da grade (total = por camada × camadas), escolha das peças que entram.
- [ ] Step 5: Salvamento automático com rascunho local e nova tentativa (mesmo padrão do `molde.html`).
- [ ] Step 6: Verificar em modo local (Playwright): nova ordem, 2 abas de tecido, 2 enfestos, ajustar grade, recarregar mantém.
- [ ] Step 7: Commit `"Pagina de ordens de corte"`

### Task 6: `enfesto.html` — risco e ajuste; resultados no `corte.html`

**Files:** Create `enfesto.html` (mesmo padrão de acesso/`B`/modo local do `corte.html`; lê a ordem e calcula o enfesto `enf`); Modify `corte.html` (botão "Abrir enfesto" por enfesto e o painel de resultados); Modify `.github/workflows/pages.yml` (copiar `enfesto.html`).

- [ ] Step 1 (`enfesto.html`): Desenho do risco do enfesto (SVG, régua em cm): peças por cor de tamanho (mesmos tokens `--t0..--t7` do editor), nome/tamanho no centro, limites da largura útil, ourelas e cabeceira.
- [ ] Step 2 (`enfesto.html`): Painel do enfesto: aproveitamento %, comprimento, total de tecido (comp × camadas), camadas, aviso se passar do comprimento máximo da mesa.
- [ ] Step 3 (`enfesto.html`): Ajuste manual: arrastar peça (encaixe na grade de 20 mm, sem sobrepor), girar entre variantes permitidas; comprimento e aproveitamento recalculam; botão "Refazer encaixe automático"; nada é salvo.
- [ ] Step 4 (`corte.html`): Painel de resultados da ordem (`resultados`): pesos, consumo linear, custo, total de peças, grade total por referência e tamanho.
- [ ] Step 5: Verificar em modo local; Commit `"Risco, ajuste manual e resultados da ordem"`

### Task 7: Impressões (`enfesto.html` e `corte.html`)

**Files:** Modify `enfesto.html` (minimapa e exportação do encaixe); Modify `corte.html` (relatório).

- [ ] Step 1 (`enfesto.html`): "Imprimir minimapa": risco reduzido numa A4 deitada com cabeçalho (ordem, enfesto, tecido, metros, camadas) via CSS de impressão.
- [ ] Step 2 (`corte.html`): "Imprimir relatório": resultados + grades em A4.
- [ ] Step 3 (`enfesto.html`): "Exportar encaixe": diálogo com formato (PDF na largura do tecido, PLT, DXF, A4 emendável), liga/desliga (nome do molde, textos, margem de costura, fio, bordas, limites do enfesto, cabeçalho), tamanho do papel e margens (A4); PDF via jsPDF a partir de `pdfPlano`; arquivos baixados com nome `ordem-enfesto.ext`.
- [ ] Step 4: Verificar em modo local: baixar PLT e DXF e conferir a escala com o quadrado de calibração (ler o arquivo baixado); PDF A4 tem N páginas numeradas.
- [ ] Step 5: Commit `"Impressoes da ordem de corte"`

### Task 8: Ligações no `index.html`

**Files:** Modify `index.html`.

- [ ] Step 1: Menu do admin ganha "Ordens de corte" (abre `corte.html`).
- [ ] Step 2: Aba Fabricar: botão "Criar ordem de corte" grava `fabricarLista()` e `{camadas: enfCam, compMax: enfMesa}` em `sessionStorage['ordemNova']` e abre `corte.html?deFabricar=1`.
- [ ] Step 3: Formulário do produto com molde do editor (`p.mol.porTam`): botão "Calcular consumo pelo molde" (risco P,M,G,GG uma de cada ÷ 4 → `cons`; G1–G4 → `consG`; usa `MoldeEncaixe` e o tecido do produto com encolhimento), como sugestão no padrão "Usar este consumo".
- [ ] Step 4: self-checks OK; Commit `"Ordens de corte ligadas ao app"`
