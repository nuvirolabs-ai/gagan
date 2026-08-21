import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import {
  opaqueObjectKey,
  ObjectStorageError,
  type ObjectStorage,
  type PutObjectInput,
  type StoredObject,
  validatePutInput,
} from "./objectStorage";

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDir: string) {}

  async put(input: PutObjectInput): Promise<StoredObject> {
    const checksum = validatePutInput(input);
    const objectKey = opaqueObjectKey(input.purpose);
    const path = this.pathFor(objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body, { flag: "wx" });
    return { objectKey, checksum, contentType: input.contentType, sizeBytes: input.body.length };
  }

  async read(objectKey: string) {
    return readFile(this.pathFor(objectKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") throw new ObjectStorageError("object_not_found", "Evidence object not found");
      throw error;
    });
  }

  async signedReadUrl(objectKey: string, expiresInSeconds: number) {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new ObjectStorageError("invalid_expiry", "Signed URL expiry must be between 1 and 900 seconds");
    }
    await this.read(objectKey);
    const token = Buffer.from(JSON.stringify({ objectKey, expiresAt: Date.now() + expiresInSeconds * 1000 })).toString("base64url");
    return `local-storage://${token}`;
  }

  async delete(objectKey: string) {
    await unlink(this.pathFor(objectKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  private pathFor(objectKey: string) {
    if (!objectKey || isAbsolute(objectKey) || objectKey.includes("\\") || objectKey.split("/").some((part) => part === ".." || part === "")) {
      throw new ObjectStorageError("invalid_object_key", "Evidence object key is invalid");
    }
    const path = join(this.rootDir, objectKey);
    const rel = relative(this.rootDir, path);
    if (rel.startsWith("..") || isAbsolute(rel)) throw new ObjectStorageError("invalid_object_key", "Evidence object key escapes storage root");
    return path;
  }
}
