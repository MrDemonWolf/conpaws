import {
  catalogErrorResponse,
  catalogResponseHeaders,
  listPublicPublishedSnapshots,
} from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conventions = await listPublicPublishedSnapshots();
    return Response.json(
      { version: 1, conventions },
      { headers: catalogResponseHeaders() },
    );
  } catch {
    return catalogErrorResponse();
  }
}
