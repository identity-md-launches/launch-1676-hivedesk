import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const candidates = [...new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))].sort();
const changed = git('diff', '--name-only', 'HEAD', '-z').split('\0').filter(Boolean);
const protectedPaths = ['foundry.toml', 'foundry.lock', 'remappings.txt', '.gitmodules', 'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.gitignore'];
assert.ok(changed.every((path) => !protectedPaths.includes(path) && !path.startsWith('lib/') && !path.startsWith('.github/') && !path.startsWith('.git/')), 'Protected tracked file changed');
assert.ok(candidates.every((path) => !/(^|\/)(node_modules|\.cache|\.npm|\.env(?:\.[^/]*)?)(\/|$)/.test(path)), 'Generated dependency/cache or environment file in submission');
assert.ok(candidates.every((path) => !/\.(tgz|tar|zip)$/.test(path)), 'Unnecessary dependency archive in submission');
assert.ok(!git('ls-files', '--stage').split('\n').some((line) => line.startsWith('160000 ')), 'Git submodule found');
for (const path of candidates) assert.ok(!(await lstat(join(repo, path))).isSymbolicLink(), `Symlink in submission: ${path}`);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
async function filesIn(dir) {
  const result = [];
  for (const entry of await readdir(join(repo, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await filesIn(path));
    else result.push(path);
  }
  return result.sort();
}

const html = await readFile(join(repo, 'dist/index.html'), 'utf8');
assert.match(html, /<title>HiveDesk \| Token dashboard<\/title>/);
for (const property of ['description', 'og:title', 'og:image']) assert.ok(html.includes(`"${property}"`), `Missing metadata: ${property}`);
for (const [, local] of html.matchAll(/(?:src|href)="(\.[^"]+)"/g)) {
  assert.ok((await lstat(join(repo, 'dist', local))).isFile(), `Missing static asset: ${local}`);
}
assert.ok(!/(?:src|href)="\/(?!\/)/.test(html), 'Root-relative asset in exported HTML');
const share = await readFile(join(repo, 'dist/share.png'));
assert.equal(share.readUInt32BE(16), 1200);
assert.equal(share.readUInt32BE(20), 630);

const exportFiles = [];
for (const path of await filesIn('dist')) {
  assert.ok(candidates.includes(path), `Export is excluded from Git: ${path}`);
  const data = await readFile(join(repo, path));
  exportFiles.push({ path, bytes: data.length, sha256: sha256(data) });
}
const sourceHash = createHash('sha256');
for (const path of [...await filesIn('web/src'), ...await filesIn('web/config'), ...await filesIn('web/public'), 'web/index.html', 'web/vite.config.ts'].sort()) {
  sourceHash.update(path).update('\0').update(await readFile(join(repo, path))).update('\0');
}
const auditPath = 'web/validation/submission-audit.json';
let candidateBytesExcludingAudit = 0;
for (const path of candidates.filter((path) => path !== auditPath)) candidateBytesExcludingAudit += (await lstat(join(repo, path))).size;
const historicalPackKiB = Number(git('count-objects', '-v').match(/^size-pack: (\d+)$/m)?.[1] || 0);
const overheadAllowanceBytes = 1024 * 1024;
const conservativeBudgetBytes = candidateBytesExcludingAudit + historicalPackKiB * 1024 + overheadAllowanceBytes;
const budgetBytes = 8388608;
assert.ok(conservativeBudgetBytes < budgetBytes, 'Submission exceeds its conservative byte budget');

const report = {
  passed: true,
  budgetBytes,
  candidateFileCountExcludingAudit: candidates.filter((path) => path !== auditPath).length,
  candidateBytesExcludingAudit,
  historicalPackKiB,
  overheadAllowanceBytes,
  conservativeBudgetBytes,
  budgetBasis: 'All candidate file payloads plus existing Git pack size and 1 MiB for Git/audit overhead. No Git index or commit was changed.',
  protectedTrackedFiles: 'unchanged',
  dependencyCaches: 'absent from candidate files',
  submodulesAndSymlinks: 'none',
  ignoreFiles: 'unchanged',
  applicationSourceSha256: sourceHash.digest('hex'),
  exportBytes: exportFiles.reduce((total, file) => total + file.bytes, 0),
  exportFiles,
};
for (const path of ['artifacts/submission-audit.json', auditPath]) {
  await mkdir(dirname(join(repo, path)), { recursive: true });
  await writeFile(join(repo, path), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ passed: report.passed, exportBytes: report.exportBytes, candidateBytesExcludingAudit, conservativeBudgetBytes, budgetBytes }, null, 2));
