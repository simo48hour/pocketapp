import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const source = resolve('scripts/prebuilt');
const output = resolve('public/prebuilt');

// Skip re-packaging if package-lock hasn't changed
if (
  existsSync(join(output, 'dependencies.bin')) &&
  existsSync(join(output, 'manifest.json')) &&
  existsSync(join(output, 'package-lock.json')) &&
  existsSync(join(source, 'package-lock.json'))
) {
  const existingLock = readFileSync(join(output, 'package-lock.json'));
  const currentLock = readFileSync(join(source, 'package-lock.json'));
  if (existingLock.equals(currentLock)) {
    console.log('⚡ Prebuilt dependencies archive is up to date, skipping packaging.');
    process.exit(0);
  }
}

const temporary = mkdtempSync(join(tmpdir(), 'pocketapp-dependencies-'));
try {
  mkdirSync(output, { recursive: true });
  cpSync(join(source, 'package.json'), join(temporary, 'package.json'));
  cpSync(join(source, 'package-lock.json'), join(temporary, 'package-lock.json'));
  execFileSync('npm', ['ci', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund'], {
    cwd: temporary, stdio: 'inherit',
  });
  // Preserve .bin symlinks: CLI entry points resolve imports relative to their real package.
  // The locked esbuild and Rollup overrides use portable WASM, not host binaries.
  execFileSync('tar', ['--format=ustar', '-czf', join(output, 'node_modules.tar.gz'), 'node_modules'], {
    cwd: temporary, stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  const archive = readFileSync(join(output, 'node_modules.tar.gz'));
  // Vite's static server treats .gz as HTTP Content-Encoding and browsers decode it.
  // A neutral suffix preserves the exact compressed bytes used by the checksum.
  writeFileSync(join(output, 'dependencies.bin'), archive);
  const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  const manifest = {
    format: 1, sha256: createHash('sha256').update(archive).digest('hex'), bytes: archive.length,
    dependencies: { ...pkg.dependencies, ...pkg.devDependencies }, overrides: pkg.overrides,
  };
  writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  cpSync(join(source, 'package-lock.json'), join(output, 'package-lock.json'));
  console.log(`Prepared ${Math.round(archive.length / 1024 / 1024)} MB dependency archive`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
