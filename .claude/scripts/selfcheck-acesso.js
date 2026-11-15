#!/usr/bin/env node
// Self-check de acesso.js (permissões por checklist, lógica pura). Falha = saída 2.
const path = require('path');
const A = require(path.join(__dirname, '..', '..', 'acesso.js'));

const ig = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const inclui = (obj, esp) => Object.keys(esp).every(k => obj[k] === esp[k]);
const adm = permissoes => ({ role: 'admin', is_principal: false, permissoes });
const todas = A.AREAS.map(a => a.k);

const testes = [
  ['AREAS na ordem do checklist', ig(todas, ['painel', 'produtos', 'materia', 'pedidos', 'fabricar', 'moldes', 'reps', 'cadastros', 'estoque', 'config']), true],
  ['fabricar é soVer', A.AREAS.find(a => a.k === 'fabricar').soVer, true],
  ['fechar produtos:mexer', inclui(A.fechar({ produtos: 'mexer' }), { moldes: 'mexer', produtos: 'mexer', materia: 'ver' }), true],
  ['fechar pedidos:ver', inclui(A.fechar({ pedidos: 'ver' }), { produtos: 'ver', cadastros: 'ver', reps: 'ver', pedidos: 'ver' }), true],
  ['fechar painel:ver', inclui(A.fechar({ painel: 'ver' }), { pedidos: 'ver', produtos: 'ver', cadastros: 'ver', reps: 'ver' }), true],
  ['fechar estoque:ver', inclui(A.fechar({ estoque: 'ver' }), { produtos: 'ver', materia: 'ver', config: 'ver' }), true],
  ['fechar cadastros:mexer', inclui(A.fechar({ cadastros: 'mexer' }), { cadastros: 'mexer', pedidos: 'mexer', reps: 'ver', produtos: 'ver' }), true],
  ['fechar produtos:ver', ig(A.fechar({ produtos: 'ver' }), { produtos: 'ver', materia: 'ver', config: 'ver' }), true],
  ['fechar fabricar:mexer -> ver', A.fechar({ fabricar: 'mexer' }).fabricar, 'ver'],
  ['fechar chaves/valores inválidos', ig(A.fechar({ x: 'mexer', pedidos: 'tudo' }), {}), true],
  ['fechar null -> {}', ig(A.fechar(null), {}), true],
  ['fechar não muta a entrada', (() => { const p = { produtos: 'mexer' }; A.fechar(p); return ig(p, { produtos: 'mexer' }); })(), true],
  ['principal pode tudo', todas.every(k => A.pode({ role: 'admin', is_principal: true, permissoes: null }, k, 'mexer') && A.pode({ role: 'admin', is_principal: true }, k, 'ver')), true],
  ['admin pedidos:ver -> ver', A.pode(adm({ pedidos: 'ver' }), 'pedidos', 'ver'), true],
  ['admin pedidos:ver -> mexer não', A.pode(adm({ pedidos: 'ver' }), 'pedidos', 'mexer'), false],
  ['admin pedidos:mexer -> ver', A.pode(adm({ pedidos: 'mexer' }), 'pedidos', 'ver'), true],
  ['admin sem a área', A.pode(adm({ pedidos: 'ver' }), 'produtos', 'ver'), false],
  ['lojista false', A.pode({ role: 'lojista', is_principal: true, permissoes: { pedidos: 'mexer' } }, 'pedidos', 'ver'), false],
  ['permissoes null false', A.pode(adm(null), 'pedidos', 'ver'), false],
  ['perfil null false', A.pode(null, 'pedidos', 'ver'), false],
  ['ação desconhecida false', A.pode(adm({ pedidos: 'mexer' }), 'pedidos', 'apagar'), false],
  ['ABA_AREA', ig(A.ABA_AREA, { painel: 'painel', produtos: 'produtos', materia: 'materia', pedidos: 'pedidos', fabricar: 'fabricar', molde: 'moldes', corte: 'moldes', digitalizar: 'moldes', reps: 'reps', cadastros: 'cadastros', estoque: 'estoque' }), true],
  ['DEPS exportado', typeof A.DEPS, 'object'],
];

let falhas = 0;
for (const [nome, obtido, esperado] of testes) {
  if (obtido !== esperado) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ acesso: ' + testes.length + ' asserções OK');
