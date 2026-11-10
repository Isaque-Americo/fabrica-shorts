#!/usr/bin/env node
// PostToolUse hook: `deno check` nas Edge Functions editadas (supabase/functions/**/*.ts).
// Sem deno instalado, avisa uma vez e sai limpo.
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const filePath = (payload.tool_input || {}).file_path || '';
    if (!filePath) process.exit(0);
    const normalized = filePath.replace(/\\/g, '/');
    if (!/(^|\/)supabase\/functions\/.+\.ts$/.test(normalized)) process.exit(0);

    const { spawnSync } = require('child_process');
    const sh = process.platform === 'win32';
    // sem deno, o cmd.exe responde "não é reconhecido" com status 1; checa a existência antes para não confundir com reprovação
    const v = spawnSync('deno', ['--version'], { encoding: 'utf-8', shell: sh });
    if (v.error || v.status !== 0) {
      console.error('deno não encontrado: as Edge Functions não foram verificadas. Instale em https://deno.com para ligar esta checagem.');
      process.exit(0);
    }
    const r = spawnSync('deno', ['check', normalized], { encoding: 'utf-8', shell: sh });
    if (r.error || r.status === null) {
      console.error('deno check não rodou: ' + ((r.error && r.error.message) || 'sem status'));
      process.exit(0);
    }
    if (r.status !== 0) {
      console.error('deno check reprovou ' + normalized + ':\n' + (r.stderr || r.stdout || ''));
      process.exit(2);
    }
    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});
