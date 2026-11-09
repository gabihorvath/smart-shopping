# Einkaufsliste

Private single-user shopping list PWA (Vue 3 + TypeScript + Vite + Tailwind + Pinia). See `docs/`.

**Using the app:** [User guide](docs/user-guide.md)

## Commands

- `npm install` – install dependencies
- `npm run dev` – dev server (http://localhost:5173/smart-shopping/)
- `npm run build` – type-check and production build into `dist/`
- `npm run preview` – serve the production build
- `npm run lint` / `npm run format` / `npm test`

## Deploy

Pushes to `main` build and deploy to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: repo Settings → Pages → Source: **GitHub Actions**.
The site is served at `https://<user>.github.io/smart-shopping/`; the base path is set in `vite.config.ts`.
