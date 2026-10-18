import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(import.meta.dirname, '../src/data/site-content.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const warnings = [];
const followUps = [];
const seenIds = new Set();
const seenSlugs = new Set();

for (const recipe of data.recipes) {
  if (seenIds.has(recipe.id)) errors.push(`${recipe.source}: duplicate id ${recipe.id}`);
  if (seenSlugs.has(recipe.slug)) errors.push(`${recipe.source}: duplicate URL slug ${recipe.slug}`);
  seenIds.add(recipe.id); seenSlugs.add(recipe.slug);
  if (!recipe.description) warnings.push(`${recipe.source}: missing description`);
  if (!recipe.ingredientsMarkdown) warnings.push(`${recipe.source}: missing Ingredients section`);
  if (!recipe.instructionsHtml) warnings.push(`${recipe.source}: missing Instructions section`);
  if (!recipe.image) errors.push(`${recipe.source}: missing recipe photo`);
  if (!Number.isFinite(recipe.yield.amount) || recipe.yield.amount <= 0) errors.push(`${recipe.source}: unusable yield "${recipe.yield.text}"`);
  if (!recipe.yield.unit) errors.push(`${recipe.source}: yield needs a unit`);
}

for (const tip of data.tips) {
  if (!tip.summary) errors.push(`${tip.source}: missing explicit summary`);
  if (!tip.sections.length) errors.push(`${tip.source}: missing structured sections`);
}

const report = [
  '# Content Review', '',
  `Generated from ${data.recipes.length} recipes and ${data.tips.length} cooking tips.`, '',
  `## Warnings (${warnings.length})`, '',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- None']), '',
  `## Manual Follow-up (${followUps.length})`, '',
  ...(followUps.length ? followUps.map((item) => `- ${item}`) : ['- None']), '',
  `## Errors (${errors.length})`, '',
  ...(errors.length ? errors.map((error) => `- ${error}`) : ['- None']), '',
];
fs.writeFileSync(path.resolve(import.meta.dirname, '../CONTENT_REVIEW.md'), report.join('\n'));

if (warnings.length) {
  console.warn(`Content warnings (${warnings.length}):`);
  for (const warning of warnings.slice(0, 30)) console.warn(`- ${warning}`);
  if (warnings.length > 30) console.warn(`- …and ${warnings.length - 30} more`);
}
if (errors.length) {
  console.error(`Content errors (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Validated ${data.recipes.length} recipes and ${data.tips.length} tips.`);
