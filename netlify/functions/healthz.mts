// Netlify Function: health check. Mirrors the Express GET /api/healthz
// route so deploy previews have a quick way to confirm the API layer
// is reachable.

export default async (req: Request): Promise<Response> => {
  if (req.method !== "GET") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }
  return Response.json({ status: "ok" });
};

export const config = {
  path: "/api/healthz",
  method: "GET",
};
