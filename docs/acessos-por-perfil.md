# Acessos por perfil

O login usa a mesma autenticação por usuário e senha do Supabase para os três perfis. A opção escolhida na tela precisa corresponder ao perfil cadastrado em `public.user_profiles`; a escolha do navegador não concede acesso por si só. As permissões efetivas são aplicadas por Row Level Security (RLS).

## Permissões

| Perfil | Pode consultar | Pode criar | Administração |
| --- | --- | --- | --- |
| Administrador | Todos os dados | Todos os registros | Gerencia pedidos, produtos, estoque, matéria-prima e representantes |
| Lojista | Catálogo com referência, descrição e preço; pedidos vinculados à própria conta | Pedidos para a loja vinculada | Não acessa custos, estoque, matéria-prima, ficha técnica nem pedidos de outras lojas |
| Representante | Catálogo comercial; pedidos associados ao próprio cadastro; lojas vinculadas a ele; a própria comissão | Pedidos associados ao próprio cadastro | Não acessa custos, estoque, matéria-prima, outros representantes nem pedidos não atribuídos a ele |

O administrador vincula cada loja ao seu representante no perfil da loja. Pedidos criados pela loja herdam esse representante. Um representante pode criar pedidos para lojas vinculadas a ele; também pode lançar pedidos para clientes ainda sem conta, que ficam visíveis ao representante e ao administrador até serem vinculados a uma conta de lojista. O administrador pode vincular um pedido a uma loja ao criá-lo. Representantes e lojistas não podem alterar status, excluir pedidos ou editar cadastros. Essas ações permanecem exclusivas do administrador.

## Preparar contas

Ative as migrações em duas etapas para preservar os logins atuais:

1. Aplique apenas `role_based_auth`. Ela cria o cadastro de perfis, as visualizações de catálogo e o vínculo de pedidos; a política de acesso atual continua ativa nesta etapa.
2. Cadastre em `public.user_profiles` todas as contas já existentes, identificando-as pelo e-mail interno usado no login (`usuário@fabrica.interno`). Não inclua senhas nesse cadastro.
3. Aplique `enforce_role_permissions`. Ela substitui a política ampla pelas regras por perfil.
4. Publique a versão do app com o seletor de perfis.

Não aplique `enforce_role_permissions` antes de cadastrar todas as contas que precisam continuar acessando o sistema.

Para localizar o ID de uma conta:

```sql
select id, email
from auth.users
where lower(email) = lower('USUARIO@fabrica.interno');
```

Administrador:

```sql
insert into public.user_profiles (user_id, role)
values ('UUID_DA_CONTA', 'admin');
```

Lojista — o nome deve corresponder ao nome da loja usado nos pedidos. Se a loja tiver representante atribuído, informe também o ID do registro dele:

```sql
insert into public.user_profiles (user_id, role, store_name, rep_id)
values ('UUID_DA_CONTA', 'lojista', 'NOME EXATO DA LOJA', 'ID_DO_REPRESENTANTE');
```

Use `null` no lugar de `ID_DO_REPRESENTANTE` quando a loja ainda não tiver representante.

Representante — use o ID do registro em `docs` da coleção `reps`:

```sql
select id, data ->> 'nome' as nome
from public.docs
where col = 'reps';

insert into public.user_profiles (user_id, role, rep_id)
values ('UUID_DA_CONTA', 'representante', 'ID_DO_REPRESENTANTE');
```

## Pedidos existentes

Pedidos antigos permanecem disponíveis ao administrador e ao representante indicado em `repId`. A migração não tenta adivinhar a qual conta de lojista pertencem. Pedidos vinculados a uma loja recebem o `owner_id` dessa conta e ficam visíveis para ela; pedidos não vinculados continuam visíveis ao administrador e ao representante indicado em `repId`.

## Ativação

Quando as políticas restritivas entrarem em vigor, usuários sem linha em `user_profiles` não terão acesso aos dados. A seleção de perfil na tela só habilita o fluxo correto; ela nunca substitui as regras do banco.

