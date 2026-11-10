---
name: security-audit
description: Executa auditoria de segurança focada em RLS, credenciais, auth e Edge Functions do fabrica-shorts.
user-invocable: true
---

# Security Audit

## Objetivo
Rodar revisão de segurança somente leitura usando o subagente `security-reviewer`.

## Escopo
- RLS para admin/lojista/representante
- Fluxo de recuperação de senha
- Turnstile
- Edge Functions administrativas: `gerenciar-acesso`, `gerenciar-administradores`
- Credenciais expostas no cliente

## Comando
Invocar subagente `security-reviewer` com prompt:

> Audite segurança SOMENTE LEITURA. Foque em RLS por perfil, fluxo recuperação senha, Turnstile, Edge Functions administrativas gerenciar-acesso e gerenciar-administradores, credenciais expostas no cliente. Retorne relatório com gravidade, arquivo e linha, sugestão de correção, sem aplicar mudanças.

## Saída esperada
Relatório estruturado com:
- Gravidade
- Arquivo:linha
- Descrição
- Sugestão de correção
