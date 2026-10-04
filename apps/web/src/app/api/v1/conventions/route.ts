import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  catalogErrorResponse,
  catalogResponseHeaders,
  listPublishedSnapshots,
} from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.CATALOG_DB) return catalogErrorResponse();
    const conventions = await listPublishedSnapshots(env.CATALOG_DB);
    return Response.json(
      { version: 1, conventions },
      { headers: catalogResponseHeaders() },
    );
  } catch {
    return catalogErrorResponse();
  }
}
