// One command for the public site's refresh (Stage 2 spec §6):
// ingest -> SATCAT -> screen -> bake -> build -> copy -> upload.
//   npm run site:refresh               full refresh and upload (Fenil's machine)
//   npm run site:refresh -- --no-upload   everything except the upload
// Stops at the first failing step. The upload runs under the Vercel account
// that `npx vercel login` signed in, into the project `npx vercel link` set.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const upload = !process.argv.includes('--no-upload');

function run(cmd, env = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
}
const worker = (task) => run(`docker compose run --rm worker uv run python -m app.workers.tasks.${task} --once`);

worker('ingest_spacetrack_gp');
worker('ingest_satcat');
worker('screen_conjunctions');
worker('bake_site');
run('npm run build:packages');
run('npm run build:frontend', { VITE_DATA_MODE: 'static' });

const siteData = join(root, 'data', 'site');
const distData = join(root, 'frontend', 'dist', 'data');
rmSync(distData, { recursive: true, force: true });
cpSync(siteData, distData, { recursive: true });
console.log(`\nCopied ${siteData} -> ${distData}`);

if (!upload) {
  console.log('Built frontend/dist with the baked data; not uploaded (--no-upload).');
} else {
  const link = join(root, '.vercel', 'project.json');
  if (!existsSync(link)) {
    throw new Error('No Vercel project linked: run `npx vercel link --project orcas-simulation` once at the repo root.');
  }
  const { orgId, projectId } = JSON.parse(readFileSync(link, 'utf8'));
  run('npx vercel deploy frontend/dist --prod --yes', { VERCEL_ORG_ID: orgId, VERCEL_PROJECT_ID: projectId });
}
