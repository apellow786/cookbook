# Recipe photo workflow

The Obsidian vault remains the master source for recipe photos. Recipe Markdown files do not need photo properties.

## Where photos live

- Photo files: `Cookbook/Recipes/Assets/Recipes/`
- Photo catalog: `Cookbook/Recipes/Assets/photo-manifest.json`
- Use a recipe's stable `id` as the filename, such as `recipe-33a8bf22-c186-47e3-99d8-be6a5b276c96.jpg`.
- Supported formats are JPG, PNG, WebP, and AVIF.

## Photo catalog format

```json
{
  "version": 1,
  "categoryCovers": {
    "Appetizers": "recipe-33a8bf22-c186-47e3-99d8-be6a5b276c96"
  },
  "recipes": {
    "recipe-33a8bf22-c186-47e3-99d8-be6a5b276c96": {
      "file": "Recipes/recipe-33a8bf22-c186-47e3-99d8-be6a5b276c96.jpg",
      "alt": "Fresh guacamole in a stone bowl with tortilla chips",
      "source": {
        "creator": "Photographer name",
        "url": "https://example.com/original-photo-page",
        "license": "License name"
      }
    }
  }
}
```

`alt` describes what is visible for people using screen readers. Source details preserve the photo's provenance even when attribution is optional.

## Add or replace a photo

1. Put the image in `Assets/Recipes` using the recipe ID as its filename.
2. Add or update that recipe's entry in `photo-manifest.json`.
3. To use it on the home page, point the appropriate `categoryCovers` entry to that recipe ID.
4. Run the website content sync and build.

Replacing the source file changes the generated website filename automatically, so phones and browsers do not keep showing a stale cached copy.

## Remove a photo

Delete its catalog entry and image file. If it is a category cover, remove or replace that `categoryCovers` entry too. The next sync removes obsolete generated image files.

## Compatibility

The importer also recognizes older title-named images directly inside `Assets`, so existing photos continue to work while they are gradually added to the catalog.
