import "server-only";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" } as const;

export function noStoreJson(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { ...noStoreHeaders, ...headers },
  });
}
