// Response helpers: every reply from ai-coach goes through here so the CORS
// headers and body shapes stay identical across the router and the lib modules.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** JSON reply: `{ ...body }` with CORS and a JSON content type. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Plain-text reply (the app's 400/413 validation errors are bare strings). */
export function textResponse(status: number, text: string): Response {
  return new Response(text, { status, headers: CORS_HEADERS });
}

/** Answer to the browser's CORS preflight. */
export function preflightResponse(): Response {
  return new Response('ok', { headers: CORS_HEADERS });
}
