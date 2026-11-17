"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Tooltip } from "radix-ui";
import { Toaster } from "sonner";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <Tooltip.Provider delayDuration={250}>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </Tooltip.Provider>
    </NextThemesProvider>
  );
}
