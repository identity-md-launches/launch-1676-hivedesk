// Keep dependency installation and all package-manager caches outside the repository.
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(source, '..');
const id = createHash('sha256').update(repo).digest('hex').slice(0, 12);
const work = join(tmpdir(), `hivedesk-frontend-${id}`);
const stage = join(work, 'web');
const command = process.argv[2];
const commands = ['install', 'typecheck', 'build', 'preview', 'dev', 'check:live', 'check:ui', 'browsers'];
if (!commands.includes(command)) {
  console.error(`Usage: node web/scripts/site.mjs ${commands.join('|')}`);
  process.exit(1);
}

async function run(args) {
  const child = spawn('npm', args, {
    cwd: stage, stdio: 'inherit',
    env: { ...process.env, npm_config_cache: join(work, 'npm-cache'), PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || join(work, 'browsers'), HIVEDESK_DIST: join(repo, 'dist'), HIVEDESK_REPORT: join(repo, 'artifacts') },
  });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  if (code !== 0) process.exit(typeof code === 'number' ? code : 1);
}

await mkdir(stage, { recursive: true });
for (const name of ['src', 'config', 'public', 'scripts', 'design', 'package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts']) {
  const target = join(stage, name);
  await rm(target, { recursive: true, force: true });
  await cp(join(source, name), target, { recursive: true });
}
console.log(`Frontend workspace: ${work}`);
if (command === 'install') {
  await run(['ci', '--no-audit', '--no-fund']);
  await cp(join(source, 'package-lock.json'), join(work, 'installed-lock.json'));
} else {
  const installed = await readFile(join(work, 'installed-lock.json')).catch(() => null);
  const current = await readFile(join(source, 'package-lock.json'));
  if (!installed?.equals(current)) throw new Error('Run node web/scripts/site.mjs install first (lockfile changed or dependencies missing).');
  if (command === 'preview') {
    if (!(await stat(join(repo, 'dist', 'index.html')).catch(() => null))) throw new Error('No dist/index.html. Run the build command first.');
    await rm(join(work, 'dist'), { recursive: true, force: true });
    await cp(join(repo, 'dist'), join(work, 'dist'), { recursive: true });
  }
  await run(['run', command]);
  if (command === 'build') {
    const built = join(work, 'dist');
    if (!(await stat(join(built, 'index.html'))).isFile()) throw new Error('Build did not produce index.html.');
    await rm(join(repo, 'dist'), { recursive: true, force: true });
    await cp(built, join(repo, 'dist'), { recursive: true });
    console.log('Production export written to dist/.');
  }
}
