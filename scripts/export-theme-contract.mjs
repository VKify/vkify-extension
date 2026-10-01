import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Refresh the website's portable contract after changing appearance settings.
// Usage: node scripts/export-theme-contract.mjs ../frontend/src/data/theme-contract.json
const output = process.argv[2];
if (!output) throw new Error('Pass the destination theme-contract.json path');
const bundled = await build({
  stdin: {
    contents: `export { THEME_KEYS, appearanceDefault } from './src/shared/constants/appearance.ts';
      export { SETTINGS_SCHEMA } from './src/shared/constants/settings-schema.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { THEME_KEYS, appearanceDefault, SETTINGS_SCHEMA } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);
const contract = {
  keys: THEME_KEYS,
  defaults: Object.fromEntries(THEME_KEYS.map(key => [key, appearanceDefault(key)])),
  aliases: Object.fromEntries(THEME_KEYS.filter(key => SETTINGS_SCHEMA[key].short).map(key => [key, SETTINGS_SCHEMA[key].short])),
};
await writeFile(resolve(output), JSON.stringify(contract, null, 2) + '\n');
