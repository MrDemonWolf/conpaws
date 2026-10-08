import {
  catalogErrorResponse,
  catalogResponseHeaders,
  getPublicPublishedSnapshot,
} from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const convention = await getPublicPublishedSnapshot(slug);
    if (!convention) return catalogErrorResponse(404);
    return Response.json(
      { version: 1, convention },
      { headers: catalogResponseHeaders() },
    );
  } catch {
    return catalogErrorResponse();
  }
}
