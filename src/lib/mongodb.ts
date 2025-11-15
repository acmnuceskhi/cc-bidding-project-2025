import { MongoClient, type MongoClientOptions } from "mongodb";
import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "Please define MONGODB_URI in your environment (e.g. .env.local)"
  );
}

const options: MongoClientOptions = {
  maxPoolSize: 10, // Limit concurrent connections for free tier
  minPoolSize: 2,
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  serverSelectionTimeoutMS: 10000, // Fail fast if DB unreachable
};

let client: MongoClient;

declare global {
  // allow global caching of the promise
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}

const clientPromise = global._mongoClientPromise;

export default clientPromise;
