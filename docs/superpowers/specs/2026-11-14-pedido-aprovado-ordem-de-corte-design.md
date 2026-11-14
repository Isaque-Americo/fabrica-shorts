# Do pedido aprovado à ordem de corte — desenho

Data: 2026-11-14 · Dono: Isaque · Branch base: `main` (`ec57cac`, etapas 1–3 do CAD de molde publicadas)

## Intenção

Hoje a ordem de corte nasce do **Fabricar**, que soma todos os pedidos em aberto e gera uma ordem única. O dono quer outro caminho: **cada pedido aprovado vira a sua ordem de corte**. O app lê as referências do pedido, puxa o molde de cada produto e monta os enfestos sozinho, ou deixa o admin montar enfesto por enfesto. Para isso funcionar sempre, **todo produto precisa ter molde**.

O que conta como sucesso: o admin aprova o pedido, escolhe "automático" e recebe uma ordem de corte pronta, com o nº do pedido e as referências, sem digitar grade nem escolher peças.

## Fluxo

1. **Molde primeiro.** Pelo menu lateral, "Criar molde" abre o editor (`molde.html`) sem produto, só com nome/referência (ex.: "5050").
2. **Produto exige molde.** No cadastro do produto, o campo **Molde** é obrigatório: escolher um molde da lista ou importar um PLT (o caminho de hoje). Sem molde, Salvar recusa.
   - Os 3 produtos atuais (todos sem molde) continuam no app com o selo **"sem molde"** e **não podem entrar em pedido novo** até ganharem um.
3. **Pedido.** Lojista, representante e admin fazem pedido como hoje. O **lojista escolhe obrigatoriamente um representante cadastrado** (hoje o representante vem fixo do perfil do lojista).
4. **Aprovação.** O pedido nasce **Pendente**. O admin tem **Aprovar** e **Recusar**.
   - Recusado: novo status **Recusado**, visível para lojista e representante.
   - Aprovado: novo status **Aprovado**, entre Pendente e Faturado. Daí segue Faturado → Enviado → Entregue como hoje.
5. **Ao aprovar**, o app abre a escolha:
   - **Enfesto automático:** agrupa as referências do pedido por tecido. Referências de **mesmo tecido e mesma largura** vão no mesmo enfesto. Peças de outro tecido (forro) ganham aba e enfesto próprios (regra que já existe em `MoldeOrdem.deFabricar`).
   - **Enfesto detalhado:** lista as referências do pedido e o admin marca quais vão em cada enfesto. Pode ser referência por referência ou o pedido inteiro num enfesto. O app **só deixa juntar** referências de mesmo tecido e mesma largura.
   - Nos dois casos nasce **uma ordem de corte por pedido**, guardando o nº do pedido e as referências.
6. **Ordem de corte** (`corte.html`):
   - A lista mostra nº do pedido, referências, data e metros, com **Editar** (abre a ordem) e **Apagar** (com confirmação).
   - Dentro da ordem fica tudo como hoje (abas de tecido, enfestos, grade, resultados, abrir enfesto, exportar).
7. **Enfesto e exportação:** opção de mostrar **nº do pedido** e **referência do produto** no risco e na impressão (liga/desliga, como os outros itens de "Mostrar").
8. **Menu lateral (admin):** atalhos **Criar molde** e **Ordens de corte** (com "Nova ordem" lá dentro, para ordem avulsa sem pedido).
9. **Fabricar vira painel "A fabricar"**, só informativo: soma o que falta produzir em todos os pedidos aprovados, por referência/cor/tamanho. Perde o botão de gerar ordem.

## Objetivos

- Pedido aprovado → ordem de corte em 2 cliques (Aprovar, Automático).
- Nenhum produto pedível sem molde.
- O admin decide como agrupar quando quiser (detalhado).

## Fora do escopo

- Juntar vários pedidos numa ordem só (decisão do dono: cada pedido tem a sua).
- Mudar o encaixe, a exportação ou as regras de tubular, sentido e pares (etapa 3, já publicada).
- As ideias dos vídeos (encaixe otimizado por tempo, tabela de medidas, digitalização por foto). Elas ficam para depois.

## O que seria fracasso mesmo funcionando

- Aprovar um pedido gerar ordem com peça faltando ou tecido errado sem avisar.
- Um lojista conseguir gravar pedido com representante que não existe, ou ler pedidos de outro lojista.
- A ordem de um pedido mudar sozinha quando o pedido é editado depois de aprovado, sem o admin saber.

## Restrições

- App em HTML/JS puro: `index.html`, `corte.html`, `molde.html`, `enfesto.html` e `molde/*.js`. Banco Supabase, tabela `docs` (coleções `produtos`, `pedidos`, `ordens`, `moldes`) com RLS.
- A RLS `docs_store_insert_own_order` hoje exige `repId` = `rep_id` do perfil do lojista. Para o lojista escolher o representante, ela precisa mudar para "repId de um representante cadastrado". Isso é migração no banco e precisa da aprovação do dono antes de aplicar. A mesma política compara `r.id = r.data->>'repId'` (a linha consigo mesma), o que parece um erro: conferir e corrigir junto.
- Documentos antigos não têm `status:'Aprovado'`, `pedidoId` na ordem nem molde no produto. Ler tudo com valor padrão (ver o agente `compat-reviewer`).
- Responder e rotular tudo em português.
- O self-check (`.claude/scripts/selfcheck*.js`) precisa cobrir a montagem automática (agrupamento por tecido e largura, forro separado, grade = quantidades do pedido).

## Decisões já tomadas pelo dono

- Juntar referências no mesmo enfesto só com mesmo tecido e mesma largura.
- Cada pedido aprovado gera a sua ordem.
- Produto só é aceito com molde, e o molde é criado antes (menu lateral).
- O Fabricar pode deixar de gerar ordem. Minha sugestão, que o dono não contestou: virar painel informativo.

- **A ordem corta a quantidade inteira do pedido** e ignora o estoque.
- **Pedido aprovado fica travado.** Não dá para editar o pedido enquanto ele tem ordem de corte. Para mudar:
  1. O admin apaga a ordem.
  2. O pedido volta a **Pendente**.
  3. O admin edita e aprova de novo.
  - Cancelar um pedido que tem ordem avisa que ela existe e pede confirmação. A ordem não é apagada sozinha.
  - Um pedido tem no máximo uma ordem: "Aprovar" não aparece de novo enquanto a ordem existir.
  - Apagar a ordem de um pedido devolve o pedido a Pendente, depois de confirmar.

## Decisões minhas (o dono pode mudar)

- Status novos **Aprovado** e **Recusado**, sem mexer nos outros.
- O lojista escolhe numa lista de representantes cadastrados. Se o perfil dele já tem representante, ele vem pré-selecionado.
- Na ordem automática, a grade de cada referência é a quantidade inteira do pedido, com camadas = 1 (mesma regra de `deFabricar`). O admin ajusta camadas depois.
- Os 3 produtos sem molde ficam bloqueados para pedido novo. Pedidos antigos que já têm esses produtos continuam visíveis.
- **"Mesmo tecido e mesma largura" = mesma matéria-prima (`materiaId`).** A largura é campo da matéria-prima, então mesma matéria implica mesma largura. Referências de cores diferentes no mesmo tecido podem ir no mesmo enfesto (cada item da ordem já guarda a sua cor). *Dono confirmou:* todo produto tem o tecido cadastrado (obrigatório), e o tecido é a única matéria-prima que muda de um produto para outro. As outras vão em todos os produtos.
- **Aprovar com produto sem molde é bloqueado.** A mensagem lista as referências sem molde. Não nasce ordem com peça faltando.
- **Molde e produto:** o produto continua guardando `mol` (peças por tamanho) e `tecidoId`, como hoje. Ligar o produto a um molde copia as peças para o produto pelo caminho que o editor já usa (`produtoIds` no molde, `molId` no produto). A ordem lê o produto, então editar o molde depois não muda as ordens já criadas sem passar pelo produto. `tecidoId` continua obrigatório no produto, e peças de forro usam o tecido da própria peça.
- **"A fabricar"** soma os pedidos **Aprovado** e **Faturado** por referência, cor e tamanho, **sem descontar o estoque** (dono confirmou). É só informação.
- **Pedidos antigos:** são dados de exemplo (dono confirmou). Basta ler com valor padrão, sem migrar. Os Pendentes podem ser aprovados no fluxo novo para teste. A ordem que já foi gerada pelo Fabricar continua como ordem avulsa, sem pedido.
- **Banco:** antes de escrever a migração, conferir a política viva e onde ficam os representantes (`docs` col `reps` / `catalogo_representantes`). Manter: lojista só lê os pedidos dele, representante só os atribuídos a ele. *Dono aprovou aplicar a migração* (2026-11-14).

## Próximo projeto (fora deste)

- **Estoque com reserva:** o lojista e o representante veem o estoque e podem reservar peças. Isso não entra na ordem de corte, que corta sempre o pedido inteiro. Fica para um desenho próprio.

## Para o construtor decidir

- Onde fica a tela de escolha automático/detalhado (modal no `index.html` ou página no `corte.html`).
- Como o editor de molde abre sem produto e como o produto se liga ao molde (`molId` já existe no produto; o molde guarda `produtoIds`).
- Reaproveitar `MoldeOrdem.deFabricar` adaptado para um pedido, ou uma função nova `dePedido`.
