// Validação e fechamento de dependências de `permissoes` (lógica pura, usada pela gerenciar-administradores).
// DEPS e fechar são cópia de acesso.js: manter as duas tabelas idênticas (conferido por .claude/scripts/selfcheck-edge-acesso.js).
export const AREAS = ['painel', 'produtos', 'materia', 'pedidos', 'fabricar', 'moldes', 'reps', 'cadastros', 'estoque', 'config']
const SO_VER = ['fabricar']

// "área:nível" exigido => lista de "área:nível" que passam a ser exigidas
export const DEPS = {
  'produtos:ver': ['materia:ver', 'config:ver'], // custo e margem leem matéria-prima e a ficha padrão (config)
  'produtos:mexer': ['moldes:mexer'],
  'moldes:ver': ['produtos:ver', 'materia:ver'],
  'pedidos:ver': ['produtos:ver', 'cadastros:ver', 'reps:ver'],
  'painel:ver': ['pedidos:ver', 'produtos:ver'],
  'fabricar:ver': ['pedidos:ver', 'produtos:ver'],
  'estoque:ver': ['produtos:ver'],
  'cadastros:mexer': ['pedidos:mexer', 'reps:ver'], // ativar acesso de representante dá acesso aos pedidos dele
}

export function fechar(perm) {
  const soVer = new Set(SO_VER)
  const ok = new Set(AREAS)
  const r = {}
  const dar = (k, n) => { if (ok.has(k) && (n === 'ver' || n === 'mexer') && r[k] !== 'mexer') r[k] = soVer.has(k) ? 'ver' : n }
  for (const k of Object.keys(perm || {})) dar(k, perm[k])
  // repete até não mudar (as dependências encadeiam: painel -> pedidos -> produtos...)
  for (let mudou = true; mudou;) {
    mudou = false
    for (const k of Object.keys(r)) {
      const niveis = r[k] === 'mexer' ? ['ver', 'mexer'] : ['ver']
      for (const n of niveis) for (const d of DEPS[k + ':' + n] || []) {
        const [dk, dn] = d.split(':')
        const antes = r[dk]
        dar(dk, dn)
        if (r[dk] !== antes) mudou = true
      }
    }
  }
  return r
}

// Recusa (não ignora) chave ou valor desconhecido. null = sem acesso. Devolve { valor } ou { erro }.
export function validarPermissoes(perm) {
  if (perm === null) return { valor: null }
  if (typeof perm !== 'object' || Array.isArray(perm)) return { erro: 'Permissões inválidas.' }
  for (const k of Object.keys(perm)) {
    if (!AREAS.includes(k)) return { erro: 'Área desconhecida nas permissões: ' + k + '.' }
    const v = perm[k]
    if (v !== 'ver' && v !== 'mexer') return { erro: 'Nível inválido para ' + k + ': use ver ou mexer.' }
    if (SO_VER.includes(k) && v !== 'ver') return { erro: 'A área ' + k + ' só aceita ver.' }
  }
  return { valor: fechar(perm) }
}
