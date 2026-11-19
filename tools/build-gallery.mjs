#!/usr/bin/env node
// Bundles tools/gallery-src/main.js with esbuild and inlines it into assets/gallery/index.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'package.json'));
const esbuild = require('esbuild');

const result = await esbuild.build({
  entryPoints: [path.join(here, 'gallery-src', 'main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  nodePaths: [path.join(root, 'node_modules')], logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(here, 'gallery-src', 'template.html'), 'utf8');
const html = tpl.replace('<script>/*__BUNDLE__*/</script>', () => '<script>' + js + '</script>');
const out = path.join(root, 'assets', 'gallery', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`gallery: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
