import { AwsClient } from "npm:aws4fetch@1.0.20";

type AwsRequestInit = RequestInit & {
  aws?: {
    signQuery?: boolean;
  };
};

export type R2HttpClient = {
  fetch(
    input: Request | { toString: () => string },
    init?: AwsRequestInit,
  ): Promise<Response>;
  sign(
    input: Request | { toString: () => string },
    init?: AwsRequestInit,
  ): Promise<Request>;
};

export type R2Config = {
  bucket: string;
  endpoint: string;
  client: R2HttpClient;
};

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Falta el secret ${name}`);
  return value;
};

export const createR2Config = (): R2Config => {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const bucket = Deno.env.get("R2_BUCKET_NAME")?.trim() ||
    Deno.env.get("R2_BUCKET")?.trim();
  if (!bucket) {
    throw new Error("Falta el secret R2_BUCKET_NAME (o R2_BUCKET legado)");
  }
  return {
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    client: new AwsClient({
      service: "s3",
      region: "auto",
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
      retries: 2,
    }),
  };
};

const encodeObjectKey = (key: string): string =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const r2ObjectUrl = (
  r2: Pick<R2Config, "endpoint" | "bucket">,
  key: string,
): string => {
  if (!key || key.includes("..") || key.startsWith("/")) {
    throw new Error(`Ruta R2 inválida: ${key || "(vacía)"}`);
  }
  return `${r2.endpoint}/${encodeURIComponent(r2.bucket)}/${
    encodeObjectKey(key)
  }`;
};

const responseError = async (
  operation: string,
  key: string,
  response: Response,
): Promise<Error> => {
  const detail = (await response.text().catch(() => ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return new Error(
    `R2 rechazó ${operation} para ${key} (HTTP ${response.status})${
      detail ? `: ${detail}` : ""
    }`,
  );
};

const requireOk = async (
  operation: string,
  key: string,
  response: Response,
): Promise<void> => {
  if (!response.ok) throw await responseError(operation, key, response);
};

export const sha256Base64 = async (bytes: Uint8Array): Promise<string> => {
  const digestInput = Uint8Array.from(bytes);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", digestInput),
  );
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
  const response = await r2.client.fetch(r2ObjectUrl(r2, key), {
    method: "HEAD",
  });
  if (response.status === 404) return false;
  await requireOk("HEAD", key, response);

  const size = Number(response.headers.get("content-length"));
  if (!Number.isFinite(size) || size !== expectedSize) return false;
  return !expectedSha256 ||
    response.headers.get("x-amz-meta-sha256") === expectedSha256;
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
  const alreadyPresent = await headVerifiedObject(
    r2,
    key,
    bytes.byteLength,
    sha256,
  );
  if (!alreadyPresent) {
    const body = Uint8Array.from(bytes).buffer;
    const response = await r2.client.fetch(r2ObjectUrl(r2, key), {
      method: "PUT",
      headers: {
        "content-type": contentType || "application/octet-stream",
        "x-amz-meta-sha256": sha256,
        "x-amz-meta-source-bucket": sourceBucket,
        "x-amz-meta-source-path": encodeURIComponent(sourcePath),
      },
      body,
    });
    await requireOk("PUT", key, response);
  }

  if (!await headVerifiedObject(r2, key, bytes.byteLength, sha256)) {
    throw new Error(`R2 no confirmó tamaño/checksum para ${key}`);
  }
  return { size: bytes.byteLength, sha256 };
};

export const deleteAndVerifyObjects = async (
  r2: R2Config,
  keys: string[],
): Promise<void> => {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  for (const key of uniqueKeys) {
    const response = await r2.client.fetch(r2ObjectUrl(r2, key), {
      method: "DELETE",
    });
    await requireOk("DELETE", key, response);
  }

  for (const key of uniqueKeys) {
    const response = await r2.client.fetch(r2ObjectUrl(r2, key), {
      method: "HEAD",
    });
    if (response.status !== 404) {
      if (!response.ok) {
        throw await responseError("verificación de borrado", key, response);
      }
      throw new Error(`R2 todavía contiene ${key} después del borrado`);
    }
  }
};

export const createR2DownloadUrl = async (
  r2: R2Config,
  key: string,
  expiresIn = 3600,
): Promise<string> => {
  const objectUrl = r2ObjectUrl(r2, key);
  const head = await r2.client.fetch(objectUrl, { method: "HEAD" });
  await requireOk("HEAD", key, head);

  const safeExpiry = Math.min(Math.max(Math.trunc(expiresIn), 1), 604_800);
  const signed = await r2.client.sign(
    new Request(`${objectUrl}?X-Amz-Expires=${safeExpiry}`),
    { aws: { signQuery: true } },
  );
  return signed.url;
};
