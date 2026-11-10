---
name: ui-audit
description: Revisa acessibilidade, contraste, responsividade mobile e modo escuro do app fabrica-shorts.
user-invocable: true
---

# UI Audit

## Objetivo
Rodar revisão de interface SOMENTE LEITURA usando subagente `ui-reviewer`.

## Escopo
- Acessibilidade WCAG 2.1 AA
- Contraste de cores
- Responsividade mobile de tabelas e diálogos
- Modo escuro

## Comando
Invocar subagente `ui-reviewer` com prompt:

> Revise interface SOMENTE LEITURA. Foque em acessibilidade, contraste, responsividade mobile de tabelas e diálogos, modo escuro. Retorne relatório com arquivo e linha, sem editar.

## Saída esperada
Relatório com:
- Tipo de problema
- Arquivo:linha
- Critério WCAG / impacto
- Sugestão
