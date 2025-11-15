<!-- ad37bd2b-c07b-4e30-baa1-e7776202332e 408159dd-1d3e-47ca-a06d-707171d35143 -->
# Fix server.js TypeScript Import Error

## Problem

The `server.js` file uses CommonJS `require()` to import TypeScript model files (`./src/lib/models/rounds`, etc.), which fails because Node.js cannot directly require `.ts` files. The error occurs when a client connects and `buildStateFromDB()` tries to load the models:

```
Error: Cannot find module './src/lib/models/rounds'
```

## Solution

Convert `server.js` to `server.ts` with ES6 imports, matching the rest of the codebase's TypeScript pattern. Use `tsx` (already installed) to run the TypeScript server file, consistent with other scripts in the project.

## Implementation

### 1. Convert server.js to server.ts

- Rename `server.js` → `server.ts`
- Convert all `require()` statements to ES6 `import` statements:
  - `const { createServer } = require("http")` → `import { createServer } from "http"`
  - `const { parse } = require("url")` → `import { parse } from "url"`
  - `const next = require("next")` → `import next from "next"`
  - `const { Server } = require("socket.io")` → `import { Server } from "socket.io"`
  - `const { setSocketInstance } = require("./src/lib/socket-instance")` → `import { setSocketInstance } from "./src/lib/socket-instance"`
  - Model imports: `const { Rounds } = require("./src/lib/models/rounds")` → `import { Rounds } from "@/lib/models/rounds"` (using `@/` path alias)
  - Apply same pattern for `Teams`, `Bids`, and `Houses` imports

### 2. Update package.json scripts

- Change `"dev": "node server.js"` → `"dev": "tsx server.ts"`
- Change `"start": "NODE_ENV=production node server.js"` → `"start": "NODE_ENV=production tsx server.ts"`

### 3. Handle socket-instance.js import

- Keep the relative import: `import { setSocketInstance } from "./src/lib/socket-instance"`
- The CommonJS module.exports in `socket-instance.js` will work with ES6 import (Node.js handles this interop)

## Files to Modify

- `server.js` → `server.ts` (rename and convert imports)
- `package.json` (update dev and start scripts)

## Notes

- `tsx` is already installed as a dev dependency and used for other scripts (init-data, reset-auction, etc.)
- The `@/` path alias is configured in `tsconfig.json` and will resolve correctly
- TypeScript model files use ES6 exports which will work with ES6 imports
- This approach matches Next.js custom server best practices for TypeScript projects

### To-dos

- [ ] Rename server.js to server.ts and convert all require() statements to ES6 import statements, including updating model imports to use @/ path alias
- [ ] Update package.json dev and start scripts to use 'tsx server.ts' instead of 'node server.js'
- [ ] Verify server starts without module errors and Socket.IO connections work properly