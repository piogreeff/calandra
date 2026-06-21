import {
  availableThemeNames,
  calandraThemeName,
  type ThemeName,
} from "@calandra/ui";

export const themeCookieName = "calandra-theme";

export const themeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export const defaultTheme = calandraThemeName;

export const availableThemes = availableThemeNames;

export type { ThemeName };

export function isThemeName(value: string): value is ThemeName {
  return availableThemes.includes(value as ThemeName);
}

export function resolveTheme(value: string | undefined): ThemeName {
  return value && isThemeName(value) ? value : defaultTheme;
}
