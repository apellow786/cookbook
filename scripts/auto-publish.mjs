import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const source = process.env.COOKBOOK_SOURCE || '/Users/alexanderpellow/myvault/Cookbook/Recipes';
const state = path.join(root, '.auto-publish');
const checkout = path.join(state, 'checkout');
const git = '/usr/bin/git';
const npm = path.join(path.dirname(process.execPath), 'npm');
const env = { ...process.env, COOKBOOK_SOURCE: source, GIT_TERMINAL_PROMPT: '0',
  PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
  GIT_AUTHOR_NAME: 'Cookbook Auto Publish', GIT_AUTHOR_EMAIL: 'apellow786@users.noreply.github.com',
  GIT_COMMITTER_NAME: 'Cookbook Auto Publish', GIT_COMMITTER_EMAIL: 'apellow786@users.noreply.github.com' };
const log = (message) => console.log(`${new Date().toISOString()} ${message}`);
const run = (command, args, cwd = checkout) => execFileSync(command, args, {
  cwd, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024,
});

export function fingerprint(directory) {
  const hash = crypto.createHash('sha256');
  function visit(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && /\.(md|json|jpe?g|png|webp|avif)$/i.test(entry.name)) {
        hash.update(path.relative(directory, file));
        hash.update('\0');
        hash.update(fs.readFileSync(file));
        hash.update('\0');
      }
    }
  }
  visit(directory);
  return hash.digest('hex');
}

function publish(expected) {
  // Missing vault folders can indicate that a sync or mount is incomplete.
  for (const folder of ['Appetizers', 'Breakfast & Breads', 'Desserts', 'Main Dishes',
    'Salads & Dressings', 'Sauces & Seasonings', 'Side Dishes', 'Soups & Stews', 'Cooking Tips', 'Assets']) {
    if (!fs.statSync(path.join(source, folder)).isDirectory()) throw new Error(`Missing source folder: ${folder}`);
  }
  if (!fs.existsSync(checkout)) {
    const remote = run(git, ['remote', 'get-url', 'origin'], root).trim();
    run(git, ['clone', '--single-branch', '--branch', 'main', remote, checkout], root);
  }
  // Only this private, disposable checkout is reset. The working project is untouched.
  run(git, ['fetch', 'origin', 'main']);
  run(git, ['reset', '--hard', 'origin/main']);
  const lockHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(checkout, 'package-lock.json'))).digest('hex');
  const lockFile = path.join(state, 'installed-lock');
  if (!fs.existsSync(path.join(checkout, 'node_modules')) || !fs.existsSync(lockFile) || fs.readFileSync(lockFile, 'utf8') !== lockHash) {
    log(run(npm, ['ci', '--no-audit', '--no-fund']));
    fs.writeFileSync(lockFile, lockHash);
  }
  const dataFile = path.join(checkout, 'src/data/site-content.json');
  const previous = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  log(run(npm, ['run', 'sync']));
  const next = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  next.generatedAt = previous.generatedAt;
  fs.writeFileSync(dataFile, JSON.stringify(next, null, 2) + '\n');
  log(run(npm, ['run', 'build']));
  if (fingerprint(source) !== expected) throw new Error('Recipes changed during build; waiting for a stable save.');
  run(git, ['add', '--', 'src/data/site-content.json', 'public/images/recipes', 'CONTENT_REVIEW.md']);
  if (run(git, ['diff', '--cached', '--name-only']).trim()) {
    run(git, ['commit', '-m', 'Automatically publish Obsidian recipe changes']);
    // A concurrent remote update rejects this push; the next attempt rebuilds on latest main.
    log(run(git, ['push', 'origin', 'HEAD:main']));
    log('Recipe update pushed. GitHub Pages will build and deploy it.');
  } else log('Website content already matches Obsidian.');
  fs.writeFileSync(path.join(state, 'published-fingerprint'), expected);
}

async function main() {
  fs.mkdirSync(state, { recursive: true });
  const once = process.argv.includes('--once');
  let observed;
  let stableSince = Date.now();
  let nextAttempt = 0;
  log(`Watching ${source}`);
  do {
    try {
      const current = fingerprint(source);
      if (current !== observed) { observed = current; stableSince = Date.now(); }
      const saved = path.join(state, 'published-fingerprint');
      const published = fs.existsSync(saved) ? fs.readFileSync(saved, 'utf8') : '';
      if (current !== published && (once || (Date.now() - stableSince >= 30_000 && Date.now() >= nextAttempt))) {
        log('Importing and checking saved recipe changes.');
        publish(current);
      }
    } catch (error) {
      log(`Publish failed: ${error.message}`);
      nextAttempt = Date.now() + 60_000;
      if (once) process.exitCode = 1;
    }
    if (!once) await new Promise((resolve) => setTimeout(resolve, 10_000));
  } while (!once);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
