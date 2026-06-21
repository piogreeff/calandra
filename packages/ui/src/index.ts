export const calandraThemeName = "calandra";

export const calandraThemeTokens = {
  "color-scheme": "dark",
  "--color-base-100": "#0d0b08",
  "--color-base-200": "#16130d",
  "--color-base-300": "#1f1a12",
  "--color-base-content": "#c8b88a",
  "--color-primary": "#c9a227",
  "--color-primary-content": "#0d0b08",
  "--color-secondary": "#786645",
  "--color-secondary-content": "#0d0b08",
  "--color-accent": "#1ba29b",
  "--color-accent-content": "#061615",
  "--color-neutral": "#3a352b",
  "--color-neutral-content": "#d8ccb0",
  "--color-info": "#6b88d6",
  "--color-info-content": "#080b13",
  "--color-success": "#73a857",
  "--color-success-content": "#081006",
  "--color-warning": "#c98927",
  "--color-warning-content": "#120b03",
  "--color-error": "#b74a35",
  "--color-error-content": "#120504",
  "--radius-selector": "0.375rem",
  "--radius-field": "0.375rem",
  "--radius-box": "0.5rem",
  "--size-selector": "0.25rem",
  "--size-field": "0.25rem",
  "--border": "1px",
  "--depth": "0",
  "--noise": "0",
} as const;

export const rarityTokens = {
  "--rarity-normal": "#c8c8c8",
  "--rarity-magic": "#8888ff",
  "--rarity-rare": "#ffff77",
  "--rarity-unique": "#af6025",
  "--rarity-gem": "#1ba29b",
  "--rarity-currency": "#aa9e82",
} as const;

export const flyonuiThemeNames = [
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
  "slack",
] as const;

export const availableThemeNames = [
  calandraThemeName,
  ...flyonuiThemeNames,
] as const;

export type CalandraThemeToken = keyof typeof calandraThemeTokens;
export type RarityToken = keyof typeof rarityTokens;
export type ThemeName = (typeof availableThemeNames)[number];
