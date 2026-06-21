"use client";

import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { availableThemes, isThemeName, type ThemeName } from "../lib/theme";
import {
  persistThemePreference,
  readThemePreference,
} from "../lib/theme-persistence";

export function ThemeSelector({ selectedTheme }: { selectedTheme: ThemeName }) {
  const [theme, setTheme] = useState<ThemeName>(selectedTheme);

  useEffect(() => {
    let cancelled = false;

    void readThemePreference().then((persistedTheme) => {
      if (cancelled) return;

      document.documentElement.setAttribute("data-theme", persistedTheme);
      setTheme(persistedTheme);
    });

    return () => {
      cancelled = true;
    };
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
          setTheme(selected);
          void persistThemePreference(selected);
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
