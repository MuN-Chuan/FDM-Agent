import { cp, rename, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, '..');
const distDir = path.join(frontendDir, 'dist');
const developerDistDir = path.join(frontendDir, 'dist-developer');

async function ensureBuildExists() {
  await stat(path.join(distDir, 'developer.html'));
}

async function main() {
  await ensureBuildExists();
  await rm(developerDistDir, { recursive: true, force: true });
  await cp(distDir, developerDistDir, { recursive: true });

  const developerHtml = path.join(developerDistDir, 'developer.html');
  const mainHtml = path.join(developerDistDir, 'index.html');

  await unlink(mainHtml).catch(() => {});
  await rename(developerHtml, mainHtml);
}

main().catch((error) => {
  console.error('Failed to build standalone developer site:', error);
  process.exitCode = 1;
});
