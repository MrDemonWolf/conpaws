export function GET() {
  return Response.json(
    {
      ok: true,
      release: process.env.CONPAWS_RELEASE_SHA ?? "local",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
