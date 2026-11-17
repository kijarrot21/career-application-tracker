import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import {
  LOCALE_COOKIE_NAME,
  MARKET_CONFIGS,
  normalizeLocale,
} from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trackr ATS | Executive Precision Personal ATS",
  description:
    "Executive-grade personal career command center for discovering job opportunities, managing recruitment pipelines, and analyzing career outcomes.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var r=t==="dark"?"dark":"light";var d=document.documentElement;d.classList.remove("light","dark");d.classList.add(r);d.style.colorScheme=r}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const resolvedLocale = normalizeLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
  );
  const htmlLang = MARKET_CONFIGS[resolvedLocale].htmlLang;

  return (
    <html
      lang={htmlLang}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
