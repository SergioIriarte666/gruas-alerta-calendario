import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@3.828.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.828.0";

export type R2Config = {
  bucket: string;
  client: S3Client;
};

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta el secret ${name}`);
  return value;
};

export const createR2Config = (): R2Config => {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = Deno.env.get("R2_BUCKET_NAME")?.trim() || Deno.env.get("R2_BUCKET")?.trim();
  if (!bucket) throw new Error("Falta el secret R2_BUCKET_NAME (o R2_BUCKET legado)");
  return {
    bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      },
    }),
  };
};

export const sha256Base64 = async (bytes: Uint8Array): Promise<string> => {
  const digestInput = Uint8Array.from(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", digestInput));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const headVerifiedObject = async (
  r2: R2Config,
  key: string,
  expectedSize: number,
  expectedSha256?: string,
): Promise<boolean> => {
  try {
    const head = await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    if (head.ContentLength !== expectedSize) return false;
    return !expectedSha256 || head.Metadata?.sha256 === expectedSha256;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
};

export const putAndVerifyObject = async (
  r2: R2Config,
  key: string,
  bytes: Uint8Array,
  contentType: string,
  sourceBucket: string,
  sourcePath: string,
): Promise<{ size: number; sha256: string }> => {
  const sha256 = await sha256Base64(bytes);
  const alreadyPresent = await headVerifiedObject(r2, key, bytes.byteLength, sha256);
  if (!alreadyPresent) {
    await r2.client.send(new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: bytes,
      ContentLength: bytes.byteLength,
      ContentType: contentType || "application/octet-stream",
      Metadata: {
        sha256,
        "source-bucket": sourceBucket,
        "source-path": encodeURIComponent(sourcePath),
      },
    }));
  }

  if (!await headVerifiedObject(r2, key, bytes.byteLength, sha256)) {
    throw new Error(`R2 no confirmó tamaño/checksum para ${key}`);
  }
  return { size: bytes.byteLength, sha256 };
};

export const deleteAndVerifyObjects = async (r2: R2Config, keys: string[]): Promise<void> => {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  if (uniqueKeys.length === 0) return;

  for (let offset = 0; offset < uniqueKeys.length; offset += 1000) {
    const chunk = uniqueKeys.slice(offset, offset + 1000);
    const result = await r2.client.send(new DeleteObjectsCommand({
      Bucket: r2.bucket,
      Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: false },
    }));
    if (result.Errors?.length) {
      throw new Error(`R2 rechazó el borrado de: ${result.Errors.map((e) => e.Key).join(", ")}`);
    }
    for (const key of chunk) {
      try {
        await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
        throw new Error(`R2 todavía contiene ${key} después del borrado`);
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status !== 404) throw error;
      }
    }
  }
};

export const createR2DownloadUrl = async (
  r2: R2Config,
  key: string,
  expiresIn = 3600,
): Promise<string> => {
  // Firmar no consulta R2; HEAD evita entregar una URL aparentemente válida a un objeto ausente.
  await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
  return getSignedUrl(
    r2.client,
    new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
    { expiresIn },
  );
};
