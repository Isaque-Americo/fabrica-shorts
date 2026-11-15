# Visual Outline (estilo esportivo) — desenho

Data: 2026-11-14 · Dono: Isaque · Base: `main` (f387161)

## Intenção

O app ainda tem cara de protótipo: chama "Fábrica de Shorts", usa azul padrão (#007bff) e o painel é uma fileira de cartões e uma tabela. O dono quer um visual **mais profissional, com cara de app de empresa e painel moderno**, com a marca da fábrica, **Outline**. Ele escolheu o estilo **B, esportivo: preto e laranja**, e aprovou a maquete "Estilo B versão 2" (`.superpowers/brainstorm/…/content/estilo-b-v2.html`).

O que conta como sucesso: o dono abre o app e vê a marca Outline. Em 10 segundos ele sabe como estão vendas, aprovações e produção.

## O que muda

1. **Marca**
   - Logo da Outline (arquivo `C:\Users\Isaque\Desktop\Short\logo\logo 2.png`, monograma OL de linhas paralelas, PNG com fundo transparente) copiado para o repo e publicado pelo `pages.yml`.
   - Na barra lateral escura, o logo aparece em branco, ao lado de "OUTLINE" e "CONFECÇÃO".
   - O nome "Fábrica de Shorts" sai do título da aba, do login e do topo do menu. Entra "Outline".
2. **Cores (tokens em `:root`)**
   - Neutros: quase preto `#0e0e0f` na barra lateral; fundo `#f4f4f3`; cartões brancos com borda `#e4e4e7`; texto `#18181b`; texto secundário `#71717a`.
   - **Uma cor de destaque só: laranja `#f97316`**. Ela vale para:
     - o botão principal
     - a aba ativa (faixa à esquerda)
     - os contadores do que pede ação
     - o mês atual no gráfico
   - Verde, âmbar e vermelho ficam só para estados: ok, aviso e erro.
   - **Modo escuro continua existindo.** Os mesmos tokens são redefinidos, com a barra lateral igual e o conteúdo em grafite.
3. **Tipografia**
   - Inter para o texto.
   - **Barlow Condensed** (negrito) para os números grandes e os títulos de página, em caixa alta. É o "placar esportivo".
   - Poppins e Roboto saem, se nada mais depender delas.
4. **Menu lateral** agrupado, com títulos pequenos:
   - Visão geral: Painel
   - Vendas: Pedidos, Representantes, Cadastros
   - Produção: A fabricar, Ordens de corte, Criar molde
   - Catálogo: Produtos, Matéria-prima, Estoque
   - Administradores, para o principal
   - Pedidos mostra uma pílula laranja com o nº de pendentes.
   - Respeita as permissões de hoje: um grupo sem nenhuma aba visível não aparece.
5. **Painel do admin** (conteúdo, de cima para baixo):
   - Saudação ("Bom dia, Isaque", com a data) e o botão **+ Novo pedido**, este só com pedidos:mexer.
   - **4 números grandes:**
     - Faturamento, em cartão preto, com a variação em relação ao mês anterior.
     - Para aprovar, o nº de pendentes, em laranja.
     - A fabricar, em peças.
     - Em estoque, em peças e nº de produtos.
   - **Caminho dos pedidos:**
     - uma faixa com a contagem por etapa: Pendente, Aprovado, Em corte, Faturado, Enviado, Entregue;
     - a etapa com pendência fica em destaque;
     - clicar numa etapa abre Pedidos filtrado nela.
   - **Vendas por mês:** barras dos últimos 6 meses, calculadas do total dos pedidos pela data, sem Cancelado e Recusado. O mês atual fica em laranja.
   - **Precisa de atenção:** uma lista curta e clicável, só com o que existe:
     - pedidos para aprovar;
     - produtos sem molde;
     - estoque abaixo do mínimo;
     - pedidos com representante sem cadastro;
     - comissão a pagar por representante.
   - A tabela "Vendas e comissões por representante" continua abaixo.
6. **Login:** fundo preto, logo e "OUTLINE" no topo do cartão de entrada, botão laranja. O Turnstile e o fluxo não mudam.
7. **Resto do app:**
   - As outras abas herdam os tokens: botões, tabelas, etiquetas de status coloridas e cabeçalhos de página em Barlow Condensed.
   - Não se refaz a estrutura delas.
   - `corte.html`, `molde.html` e `enfesto.html` trocam só as cores e a fonte para os mesmos tokens.

## Objetivos

- A marca Outline visível em todas as telas.
- O painel lido em 10 segundos.
- Tudo calculado dos dados reais, sem número inventado.

## Fora do escopo

- Mudar o que as telas fazem, as permissões ou o banco.
- Painel do lojista e do representante: só herdam as cores. O painel deles fica para depois.
- Novo status de pedido. "Em corte" é só um rótulo na tela: um pedido **Aprovado que já tem `ordemId`**. "Aprovado" no caminho conta só os aprovados sem ordem.

## O que seria fracasso mesmo funcionando

- Qualquer tela ficar ilegível no modo escuro ou no celular. A barra lateral precisa continuar recolhendo como hoje.
- Contraste do laranja com o texto abaixo do mínimo de acessibilidade. Texto preto sobre laranja, nunca branco sobre laranja em letra pequena.
- O painel mostrar número que não bate com as abas, como faturamento diferente da soma dos pedidos.
- Um admin limitado ver no painel um atalho ou número de área que ele não pode ver.

## Restrições

- HTML/JS sem build. `index.html` é CRLF.
- Fontes só do Google Fonts. Sem biblioteca de gráfico nova: as barras são HTML/CSS.
- Os self-checks atuais (`.claude/scripts/selfcheck*.js`) continuam passando.
- Publicar no main só com o ok do dono.

## Decisões do dono

- Estilo B, esportivo, preto e laranja.
- Maquete v2 aprovada ("por enquanto está bom assim").
- **Cartão de faturamento mostra os dois números:**
  - **"Vendido"**, grande: soma de todos os pedidos menos Cancelado e Recusado, a conta de hoje;
  - **"Aprovado"**, menor, embaixo: soma de Aprovado, Faturado, Enviado e Entregue.
  - A variação em relação ao mês anterior vale para o Vendido.
- Desenho aprovado em 2026-11-14 ("o restante está ok").

## Decisões minhas depois da revisão do construtor

- **Datas e totais.**
  - O mês de um pedido sai do campo `data` (AAAA-MM-DD) do pedido, no horário local.
  - O total de um pedido é `pedTotal(o)`, a mesma conta das abas.
  - Sem `data`, o pedido não entra no gráfico.
- **Admin limitado.** O Painel só aparece com `painel:ver`. O checklist já marca junto Ver Pedidos, Produtos, Cadastros, Representantes, Matéria-prima e Configurações, então todos os números do painel podem ser mostrados. Duas regras a mais:
  - o botão **+ Novo pedido** exige `pedidos:mexer`;
  - cada atalho clicável (etapa, item de atenção, cartão) só leva a uma aba que o admin pode ver. Se não puder, o atalho vira texto sem link.
- **Dados que já existem.**
  - O estoque mínimo é `p.min` do produto, e o item de atenção usa a regra que já existe (`tot(p) <= min`).
  - "Comissão" usa a mesma conta da tabela de hoje (vendas × % do representante). Não existe controle de "pago": o item diz "comissão do período", não "a pagar".
  - O banco não muda.
- **Logo.**
  - O arquivo vai para `img/outline-logo.png` no repo, e o `pages.yml` ganha `cp -r img _site/img`.
  - O branco é feito com o filtro CSS `brightness(0) invert(1)`, o mesmo da maquete. No fundo claro, o logo usa o cinza original.
- **Lojista e representante.** Mesma barra lateral escura, com o logo e as abas deles, sem os títulos de grupo (eles têm poucas abas). Herdam as cores e as fontes.
- **Pedidos antigos.** Aprovado sem `ordemId` conta como **Aprovado**, e Aprovado com `ordemId` conta como **Em corte**. Os status Recusado e Cancelado não aparecem no caminho.

## Decisões minhas (o dono pode mudar)

- "Em corte" derivado de Aprovado + `ordemId`.
- A variação do faturamento compara o mês corrente com o anterior. Sem pedidos no mês anterior, ela não aparece.
- Os grupos do menu seguem a lista acima.
- O modo escuro é mantido.
- O lojista e o representante só herdam as cores.
