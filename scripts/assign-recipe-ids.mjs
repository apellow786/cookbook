import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const source = process.env.COOKBOOK_SOURCE || '/Users/alexanderpellow/myvault/Cookbook/Recipes';
const excluded = new Set(['Assets', 'Cooking Tips']);
let changed = 0;

for (const category of fs.readdirSync(source, { withFileTypes: true })) {
  if (!category.isDirectory() || excluded.has(category.name)) continue;
  const directory = path.join(source, category.name);
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.md'))) {
    const filename = path.join(directory, file);
    const text = fs.readFileSync(filename, 'utf8');
    if (/^id:\s*\S+/m.test(text)) continue;
    const opening = text.match(/^---\s*\n/);
    if (!opening) throw new Error(`${filename} has no YAML frontmatter.`);
    const id = `recipe-${crypto.randomUUID()}`;
    const updated = text.slice(0, opening[0].length) + `id: ${id}\n` + text.slice(opening[0].length);
    fs.writeFileSync(filename, updated);
    changed++;
  }
}

console.log(`Assigned permanent IDs to ${changed} recipes.`);
