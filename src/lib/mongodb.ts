import { MongoClient, type MongoClientOptions } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    "Please define MONGODB_URI in your environment (e.g. .env.local)"
  );
}

const options: MongoClientOptions = {};

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
