"use client";

import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import {
  availableThemes,
  isThemeName,
  resolveTheme,
  themeCookieName,
  type ThemeName,
} from "../lib/theme";

export function ThemeSelector({ selectedTheme }: { selectedTheme: ThemeName }) {
  const [theme, setTheme] = useState<ThemeName>(selectedTheme);

  useEffect(() => {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${themeCookieName}=([^;]+)`),
    );
    const cookieTheme = match ? decodeURIComponent(match[1] ?? "") : undefined;

    setTheme(resolveTheme(cookieTheme));
  }, []);

  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-base-300 bg-base-200 px-3 text-sm text-base-content/75">
      <Palette className="size-4 text-primary" aria-hidden="true" />
      <span className="sr-only">Theme</span>
      <select
        className="bg-transparent text-sm outline-none"
        value={theme}
        aria-label="Theme"
        onChange={(event) => {
          const selected = event.currentTarget.value;
          if (!isThemeName(selected)) return;

          document.documentElement.setAttribute("data-theme", selected);
          document.cookie = `${themeCookieName}=${encodeURIComponent(
            selected,
          )}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          setTheme(selected);
        }}
      >
        {availableThemes.map((theme) => (
          <option key={theme} value={theme}>
            {theme}
          </option>
        ))}
      </select>
    </label>
  );
}
