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
3. Crie no Supabase Auth as contas novas para os clientes e para o representante, usando os nomes de usuário abaixo e a mesma senha temporária. Marque o e-mail interno como confirmado, pois `@fabrica.interno` não recebe e-mail. Defina `must_change_password = true` nos perfis novos.
4. Associe cada conta em `public.user_profiles`, publique o app com o seletor de perfis e confirme que o login funciona.
5. Aplique `enforce_role_permissions`. Ela substitui a política ampla pelas regras por perfil.

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
insert into public.user_profiles (user_id, role, store_name, rep_id, must_change_password)
values ('UUID_DA_CONTA', 'lojista', 'NOME EXATO DA LOJA', 'ID_DO_REPRESENTANTE', true);
```

Use `null` no lugar de `ID_DO_REPRESENTANTE` quando a loja ainda não tiver representante.

### Contas iniciais desta implantação

Os nomes abaixo vêm dos clientes que já aparecem em `pedidos`. Os nomes de usuário são os mesmos nomes normalizados para minúsculas, sem espaços ou acentos; no login, o app acrescenta `@fabrica.interno`.

| Cliente | Usuário | Representante atribuído |
| --- | --- | --- |
| ALEX SOUZA DA SILVA | `alex.souza.da.silva` | Uberdan F. Cavalcante |
| Casa Rezende Tecidos | `casa.rezende.tecidos` | Uberdan F. Cavalcante |
| E.P. RANGEL | `e.p.rangel` | Uberdan F. Cavalcante |
| L. C. Bebber | `l.c.bebber` | Uberdan F. Cavalcante |
| Matos e Matos | `matos.e.matos` | Uberdan F. Cavalcante |
| Sandro José | `sandro.jose` | Uberdan F. Cavalcante |
| Uberdan F. Cavalcante | `uberdan` | — |

Na tela **Cadastros**, o administrador pode completar os dados comerciais de cada lojista e os dados do representante. Esses dados são salvos na coleção `cadastros`; o nome de usuário é uma reserva e não cria sozinho a conta do Supabase Auth.

No cadastro da loja, a consulta pelo CNPJ usa `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` e preenche os dados públicos retornados, como razão social, nome fantasia, situação, endereço, contato, porte e CNAE. O CNPJ digitado é enviado à BrasilAPI; revise os resultados antes de salvar. Os dados fornecidos para Casa Rezende Tecidos já aparecem como valores iniciais do formulário.

Use a senha temporária única fornecida ao administrador fora do repositório. O campo `must_change_password` força a troca no primeiro acesso e impede fechar essa etapa sem salvar uma senha pessoal.

Depois de inserir os perfis, associe os pedidos já existentes aos lojistas pelo nome exato:

```sql
update public.docs d
set owner_id = p.user_id
from public.user_profiles p
where d.col = 'pedidos'
  and p.role = 'lojista'
  and d.data ->> 'cliente' = p.store_name;
```

Representante — use o ID do registro em `docs` da coleção `reps`:

```sql
select id, data ->> 'nome' as nome
from public.docs
where col = 'reps';

insert into public.user_profiles (user_id, role, rep_id, must_change_password)
values ('UUID_DA_CONTA', 'representante', 'ID_DO_REPRESENTANTE', true);
```

Defina `must_change_password = true` para o representante se ele receber a senha temporária compartilhada. A conta existente `isaque@fabrica.interno` permanece Administrador.

### Administradores e recuperação de senha

Na tela **Administradores**, um administrador autenticado pode convidar outro administrador e alterar o e-mail de login e o WhatsApp das contas administrativas. O convite do Supabase Auth é enviado ao e-mail real informado; o novo administrador define a própria senha pelo link recebido. A alteração do e-mail também atualiza a identidade de login e o destino de recuperação de senha.

A ação **Esqueci minha senha** aparece no login do administrador. A conta existente `@fabrica.interno` não recebe e-mails; para habilitar a recuperação dessa conta, entre com o usuário atual, abra **Administrador**, salve o e-mail real de contato e depois use o e-mail como login. O envio depende do SMTP de e-mail do Supabase estar configurado.

Publique `index.html` no GitHub Pages e a função administrativa no Supabase. Permita o retorno de autenticação para a página do app em **Authentication > URL Configuration**:

```powershell
npx.cmd --yes supabase functions deploy gerenciar-administradores --project-ref kgikdyqyoaqrhsshpmcw
```

Inclua `https://isaque-americo.github.io/fabrica-shorts/` na lista de URLs de redirecionamento do Supabase. O perfil de administrador é criado apenas depois de a função validar que o solicitante tem perfil `admin`.

### Recuperação por WhatsApp (Meta Cloud API)

O login oferece recuperação por e-mail e WhatsApp. A recuperação por WhatsApp só funciona depois de habilitar a Meta WhatsApp Cloud API e configurar o backend; até lá, use a opção por e-mail.

**Estado em 31/10/2026:** a tentativa de envio com o número de teste da Meta retornou `(#133010) Account not registered`; a conta WhatsApp de teste aparece com `account_review_status: REJECTED`. A integração não está validada para envio. Resolva o estado da conta de teste na Meta antes de considerar o fluxo pronto; o número comercial terminado em 3046 não foi alterado.

**Atenção às migrations:** a lista local e a lista do projeto Supabase remoto estão divergentes: existem migrations locais ainda não registradas no remoto e migrations remotas ausentes deste checkout. Não execute `supabase db push` até reconciliar o histórico e fazer backup do banco.

1. Na Meta, configure uma conta WhatsApp Business, um número habilitado para a Cloud API e um token de acesso de servidor. Crie e obtenha aprovação para um template da categoria **Authentication**, idioma `pt_BR`, botão OTP **Copy code** e código de expiração de 10 minutos. O nome inicial esperado pelo app é `authentication_code_copy_code_button`; se escolher outro, configure `META_WHATSAPP_TEMPLATE_NAME`.
2. Salve, pelo painel **Supabase > Edge Functions > Secrets**, os seguintes secrets. Nunca os coloque em `index.html`, Git ou mensagens:
   - `META_WHATSAPP_ACCESS_TOKEN`: token de acesso do servidor da Meta.
   - `META_WHATSAPP_PHONE_NUMBER_ID`: ID do número de telefone no WhatsApp Manager.
   - `WHATSAPP_OTP_HASH_SECRET`: segredo aleatório forte com pelo menos 32 caracteres, usado para armazenar somente o hash do código.
   - `TURNSTILE_SECRET_KEY`: secret do Cloudflare Turnstile correspondente à chave pública do app.
   - Opcional: `META_WHATSAPP_TEMPLATE_NAME`, `META_WHATSAPP_TEMPLATE_LANGUAGE` (padrão `pt_BR`) e `META_GRAPH_API_VERSION` (padrão `v26.0`).
3. Aplique a migração `20261031235000_admin_whatsapp_password_recovery.sql` e publique a função atualizada:

```powershell
npx.cmd --yes supabase db push --project-ref kgikdyqyoaqrhsshpmcw
npx.cmd --yes supabase functions deploy gerenciar-administradores --project-ref kgikdyqyoaqrhsshpmcw
```

4. Publique o `index.html` atualizado no GitHub Pages. O administrador deve ter salvo o telefone no formato internacional (`+55...`) no próprio perfil. Na recuperação, a pessoa solicita o código e confirma que aceita recebê-lo; respostas públicas não indicam se o número está cadastrado. Os códigos expiram em 10 minutos, são de uso único, têm até cinco tentativas e o envio é limitado a um por minuto e cinco por 24 horas por conta.

A conta Meta precisa ter o opt-in adequado para enviar mensagens ao número. A criação e aprovação do template, ativação do número, verificação do consentimento e eventuais cobranças são administradas pela Meta; o app não cria esses recursos automaticamente. O SMTP e a recuperação por e-mail continuam disponíveis como alternativa.

## Pedidos existentes

Pedidos antigos permanecem disponíveis ao administrador e ao representante indicado em `repId`. A migração não tenta adivinhar a qual conta de lojista pertencem. Pedidos vinculados a uma loja recebem o `owner_id` dessa conta e ficam visíveis para ela; pedidos não vinculados continuam visíveis ao administrador e ao representante indicado em `repId`.

## Ativação

Quando as políticas restritivas entrarem em vigor, usuários sem linha em `user_profiles` não terão acesso aos dados. A seleção de perfil na tela só habilita o fluxo correto; ela nunca substitui as regras do banco.
