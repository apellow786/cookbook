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

## Automatic publishing from Obsidian (macOS)

Run `npm run auto-publish:install` once on the Mac containing the vault.
The login background service checks recipe files, cooking tips, and photo assets
every 10 seconds. After 30 seconds without changes, it imports and builds in an
isolated `.auto-publish/checkout`, then commits generated content and pushes to
`main`. GitHub Actions publishes the website. Saving in Obsidian authorizes
publishing that content; no manual review step runs in this mode.

The Mac must be awake, logged in, and online, with GitHub push credentials and
Node installed. The service starts again at login, catches up on changes made
while it was off, and retries failures after a minute. Build failures leave the
published website unchanged. It does not change your website working checkout
or your Obsidian files. New recipes still need the photo and yield required by
the existing content validator.

Logs: `.auto-publish/watcher.log` and `.auto-publish/watcher-error.log`.
Stop and remove the service with `npm run auto-publish:uninstall`.
Run a single immediate sync with `node scripts/auto-publish.mjs --once`.
The private checkout and logs are ignored by Git.
