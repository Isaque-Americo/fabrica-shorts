---
name: self-check
description: Roda o self-check do index.html (sintaxe dos scripts inline + asserções do bloco IS_DEV) fora do navegador
disable-model-invocation: true
---

# Self-check do index.html

Roda, sem abrir o navegador:

```bash
node .claude/scripts/selfcheck.js
```

Opcionalmente num arquivo específico: `node .claude/scripts/selfcheck.js caminho/para/index.html`.

## O que ele faz
1. Valida a sintaxe de todo `<script>` inline do `index.html` (o `htmlhint` não olha JavaScript).
2. Executa o bloco `if(IS_DEV)setTimeout(...)` do fim do arquivo, com DOM, Supabase e Turnstile
   substituídos por stubs permissivos, e devolve a linha de resultado das asserções.

## Como ler a saída
- `✓ custo/margem: N asserções OK` — tudo passou, código de saída 0.
- `FALHA no custo/margem: <asserção> deu X, esperado Y` — saída 2. Conserte o cálculo ou a asserção
  (a asserção está no fim do `index.html`, no array `t`).
- `Erro de sintaxe no script #N` — saída 2, o arquivo está quebrado: conserte antes de qualquer outra coisa.
- `O self-check não rodou` — o bloco `IS_DEV` sumiu, ou algum script parou num stub antes de chegar nele.
  A mensagem diz em qual script parou; normalmente falta um stub de API do navegador em
  `.claude/scripts/selfcheck.js` (acrescente ao objeto `g`).

Este mesmo script roda sozinho no hook `PostToolUse` após cada edição do `index.html`.
Lógica nova não trivial deve ganhar uma asserção no array `t` do bloco `IS_DEV` — é o que esta skill verifica.
