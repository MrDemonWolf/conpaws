"use client";

import { Toaster } from "@conpaws/ui/components/sonner";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      scriptProps={{ "data-cfasync": "false" }}
    >
      {children}
      <Toaster richColors />
    </ThemeProvider>
  );
}
