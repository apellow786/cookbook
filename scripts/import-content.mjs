import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { marked } from 'marked';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '..');
const source = process.env.COOKBOOK_SOURCE || '/Users/alexanderpellow/myvault/Cookbook/Recipes';
const output = path.join(root, 'src/data/site-content.json');
const imageOutput = path.join(root, 'public/images/recipes');
const assetsDirectory = path.join(source, 'Assets');
const photoManifestPath = path.join(assetsDirectory, 'photo-manifest.json');
const supportedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

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

function loadPhotoManifest() {
  if (!fs.existsSync(photoManifestPath)) return { version: 1, recipes: {}, families: {}, recipeFamilies: {}, categoryCovers: {} };
  const manifest = JSON.parse(fs.readFileSync(photoManifestPath, 'utf8'));
  if (manifest.version !== 1 || !manifest.recipes || typeof manifest.recipes !== 'object') {
    throw new Error(`${photoManifestPath}: expected version 1 with a recipes object`);
  }
  return {
    ...manifest,
    families: manifest.families || {},
    recipeFamilies: manifest.recipeFamilies || {},
    categoryCovers: manifest.categoryCovers || {},
  };
}

const photoManifest = loadPhotoManifest();

function safeAssetPath(relative) {
  const candidate = path.resolve(assetsDirectory, relative);
  const rootWithSeparator = `${path.resolve(assetsDirectory)}${path.sep}`;
  if (!candidate.startsWith(rootWithSeparator)) throw new Error(`Photo path escapes Assets: ${relative}`);
  return candidate;
}

function legacyImagePath(id, title) {
  if (!fs.existsSync(assetsDirectory)) return null;
  const recipeAssetDirectory = path.join(assetsDirectory, 'Recipes');
  if (fs.existsSync(recipeAssetDirectory)) {
    const stableFile = fs.readdirSync(recipeAssetDirectory).find((name) =>
      path.parse(name).name === id && supportedImageExtensions.has(path.extname(name).toLowerCase()));
    if (stableFile) return path.join(recipeAssetDirectory, stableFile);
  }
  const target = slugify(title);
  const titleFile = fs.readdirSync(assetsDirectory).find((name) =>
    slugify(path.parse(name).name) === target && supportedImageExtensions.has(path.extname(name).toLowerCase()));
  return titleFile ? path.join(assetsDirectory, titleFile) : null;
}

function importPhoto(id, title) {
  const family = photoManifest.recipeFamilies[id];
  const recipeEntry = photoManifest.recipes[id];
  const entry = recipeEntry || (family ? photoManifest.families[family] : null);
  if (family && !entry) throw new Error(`${photoManifestPath}: unknown photo family for ${id}: ${family}`);
  const sourcePath = entry?.file ? safeAssetPath(entry.file) : legacyImagePath(id, title);
  if (!sourcePath) return { image: null };
  if (!fs.existsSync(sourcePath)) throw new Error(`${photoManifestPath}: missing photo for ${id}: ${entry.file}`);
  const extension = path.extname(sourcePath).toLowerCase();
  if (!supportedImageExtensions.has(extension)) throw new Error(`Unsupported photo format for ${id}: ${extension}`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex').slice(0, 10);
  const outputKey = recipeEntry ? id : family ? `family-${slugify(family)}` : id;
  const destination = `${outputKey}-${hash}${extension}`;
  fs.copyFileSync(sourcePath, path.join(imageOutput, destination));
  return {
    image: `/images/recipes/${destination}`,
    imageAlt: entry?.alt || title,
    photoCredit: entry?.source ? {
      creator: entry.source.creator || '',
      url: entry.source.url || '',
      license: entry.source.license || '',
      licenseUrl: entry.source.licenseUrl || '',
    } : null,
  };
}

fs.rmSync(imageOutput, { recursive: true, force: true });
fs.mkdirSync(imageOutput, { recursive: true });

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
    const id = doc.data.id || stableId('recipe', relative);
    const photo = importPhoto(id, doc.title);
    recipes.push({
      id,
      slug: slugify(doc.title), title: doc.title, category,
      categoryDisplay: displayNames[category] || category,
      categorySlug: slugify(displayNames[category] || category),
      description: doc.intro, cuisines, yield: yieldValue,
      ...photo,
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

const categories = categoryOrder.map((name) => {
  const categoryRecipes = recipes.filter((recipe) => recipe.category === name);
  const coverId = photoManifest.categoryCovers[name];
  const selectedCover = coverId ? recipes.find((recipe) => recipe.id === coverId && recipe.category === name) : null;
  if (coverId && !selectedCover) throw new Error(`${photoManifestPath}: category cover for ${name} is not a recipe in that category`);
  if (selectedCover && !selectedCover.image) throw new Error(`${photoManifestPath}: category cover for ${name} has no photo`);
  return {
    name, displayName: displayNames[name] || name, slug: slugify(displayNames[name] || name),
    count: categoryRecipes.length,
    representative: selectedCover?.image || categoryRecipes.find((recipe) => recipe.image)?.image || null,
  };
});

const knownIds = new Set(recipes.map((recipe) => recipe.id));
for (const id of Object.keys(photoManifest.recipes)) {
  if (!knownIds.has(id)) console.warn(`Photo manifest contains unknown recipe id: ${id}`);
}
for (const id of Object.keys(photoManifest.recipeFamilies)) {
  if (!knownIds.has(id)) console.warn(`Photo manifest contains family assignment for unknown recipe id: ${id}`);
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), categories, recipes, tips }, null, 2) + '\n');
console.log(`Imported ${recipes.length} recipes and ${tips.length} cooking tips.`);
