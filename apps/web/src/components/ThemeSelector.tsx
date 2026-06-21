"use client";

import { Palette } from "lucide-react";
import { useTransition } from "react";
import { setThemePreference } from "../app/actions";
import { availableThemes, type ThemeName } from "../lib/theme";

export function ThemeSelector({ selectedTheme }: { selectedTheme: ThemeName }) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-base-300 bg-base-200 px-3 text-sm text-base-content/75">
      <Palette className="size-4 text-primary" aria-hidden="true" />
      <span className="sr-only">Theme</span>
      <select
        className="bg-transparent text-sm outline-none"
        defaultValue={selectedTheme}
        aria-label="Theme"
        disabled={isPending}
        onChange={(event) => {
          const theme = event.currentTarget.value as ThemeName;
          document.documentElement.setAttribute("data-theme", theme);
          startTransition(() => {
            void setThemePreference(theme);
          });
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
