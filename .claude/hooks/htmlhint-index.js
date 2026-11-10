#!/usr/bin/env node
// PostToolUse hook: roda htmlhint apenas se o arquivo editado for index.html
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const toolInput = payload.tool_input || {};
    const filePath = toolInput.file_path || '';
    if (!filePath) process.exit(0);
    const normalized = filePath.replace(/\\/g, '/');
    const isIndexHtml = normalized.endsWith('/index.html') || normalized === 'index.html';
    if (!isIndexHtml) process.exit(0);
    // Roda htmlhint
    const { spawnSync } = require('child_process');
    const result = spawnSync('npx', ['htmlhint', 'index.html'], { encoding: 'utf-8' });
    if (result.error) {
      console.error('htmlhint não disponível:', result.error.message);
      process.exit(0);
    }
    if (result.stderr && result.stderr.length > 0) {
      console.error(result.stderr);
    }
    // Não bloqueia, apenas informa
    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});
