#!/usr/bin/env node
// PostToolUse hook: roda o self-check do index.html (sintaxe + asserções) depois de cada edição.
// Saída 2 + stderr = o Claude recebe a falha de volta e corrige.
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const filePath = (payload.tool_input || {}).file_path || '';
    if (!filePath) process.exit(0);
    const normalized = filePath.replace(/\\/g, '/');
    const molde = /(^|\/)(molde\/geo\.js|molde\/modelo\.js|molde\.html)$/.test(normalized);
    if (!(molde || normalized.endsWith('/index.html') || normalized === 'index.html')) process.exit(0);

    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [molde ? '.claude/scripts/selfcheck-molde.js' : '.claude/scripts/selfcheck.js'], { encoding: 'utf-8' });
    if (r.error) {
      console.error('self-check não rodou: ' + r.error.message);
      process.exit(0);
    }
    if (r.status !== 0) {
      console.error('Self-check ' + (molde ? 'do molde' : 'do index.html') + ' falhou:\n' + (r.stderr || '') + (r.stdout || ''));
      process.exit(2);
    }
    process.exit(0);
  } catch (e) {
    process.exit(0); // hook quebrado nunca deve travar a edição
  }
});
