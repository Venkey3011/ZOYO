const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const matches = Array.from(content.matchAll(/supabase\.from\(['"](\w+)['"]\)/g), m => m[1]);
console.log('Tables in server.ts:', Array.from(new Set(matches)));

const srcMatches = [];
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = dir + '/' + e.name;
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') {
      scanDir(full);
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      const c = fs.readFileSync(full, 'utf8');
      const m = Array.from(c.matchAll(/supabase\.from\(['"](\w+)['"]\)/g), x => x[1]);
      srcMatches.push(...m);
    }
  }
}
scanDir('src');
console.log('Tables in src/:', Array.from(new Set(srcMatches)));
