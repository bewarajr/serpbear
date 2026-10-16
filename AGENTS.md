# Repository Guidelines

SerpBear is a Next.js and React application for tracking search rankings. Keep deployment-specific files such as `compose.official.yml` and `INSTALLATION_REPORT.md` separate from the upstream app source.

## Project Structure & Module Organization

- `pages/` contains UI routes and API handlers; API endpoints live in `pages/api/`.
- `components/`, `hooks/`, and `styles/` hold the interface and shared behavior.
- `services/`, `utils/`, and `scrapers/` contain application logic and integrations.
- `database/` contains Sequelize models and migrations. `public/` holds static assets.
- `__tests__/` and `__mocks__/` contain Jest tests and fixtures.

## Build, Test, and Development Commands

- `npm install` installs dependencies from the lockfile.
- `npm run dev` starts the local Next.js development server.
- `npm run lint` runs Next.js ESLint checks.
- `npm run test:ci` runs the Jest suite once; `npm test` starts Jest in watch mode.
- `npm run build` creates a production build; `npm start` serves it.
- `npm run db:migrate` applies production database migrations. Use it only with the intended database.

## Coding Style & Naming Conventions

Use the existing JavaScript/TypeScript and React patterns. ESLint extends `next/core-web-vitals` and Airbnb Base; keep imports extensionless and lines within the configured 150-character limit. Match neighboring files for component names (PascalCase), hooks (`use…`), and utilities (camelCase). Keep changes focused and avoid editing generated build output or local deployment data.

## Testing Guidelines

Add Jest tests under `__tests__/`, following the existing `.test.tsx` naming and grouping by pages, hooks, or components. Use `__mocks__/` for shared fixtures. Run `npm run test:ci` and `npm run lint` for application changes; there is no coverage threshold configured.

## Commits & Pull Requests

The available history contains a release commit, `chore(release): 3.1.0`, rather than a broad feature convention. Prefer concise Conventional Commit subjects such as `fix(api): handle empty domain`, with an imperative summary. Pull requests should explain the user-visible change, link related issues, list checks run, and include screenshots for UI changes.

## Security & Configuration

Do not commit `.env`, tunnel credentials, database files, or provider keys. Put placeholders only in `.env.example`; keep runtime secrets in protected local files and do not include them in logs or reports.
