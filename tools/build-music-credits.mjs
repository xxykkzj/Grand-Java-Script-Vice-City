#!/usr/bin/env node
// Writes the "Music credits" section of README.md from assets/music/manifest.json (between the
// <!-- music-credits --> markers). build.mjs runs it on every build; it only writes when something changed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = '<!-- music-credits:start -->', B = '<!-- music-credits:end -->';
const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function musicCredits() {
  let tracks = [];
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'assets/music/manifest.json'), 'utf8'));
    tracks = Array.isArray(j) ? j : j.tracks || [];
  } catch (e) { tracks = []; }
  if (!tracks.length) return '_No recorded tracks yet: `assets/music/manifest.json` is empty, so the lounge plays the game\'s synthesised music. See [assets/music/README.md](assets/music/README.md) to add some._';
  return ['| Title | Artist | Licence | Genre | Source |', '| --- | --- | --- | --- | --- |',
    ...tracks.map((t) => `| ${cell(t.title)} | ${cell(t.artist)} | ${cell(t.licence)} | ${cell(t.genre)} | ${t.source ? `[link](${cell(t.source)})` : ''} |`)].join('\n');
}

export function writeMusicCredits() {
  const f = path.join(root, 'README.md'), md = fs.readFileSync(f, 'utf8');
  const i = md.indexOf(A), j = md.indexOf(B);
  if (i < 0 || j < i) return false;
  const next = md.slice(0, i + A.length) + '\n' + musicCredits() + '\n' + md.slice(j);
  if (next !== md) fs.writeFileSync(f, next);
  return next !== md;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) console.log(writeMusicCredits() ? 'README music credits updated' : 'README music credits unchanged');
