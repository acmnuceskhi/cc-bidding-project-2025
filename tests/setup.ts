import { MongoClient, Document } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// NOTE: In-memory Mongo is now started inside `src/lib/mongodb.ts` during tests.
// This setup file focuses only on snapshotting & restoring deterministic state.
// If a remote cluster URI is detected here during Jest runs, we abort to avoid
// accidental data mutation.
let client: MongoClient | null = null;
let dbSnapshot: Record<string, Document[]> | null = null;

beforeAll(async () => {
  // Force test env flag (helps code paths relying on NODE_ENV)
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    writable: true,
    configurable: true,
  });

  let uri = process.env.MONGODB_URI;
  // Provision in-memory server if no URI OR if URI points to a remote cluster (safety override)
  if (!uri || /mongodb\+srv/.test(uri) || /cluster/i.test(uri)) {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = replSet.getUri();
    process.env.MONGODB_URI = uri;
    (global as any).__INMEMORY_REPLSET = replSet;
  }

  client = new MongoClient(uri);
  await client.connect();

  try {
    const seed = await import("@/scripts/seed-test-data");
    if (seed && typeof seed.initializeData === "function") {
      await seed.initializeData();
    }

    const db = client.db();
    const collections = await db.collections();
    dbSnapshot = {};
    for (const col of collections) {
      const name = col.collectionName;
      const docs = await col.find({}).toArray();
      dbSnapshot[name] = docs as Document[];
    }
  } catch (err) {
    console.error("Initial seeding failed in beforeAll:", err);
    throw err;
  }
});
// Restore DB from snapshot before each test for deterministic state without re-running seeder
beforeEach(async () => {
  if (!client || !dbSnapshot) return;
  const db = client.db();
  
  // Clear all collections first
  const collections = await db.collections();
  for (const col of collections) {
    await col.deleteMany({});
  }

  // Restore each snapshot collection by replacing contents
  for (const [name, docs] of Object.entries(dbSnapshot)) {
    const col = db.collection(name);
    if (docs.length > 0) {
      // Insert clones of documents (preserve _id from snapshot for referential integrity)
      const toInsert = docs.map((d) => ({ ...d }));
      await col.insertMany(toInsert);
    }
  }
});

// Close everything
afterAll(async () => {
  if (client) {
    await client.close();
    client = null;
  }
  // Attempt to stop in-memory replSet if mongodb.ts stored it globally
  const repl = (global as any).__INMEMORY_REPLSET;
  if (repl && typeof repl.stop === "function") {
    try {
      await repl.stop();
    } catch {
      /* ignore */
    }
  }
  try {
    const mp = await import("@/lib/mongodb");
    const appClientPromise = mp.default as Promise<MongoClient> | undefined;
    if (appClientPromise) {
      const appClient = await appClientPromise;
      if (appClient?.close) {
        await appClient.close();
      }
    }
  } catch {
    // ignore
  }
});
