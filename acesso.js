// Permissões por checklist (lógica pura). Perfil = { role, is_principal, permissoes }.
// DEPS é copiado igual na Edge Function gerenciar-administradores: manter as duas tabelas idênticas.
(function (g) {
  const AREAS = [
    { k: 'painel', nome: 'Painel' }, { k: 'produtos', nome: 'Produtos' }, { k: 'materia', nome: 'Matéria-prima' },
    { k: 'pedidos', nome: 'Pedidos' }, { k: 'fabricar', nome: 'A fabricar', soVer: true },
    { k: 'moldes', nome: 'Moldes e ordens de corte' }, { k: 'reps', nome: 'Representantes' },
    { k: 'cadastros', nome: 'Cadastros (lojas)' }, { k: 'estoque', nome: 'Estoque' }, { k: 'config', nome: 'Configurações' },
  ];
  // "área:nível" exigido => lista de "área:nível" que passam a ser exigidas
  const DEPS = {
    'produtos:ver': ['materia:ver', 'config:ver'], // custo e margem leem matéria-prima e a ficha padrão (config)
    'produtos:mexer': ['moldes:mexer'],
    'moldes:ver': ['produtos:ver', 'materia:ver'],
    'pedidos:ver': ['produtos:ver', 'cadastros:ver', 'reps:ver'],
    'painel:ver': ['pedidos:ver', 'produtos:ver'],
    'fabricar:ver': ['pedidos:ver', 'produtos:ver'],
    'estoque:ver': ['produtos:ver'],
    'cadastros:mexer': ['pedidos:mexer', 'reps:ver'], // ativar acesso de representante dá acesso aos pedidos dele
  };
  const ABA_AREA = { painel: 'painel', produtos: 'produtos', materia: 'materia', pedidos: 'pedidos', fabricar: 'fabricar', molde: 'moldes', corte: 'moldes', reps: 'reps', cadastros: 'cadastros', estoque: 'estoque' };

  function fechar(perm) {
    const soVer = new Set(AREAS.filter(a => a.soVer).map(a => a.k));
    const ok = new Set(AREAS.map(a => a.k));
    const r = {};
    const dar = (k, n) => { if (ok.has(k) && (n === 'ver' || n === 'mexer') && r[k] !== 'mexer') r[k] = soVer.has(k) ? 'ver' : n; };
    for (const k of Object.keys(perm || {})) dar(k, perm[k]);
    // repete até não mudar (as dependências encadeiam: painel -> pedidos -> produtos...)
    for (let mudou = true; mudou;) {
      mudou = false;
      for (const k of Object.keys(r)) {
        const niveis = r[k] === 'mexer' ? ['ver', 'mexer'] : ['ver'];
        for (const n of niveis) for (const d of DEPS[k + ':' + n] || []) {
          const [dk, dn] = d.split(':');
          const antes = r[dk];
          dar(dk, dn);
          if (r[dk] !== antes) mudou = true;
        }
      }
    }
    return r;
  }

  function pode(perfil, area, acao) {
    if (!perfil || perfil.role !== 'admin' || (acao !== 'ver' && acao !== 'mexer')) return false;
    if (perfil.is_principal) return true;
    const n = (perfil.permissoes || {})[area];
    return n === 'mexer' || (n === 'ver' && acao === 'ver');
  }

  const Acesso = { AREAS, DEPS, ABA_AREA, fechar, pode };
  g.Acesso = Acesso;
  if (typeof module !== 'undefined') module.exports = Acesso;
})(typeof window !== 'undefined' ? window : globalThis);
