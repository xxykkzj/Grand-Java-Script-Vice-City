#!/usr/bin/env node
// Bundles tools/figure-lab/main.js (with three.js and src/actors/figure.js) and inlines it into
// tools/figure-lab/template.html, producing ONE self-contained page: dist/figure-lab.html
//   node tools/figure-lab/build.mjs            (minified)
//   node tools/figure-lab/build.mjs --dev      (readable, for debugging)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const require = createRequire(path.join(root, 'package.json'));
const esbuild = require('esbuild');
const dev = process.argv.includes('--dev');

const result = await esbuild.build({
  entryPoints: [path.join(here, 'main.js')],
  bundle: true, minify: !dev, format: 'iife', target: 'es2020', charset: 'utf8', legalComments: 'none', write: false,
  nodePaths: [path.join(root, 'node_modules')], logLevel: 'warning', metafile: true,
  define: { __DEV__: dev ? 'true' : 'false' },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const tpl = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
if (!tpl.includes('/*%%LAB%%*/')) throw new Error('placeholder missing in template.html');
const html = tpl.replace('/*%%LAB%%*/', () => js);
const out = path.join(root, 'dist', 'figure-lab.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
let three = 0, own = 0;
for (const [file, info] of Object.entries(Object.values(result.metafile.outputs)[0].inputs)) (file.includes('node_modules/three') ? (three += info.bytesInOutput) : (own += info.bytesInOutput));
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`dist/figure-lab.html  ${kb(Buffer.byteLength(html))}  (three.js ${kb(three)} | lab + figures ${kb(own)})`);
