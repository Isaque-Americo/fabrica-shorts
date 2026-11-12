#!/usr/bin/env node
// Roda fora do navegador: (1) sintaxe de todo <script> inline do index.html,
// (2) o bloco de self-check que só rodava com IS_DEV em localhost.
// shortcut: DOM, Supabase e Turnstile são stubs permissivos (Proxy), então só a lógica pura
// é exercitada de verdade; trocar por jsdom se o self-check passar a depender de layout real.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const arquivo = process.argv[2] || path.join(__dirname, '..', '..', 'index.html');
const html = fs.readFileSync(arquivo, 'utf8');
const blocos = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

if (!blocos.length) {
  console.error('Nenhum <script> inline encontrado em ' + arquivo);
  process.exit(1);
}

// 1) sintaxe
const erros = [];
blocos.forEach((src, i) => {
  try { new vm.Script(src, { filename: 'script#' + (i + 1) }); }
  catch (e) { erros.push('Erro de sintaxe no script #' + (i + 1) + ': ' + e.message); }
});
if (erros.length) {
  console.error(erros.join('\n'));
  process.exit(2);
}

// 2) self-check: qualquer coisa que não seja lógica pura vira um objeto que aceita tudo
const qualquer = () => new Proxy(function () {}, {
  get: (t, k) => {
    if (typeof k === 'symbol' || k === 'then') return undefined;
    if (k === 'toString' || k === 'valueOf') return () => '';
    return qualquer();
  },
  set: () => true,
  apply: () => qualquer(),
  construct: () => qualquer(),
  has: () => true
});

const saida = [];
const g = {
  console: {
    log: (...a) => saida.push(a.join(' ')),
    error: (...a) => saida.push(a.join(' ')),
    warn: () => {},
    info: () => {}
  },
  setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: f => setTimeout(f, 0),
  queueMicrotask,
  fetch: () => new Promise(() => {}),
  // IS_DEV = hostname localhost; é o que liga o self-check
  location: { hostname: 'localhost', pathname: '/', href: 'http://localhost/', search: '', hash: '', replace() {}, assign() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: qualquer(),
  history: qualquer(),
  navigator: { userAgent: 'node', clipboard: qualquer() },
  supabase: { createClient: () => qualquer() },
  turnstile: qualquer(),
  alert: () => {}, confirm: () => false, prompt: () => null,
  addEventListener() {}, removeEventListener() {},
  crypto: require('crypto').webcrypto,
  URL, URLSearchParams, TextEncoder, TextDecoder, Blob: qualquer(), FormData: qualquer(), Image: qualquer(),
  MutationObserver: qualquer(), ResizeObserver: qualquer(), IntersectionObserver: qualquer(),
  HTMLElement: qualquer(), customElements: qualquer(), matchMedia: () => qualquer(), getComputedStyle: () => qualquer(),
  FileReader: qualquer(), createImageBitmap: () => new Promise(() => {}), OffscreenCanvas: qualquer(), atob: s => s, btoa: s => s
};
g.window = g; g.globalThis = g; g.self = g; g.top = g;
vm.createContext(g);

process.on('unhandledRejection', () => {}); // os fluxos async de login morrem nos stubs; não interessa aqui

// scripts locais (<script src="molde/...">) rodam antes, como no navegador
for (const [, src] of html.matchAll(/<script[^>]*\bsrc="(molde\/[^"]+)"/g))
  vm.runInContext(fs.readFileSync(path.join(path.dirname(arquivo), src), 'utf8'), g, { filename: src });

blocos.forEach((src, i) => {
  try { vm.runInContext(src, g, { filename: 'script#' + (i + 1) }); }
  catch (e) { saida.push('script #' + (i + 1) + ' parou nos stubs: ' + e.message); }
});

// o self-check roda em setTimeout(...,0); deixa o loop girar antes de ler a saída
setTimeout(() => {
  const linhas = saida.filter(l => /FALHA|asserções|✓/.test(l));
  const falhou = linhas.some(l => l.includes('FALHA'));
  const rodou = falhou || linhas.some(l => l.includes('asserções'));
  if (!rodou) {
    console.error('O self-check não rodou (o bloco IS_DEV sumiu ou parou antes). Saída: ' + (saida.join(' | ') || 'vazia'));
    process.exit(2);
  }
  console.log(linhas.join('\n'));
  process.exit(falhou ? 2 : 0);
}, 50);
