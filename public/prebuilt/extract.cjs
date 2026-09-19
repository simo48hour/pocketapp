// Portable ustar extractor: WebContainer supports Node, but may not provide tar.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const data = zlib.gunzipSync(fs.readFileSync('.pocketapp-dependencies.tar.gz'));
const root = path.resolve('.');
const text = (offset, length) => data.subarray(offset, offset + length).toString().split('\0')[0];
for (let offset = 0; offset + 512 <= data.length;) {
  const name = text(offset, 100);
  if (!name) break;
  const prefix = text(offset + 345, 155);
  const relative = prefix ? `${prefix}/${name}` : name;
  const destination = path.resolve(root, relative);
  if (!destination.startsWith(path.join(root, 'node_modules') + '/') && destination !== path.join(root, 'node_modules')) {
    throw new Error('Unsafe archive path');
  }
  const size = parseInt(text(offset + 124, 12).trim(), 8) || 0;
  const mode = parseInt(text(offset + 100, 8).trim(), 8) || 0o644;
  const type = text(offset + 156, 1);
  if (type === '5') fs.mkdirSync(destination, { recursive: true });
  else if (type === '0' || type === '') {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data.subarray(offset + 512, offset + 512 + size), { mode });
  } else if (type === '2') {
    const target = text(offset + 157, 100);
    const resolved = path.resolve(path.dirname(destination), target);
    if (!resolved.startsWith(path.join(root, 'node_modules') + '/')) throw new Error('Unsafe symlink');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(target, destination);
  } else throw new Error(`Unsupported archive entry ${type}`);
  offset += 512 + Math.ceil(size / 512) * 512;
}
require('./node_modules/esbuild').transformSync('const x: number = 1', { loader: 'ts' });
require('./node_modules/rollup');
fs.unlinkSync('.pocketapp-dependencies.tar.gz');
