# Admin principal e permissões por checklist — desenho

Data: 2026-11-14 · Dono: Isaque · Base: `main`

## Intenção

Hoje existe um único admin, e todo admin pode tudo, na tela e no banco (política `docs_admin_all`). O dono quer ser o **admin principal**: só ele cria outros admins e escolhe, num **checklist**, o que cada um pode fazer no app. A regra tem de valer **no banco**, não só na tela. Senão um admin limitado acessa os dados pela API.

## Fluxo

1. A tela **Administradores** (já existe, `adminAccountsPage` + Edge Function `gerenciar-administradores`) só aparece para o principal.
2. **Novo administrador** e **Editar** mostram o checklist. Cada linha é uma área do app, com **Ver** e **Mexer** (Mexer inclui Ver):
   - Painel (faturamento e números)
   - Produtos (inclui ficha técnica e custos)
   - Matéria-prima
   - Pedidos (ver; mexer = criar, editar, mudar status, aprovar/recusar, excluir)
   - A fabricar (só Ver)
   - Moldes e ordens de corte
   - Representantes (inclui comissões)
   - Cadastros (lojas)
   - Estoque
   - Configurações (`config`)
3. O admin limitado só vê no menu as áreas marcadas. Uma área só com Ver fica sem botões de criar, editar e excluir.
4. **Administradores** nunca entra no checklist: é sempre só do principal.
5. O principal pode mudar o checklist a qualquer momento. A mudança vale no próximo carregamento do app do outro admin.

## Objetivos

- O principal decide o acesso de cada admin com um checklist.
- O banco recusa o que o checklist não permite (ler, gravar, apagar).
- Nada muda para o principal: ele continua podendo tudo.

## Fora do escopo

- Permissões para lojista e representante (continuam como estão).
- Separar custos de produtos (custos vão junto com Produtos, decisão do dono: uma linha por aba).
- Registro de quem fez o quê (auditoria).
- Financeiro e contábil (projeto próprio).

## O que seria fracasso mesmo funcionando

- Um admin limitado conseguir ler ou gravar uma área desmarcada chamando a API direto.
- Um admin limitado conseguir mudar a própria permissão, criar admins, ou virar principal.
- O principal perder acesso a alguma coisa por causa da migração.
- Lojista e representante perderem algum acesso que têm hoje.

## Restrições

- Banco Supabase, tabela `docs` (coleções `produtos`, `materiais`, `pedidos`, `ordens`, `moldes`, `reps`, `cadastros`, `config`) com RLS. Perfis em `public.user_profiles` (`role` = `'admin' | 'lojista' | 'representante'`). O usuário comum só consegue alterar colunas de contato e `must_change_password` (grants por coluna).
- Estoque e custos ficam dentro do doc do produto (`data.est`, ficha), não em coleção própria.
- Edge Functions existentes (`gerenciar-administradores`, `gerenciar-acesso`, `ler-pedido`) checam papel admin. Elas precisam respeitar o principal e as permissões.
- Toda migração no banco precisa de aprovação do dono antes de aplicar.
- App em HTML/JS puro (`index.html`, `corte.html`, `molde.html`, `enfesto.html`). Tudo em português.

## Decisões do dono

- Um principal com acesso total. Outros admins têm acesso escolhido por checklist pelo principal.
- Granularidade: uma linha por área, com Ver e Mexer.

## Decisões minhas (o dono pode mudar)

- **Quem é o principal:** o admin que existe hoje. Fica marcado em `user_profiles` (coluna nova `is_principal boolean`, uma só linha `true`). Ninguém se marca sozinho: a coluna fica fora dos grants de usuário e só muda por migração.
- **Onde ficam as permissões:** coluna nova `permissoes jsonb` em `user_profiles`, no formato `{"produtos":"mexer","pedidos":"ver",...}`. Só a Edge Function `gerenciar-administradores` grava, com a chave de serviço, depois de conferir que quem chama é o principal. Admin sem `permissoes` (null) = **nenhum acesso** além do próprio contato. O principal ignora a coluna.
- **No banco:** a política `docs_admin_all` vira uma função `private.pode(col text, acao text)` (SECURITY DEFINER, `search_path` vazio) usada por políticas de SELECT, INSERT, UPDATE e DELETE por coleção. Principal → sempre verdadeiro. Mapa coleção → área: `produtos`→Produtos, `materiais`→Matéria-prima, `pedidos`→Pedidos, `ordens`/`moldes`→Moldes e ordens, `reps`→Representantes, `cadastros`→Cadastros, `config`→Configurações. SELECT pede Ver, o resto pede Mexer. As políticas de lojista e representante ficam como estão.
- **Estoque:** como mora no doc do produto, "Mexer em Estoque" grava por uma função `public.ajustar_estoque(prod_id text, est jsonb)` (SECURITY DEFINER) que confere `pode('estoque','mexer')` e só troca `data.est`. "Ver Estoque" exige "Ver Produtos" (é o mesmo doc), e o checklist marca isso sozinho.
- **Painel e A fabricar** não têm dados próprios: eles calculam a partir de pedidos e produtos. A permissão só esconde a aba. Para os números aparecerem, o admin precisa de Ver Pedidos e Ver Produtos, e o checklist marca isso sozinho.
- **Aprovar pedido** cria a ordem de corte: exige Mexer em Pedidos e Mexer em Moldes e ordens. O botão só aparece com as duas.
- **Edge Functions:** `gerenciar-administradores` passa a exigir o principal. `gerenciar-acesso` (lojistas e representantes) exige Mexer em Cadastros. `ler-pedido` exige Mexer em Pedidos.

## Decisões minhas depois da revisão do construtor

- **Principal confirmado:** o único admin hoje é a conta do dono (contato "Isaque"). Ela recebe `is_principal = true`. O principal não pode se rebaixar nem se apagar pela tela, e a troca de principal só acontece por migração.
- **Ordem da migração (obrigatória):**
  1. Criar as colunas e a função.
  2. Marcar o principal.
  3. Criar as políticas novas ao lado de `docs_admin_all`.
  4. Testar com um admin limitado de teste em transação desfeita.
  5. Só então remover `docs_admin_all`.

  Conferir que `is_principal` e `permissoes` ficam fora dos grants de UPDATE por coluna do usuário.
- **Views de catálogo** (`catalogo_lojas`, `catalogo_representantes`, `catalogo_produtos`) e as tabelas `private.catalog_*`: a leitura por admin passa a exigir Ver na área correspondente (Cadastros, Representantes, Produtos). Para lojista e representante nada muda.
- **Dependências entre áreas:** o checklist marca sozinho o que cada área precisa, e o banco cobra cada coleção separadamente.
  - Mexer em Produtos marca Mexer em Moldes e ordens, porque ligar um molde grava nos dois.
  - Moldes e ordens marca Ver Produtos e Ver Matéria-prima.
  - Pedidos marca Ver Produtos, Ver Cadastros e Ver Representantes.
  - Painel e A fabricar marcam Ver Pedidos e Ver Produtos.
  - Estoque marca Ver Produtos.
  - Uma área sem as dependências fica desmarcável só junto com elas.
- **Apagar ordem de corte** exige Mexer em Moldes e ordens e Mexer em Pedidos (porque devolve o pedido a Pendente).
- **`ler-pedido`** (ler pedido de arquivo) exige Mexer em Pedidos.
- **Estoque:** quem tem Mexer em Produtos também pode mudar `est` ao salvar o produto. Isso é aceito, sem trigger.
- **Fotos (bucket `produtos` no Storage):** enviar e apagar exigem Mexer em Produtos ou em Moldes e ordens. O construtor confere as políticas atuais do bucket antes.
- **Realtime:** o plano inclui um teste de que o admin limitado não recebe eventos de coleções sem Ver.
- **Mudança de checklist:** o banco passa a valer na hora, porque a RLS lê `permissoes` a cada consulta. A tela do outro admin se atualiza no próximo carregamento.
- **Checklist vazio:** é permitido. O admin entra e vê só "Sem acesso a nenhuma área; fale com o administrador principal".
- **Apagar admins:** o principal pode apagar outros admins se a função atual já permitir. Se não permitir, fica fora deste projeto.

## Para o construtor decidir

- Como o app lê as permissões do admin logado (junto com `appProfile`) e esconde abas e botões.
- A forma do checklist na tela (tabela com duas caixas por linha).
- A ordem segura da migração: criar a função e as colunas, marcar o principal, criar as políticas novas, e só depois remover `docs_admin_all`. Testar com um admin limitado de teste dentro de uma transação desfeita.
