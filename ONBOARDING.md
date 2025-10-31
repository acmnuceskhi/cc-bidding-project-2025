# CC Bidding Project — Onboarding & Contributor Guide

## Quick start

1. Clone the repo:

   `git clone https://github.com/acmnuceskhi/cc-bidding-project-2025.git`

2. Install dependencies:

   npm i

3. Create a `.env.local` file in the project root with required environment variables:

   MONGODB_URI=mongodb://127.0.0.1:27017

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
- `src/app/page.tsx` is the root page. `src/app/dashboard/page.tsx` is the dashboard page (example).

## Database

- `src/lib/mongodb.ts` provides a cached MongoDB client promise. Use it like:

```ts
import clientPromise from "src/lib/mongodb";
const client = await clientPromise;
const db = client.db();
```

- Add models under `src/lib/models/` (one file per collection).

### Database: Atlas (hosted)

- MongoDB Atlas (recommended for shared/team development)
  1. Copy the connection string (it will look like `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mydb?retryWrites=true&w=majority`). Replace `<password>` and the default DB name.
  2. Add the connection string to `.env.local` as `MONGODB_URI="<your-atlas-connection-string>"`.

Notes:

- Do not commit `.env.local` or any secrets to git.
- The app expects `process.env.MONGODB_URI` and `src/lib/mongodb.ts` reuses a cached connection. Always import `clientPromise` and reuse it rather than constructing a new `MongoClient`.

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Create a production build
- `npm run start` — Run built app
- `npm run lint` — Run ESLint
- `npm run format` — Run Prettier and rewrite files
- `npm run format:check` — Check Prettier formatting

## Pre-PR checklist

- Run `npm run format:check` and `npm run lint` before opening a PR.
- Do not commit secrets. Use `.env.local` for local variables.
