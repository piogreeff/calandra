export const themeCookieName = "calandra-theme";

export const defaultTheme = "calandra";

export const availableThemes = [
  "calandra",
  "light",
  "dark",
  "corporate",
  "pastel",
  "black",
  "luxury",
  "ghibli",
  "gourmet",
  "marshmallow",
  "soft",
  "spotify",
  "valorant",
  "shadcn",
  "claude",
  "vscode",
  "mintlify",
  "perplexity",
  "slack"
] as const;

export type ThemeName = (typeof availableThemes)[number];

export function isThemeName(value: string): value is ThemeName {
  return availableThemes.includes(value as ThemeName);
}

export function resolveTheme(value: string | undefined): ThemeName {
  return value && isThemeName(value) ? value : defaultTheme;
}
