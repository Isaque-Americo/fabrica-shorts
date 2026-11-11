# CAD de molde — Etapa 2 (tamanhos e peça) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O molde ganha grade de tamanhos e gradação por ponto (com tamanhos em cores, fantasma, separar e remover gradação), tabela de medidas para conferir, ferramenta Bainha, propriedades novas da peça (rotação, espelhar, tubular, tecido) e diálogo de novo molde (grade, base, foto); o Plano de enfesto passa a encaixar a peça do tamanho certo.

**Architecture:** Toda a regra nova é pura em `molde/modelo.js` (testada em Node). `molde.html` só ganha interface. O produto recebe `p.mol.porTam` (peças por tamanho) além de `p.mol.pecas` (tamanho base, para leitores antigos). O `index.html` troca `encaixeRisco` para usar as peças de cada tamanho do risco e respeitar a rotação de cada peça.

**Tech Stack:** HTML/JS puro sem build, SVG, Supabase JS 2.45.4 (CDN, já carregado), Node para self-check.

**Spec:** `docs/superpowers/specs/2026-11-11-cad-molde-enfesto-design.md` (seções "Etapa 2" e "Adições pedidas pelo dono", itens 1–4)

## Global Constraints

- Sem build; nenhuma biblioteca nova.
- Armazenamento em **mm**; tela em **cm**, aceitando vírgula decimal.
- Só admin edita moldes (RLS `docs_admin_all`); nada muda no banco.
- `p.mol` mantém `{arq, un:'mm', pecas:[{w,h,qtd,pts}]}` com `pts` inteiros `[x,y]`, fio no eixo **X**. Campos novos só somam: `p.mol.porTam = {<tam>: [peça…]}` e, em cada peça, `rot` (`'nenhuma'|'180'|'livre'`) e `tecido` (`''` = principal, ou id da matéria-prima). `p.mol.pecas` = tamanho base.
- Ruling desta etapa: `porTam` fica **no produto** (não só no doc `moldes`) — o catálogo do lojista copia só `ref, nome, preco, precoG` (`private.sync_catalog_from_docs`), então não vaza; e o `index.html` já lê `p.mol`. Isso substitui o call "polígonos só no doc moldes" do spec.
- Molde vazio/quebrado nunca sobrescreve `mol` existente (regra da etapa 1, `temPecas`).
- Doc antigo sem os campos novos abre igual (padrões em `normalizar`).
- Textos de dados no HTML/SVG passam por `esc`/`textContent`; números coeridos.
- Grades: `GRADES = { app: ['P','M','G','GG','G1','G2','G3','G4'], numerica: ['36','38','40','42','44','46','48','50','52','54','56'] }`; `M.grade = []` = "definir depois" (só o tamanho base existe).

## Review Focus

1. **Doc da etapa 1 (sem `grade`/`grad`)**: abre, salva e gera `p.mol` idêntico ao de antes (porTam com só o base). → Task 1.
2. **Curva graduada**: as alças (`c1`,`c2`) acompanham as pontas; a curva do gancho não entorta. → Task 1.
3. **Separar tamanhos**: cada peça separada tem exatamente a forma do tamanho graduado, e o molde fica sem gradação. → Task 1.
4. **Enfesto com risco P+M+G**: usa a peça de cada tamanho, não 3× o base; produto antigo só com `pecas` continua igual. → Task 6.
5. **Rotação `'nenhuma'`**: o encaixe nunca gira a peça; `'livre'` pode usar 90°. → Task 6.

---

## Formato novo no doc `moldes` (decidido aqui)

```js
{
  ...etapa1,
  grade: ['P','M','G','GG','G1','G2','G3','G4'],   // [] = definir depois
  base: 'M',                                        // ∈ grade (ou qualquer, se grade vazia)
  grad: { [pontoId]: { [tam]: { dx, dy } } },        // deslocamento em mm relativo ao base; base sempre 0
  medidas: [{ id, nome, tracos: [tracoId], valores: { [tam]: mm } }],
  foto: '',                                          // caminho no storage 'produtos' (ou dataURL só no modo local)
  pecas: [{ ...etapa1,
    rotacao: '180',          // 'nenhuma' | '180' | 'livre'
    espelhar: false, tubular: false, tecido: '',     // '' = tecido principal do produto
    bainhas: { [tracoId]: { largura, dobras, piques } } // mm; margemTraco[tracoId] = largura*dobras
  }]
}
```

---

### Task 1: Regras de tamanho no `molde/modelo.js`

**Files:**
- Modify: `molde/modelo.js`
- Modify: `.claude/scripts/selfcheck-molde.js`

**Interfaces:**
- Produces (em `MoldeModelo`):
  - `GRADES` (constante acima).
  - `normalizar` passa a preencher `grade` (padrão `[]`), `grad` `{}`, `medidas` `[]`, `foto` `''`, e nas peças `rotacao:'180'`, `espelhar:false`, `tubular:false`, `tecido:''`, `bainhas:{}`.
  - `tamanhos(m) -> string[]` — `m.grade` se não vazia, senão `[m.base]`.
  - `noTamanho(m, tam) -> Molde` — cópia com cada ponto deslocado por `grad[id][tam]` (ausente = 0); em curvas, `c1` desloca como o ponto `a` e `c2` como o ponto `b`; círculos deslocam o centro.
  - `graduarPasso(m, pontoId, dx, dy, opts={salto:null}) -> void` — preenche `grad[pontoId][tam]` = (índice(tam) − índice(base)) × (dx,dy); com `opts.salto={dx,dy,de:'G1'}`, a partir de `de` soma o salto por passo em vez de (dx,dy).
  - `copiarRegra(m, de, para:string[])`, `removerGradacao(m)` (zera `grad`).
  - `separarTamanhos(m, espaco=50) -> void` — para cada tamanho ≠ base e cada peça visível: duplica os pontos/traços do contorno já deslocados (`noTamanho`), afastados `espaco` mm à direita do bbox do molde por tamanho, cria peça "NOME · TAM" com as mesmas propriedades; depois `removerGradacao`. As peças originais ficam como o base.
  - `medir(m, tracoIds, tam) -> mm` — soma do comprimento dos traços em `noTamanho(m,tam)`.
  - `aplicarBainha(peca, tracoId, {largura, dobras, piques}) -> void` — grava `bainhas[tracoId]` e `margemTraco[tracoId] = largura*dobras`; `largura<=0` remove a bainha e a exceção de margem.
  - `molParaProduto(m)` passa a devolver também `porTam: {tam: pecas}` (uma lista por `tamanhos(m)`, cada uma montada de `noTamanho`), e cada peça ganha `rot` (= `rotacao`) e `tecido`. `pecas` = `porTam[base]`. Sem nenhuma peça válida em nenhum tamanho → `pecas: []` (regra `temPecas` continua).

- [ ] **Step 1: Testes** (estilo `[nome, obtido, esperado]`, tolerância 0,5):
  - **Review 1:** doc da etapa 1 (o mesmo usado nos testes de `molParaProduto` da etapa 1) → `molParaProduto` tem `pecas` igual ao de antes e `Object.keys(porTam)` = `['M']`.
  - `graduarPasso(m,'p1',5,0)` com grade app e base M → `grad.p1.P.dx=-5`, `G.dx=5`, `G4.dx=35`; com `salto:{dx:10,dy:0,de:'G1'}` → `GG.dx=10`, `G1.dx=20`, `G4.dx=50`.
  - **Review 2:** curva a→b com `grad` só em `b` (+20,0) no G → em `noTamanho(m,'G')` `c2` deslocou 20 e `c1` não.
  - Retângulo 100×200 com os dois pontos da direita graduados +10 por passo → `costura` no GG tem largura 120 e no base 100; `porTam.GG[0].w` − `porTam.M[0].w` = 20 (±1).
  - **Review 3:** `separarTamanhos` com grade P,M,G e 1 peça → 3 peças; área da "· G" = área da costura do G antes de separar; `grad` vazio depois.
  - `medir` do lado de cima do retângulo (100 mm) no base = 100; no GG (pontos da direita +10 por passo) = 120.
  - `aplicarBainha(peca,'t3',{largura:15,dobras:2,piques:true})` → `margemTraco.t3=30`; `largura:0` remove.
  - `molParaProduto` com peça `rotacao:'nenhuma', tecido:'mat9'` → cada peça de `porTam` tem `rot:'nenhuma', tecido:'mat9'`.
- [ ] **Step 2:** `node .claude/scripts/selfcheck-molde.js` → falha.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar os dois self-checks → OK.
- [ ] **Step 5: Commit** `"Molde: grade, gradacao e bainha no modelo"`

### Task 2: Novo molde, grade e tamanho exibido (`molde.html`)

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `GRADES`, `tamanhos`, `noTamanho`.
- Produces: global `tamVer` (tamanho exibido, padrão `M.base`) e `fantasma` (bool), usados nas Tasks 3–5.

- [ ] **Step 1:** Ao criar molde (qualquer caminho que hoje cria um molde novo), diálogo "Novo molde": nome, grade (`P–G4 do app` | `36–56` | `Definir depois`), tamanho base (lista da grade; padrão M ou 40), foto da ficha técnica (opcional). Doc antigo sem grade abre sem diálogo.
- [ ] **Step 2:** Foto: no modo Supabase, enviar para o bucket `produtos` como faz `subirFoto` do `index.html` (JPEG ≤1200 px, nome `crypto.randomUUID()+'.jpg'`), gravar o caminho em `M.foto` e mostrar miniatura clicável na barra superior; no modo local, guardar dataURL reduzida. Trocar a foto remove a antiga do storage. Botão "Grade e foto" reabre o diálogo depois (mudar a grade mantém `grad` dos tamanhos que continuam).
- [ ] **Step 3:** Barra superior: seletor do tamanho exibido (chips com a cor de cada tamanho, base marcado) e botão "Fantasma" (mostra os outros tamanhos por baixo, só contorno, cor de cada um, 35% de opacidade). Diagrama e peças desenham `noTamanho(M,tamVer)`; edição de geometria só no tamanho base (fora dele, as ferramentas de desenho ficam desabilitadas com aviso "Edite no tamanho base").
- [ ] **Step 4:** Cores fixas por posição na grade (8 cores distintas que funcionem no claro e no escuro, definidas como tokens CSS).
- [ ] **Step 5: Verificar** em modo local (Playwright): criar molde com grade P–G4 e base M, foto local; trocar tamanho exibido; fantasma liga/desliga; recarregar mantém grade, base e foto.
- [ ] **Step 6: Commit** `"Molde: novo molde com grade, base e foto"`

### Task 3: Painel de gradação

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `graduarPasso`, `copiarRegra`, `removerGradacao`, `separarTamanhos`, `tamVer`, `fantasma`.

- [ ] **Step 1:** Ferramenta "Graduar ponto" (tecla `R`): clicar num ponto do diagrama abre o painel Gradação à direita com uma linha por tamanho (cor, nome, X cm, Y cm), editável; o base fica fixo em 0.
- [ ] **Step 2:** Campos "Passo X / Y" + "Salto a partir de G1" (opcional) e botão "Aplicar passo" (`graduarPasso`); "Copiar regra para…" aplica a regra do ponto atual aos pontos selecionados.
- [ ] **Step 3:** Pontos com regra ganham marcador; com o fantasma ligado, vetor do base até o maior tamanho.
- [ ] **Step 4:** Botões "Separar todos os tamanhos" e "Remover gradação", ambos com confirmação e um passo de desfazer.
- [ ] **Step 5: Verificar** em modo local: frente de short (retângulo + curva do gancho), graduar os 2 pontos da lateral com passo 1 cm; fantasma mostra os 8 contornos; separar → 8 peças nomeadas "· P" … "· G4"; desfazer volta.
- [ ] **Step 6: Commit** `"Molde: painel de gradacao"`

### Task 4: Tabela de medidas

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `medir`, `M.medidas`, `tamanhos`.

- [ ] **Step 1:** Painel "Medidas" (aba ao lado de Moldes/Gradação): tabela com uma linha por medida (nome editável) e uma coluna por tamanho (valor esperado em cm).
- [ ] **Step 2:** "Ligar aos traços selecionados" grava `tracos` da medida; cada célula mostra embaixo o valor medido no molde (`medir`), em verde se a diferença ≤ 0,3 cm, em vermelho acima disso.
- [ ] **Step 3:** Adicionar/remover medida; tudo entra no histórico e no salvamento.
- [ ] **Step 4: Verificar** em modo local: medida "Cintura" ligada à reta de cima, valores esperados por tamanho; mudar a gradação muda o medido.
- [ ] **Step 5: Commit** `"Molde: tabela de medidas"`

### Task 5: Bainha e propriedades novas da peça

**Files:**
- Modify: `molde.html`

**Interfaces:**
- Consumes: `aplicarBainha`; lista de tecidos: no Supabase `docs` `col='materiais'` com `data.tipo==='tecido'` (admin); no modo local, 2 tecidos de exemplo.

- [ ] **Step 1:** Ferramenta "Bainha": clicar num traço do contorno da peça selecionada abre caixa (largura cm, dobras, piques nas dobras); aplica com `aplicarBainha`. Desenho: linhas tracejadas paralelas à barra a cada `largura` e, com piques, marca de 5 mm nas duas pontas de cada dobra.
- [ ] **Step 2:** Propriedades da peça: "Rotação permitida" (Nenhuma / 180° / Livre), "Permitir espelhar", "Dobra no tecido tubular", "Tecido" (Principal do produto + tecidos da matéria-prima por nome; guarda o id).
- [ ] **Step 3:** Texto da peça mostra o tecido quando não é o principal ("FORRO" etc.).
- [ ] **Step 4: Verificar** em modo local: bainha 1,5 cm × 2 dobras com piques na barra → corte desce 3 cm; rotação "Nenhuma" e tecido "Forro" aparecem no `mol` do produto de exemplo (`porTam` e `rot/tecido`).
- [ ] **Step 5: Commit** `"Molde: bainha e propriedades da peca"`

### Task 6: Enfesto por tamanho no `index.html`

**Files:**
- Modify: `index.html` (`rasterPol`/`encaixeMol`/`encaixeRisco`, ~1454–1521; chamada em ~1545; self-check IS_DEV)

**Interfaces:**
- Consumes: `p.mol.porTam`, `peça.rot`, `peça.tecido`.
- Produces: `pecasDoRisco(p, tams) -> peça[]` (puro) e `encaixeRisco(p, larg, tams, perda)` (troca `copias` por `tams`).

- [ ] **Step 1: Testes** no bloco IS_DEV:
  - **Review 4:** produto com `porTam` {P:[A], M:[B], G:[C]} → `pecasDoRisco(p,['P','M','G'])` = [A,B,C]; produto antigo só com `pecas:[X]` → `pecasDoRisco(p,['P','M'])` = [X,X].
  - Peça com `tecido:'mat9'` fica fora de `pecasDoRisco` (o risco é do tecido principal).
  - **Review 5:** `rasterPol` variantes por `rot`: `'nenhuma'` → 1 variante; `'180'` (ou ausente) → 2; `'livre'` → 4 (0/90/180/270).
- [ ] **Step 2:** Rodar `node .claude/scripts/selfcheck.js` → falha.
- [ ] **Step 3:** Implementar: `encaixeMol` recebe a lista já expandida (cada item com `qtd`) e as variantes por peça; `encaixeRisco` usa `pecasDoRisco`; cache por `p.id|tams|larg`. Chamada do plano passa `x.tams`.
- [ ] **Step 4:** `node .claude/scripts/selfcheck.js` e `selfcheck-molde.js` → OK.
- [ ] **Step 5: Commit** `"Enfesto usa a peca de cada tamanho e a rotacao permitida"`
