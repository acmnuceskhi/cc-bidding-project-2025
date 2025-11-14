import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient, Document } from "mongodb";

let replSet: MongoMemoryReplSet | null = null;
let client: MongoClient | null = null;
let dbSnapshot: Record<string, Document[]> | null = null;

// Start an in-memory replica-set Mongo and set env variable before modules import clientPromise
// Using a replica set enables transactions (used by some routes).
beforeAll(async () => {
  // Safety: ensure we're in test mode before starting in-memory DB
  Object.defineProperty(process.env, "NODE_ENV", {
    value: "test",
    writable: true,
    configurable: true,
  });
  
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  // Ensure code that reads process.env.MONGODB_URI uses this test server
  process.env.MONGODB_URI = uri;
  // Warm up a client connection for direct DB ops in tests
  client = new MongoClient(uri);
  await client.connect();

  // Seed the database once and capture a snapshot to speed up test restores
  try {
    const seed = await import("@/scripts/seed-test-data");
    if (seed && typeof seed.initializeData === "function") {
      await seed.initializeData();
    }

    // Capture snapshot of all collections
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
  const collections = await db.collections();

  // Drop any collections not present in snapshot
  for (const col of collections) {
    if (!dbSnapshot[col.collectionName]) {
      await col.drop().catch(() => {});
    }
  }

  // Restore each snapshot collection by replacing contents
  for (const [name, docs] of Object.entries(dbSnapshot)) {
    const col = db.collection(name);
    await col.deleteMany({});
      if (docs.length > 0) {
      // Insert clones of documents (remove _id to allow Mongo to re-create ObjectIds)
      const toInsert = docs.map((d) => ({ ...d }));
      await col.insertMany(toInsert);
    }
  }
});

// Clean up DB between tests
afterEach(async () => {
  if (!client) return;
  const db = client.db();
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

// Close everything
afterAll(async () => {
  if (client) {
    await client.close();
    client = null;
  }

  if (replSet) {
    try {
      await replSet.stop();
    } catch {
      /* ignore */
    }
    replSet = null;
  }

  // Close the application's cached Mongo client (clientPromise) to avoid Jest open-handle warnings
  try {
    const mp = await import("@/lib/mongodb");
    const appClientPromise = mp.default as Promise<unknown> | undefined;
    if (appClientPromise) {
      const appClient = (await appClientPromise) as
        | { close?: () => Promise<void> }
        | undefined;
      if (appClient?.close) {
        await appClient.close();
      }
    }
  } catch {
    // ignore if import or close fails in test environment
  }
});
