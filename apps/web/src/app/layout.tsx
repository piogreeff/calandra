import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { availableThemes, defaultTheme, themeCookieName } from "../lib/theme";
import { FlyonuiScript } from "../components/FlyonuiScript";

export const metadata: Metadata = {
  metadataBase: new URL("https://calandra.pages.dev"),
  title: "Calandra",
  description:
    "Unofficial Path of Exile 2 companion for upgrades, crafting, economy, and snapshots.",
  applicationName: "Calandra",
};

const themeInitScript = `
  (function () {
    var allowedThemes = ${JSON.stringify(availableThemes)};
    function resolveTheme(value) {
      return allowedThemes.indexOf(value) === -1 ? "${defaultTheme}" : value;
    }

    var desktopTheme = window.__CALANDRA_INITIAL_THEME__;
    var match = document.cookie.match(/(?:^|; )${themeCookieName}=([^;]+)/);
    var cookieTheme = match ? decodeURIComponent(match[1]) : undefined;
    document.documentElement.setAttribute("data-theme", resolveTheme(desktopTheme || cookieTheme));
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme={defaultTheme} suppressHydrationWarning>
      <body className="calandra-shell overflow-x-hidden text-base-content antialiased">
        <Script id="calandra-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <FlyonuiScript />
        {children}
      </body>
    </html>
  );
}
