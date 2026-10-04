import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  catalogErrorResponse,
  catalogResponseHeaders,
  getPublishedSnapshot,
} from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const [{ slug }, { env }] = await Promise.all([
      params,
      getCloudflareContext({ async: true }),
    ]);
    if (!env.CATALOG_DB) return catalogErrorResponse();
    const convention = await getPublishedSnapshot(env.CATALOG_DB, slug);
    if (!convention) return catalogErrorResponse(404);
    return Response.json(
      { version: 1, convention },
      { headers: catalogResponseHeaders() },
    );
  } catch {
    return catalogErrorResponse();
  }
}
