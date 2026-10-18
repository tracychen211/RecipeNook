# Recipe Nook

My personal cooking + baking recipe app. Works offline, installs to the home screen from Chrome, and keeps everything on my phone.

## Features
- **Library** with Cooking / Baking / Family / To try tabs, search (names and ingredients), list or grid view
- **Paste anything**: paste a reel caption, a text from Mom, or a recipe copied from a website, and the app finds the ingredients, steps, servings and time. Amounts it had to guess are dashed so I can double-check them. No internet or API needed.
- **Share from Instagram**: Share → Recipe Nook saves the reel link and opens the paste screen
- **Type it in** for family recipes, with tips, a photo and a voice memo
- **Cooking mode**: big text, one step at a time, ingredients for that step, screen stays on
- **Made it log** with a note for next time
- **What can I make?** search by what's in the fridge
- **Grams ↔ cups** for common baking ingredients
- **Backup / restore** to a file (Drive, email, or Downloads), with a weekly reminder

## Files
- `index.html`: page + styles
- `app.js`: the app
- `parser.js`: the smart paste parser
- `sw.js`: offline support (bump `CACHE` when files change)
- `manifest.webmanifest`: install + share menu settings

## Hosting
GitHub Pages, deploy from the `main` branch root.
