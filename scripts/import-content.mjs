import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '..');
const source = process.env.COOKBOOK_SOURCE || '/Users/alexanderpellow/myvault/Cookbook/Recipes';
const output = path.join(root, 'src/data/site-content.json');
const imageOutput = path.join(root, 'public/images/recipes');

const categoryOrder = [
  'Breakfast & Breads', 'Appetizers', 'Salads & Dressings', 'Soups & Stews',
  'Main Dishes', 'Side Dishes', 'Sauces & Seasonings', 'Desserts',
];
const displayNames = { 'Salads & Dressings': 'Salads' };

const slugify = (value) => value.toLowerCase().normalize('NFKD')
  .replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const plain = (value = '') => value.replace(/!\[.*?\]\(.*?\)/g, '')
  .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/[*_`>#]/g, '')
  .replace(/\s+/g, ' ').trim();
const stableId = (type, relative) => `${type}-${crypto.createHash('sha1').update(relative).digest('hex').slice(0, 12)}`;

function splitDocument(raw, fallbackTitle) {
  const frontmatter = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  const parsed = { data: frontmatter ? (YAML.parse(frontmatter[1]) || {}) : {}, content: frontmatter ? raw.slice(frontmatter[0].length) : raw };
  const body = parsed.content.replace(/\r\n/g, '\n').trim();
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = plain(titleMatch?.[1] || fallbackTitle);
  const withoutTitle = titleMatch ? body.replace(titleMatch[0], '').trim() : body;
  const firstSection = withoutTitle.search(/^##\s+/m);
  const intro = plain(firstSection >= 0 ? withoutTitle.slice(0, firstSection) : withoutTitle);
  const sections = {};
  const matches = [...withoutTitle.matchAll(/^##\s+(.+)$/gm)];
  for (let i = 0; i < matches.length; i++) {
    const name = plain(matches[i][1]).toLowerCase();
    const start = matches[i].index + matches[i][0].length;
    const end = matches[i + 1]?.index ?? withoutTitle.length;
    sections[name] = withoutTitle.slice(start, end).trim();
  }
  return { data: parsed.data, title, intro, sections };
}

function section(sections, names) {
  const key = Object.keys(sections).find((candidate) => names.includes(candidate));
  return key ? sections[key] : '';
}

function parseYield(value) {
  const text = String(value ?? '').replace(/^['"]|['"]$/g, '').trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  return { text, amount: match ? Number(match[1]) : null, unit: match?.[2]?.trim() || '' };
}

function findImage(title) {
  const assets = path.join(source, 'Assets');
  if (!fs.existsSync(assets)) return null;
  const target = slugify(title);
  const file = fs.readdirSync(assets).find((name) => slugify(path.parse(name).name) === target);
  if (!file) return null;
  fs.mkdirSync(imageOutput, { recursive: true });
  const destination = `${target}${path.extname(file).toLowerCase()}`;
  fs.copyFileSync(path.join(assets, file), path.join(imageOutput, destination));
  return `/images/recipes/${destination}`;
}

const recipes = [];
for (const category of categoryOrder) {
  const dir = path.join(source, category);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort()) {
    const relative = `${category}/${file}`;
    const doc = splitDocument(fs.readFileSync(path.join(dir, file), 'utf8'), path.basename(file, '.md'));
    const ingredients = section(doc.sections, ['ingredients', '**ingredients**']);
    const instructions = section(doc.sections, ['instructions', 'directions', 'method']);
    const variations = section(doc.sections, ['variations', 'variation']);
    const notes = section(doc.sections, ['notes', 'note']);
    const yieldValue = parseYield(doc.data.yield);
    const cuisines = Array.isArray(doc.data.tags) ? doc.data.tags.map(String) : [];
    recipes.push({
      id: doc.data.id || stableId('recipe', relative),
      slug: slugify(doc.title), title: doc.title, category,
      categoryDisplay: displayNames[category] || category,
      categorySlug: slugify(displayNames[category] || category),
      description: doc.intro, cuisines, yield: yieldValue,
      image: findImage(doc.title),
      ingredientsMarkdown: ingredients, ingredientsHtml: marked.parse(ingredients),
      instructionsHtml: marked.parse(instructions),
      variationsHtml: variations ? marked.parse(variations) : '',
      notesHtml: notes ? marked.parse(notes) : '',
      searchIngredients: plain(ingredients), source: relative,
    });
  }
}

const tipsDir = path.join(source, 'Cooking Tips');
const tips = fs.existsSync(tipsDir) ? fs.readdirSync(tipsDir).filter((name) => name.endsWith('.md')).sort().map((file) => {
  const doc = splitDocument(fs.readFileSync(path.join(tipsDir, file), 'utf8'), path.basename(file, '.md'));
  const rendered = Object.entries(doc.sections).map(([heading, markdown]) => ({
    heading: heading.replace(/\b\w/g, (letter) => letter.toUpperCase()), html: marked.parse(markdown),
  }));
  return { id: stableId('tip', file), slug: slugify(doc.title), title: doc.title, summary: doc.intro, sections: rendered, source: `Cooking Tips/${file}` };
}) : [];

const slugCounts = recipes.reduce((counts, recipe) => counts.set(recipe.slug, (counts.get(recipe.slug) || 0) + 1), new Map());
for (const recipe of recipes) {
  if (slugCounts.get(recipe.slug) > 1) recipe.slug = `${recipe.slug}-${recipe.categorySlug}`;
}

const categories = categoryOrder.map((name) => ({
  name, displayName: displayNames[name] || name, slug: slugify(displayNames[name] || name),
  count: recipes.filter((recipe) => recipe.category === name).length,
  representative: recipes.find((recipe) => recipe.category === name && recipe.image)?.image || null,
}));

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), categories, recipes, tips }, null, 2) + '\n');
console.log(`Imported ${recipes.length} recipes and ${tips.length} cooking tips.`);
