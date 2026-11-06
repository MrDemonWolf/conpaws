import type { Metadata } from "next";

import { DesignSystemPage } from "@/components/design-system-page";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "The colors, typography, components and accessibility principles behind the ConPaws website, with separate guidance for native platforms.",
  alternates: { canonical: "/design-system" },
};

export default function DesignSystem() {
  return <DesignSystemPage />;
}
