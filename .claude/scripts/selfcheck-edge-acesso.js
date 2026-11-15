#!/usr/bin/env node
// Self-check: a tabela de dependências e o fechamento da Edge Function gerenciar-administradores
// (supabase/functions/_shared/permissoes.mjs) são iguais aos de acesso.js. Falha = saída 2.
const path = require('path');
const { pathToFileURL } = require('url');
const raiz = path.join(__dirname, '..', '..');
const A = require(path.join(raiz, 'acesso.js'));

(async () => {
  const E = await import(pathToFileURL(path.join(raiz, 'supabase', 'functions', '_shared', 'permissoes.mjs')).href);
  const ig = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // mesmas entradas válidas do selfcheck-acesso.js + cada área sozinha em cada nível
  const validas = [{ produtos: 'mexer' }, { pedidos: 'ver' }, { painel: 'ver' }, { estoque: 'ver' }, {}];
  for (const a of A.AREAS) for (const n of a.soVer ? ['ver'] : ['ver', 'mexer']) validas.push({ [a.k]: n });
  validas.push({ painel: 'ver', produtos: 'mexer', config: 'mexer', fabricar: 'ver' });

  const testes = [
    ['DEPS igual ao acesso.js', ig(E.DEPS, A.DEPS), true],
    ['AREAS igual ao acesso.js', ig(E.AREAS, A.AREAS.map(a => a.k)), true],
    ...validas.map(p => ['fechar igual ' + JSON.stringify(p), ig(E.validarPermissoes(p).valor, A.fechar(p)) && ig(E.fechar(p), A.fechar(p)), true]),
    ['null -> null', E.validarPermissoes(null).valor, null],
    ['chave desconhecida recusa', !!E.validarPermissoes({ x: 'mexer' }).erro, true],
    ['valor inválido recusa', !!E.validarPermissoes({ pedidos: 'tudo' }).erro, true],
    ['fabricar:mexer recusa', !!E.validarPermissoes({ fabricar: 'mexer' }).erro, true],
    ['__proto__ recusa', !!E.validarPermissoes(JSON.parse('{"__proto__":"ver"}')).erro, true],
    ['lista recusa', !!E.validarPermissoes(['pedidos']).erro, true],
    ['texto recusa', !!E.validarPermissoes('mexer').erro, true],
    ['is_principal recusa', !!E.validarPermissoes({ is_principal: true }).erro, true],
  ];

  let falhas = 0;
  for (const [nome, obtido, esperado] of testes) {
    if (obtido !== esperado) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
  }
  if (falhas) process.exit(2);
  console.log('✓ edge-acesso: ' + testes.length + ' asserções OK');
})();
