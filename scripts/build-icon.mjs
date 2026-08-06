import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(projectRoot, 'assets', 'app-icon.svg');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const input = await readFile(source);
const outputs = [];

for (const size of sizes) {
  const output = path.join(projectRoot, 'assets', `icon-${size}.png`);
  await sharp(input).resize(size, size, { fit: 'fill' }).png().toFile(output);
  outputs.push(output);
}

const ico = await pngToIco(outputs);
await writeFile(path.join(projectRoot, 'assets', 'app.ico'), ico);
