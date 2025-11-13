import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

let replSet: MongoMemoryReplSet | null = null;
let client: MongoClient | null = null;

// Start an in-memory replica-set Mongo and set env variable before modules import clientPromise
// Using a replica set enables transactions (used by some routes).
beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  // Ensure code that reads process.env.MONGODB_URI uses this test server
  process.env.MONGODB_URI = uri;
  // Warm up a client connection for direct DB ops in tests
  client = new MongoClient(uri);
  await client.connect();
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
