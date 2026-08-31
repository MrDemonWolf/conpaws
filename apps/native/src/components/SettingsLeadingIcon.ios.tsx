import {
  Bell,
  Bug,
  CircleHelp,
  Download,
  FileText,
  Globe,
  Hand,
  Info,
  type LucideIcon,
  Palette,
  Share,
} from "lucide-react-native";

import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";

import type {
  SettingsIconName,
  SettingsLeadingIconProps,
} from "./SettingsLeadingIcon.types";

/**
 * Lucide glyphs, rendered in JS.
 *
 * This is what Settings has always shipped, kept verbatim: SwiftUI's interop
 * hosts a React Native view in a `leading` slot without complaint, and the
 * glyphs are the ones the rest of the iOS chrome uses. Android cannot do this
 * -- see `SettingsLeadingIcon.android.tsx`.
 */
const GLYPHS: Record<SettingsIconName, LucideIcon> = {
  theme: Palette,
  language: Globe,
  notifications: Bell,
  export: Share,
  import: Download,
  about: Info,
  help: CircleHelp,
  privacy: Hand,
  terms: FileText,
  debug: Bug,
};

export function SettingsLeadingIcon({ name }: SettingsLeadingIconProps) {
  const scheme = useResolvedColorScheme();
  const Glyph = GLYPHS[name];
  return <Glyph size={21} color={themeTokens[scheme].foreground} />;
}
