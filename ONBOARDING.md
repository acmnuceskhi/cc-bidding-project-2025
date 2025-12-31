# CC Bidding Project — Onboarding & Contributor Guide

**Quick Navigation:**

- [README.md](./README.md) - Project overview
- [PROJECT_FLOW.md](./docs/reference/PROJECT_FLOW.md) - System workflows and architecture
- [API.md](./docs/reference/API.md) - API endpoint documentation

---

## Quick start

1. Clone the repo:

   `git clone https://github.com/acmnuceskhi/cc-bidding-project-2025.git`

2. Install dependencies:

   `npm i`

3. Create a `.env.local` file in the project root with required environment variables (see Database section below).

4. Start the development server:

   `npm run dev`

5. Open http://localhost:3000 in your browser.

## Project layout

- `src/` — All development work lives here.
- `src/app/` — Next.js App Router. Frontend pages are folders inside this directory (e.g. `src/app/dashboard`).
- `src/app/api/` — Backend API routes. Each API route is a folder containing `route.ts` (e.g. `src/app/api/ping/route.ts`).
- `src/lib/` — Shared helpers and models:
  - `src/lib/mongodb.ts` — exports a cached `clientPromise`. Reuse this across code to avoid multiple MongoClient instances.
  - `src/lib/models/` — put one file per collection/model (e.g. `user.ts`).
  - `src/lib/utils.ts` — helper utilities (e.g. `cn()` for composing Tailwind classes).
- `src/components/`, `src/hooks/`, `src/types/` — UI components, hooks, and TypeScript types.

## Editing the frontend

- Edit pages under `src/app/`. A page is a folder with `page.tsx` (server component) and optional client components.
- `src/app/page.tsx` is the root landing page.

## Database

- `src/lib/mongodb.ts` provides a cached MongoDB client promise. Use it like:

```ts
import clientPromise from "src/lib/mongodb";
const client = await clientPromise;
const db = client.db();
```

- Add models under `src/lib/models/` (one file per collection).

### Database: Atlas (hosted)

1. **Pull `.env.example`**  
   The repo includes a `.env.example` with placeholders. Copy it to your project root folder and rename it as `.env.local`.

2. **Add the shared URI**  
   Ask the team lead or group for the MongoDB connection string.

   Paste it into `.env.local` as `MONGODB_URI`:

```env
   MONGODB_URI="mongodb+srv://sharedUser:password@cluster0.rgz9psr.mongodb.net/mydb?retryWrites=true&w=majority&appName=Cluster0"
```

⚠️ **Never commit `.env.local` to Git.** Only `.env.example` is tracked in the repo.

3. **Install dependencies**  
   dotenv was just added to packages.json, make sure to install it:

   `npm i`

4. **Test locally**  
   Quick Mongo shell test:

   `mongosh "${env:MONGODB_URI}"`

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Create a production build
- `npm run start` — Run built app
- `npm run lint` — Run ESLint
- `npm run format` — Run Prettier and rewrite files
- `npm run format:check` — Check Prettier formatting
- `npm test` — Run Jest test suite (uses in-memory MongoDB)
- `npm run test:watch` — Run tests in watch mode
- `npm run seed-test-data` — Seed database with test teams and users
- `npm run import-excel` — Import teams from Excel file
- `npm run init-data` — Initialize database with fresh data
- `npm run reset-auction` — Reset auction state (clear rounds, bids, assignments)
- `npm run full-reset` — Full database reset (removes all collections)

## Pre-PR checklist

- Run `npm run format:check` and `npm run lint` before opening a PR.
- Do not commit secrets. Use `.env.local` for local variables.
