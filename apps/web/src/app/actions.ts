"use server";

import { cookies } from "next/headers";
import { defaultTheme, isThemeName, themeCookieName, type ThemeName } from "../lib/theme";

export async function setThemePreference(theme: ThemeName): Promise<void> {
  const selectedTheme = isThemeName(theme) ? theme : defaultTheme;
  const cookieStore = await cookies();

  cookieStore.set(themeCookieName, selectedTheme, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}
