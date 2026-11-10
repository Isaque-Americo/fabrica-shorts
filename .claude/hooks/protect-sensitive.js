#!/usr/bin/env node
// PreToolUse hook: bloqueia Edit/Write/MultiEdit em caminhos sensíveis
// Saída 2 + stderr = bloqueio do Claude Code

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input);
    const tool = payload.tool_name;
    const toolInput = payload.tool_input || {};

    // PreToolUse para Edit/Write/MultiEdit
    if (!['Edit', 'Write', 'MultiEdit'].includes(tool)) return;

    const filePath = toolInput.file_path || toolInput.path || '';
    if (!filePath) return;

    const normalized = filePath.replace(/\\/g, '/');

    const forbiddenPatterns = [
      /^\.env[^./]|^\.env$/ ,                 // .env, .env.local etc, não .env.example
      /\/\.env[^./]|\/\.env$/ ,               // /something/.env
      /\.env[^./]\./ ,                        // .env.*
      /\/supabase\/\.temp\// ,   // supabase/.temp/
      /\/supabase\/\.branches\// // supabase/.branches/
    ];

    // Allowlist para arquivos de exemplo
    const allowlistPatterns = [
      /\.env\.example$/i,
      /\.env\.sample$/i
    ];
    for (const re of allowlistPatterns) {
      if (re.test(normalized)) return;
    }

    for (const re of forbiddenPatterns) {
      if (re.test(normalized)) {
        console.error(`Bloqueado por política de segurança: edição proibida em ${filePath}`);
        process.exit(2);
      }
    }
  } catch (e) {
    // Em caso de erro de parsing, não bloqueia
    process.exit(0);
  }
});
