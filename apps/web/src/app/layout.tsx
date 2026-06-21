import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { defaultTheme, themeCookieName } from "../lib/theme";
import { FlyonuiScript } from "../components/FlyonuiScript";

export const metadata: Metadata = {
  metadataBase: new URL("https://calandra.pages.dev"),
  title: "Calandra",
  description: "Unofficial Path of Exile 2 companion for upgrades, crafting, economy, and snapshots.",
  applicationName: "Calandra"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme={defaultTheme} suppressHydrationWarning>
      <body className="calandra-shell overflow-x-hidden text-base-content antialiased">
        <Script id="calandra-theme-init" strategy="beforeInteractive">
          {`
            (function () {
              var match = document.cookie.match(/(?:^|; )${themeCookieName}=([^;]+)/);
              var theme = match ? decodeURIComponent(match[1]) : "${defaultTheme}";
              document.documentElement.setAttribute("data-theme", theme || "${defaultTheme}");
            })();
          `}
        </Script>
        <FlyonuiScript />
        {children}
      </body>
    </html>
  );
}
