Tests README — cc-bidding-project-2025

Purpose

- Document how to run the test suite for this repository and how the test environment is configured.

Quick run (Windows PowerShell)

1. Install dependencies (once):
   npm ci

2. Run tests once:
   npm test

3. Run tests in watch mode during development:
   npm run test:watch

What the tests do

- Unit + integration style tests using Jest and ts-jest.
- Tests use mongodb-memory-server in replica-set mode so MongoDB transactions are available.
- Tests dynamically import application model modules so the in-memory MongoDB URI can be injected before modules open connections.
- **67 tests across 13 test suites** covering models, API routes, integration flows, and edge cases.
- All tests verified as **100% functional** and passing as of November 14, 2025.

Environment

- Node.js (v16+ recommended)
- Windows PowerShell (commands above are for PowerShell; adjust for bash if needed)
- No external MongoDB required — tests spin up an in-memory replica-set instance.

Key files

- `jest.config.js` — Jest configuration for ts-jest and setup file.
- `tests/setup.ts` — Starts the in-memory MongoDB replica set, sets process.env.MONGODB_URI, and tears down the server and cached DB client after tests.
- `tests/**/*.test.ts` — Test suites organized by domain:
  - `tests/models/` — Model CRUD operations (houses, bids, rounds)
  - `tests/api/` — API endpoint tests (authorization, bidding, round lifecycle, budget management, status, second pass)
  - `tests/integration/` — End-to-end flows (complete auction flow, data integrity, phantom budget inflation)
  - `tests/edge_cases/` — Edge case handling (unsold participants)

Common issues & troubleshooting

- "Transaction numbers are only allowed on a replica set member or mongos": The test setup uses mongodb-memory-server configured as a replica set. If you see this, ensure all dev dependencies are installed and no process is blocking the in-memory server.
- Jest hangs / open handle warning: Tests close the app's cached Mongo client on teardown; if Jest still hangs, check for other retained handles (timers, servers). Running `npm test -- --detectOpenHandles` can help locate survivors.
- Environment variables not applied: Tests rely on `tests/setup.ts` to set `process.env.MONGODB_URI` before app modules load. Avoid importing application modules at the top-level of test files; use dynamic `await import(...)` inside tests instead.
- TypeScript errors: All tests use correct import paths with models imported separately (e.g., `@/lib/models/users`, `@/lib/models/houses`, etc.) and use model wrapper methods (`getById()`, `update()`) instead of raw MongoDB methods.
- Test expectations aligned with API: Tests reflect actual implementation behavior including escrow system (bids don't deduct budget until round ends), pass 2 minimum roster checks, and proper response structures.

CI recommendations

- Use a runner with Node 16+.
- Ensure the CI environment allows spawning child processes (mongodb-memory-server starts a local mongod).
- For deterministic transactions testing, the replica-set startup may take an extra ~1-2s; allow a slightly longer test timeout if necessary.
- Run tests sequentially with `npm test -- --runInBand` to avoid race conditions in the in-memory database.
- Expected test execution time: ~280-290 seconds for full suite on Windows with in-memory replica set.
