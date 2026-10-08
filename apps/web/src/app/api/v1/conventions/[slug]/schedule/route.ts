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
      {
        version: 1,
        conventionId: convention.id,
        slug: convention.slug,
        revision: convention.revision,
        timezone: convention.timezone,
        status: convention.scheduleStatus,
        sessions: convention.sessions,
      },
      { headers: catalogResponseHeaders() },
    );
  } catch {
    return catalogErrorResponse();
  }
}
