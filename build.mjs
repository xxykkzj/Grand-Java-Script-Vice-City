// Bundles src/main.js with esbuild and inlines it into src/index.html,
// producing ONE self-contained file: dist/index.html
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeModels } from './tools/bake-models.mjs';
import { writeMusicCredits } from './tools/build-music-credits.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = '/*%%BUNDLE%%*/';
const watch = process.argv.includes('--watch');

function emit(result) {
  if (!result.outputFiles || !result.outputFiles.length) return;
  const tpl = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  if (!tpl.includes(PLACEHOLDER)) throw new Error('placeholder missing in src/index.html');
  const js = result.outputFiles[0].text
    .replace(/<\/script/gi, '<\\/script')
    .replace(/<!--/g, '<\\!--');
  const html = tpl.replace(PLACEHOLDER, () => js);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/index.html'), html);

  let three = 0, game = 0, models = 0;
  const out = Object.values(result.metafile.outputs)[0];
  for (const [file, info] of Object.entries(out.inputs)) {
    if (file.includes('node_modules/three')) three += info.bytesInOutput;
    else if (file.startsWith('kits:')) models += info.bytesInOutput;
    else game += info.bytesInOutput;
  }
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(
    `dist/index.html  ${kb(Buffer.byteLength(html))}  ` +
    `(three.js ${kb(three)} | game code ${kb(game)} | models ${kb(models)} | html+css ${kb(Buffer.byteLength(tpl))})`
  );
}

// The licensed models the game uses (assets/packed, see assets/CREDITS.md), baked into one compact
// binary blob and embedded as `import blob from 'kits:models'` (src/world/kits.js decodes it).
const kitsPlugin = {
  name: 'kits',
  setup(b) {
    b.onResolve({ filter: /^kits:models$/ }, () => ({ path: 'models', namespace: 'kits' }));
    b.onLoad({ filter: /.*/, namespace: 'kits' }, () => ({ contents: bakeModels(), loader: 'binary' }));
  },
};

const options = {
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: !watch && !process.argv.includes('--debug'),
  format: 'iife',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  write: false,
  metafile: true,
  logLevel: 'info',
  define: { __DEV__: watch ? 'true' : 'false' },
  plugins: [kitsPlugin],
};

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [kitsPlugin, {
      name: 'inline-html',
      setup(b) { b.onEnd((r) => { if (!r.errors.length) emit(r); }); },
    }],
  });
  await ctx.watch();
  fs.watch(path.join(root, 'src/index.html'), () => ctx.rebuild().catch(() => {}));
  console.log('watching src/ — open dist/index.html and refresh after each rebuild');
} else {
  emit(await esbuild.build(options));
  if (writeMusicCredits()) console.log('README: music credits updated from assets/music/manifest.json');
}
