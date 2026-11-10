---
name: project-conventions
description: Regras de ouro do fabrica-shorts. Impede alterações proibidas e lembra restrições de segurança/escrita.
user-invocable: false
---

# Convenções do Projeto Fábrica Shorts

## Não alterar
- `index.html`
- `supabase/migrations/*`
- `supabase/functions/*`

## Não executar
- Comandos que escrevem no banco: `supabase db push`, `migration repair`, `functions deploy`
- Comandos git que alterem repositório: commit, push, merge, rebase

## Credenciais
- Nunca grave chaves, tokens ou senhas em arquivos.
- Nunca mostre valores de chave na resposta. Se encontrar, informe apenas arquivo, linha e tipo.

## Escopo de escrita
- Crie apenas arquivos explicitamente listados em cada tarefa.
- Antes de escrever, apresente plano e conteúdo completo para aprovação.

## Contexto técnico
- SPA estática em `index.html` com Supabase JS client.
- Perfis: admin, lojista, representante. Permissões via RLS.
- Edge Functions administrativas: `gerenciar-acesso`, `gerenciar-administradores`.
- Deploy GitHub Pages via `.github/workflows/pages.yml`.
- Turnstile captcha no login.

## Checklist antes de agir
- [ ] Verificar se arquivo está na lista permitida para criação/edição
- [ ] Confirmar que não há escrita em banco/git
- [ ] Confirmar que nenhuma credencial será exposta
