import path from "node:path";
import { loadEnv } from "../config/env";
import { LocalObjectStorage } from "./localObjectStorage";
import { S3ObjectStorage } from "./s3ObjectStorage";
import type { ObjectStorage } from "./objectStorage";

let cached: ObjectStorage | undefined;

export function getObjectStorage(): ObjectStorage {
  if (cached) return cached;
  const env = loadEnv();
  if (env.STORAGE_PROVIDER === "s3") {
    cached = new S3ObjectStorage({
      bucket: env.OBJECT_STORAGE_BUCKET!,
      region: env.OBJECT_STORAGE_REGION,
      endpoint: env.OBJECT_STORAGE_ENDPOINT,
      accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY,
      secretAccessKey: env.OBJECT_STORAGE_SECRET_KEY,
    });
  } else {
    cached = new LocalObjectStorage(path.resolve(process.cwd(), env.OBJECT_STORAGE_ROOT));
  }
  return cached;
}

export function resetObjectStorageForTests() {
  cached = undefined;
}
