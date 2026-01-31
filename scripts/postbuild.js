import { copyFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

// Копируем manifest.json
copyFileSync(
  join(rootDir, 'manifest.json'),
  join(distDir, 'manifest.json')
);
console.log('✓ manifest.json copied');

// Копируем background.js
const bgSrc = join(rootDir, 'src', 'background', 'background.js');
if (existsSync(bgSrc)) {
  copyFileSync(bgSrc, join(distDir, 'background.js'));
  console.log('✓ background.js copied');
}

console.log('✓ Build completed!');