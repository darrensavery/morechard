/**
 * Concatenates docs/support/*.md into the KV playbook bundle the support
 * agent reads at runtime (Workers have no filesystem access to the repo).
 *
 * Phase 0/1: run this manually after any docs/support/ edit.
 * Phase 2+: automated via CI per the design spec's rollout table.
 *
 * Usage:
 *   node scripts/sync-playbook.mjs           # dev (CACHE KV namespace)
 *   node scripts/sync-playbook.mjs --env production
 */
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isProd = process.argv.includes('--env') && process.argv[process.argv.indexOf('--env') + 1] === 'production';
const supportDocsDir = join(process.cwd(), '..', 'docs', 'support');

const files = readdirSync(supportDocsDir)
  .filter(f => f.endsWith('.md'))
  .sort(); // README.md sorts first — matches the intended reading order

let bundle = '';
for (const file of files) {
  const content = readFileSync(join(supportDocsDir, file), 'utf-8');
  bundle += content + '\n\n';
}

const hash = createHash('sha256').update(bundle, 'utf-8').digest('hex');

const tmpDir = mkdtempSync(join(tmpdir(), 'playbook-'));
const bundlePath = join(tmpDir, 'bundle.md');
writeFileSync(bundlePath, bundle, 'utf-8');

const envFlag = isProd ? '--env production' : '';

// Helper to escape double quotes in shell strings
function escapeShellArg(arg) {
  return `"${arg.replace(/"/g, '\\"')}"`;
}

// Helper to run wrangler with proper shell escaping
function runWrangler(...args) {
  const escapedArgs = args.map(arg => {
    // Quote arguments that contain spaces or special characters
    if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
      return escapeShellArg(arg);
    }
    return arg;
  });
  const cmd = `npx wrangler ${escapedArgs.join(' ')} ${envFlag}`.trim();
  execSync(cmd, { stdio: 'inherit', shell: true });
}

runWrangler('kv', 'key', 'put', '--binding=CACHE', 'agent:playbook:bundle', '--path', bundlePath);
runWrangler('kv', 'key', 'put', '--binding=CACHE', 'agent:playbook:hash', hash);

const dbName = isProd ? 'morechard' : 'morechard-dev';
const now = Math.floor(Date.now() / 1000);
for (const file of files) {
  const fileContent = readFileSync(join(supportDocsDir, file), 'utf-8');
  const fileHash = createHash('sha256').update(fileContent, 'utf-8').digest('hex');
  const docPath = `docs/support/${file}`;
  const sqlStatement = `INSERT INTO playbook_sync (doc_path, content_hash, last_synced_at) VALUES ('${docPath}', '${fileHash}', ${now}) ON CONFLICT(doc_path) DO UPDATE SET content_hash = excluded.content_hash, last_synced_at = excluded.last_synced_at;`;
  runWrangler('d1', 'execute', dbName, '--remote', '--command', sqlStatement);
}

console.log(`Playbook synced: ${files.length} files, bundle hash ${hash.slice(0, 12)}...`);
