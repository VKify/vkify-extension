// Build smoke test: asserts each per-browser bundle is complete and that its
// merged manifest has the correct browser-specific shape. Fast and deterministic
// (no browser needed) — catches build/manifest regressions in CI that the
// node-environment unit tests (which mock chrome.*) cannot.
//
// Run after `npm run build` (or build:all). Exits non-zero on the first failure.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = ['chrome', 'firefox', 'opera'];

// Chrome Web Store MV3 policy ("Blue Argon") rejects a bundle that references
// remotely hosted code — the 1.8.1 upload was taken down over a cdnjs URL buried
// in an unreachable jsPDF branch (see stripJsPdfRemoteCode in vite.config.ts).
// A regex can't tell a fetched script from a URL in a license header, so any URL
// that points at an executable resource fails the build unless it is listed here
// with a reason. Remote CSS, fonts and images are NOT remote code and are fine.
const REMOTE_CODE_RE = /https?:\/\/[^\s"'`<>()\\]+?\.(?:js|mjs|cjs|wasm)\b/gi;
const REMOTE_CODE_ALLOWLIST = new Map([
  // Attribution inside jsPDF's own /** @license */ headers, crediting where its
  // vendored md5 and PDF-encryption implementations came from. Never fetched.
  ['http://www.myersdaily.org/joseph/javascript/md5.js', 'jsPDF license header'],
  ['https://github.com/foliojs/pdfkit/blob/master/lib/security.js', 'jsPDF license header'],
]);

function collectShippedScripts(dir) {
  const files = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|html)$/.test(entry.name)) files.push(full);
    }
  };
  walk(dir);
  return files;
}

// Files every bundle must contain (relative to dist/<browser>).
const REQUIRED_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'site-bridge.js',
  'embed.js',
  'audio-encoder.js',
  'pdf-renderer.html',
  'pdf-renderer.js',
  // Рендерер PDF грузится лениво (см. src/pdf-renderer.ts): без этих чанков
  // страница стартует, но экспорт падает уже в рантайме.
  'pdf-render.js',
  'pdf-vendor-html2canvas.js',
  'pdf-vendor-jspdf.js',
  'index.html',
  'injected/spy-agent.js',
  'injected/feed-ad-blocker.js',
  'injected/vk-token-extractor.js',
  'injected/player-control.js',
];

const errors = [];
function check(cond, msg) {
  if (!cond) errors.push(msg);
}

for (const browser of BROWSERS) {
  const dir = resolve(root, 'dist', browser);
  const tag = `[${browser}]`;

  if (!existsSync(dir)) {
    errors.push(`${tag} dist/${browser} is missing — run \`npm run build\` first`);
    continue;
  }

  for (const f of REQUIRED_FILES) {
    check(existsSync(resolve(dir, f)), `${tag} missing file: ${f}`);
  }

  for (const file of collectShippedScripts(dir)) {
    const rel = relative(dir, file).split('\\').join('/');
    for (const url of readFileSync(file, 'utf-8').match(REMOTE_CODE_RE) ?? []) {
      check(REMOTE_CODE_ALLOWLIST.has(url),
        `${tag} remotely hosted code referenced in ${rel}: ${url}`);
    }
  }

  const manifestPath = resolve(dir, 'manifest.json');
  if (!existsSync(manifestPath)) continue;

  let m;
  try {
    m = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    errors.push(`${tag} manifest.json is not valid JSON: ${e.message}`);
    continue;
  }

  check(m.manifest_version === 3, `${tag} manifest_version must be 3`);
  check(m.name && m.version, `${tag} manifest must have name + version`);

  // No leaked override-note keys (underscore-prefixed) and no Chrome-only
  // command property that Firefox rejects.
  check(!Object.keys(m).some(k => k.startsWith('_')), `${tag} manifest leaks "_"-prefixed key(s)`);
  for (const [name, cmd] of Object.entries(m.commands ?? {})) {
    check(!('global' in cmd), `${tag} command "${name}" still has Chrome-only "global"`);
  }

  if (browser === 'firefox') {
    check(m.background?.scripts?.includes('background.js'),
      `${tag} Firefox background must use { scripts: ["background.js"] }`);
    check(!m.background?.service_worker,
      `${tag} Firefox background must NOT use service_worker`);
    check(m.browser_specific_settings?.gecko?.id,
      `${tag} Firefox manifest must declare browser_specific_settings.gecko.id`);
    check(!/base-uri/.test(m.content_security_policy?.extension_pages ?? ''),
      `${tag} Firefox CSP must not use base-uri (unsupported)`);
    check(!('minimum_chrome_version' in m),
      `${tag} Firefox manifest must not set minimum_chrome_version`);
    check(!m.permissions?.includes('offscreen'),
      `${tag} Firefox manifest must not request unsupported offscreen permission`);
  } else {
    check(m.background?.service_worker === 'background.js',
      `${tag} ${browser} background must use service_worker`);
    check(!m.background?.scripts,
      `${tag} ${browser} background must NOT use scripts`);
    check(m.permissions?.includes('offscreen'),
      `${tag} ${browser} manifest must allow isolated PDF rendering via offscreen`);
  }

  if (browser === 'chrome') {
    check('minimum_chrome_version' in m, `${tag} Chrome manifest should set minimum_chrome_version`);
  }
}

if (errors.length > 0) {
  console.error('\n❌ Build verification FAILED:\n');
  for (const e of errors) console.error('  • ' + e);
  console.error('');
  process.exit(1);
}

console.log(`✅ Build verified: ${BROWSERS.join(', ')} — structure + manifest shape OK`);
