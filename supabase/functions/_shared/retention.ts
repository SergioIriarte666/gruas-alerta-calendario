export const assertCronRequest = (req: Request): void => {
  const configured = Deno.env.get("CRON_SECRET")?.trim();
  const received = req.headers.get("x-cron-secret")?.trim();
  if (!configured || !received || configured !== received) {
    throw new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

