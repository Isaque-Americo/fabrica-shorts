# CAD de molde e risco de enfesto — design

Data: 2026-11-11 · Status: rascunho para aprovação

## Por que

Hoje o molde do short e o risco do enfesto são feitos à mão, no papel, tamanho por tamanho. O dono quer:

1. desenhar o molde no app, como num CAD (pontos, retas, curvas);
2. desenhar um tamanho só e gerar os outros;
3. ligar o molde à referência (produto) e ao pedido, para saber qual será o enfesto de cada pedido;
4. imprimir o risco em tamanho real (1:1) para colocar sobre o tecido e cortar.

Ele ainda não tem plotter, mas quer a impressão funcionando desde já (levar o arquivo a uma gráfica com plotter, ou emendar folhas A4).

Referência visual e funcional: o Estúdio de Modelagem do molde.me (print em `C:\Users\Isaque\Desktop\Short\exemplo molde.jpg`). Segue o fluxo e o leque de funções, com visual próprio do app. Não copiar marca, ícones nem layout pixel a pixel.

## O que já existe e deve ser reaproveitado

- `index.html` (SPA, Supabase, tabela genérica `docs` com `col` + `data` JSON).
- Produto guarda molde importado de PLT em `p.mol = {arq, un:'mm', pecas:[{w,h,qtd,pts}]}` (`index.html` ~linha 795). `pts` em mm, relativos ao canto da caixa.
- `parsePlt`, `moldesDePlt`, `areaPol`, `bboxPol` (~linha 843–866).
- Encaixe real por preenchimento inferior-esquerdo em grade de 2 cm: `encaixaBLF`, `encaixeMol`, `encaixeRisco` (~linha 1450–1512). Hoje só devolve o comprimento do risco, sem desenho, e usa as mesmas peças para todos os tamanhos (sem gradação).
- Plano de enfesto por pedido (`planoEnfesto`, aba Fabricar, vista "Plano de enfesto"), com mesa e camadas.
- Ficha técnica e custo por consumo (`custoFicha`, `consDe`).
- Self-check em `.claude/scripts/selfcheck.js` (45 asserções de custo/margem/enfesto).

## Objetivos

Todas as funções abaixo foram pedidas pelo dono ("pode aplicar todas essas funções").

### 1. Desenho (diagrama)
- Ferramentas: selecionar, ponto, reta, retângulo, círculo, curva com alças (Bézier, com suavização), lápis livre, texto.
- Ímã: o traço gruda no ponto/linha mais próxima; liga/desliga.
- Medir reta e medir curva (comprimento ao longo do traço).
- Editar: cortar traço na interseção, estender linha, arredondar canto, mover, girar, espelhar, apagar.
- Desfazer/refazer, zoom/arrastar a tela, salvamento automático com indicador.
- Unidade de tela: cm; armazenamento: mm.
- Digitar medida exata: ao desenhar uma reta, poder digitar comprimento e ângulo.

### 2. Peças (moldes)
- Extrair molde: escolher um contorno fechado do diagrama → vira peça na lista "Moldes" (ver, travar, duplicar, apagar, renomear).
- Por peça: nome, "cortar N" (ou "1 par" = 2 espelhadas), sentido do fio (seta), molde em dobra (desenha meia, abre inteira).
- Margem de costura por lado (padrão único + exceção por segmento) e bainha; mostra linha de costura e linha de corte.
- Piques (marca no contorno) e pences.
- Encolhimento do tecido: % no comprimento e % na largura, aplicado na hora de gerar o corte.
- A peça extraída continua ligada ao diagrama: mudar o diagrama atualiza a peça.

### 3. Tamanhos
- Grade do app: P, M, G, GG, G1, G2, G3, G4 (a mesma `SZ` de hoje).
- Tamanho base escolhido no molde (padrão M).
- Gradação por regras nos pontos: cada ponto do contorno recebe um deslocamento (dx, dy) por passo de tamanho; tamanhos aparecem sobrepostos em cores; modo "fantasma" mostra os outros tamanhos por baixo.
- Tabela de medidas por tamanho (cintura, quadril, gancho, comprimento, entreperna…), editável, como referência e para conferir a gradação (mostra a medida do molde graduado ao lado da tabela).
- Regra pode ser copiada de um ponto para outro e de um molde para outro.

### 4. Moldes que já existem
- Importar PLT (já existe) e DXF (novo, incluindo DXF-AAMA) como peças editáveis.
- Digitalizar molde de papel por foto: foto do celular com o molde sobre um gabarito impresso (folha com marcas nos cantos e medida conhecida) → corrige perspectiva e escala → o usuário contorna (ou o app sugere o contorno) → vira peça.

### 5. Encaixe, enfesto e impressão
- Ligação com o produto: o molde fica associado à referência; ao salvar, gera `p.mol` (compatível com o que o enfesto já lê), agora com peças por tamanho.
- Plano de enfesto por pedido passa a usar as peças do tamanho certo de cada risco.
- Tela de risco: desenho do encaixe na largura do tecido, com nome/tamanho em cada peça; mover/girar peça à mão (respeitando o fio: só 180°, a não ser que a peça permita); recalcula comprimento e aproveitamento (%).
- Impressão/exportação do risco e do molde em 1:1:
  - PDF na largura do tecido (para plotter de gráfica);
  - PLT/HP-GL (para plotter de confecção);
  - DXF;
  - A4 em folhas numeradas com marcas de emenda e um quadrado de calibração de 10 cm.
  - Tamanho da fonte e posição do texto ajustáveis.
- Custo: consumo do produto e custo de tecido da ficha técnica passam a vir do encaixe real do molde desenhado.

## Não-objetivos

- Corte automático em máquina CNC/faca.
- Simulação 3D da roupa.
- Acervo/biblioteca pública de moldes.
- Vários usuários editando o mesmo molde ao mesmo tempo.
- Representantes e lojistas não veem nem editam moldes (só admin).

## Anti-objetivos (seria fracasso mesmo funcionando)

- Risco impresso fora de escala. Um centímetro na tela tem de ser um centímetro no papel. Toda exportação traz uma régua/quadrado de 10 cm para conferir.
- Peça girada contra o fio no encaixe automático.
- Quebrar produtos que já têm `p.mol` importado de PLT, ou documentos antigos sem os campos novos.
- Perder o desenho por falta de salvar.
- Deixar o `index.html` ainda mais pesado para quem não usa o CAD (lojista no celular).

## Restrições

- App estático no GitHub Pages; sem build; bibliotecas só por CDN com versão fixa (padrão do `index.html`).
- Supabase com RLS por perfil; nada de chave nova no front.
- `.claude/skills/project-conventions` diz "não alterar `index.html`" e "não commitar"; o dono liberou os dois para este trabalho.
- Uso no computador (tela grande, mouse). No celular, só ver o molde e o risco.

## Decisões de como fazer (calls meus, a confirmar)

- **Página separada `molde.html`** para o editor, com o JS dele. Motivo: o editor é grande e o `index.html` já tem ~145 KB; a sessão do Supabase é compartilhada (mesma origem). O `index.html` só ganha: botão "Desenhar molde" no produto, leitura das peças por tamanho no enfesto, e a tela/impressão do risco.
- **Armazenamento** na tabela `docs` com `col='moldes'` (um documento por molde, ligado ao produto por `produtoId`) — evita inflar o documento do produto. Ao salvar, o editor grava também o resumo `p.mol` no produto, no formato atual mais `porTam: {P:[pecas], M:[...], ...}`. Leitores antigos que só conhecem `p.mol.pecas` continuam funcionando (`pecas` = tamanho base).
- **Desenho em SVG** (zoom e seleção simples, impressão vetorial). Canvas só se ficar lento.
- **PDF** com jsPDF por CDN, versão fixa; PLT e DXF gerados como texto pelo próprio app.
- **Gradação por regras (dx, dy) por ponto** (decidido pelo dono); a tabela de medidas serve para conferir.
- **Encaixe**: reaproveitar `encaixaBLF` e devolver também as posições, para desenhar o risco.
- **Ordem de entrega**, cada etapa utilizável sozinha:
  1. Editor: desenho, ímã, medir, editar, extrair peça, margem, fio, piques, pences, dobra, salvar ligado ao produto.
  2. Tamanhos: gradação, fantasma, tabela de medidas; `p.mol.porTam`; enfesto usa o tamanho certo.
  3. Risco: tela do encaixe com ajuste manual, impressão PDF/PLT/DXF/A4, custo pelo encaixe real.
  4. Entrada: importar DXF/AAMA, digitalizar por foto, encolhimento.

### Calls da revisão (meus, a confirmar)

- **Molde compartilhado:** um molde pode servir a várias referências (`moldes.produtoIds`). O produto escolhe o molde; salvar o molde atualiza o resumo de todos os produtos ligados.
- **Polígonos só no doc `moldes` (admin):** o produto guarda só um resumo leve (`p.mol` atual = tamanho base, e `p.molId`). As peças por tamanho ficam no doc `moldes`, que o enfesto (admin) lê. Assim nada de polígono vai para a view do catálogo do lojista.
- **Consumo pelo encaixe é sugestão,** como o botão "Usar este consumo" de hoje; `cons`/`consG` continuam existindo e o `selfcheck.js` segue valendo. `cons` = metros do risco com P, M, G e GG (uma de cada) ÷ 4; `consG` = idem com G1–G4.
- **Ajuste manual do risco não é salvo** na etapa 3: serve para ver e imprimir. Salvar fica para depois, se fizer falta.
- **Sentido do tecido:** flag "sentido único" no cadastro do tecido (padrão desligado). Ligado, o encaixe não gira nem 180°. Peças PLT já importadas: fio = eixo vertical (Y), como o encaixe já supõe.
- **Encolhimento** mora no tecido (matéria-prima), em % de comprimento e de largura, e é aplicado na hora do encaixe/impressão; o molde guarda a medida sem encolhimento.

## Deixado para quem constrói

- Algoritmos de offset de margem, interseção de curvas e suavização.
- Formato interno do diagrama (pontos, segmentos, curvas, restrições).
- Atalhos de teclado e ícones.
- Testes: assert-based no padrão do `selfcheck.js` para geometria (área, offset, gradação, escala de exportação).

## Respostas do dono (2026-11-11)

1. Pode alterar o `index.html` e commitar neste trabalho (a regra de `project-conventions` não vale aqui).
2. Gradação: a entrada principal é a **regra (dx, dy) por ponto**. A tabela de medidas é referência para conferir.
3. A regra de acesso (RLS) para `col='moldes'` pode ser criada direto no Supabase pela conexão MCP. Antes, inspecionar as políticas atuais de `docs` e a view `catalogo_produtos`.
