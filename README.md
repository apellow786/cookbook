# Alexander's Cookbook

A mobile-first static cookbook generated from Alexander's Obsidian recipe vault.

## Local development

```sh
npm install
npm run sync
npm run dev
```

`npm run sync` reads the Obsidian source at
`/Users/alexanderpellow/myvault/Cookbook/Recipes` by default. Override it with
the `COOKBOOK_SOURCE` environment variable.

## Content model

- Obsidian is the master source.
- `src/data/site-content.json` is generated website data and is committed so
  GitHub Pages can build without access to the local vault.
- Cooking Tips are imported separately from recipes and are excluded from
  recipe search, category counts, and favorites.

## Deployment

GitHub Actions validates and builds the site before deploying it to GitHub
Pages. Content changes should be reviewed before committing and pushing.
