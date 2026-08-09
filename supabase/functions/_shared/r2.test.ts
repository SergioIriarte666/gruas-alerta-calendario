import {
  createR2DownloadUrl,
  deleteAndVerifyObjects,
  headVerifiedObject,
  putAndVerifyObject,
  type R2Config,
  type R2HttpClient,
  r2ObjectUrl,
  sha256Base64,
} from "./r2.ts";

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

const configWith = (client: R2HttpClient): R2Config => ({
  bucket: "archivo privado",
  endpoint: "https://account.r2.cloudflarestorage.com",
  client,
});

const requestUrl = (input: Request | { toString: () => string }): string =>
  input instanceof Request ? input.url : input.toString();

Deno.test("r2ObjectUrl codifica el bucket y cada segmento de la ruta", () => {
  const url = r2ObjectUrl(
    {
      endpoint: "https://account.r2.cloudflarestorage.com",
      bucket: "archivo privado",
    },
    "inspections/servicio 1/foto #1.jpg",
  );
  assert(
    url ===
      "https://account.r2.cloudflarestorage.com/archivo%20privado/inspections/servicio%201/foto%20%231.jpg",
    `URL inesperada: ${url}`,
  );
});

Deno.test("headVerifiedObject exige tamaño y checksum coincidentes", async () => {
  const client: R2HttpClient = {
    fetch: () =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "content-length": "4", "x-amz-meta-sha256": "hash-ok" },
        }),
      ),
    sign: (input) => Promise.resolve(new Request(requestUrl(input))),
  };
  const r2 = configWith(client);

  assert(
    await headVerifiedObject(r2, "a.txt", 4, "hash-ok"),
    "debería verificar el objeto",
  );
  assert(
    !await headVerifiedObject(r2, "a.txt", 5, "hash-ok"),
    "debería rechazar tamaño distinto",
  );
  assert(
    !await headVerifiedObject(r2, "a.txt", 4, "otro"),
    "debería rechazar checksum distinto",
  );
});

Deno.test("putAndVerifyObject sube bytes con metadatos y verifica por HEAD", async () => {
  const bytes = new TextEncoder().encode("hola");
  const expectedSha = await sha256Base64(bytes);
  const calls: Array<
    { method: string; headers: Headers; body: ArrayBuffer | null }
  > = [];
  let headCalls = 0;
  const client: R2HttpClient = {
    fetch: (_input, init = {}) => {
      const method = init.method || "GET";
      if (method === "HEAD") {
        headCalls += 1;
        if (headCalls === 1) {
          return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(
          new Response(null, {
            status: 200,
            headers: {
              "content-length": String(bytes.byteLength),
              "x-amz-meta-sha256": expectedSha,
            },
          }),
        );
      }
      calls.push({
        method,
        headers: new Headers(init.headers),
        body: init.body instanceof ArrayBuffer ? init.body : null,
      });
      return Promise.resolve(new Response(null, { status: 200 }));
    },
    sign: (input) => Promise.resolve(new Request(requestUrl(input))),
  };

  const result = await putAndVerifyObject(
    configWith(client),
    "inspections/1/a.txt",
    bytes,
    "text/plain",
    "inspection-pdfs",
    "1/a.txt",
  );

  assert(result.sha256 === expectedSha, "checksum devuelto incorrecto");
  assert(
    calls.length === 1 && calls[0].method === "PUT",
    "debería ejecutar un único PUT",
  );
  assert(
    calls[0].body?.byteLength === bytes.byteLength,
    "debería enviar el cuerpo completo",
  );
  assert(
    calls[0].headers.get("x-amz-meta-sha256") === expectedSha,
    "falta metadata sha256",
  );
});

Deno.test("deleteAndVerifyObjects borra claves únicas y confirma 404", async () => {
  const methods: string[] = [];
  const client: R2HttpClient = {
    fetch: (_input, init = {}) => {
      const method = init.method || "GET";
      methods.push(method);
      return Promise.resolve(
        new Response(null, { status: method === "HEAD" ? 404 : 204 }),
      );
    },
    sign: (input) => Promise.resolve(new Request(requestUrl(input))),
  };

  await deleteAndVerifyObjects(configWith(client), ["a", "a", "b"]);
  assert(
    methods.join(",") === "DELETE,DELETE,HEAD,HEAD",
    `secuencia inesperada: ${methods.join(",")}`,
  );
});

Deno.test("createR2DownloadUrl verifica existencia y limita expiración", async () => {
  let signedUrl = "";
  const client: R2HttpClient = {
    fetch: () =>
      Promise.resolve(
        new Response(null, { status: 200, headers: { "content-length": "1" } }),
      ),
    sign: (input) => {
      signedUrl = requestUrl(input);
      return Promise.resolve(new Request(`${signedUrl}&X-Amz-Signature=test`));
    },
  };

  const url = await createR2DownloadUrl(configWith(client), "a.txt", 999_999);
  assert(
    signedUrl.includes("X-Amz-Expires=604800"),
    `expiración inesperada: ${signedUrl}`,
  );
  assert(
    url.includes("X-Amz-Signature=test"),
    "debería devolver la URL firmada",
  );
});
