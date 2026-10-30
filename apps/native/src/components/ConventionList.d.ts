import type { ReactElement } from "react";
import type { ConventionListProps } from "./ConventionList.types";

/**
 * TypeScript resolves this extension-free import; Metro picks the real
 * `.ios.tsx` or `.android.tsx` implementation at runtime.
 */
export declare function ConventionList<T extends { id: string }>(
  props: ConventionListProps<T>,
): ReactElement;
