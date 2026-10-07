import { NotFoundPage, notFoundMetadata } from "@/components/not-found-page";

export const dynamic = "force-dynamic";
export const metadata = notFoundMetadata;

export default function NotFoundRoute() {
  return <NotFoundPage />;
}
