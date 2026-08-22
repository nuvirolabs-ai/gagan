import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  opaqueObjectKey,
  type ObjectStorage,
  type PutObjectInput,
  type StoredObject,
  validatePutInput,
} from "./objectStorage";

interface S3LikeClient {
  send(command: unknown): Promise<any>;
}

interface S3ObjectStorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  client?: S3LikeClient;
  sign?: (command: unknown, expiresInSeconds: number) => Promise<string>;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3LikeClient;
  private readonly sign: (command: unknown, expiresInSeconds: number) => Promise<string>;

  constructor(private readonly options: S3ObjectStorageOptions) {
    this.client = options.client ?? new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    });
    this.sign = options.sign ?? ((command, expiresInSeconds) => getSignedUrl(this.client as S3Client, command as any, { expiresIn: expiresInSeconds }));
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const checksum = validatePutInput(input);
    const objectKey = opaqueObjectKey(input.purpose);
    await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: objectKey,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: { checksum },
      ServerSideEncryption: "AES256",
    }));
    return { objectKey, checksum, contentType: input.contentType, sizeBytes: input.body.length };
  }

  async read(objectKey: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: objectKey }));
    if (!response.Body) throw new Error("Evidence object has no body");
    if (typeof response.Body.transformToByteArray === "function") {
      return Buffer.from(await response.Body.transformToByteArray());
    }
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async signedReadUrl(objectKey: string, expiresInSeconds: number) {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new Error("Signed URL expiry must be between 1 and 900 seconds");
    }
    return this.sign(new GetObjectCommand({ Bucket: this.options.bucket, Key: objectKey }), expiresInSeconds);
  }

  async delete(objectKey: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: objectKey }));
  }
}
